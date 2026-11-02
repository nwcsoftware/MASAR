import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/features/auth/session';
import { mockDb, mockQuery } from '@/mocks/db';
import type { CompanySettings, Holiday, Profile, Vehicle } from '@/mocks/fixtures';
import type { CompanyRulesValues } from './schema';

export const companyKeys = {
  settings: (companyId: string) => ['company', companyId, 'settings'] as const,
  users: (companyId: string) => ['company', companyId, 'users'] as const,
  holidays: (companyId: string) => ['company', companyId, 'holidays'] as const,
  vehicles: (companyId: string) => ['company', companyId, 'vehicles'] as const,
};

export function useCompanySettings() {
  const { profile } = useCurrentUser();
  const companyId = profile.company_id ?? '';
  return useQuery({
    queryKey: companyKeys.settings(companyId),
    queryFn: () => mockQuery<CompanySettings | null>(() => mockDb.companySettings, null),
  });
}

/** Owner/admin only (RLS: company_settings R/W for owner/admin). */
export function useUpdateCompanyRules() {
  const { profile } = useCurrentUser();
  const companyId = profile.company_id ?? '';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: CompanyRulesValues) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      Object.assign(mockDb.companySettings, values, { updated_at: new Date().toISOString() });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: companyKeys.settings(companyId) }),
  });
}

export type CompanyUser = Profile & { siteIds: string[] };

export function useCompanyUsers() {
  const { profile } = useCurrentUser();
  const companyId = profile.company_id ?? '';
  return useQuery({
    queryKey: companyKeys.users(companyId),
    queryFn: () =>
      mockQuery<CompanyUser[]>(
        () => mockDb.profiles.map((p) => ({ ...p, siteIds: mockDb.userSites[p.id] ?? [] })),
        [],
      ),
  });
}

export function useHolidays() {
  const { profile } = useCurrentUser();
  const companyId = profile.company_id ?? '';
  return useQuery({
    queryKey: companyKeys.holidays(companyId),
    queryFn: () => mockQuery<Holiday[]>(() => [...mockDb.holidays].sort((a, b) => a.date.localeCompare(b.date)), []),
  });
}

export function useVehicles() {
  const { profile } = useCurrentUser();
  const companyId = profile.company_id ?? '';
  return useQuery({
    queryKey: companyKeys.vehicles(companyId),
    queryFn: () => mockQuery<Vehicle[]>(() => mockDb.vehicles, []),
  });
}
