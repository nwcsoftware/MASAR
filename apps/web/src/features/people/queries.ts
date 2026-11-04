import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/features/auth/session';
import { AppError, db, unwrap, useDualMutation, useLiveData } from '@/lib/data-source';
import type { Json, TablesInsert } from '@/lib/database.types';
import { mockDb, mockQuery } from '@/mocks/db';
import type { Person } from '@/mocks/fixtures';
import type { ImportRow, PersonValues } from './schema';

export const peopleKeys = {
  all: (companyId: string) => ['people', companyId] as const,
};

/** The staff directory (RLS: staff and viewers; drivers see none). */
export function usePeople() {
  const { profile } = useCurrentUser();
  const live = useLiveData();
  return useQuery({
    queryKey: peopleKeys.all(profile.company_id ?? ''),
    queryFn: async () =>
      live
        ? (unwrap(await db().from('people').select('*').order('full_name').limit(10_000)) ?? [])
        : mockQuery<Person[]>(() => [...mockDb.people].sort((a, b) => a.full_name.localeCompare(b.full_name)), []),
  });
}

function personRow(values: PersonValues, companyId: string): TablesInsert<'people'> {
  return {
    company_id: companyId,
    full_name: values.full_name,
    full_name_ar: values.full_name_ar || null,
    employee_no: values.employee_no || null,
    grade: values.grade,
    job_title: values.job_title || null,
    department: values.department || null,
    site_id: values.site_id || null,
    phone: values.phone || null,
    email: values.email || null,
    is_active: values.is_active,
  };
}

/** Add or edit a person (wizard "new person" popup, staff page). Resolves the saved row. */
export function useSavePerson() {
  const user = useCurrentUser();
  const companyId = user.profile.company_id ?? '';
  return useDualMutation<{ id?: string; values: PersonValues }, Person>({
    live: async ({ id, values }) => {
      const row = personRow(values, companyId);
      const result = id
        ? await db().from('people').update(row).eq('id', id).select('*').single()
        : await db().from('people').insert({ ...row, created_by: user.id }).select('*').single();
      if (result.error?.code === '23505') throw new AppError(result.error.message, 'people.errors.employeeNoExists');
      return unwrap(result)!;
    },
    mock: ({ id, values }) => {
      const row = personRow(values, companyId);
      if (row.employee_no && mockDb.people.some((p) => p.employee_no === row.employee_no && p.id !== id)) {
        throw new AppError('duplicate', 'people.errors.employeeNoExists');
      }
      const now = new Date().toISOString();
      const existing = id ? mockDb.people.find((p) => p.id === id) : undefined;
      if (existing) {
        Object.assign(existing, row, { updated_at: now });
        return existing;
      }
      const person: Person = {
        ...row,
        id: crypto.randomUUID(),
        company_id: companyId,
        full_name_ar: row.full_name_ar ?? null,
        employee_no: row.employee_no ?? null,
        grade: row.grade ?? null,
        job_title: row.job_title ?? null,
        department: row.department ?? null,
        site_id: row.site_id ?? null,
        phone: row.phone ?? null,
        email: row.email ?? null,
        is_active: row.is_active ?? true,
        notes: null,
        source: 'manual',
        profile_id: null,
        registration_status: null,
        registration_note: null,
        photo_url: null,
        language: 'en',
        accessibility_needs: null,
        ride_preferences: [],
        created_by: user.id,
        created_at: now,
        updated_at: now,
      };
      mockDb.people.push(person);
      return person;
    },
    invalidate: () => [peopleKeys.all(companyId)],
  });
}

/** Excel import (rpc_import_people): upsert by employee number. */
export function useImportPeople() {
  const user = useCurrentUser();
  const companyId = user.profile.company_id ?? '';
  return useDualMutation<ImportRow[], { inserted: number; updated: number }>({
    live: async (rows) => unwrap(await db().rpc('rpc_import_people', { p_rows: rows as unknown as Json })) as { inserted: number; updated: number },
    mock: (rows) => {
      let inserted = 0;
      let updated = 0;
      const now = new Date().toISOString();
      for (const r of rows) {
        const site = r.site
          ? mockDb.sites.find((s) => s.code?.toUpperCase() === r.site!.toUpperCase() || s.name.toLowerCase() === r.site!.toLowerCase() || s.name_ar === r.site)
          : undefined;
        const existing = r.employee_no ? mockDb.people.find((p) => p.employee_no === r.employee_no) : undefined;
        if (existing) {
          Object.assign(existing, {
            full_name: r.full_name,
            full_name_ar: r.full_name_ar ?? existing.full_name_ar,
            grade: r.grade ?? existing.grade,
            job_title: r.job_title ?? existing.job_title,
            department: r.department ?? existing.department,
            site_id: site?.id ?? existing.site_id,
            phone: r.phone ?? existing.phone,
            email: r.email || existing.email,
            is_active: true,
            updated_at: now,
          });
          updated++;
        } else {
          mockDb.people.push({
            id: crypto.randomUUID(),
            company_id: companyId,
            employee_no: r.employee_no ?? null,
            full_name: r.full_name,
            full_name_ar: r.full_name_ar ?? null,
            grade: r.grade ?? null,
            job_title: r.job_title ?? null,
            department: r.department ?? null,
            site_id: site?.id ?? null,
            phone: r.phone ?? null,
            email: r.email || null,
            is_active: true,
            notes: null,
            source: 'import',
            profile_id: null,
            registration_status: null,
            registration_note: null,
            photo_url: null,
            language: 'en',
            accessibility_needs: null,
            ride_preferences: [],
            created_by: user.id,
            created_at: now,
            updated_at: now,
          });
          inserted++;
        }
      }
      return { inserted, updated };
    },
    invalidate: () => [peopleKeys.all(companyId)],
  });
}
