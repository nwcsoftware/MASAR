import { useQuery } from '@tanstack/react-query';
import { inviteOwnerInput, inviteOwnerOutput, type InviteOwnerOutput } from '@shared/schemas';
import { useCurrentUser } from '@/features/auth/session';
import { AppError, db, invokeFunction, unwrap, useDualMutation, useLiveData } from '@/lib/data-source';
import type { Database } from '@/lib/database.types';
import { mockDb, mockQuery } from '@/mocks/db';
import type { Company } from '@/mocks/fixtures';
import type { NewCompanyValues, OwnerInviteValues } from './schema';

/** One row of rpc_platform_companies (0008): company + owner + counts, never company data. */
export type PlatformCompany = Database['public']['Functions']['rpc_platform_companies']['Returns'][number];

export const platformKeys = {
  companies: (userId: string) => ['platform', userId, 'companies'] as const,
};

/** Demo mirror of rpc_platform_companies: the demo company + the other tenants. */
export function mockPlatformCompanies(): PlatformCompany[] {
  const own = mockDb.company;
  const owner = mockDb.profiles.find((p) => p.role === 'owner' && p.company_id === own.id);
  const rows: PlatformCompany[] = [
    {
      id: own.id,
      name: own.name,
      name_ar: own.name_ar,
      country_code: own.country_code,
      timezone: own.timezone,
      default_language: own.default_language,
      created_at: own.created_at,
      owner_id: owner?.id ?? null,
      owner_name: owner?.full_name ?? null,
      owner_email: owner?.email ?? null,
      owner_pending: owner ? false : null,
      site_count: mockDb.sites.length,
      user_count: mockDb.profiles.filter((p) => p.company_id === own.id && p.role !== 'passenger').length,
    },
    ...mockDb.otherCompanies.map(({ company: c, owner: o, site_count, user_count }) => ({
      id: c.id,
      name: c.name,
      name_ar: c.name_ar,
      country_code: c.country_code,
      timezone: c.timezone,
      default_language: c.default_language,
      created_at: c.created_at,
      owner_id: o ? c.id : null,
      owner_name: o?.full_name ?? null,
      owner_email: o?.email ?? null,
      owner_pending: o ? o.pending : null,
      site_count,
      user_count,
    })),
  ];
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function allMockEmails(): string[] {
  return [
    ...mockDb.profiles.map((p) => p.email),
    ...mockDb.platformAdmins.map((p) => p.email),
    ...mockDb.otherCompanies.map((c) => c.owner?.email),
  ].filter((e): e is string => Boolean(e));
}

/** Companies list for the super admin console. */
export function usePlatformCompanies() {
  const { id } = useCurrentUser();
  const live = useLiveData();
  return useQuery({
    queryKey: platformKeys.companies(id),
    queryFn: async () => (live ? (unwrap(await db().rpc('rpc_platform_companies')) ?? []) : mockQuery(mockPlatformCompanies, [])),
  });
}

/** Demo mirror of the invite-owner Edge Function. */
function mockInviteOwner(companyId: string, values: OwnerInviteValues): InviteOwnerOutput {
  const entry = mockDb.otherCompanies.find((c) => c.company.id === companyId);
  if (!entry) throw new AppError('unknown company', companyId === mockDb.company.id ? 'platform.errors.ownerInCompany' : 'platform.errors.unknownCompany');
  if (entry.owner?.email !== values.owner_email && allMockEmails().includes(values.owner_email)) {
    throw new AppError('exists', 'platform.errors.ownerInCompany');
  }
  entry.owner = { full_name: values.owner_name, email: values.owner_email, pending: true };
  entry.user_count = Math.max(entry.user_count, 1);
  return { user_id: crypto.randomUUID(), existing: false };
}

/**
 * FR-01 — create a company (rpc_platform_create_company) and invite its owner
 * (invite-owner). If the invite fails the company still exists; the console
 * shows it without an owner and offers "Invite owner" again.
 */
export function useCreatePlatformCompany() {
  const { id } = useCurrentUser();
  return useDualMutation<NewCompanyValues, { company: Company; invite: InviteOwnerOutput }>({
    live: async (values) => {
      const company = unwrap(
        await db().rpc('rpc_platform_create_company', {
          p_name: values.name,
          p_name_ar: values.name_ar || undefined,
          p_country_code: values.country_code,
          p_timezone: values.timezone,
          p_default_language: values.default_language,
        }),
      );
      if (!company) throw new AppError('rpc_platform_create_company returned no row');
      const invite = inviteOwnerOutput.parse(
        await invokeFunction(
          'invite-owner',
          inviteOwnerInput.parse({ company_id: company.id, email: values.owner_email, full_name: values.owner_name, language: values.default_language }),
        ),
      );
      return { company, invite };
    },
    mock: (values) => {
      if (allMockEmails().includes(values.owner_email)) throw new AppError('exists', 'platform.errors.ownerInCompany');
      const now = new Date().toISOString();
      const company: Company = {
        id: crypto.randomUUID(),
        name: values.name.trim(),
        name_ar: values.name_ar?.trim() || null,
        country_code: values.country_code.toUpperCase(),
        timezone: values.timezone,
        default_language: values.default_language,
        logo_url: null,
        created_at: now,
        updated_at: now,
      };
      mockDb.otherCompanies.push({ company, owner: null, site_count: 0, user_count: 0 });
      return { company, invite: mockInviteOwner(company.id, values) };
    },
    invalidate: () => [platformKeys.companies(id)],
  });
}

/** Invite (or re-invite) the owner of a company that has none yet. */
export function useInviteOwner() {
  const { id } = useCurrentUser();
  return useDualMutation<{ companyId: string; language: 'en' | 'ar'; values: OwnerInviteValues }, InviteOwnerOutput>({
    live: async ({ companyId, language, values }) =>
      inviteOwnerOutput.parse(
        await invokeFunction('invite-owner', inviteOwnerInput.parse({ company_id: companyId, email: values.owner_email, full_name: values.owner_name, language })),
      ),
    mock: ({ companyId, values }) => mockInviteOwner(companyId, values),
    invalidate: () => [platformKeys.companies(id)],
  });
}
