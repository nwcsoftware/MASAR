import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/features/auth/session';
import { AppError, db, unwrap, useDualMutation, useLiveData } from '@/lib/data-source';
import type { Json } from '@/lib/database.types';
import { mockDb, mockQuery } from '@/mocks/db';
import type { GradeGroup } from '@/mocks/fixtures';
import { gradeGroupsSchema, type GradeGroupsValues } from './schema';

export const gradeKeys = {
  groups: (companyId: string) => ['grades', companyId] as const,
};

/** The company's grade groups, most senior (A) first. Empty = grade rules off. */
export function useGradeGroups() {
  const { profile } = useCurrentUser();
  const live = useLiveData();
  return useQuery({
    queryKey: gradeKeys.groups(profile.company_id ?? ''),
    queryFn: async () =>
      live
        ? (unwrap(await db().from('grade_groups').select('*').order('rank')) ?? [])
        : mockQuery<GradeGroup[]>(() => [...mockDb.gradeGroups].sort((a, b) => a.rank - b.rank), []),
  });
}

/** Replace the groups (rpc_set_grade_groups, admin). Codes that survive keep their id. */
export function useSetGradeGroups() {
  const { profile } = useCurrentUser();
  const companyId = profile.company_id ?? '';
  return useDualMutation<GradeGroupsValues, void>({
    live: async (values) => {
      unwrap(await db().rpc('rpc_set_grade_groups', { p_groups: values.groups as unknown as Json }));
    },
    mock: (values) => {
      const parsed = gradeGroupsSchema.safeParse(values);
      if (!parsed.success) throw new AppError(parsed.error.issues[0]!.message);
      const now = new Date().toISOString();
      mockDb.gradeGroups = parsed.data.groups.map((g, i) => ({
        id: mockDb.gradeGroups.find((x) => x.code === g.code)?.id ?? crypto.randomUUID(),
        company_id: companyId,
        code: g.code,
        name: g.name || null,
        name_ar: g.name_ar || null,
        rank: i + 1,
        min_grade: g.min_grade,
        max_grade: g.max_grade,
        created_at: now,
      }));
      // on delete set null
      const ids = new Set(mockDb.gradeGroups.map((g) => g.id));
      for (const v of mockDb.vehicles) if (v.grade_group_id && !ids.has(v.grade_group_id)) v.grade_group_id = null;
      for (const d of mockDb.drivers) if (d.serve_group_id && !ids.has(d.serve_group_id)) d.serve_group_id = null;
    },
    invalidate: () => [gradeKeys.groups(companyId), ['company', companyId], ['drivers', companyId], ['people', companyId]],
  });
}
