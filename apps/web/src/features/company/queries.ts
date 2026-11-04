import { useQuery } from '@tanstack/react-query';
import { inviteUserInput, inviteUserOutput, type InviteUserInput, type InviteUserOutput } from '@shared/schemas';
import { useCurrentUser, useSessionApi } from '@/features/auth/session';
import { AppError, db, invokeFunction, unwrap, useDualMutation, useLiveData } from '@/lib/data-source';
import { mockDb, mockQuery } from '@/mocks/db';
import type { CompanySettings, Holiday, Profile, Vehicle } from '@/mocks/fixtures';
import type { CompanyProfileValues, CompanyRulesValues, HolidayValues, UserAccessValues, VehicleValues } from './schema';

export const companyKeys = {
  settings: (companyId: string) => ['company', companyId, 'settings'] as const,
  users: (companyId: string) => ['company', companyId, 'users'] as const,
  holidays: (companyId: string) => ['company', companyId, 'holidays'] as const,
  vehicles: (companyId: string) => ['company', companyId, 'vehicles'] as const,
};

// ---------------------------------------------------------------------------
// reads
// ---------------------------------------------------------------------------
export function useCompanySettings() {
  const { profile } = useCurrentUser();
  const live = useLiveData();
  return useQuery({
    queryKey: companyKeys.settings(profile.company_id ?? ''),
    queryFn: async () =>
      live
        ? unwrap(await db().from('company_settings').select('*').maybeSingle())
        : mockQuery<CompanySettings | null>(() => mockDb.companySettings, null),
  });
}

export type CompanyUser = Profile & { siteIds: string[]; driverId: string | null };

export function useCompanyUsers() {
  const { profile } = useCurrentUser();
  const live = useLiveData();
  return useQuery({
    queryKey: companyKeys.users(profile.company_id ?? ''),
    queryFn: async (): Promise<CompanyUser[]> => {
      if (!live) {
        return mockQuery(
          () =>
            mockDb.profiles.filter((p) => p.role !== 'passenger').map((p) => ({
              ...p,
              siteIds: mockDb.userSites[p.id] ?? [],
              driverId: mockDb.drivers.find((d) => d.profile_id === p.id)?.id ?? null,
            })),
          [],
        );
      }
      const [profiles, scopes, drivers] = await Promise.all([
        db().from('profiles').select('*').order('full_name'),
        db().from('user_sites').select('user_id, site_id'),
        db().from('drivers').select('id, profile_id').not('profile_id', 'is', null),
      ]);
      const sites = unwrap(scopes) ?? [];
      const driverRows = unwrap(drivers) ?? [];
      // passengers are managed under Staff, not as console users
      return (unwrap(profiles) ?? []).filter((p) => p.role !== 'passenger').map((p) => ({
        ...p,
        siteIds: sites.filter((s) => s.user_id === p.id).map((s) => s.site_id),
        driverId: driverRows.find((d) => d.profile_id === p.id)?.id ?? null,
      }));
    },
  });
}

export function useHolidays() {
  const { profile } = useCurrentUser();
  const live = useLiveData();
  return useQuery({
    queryKey: companyKeys.holidays(profile.company_id ?? ''),
    queryFn: async () =>
      live
        ? (unwrap(await db().from('holidays').select('*').order('date')) ?? [])
        : mockQuery<Holiday[]>(() => [...mockDb.holidays].sort((a, b) => a.date.localeCompare(b.date)), []),
  });
}

export function useVehicles() {
  const { profile } = useCurrentUser();
  const live = useLiveData();
  return useQuery({
    queryKey: companyKeys.vehicles(profile.company_id ?? ''),
    queryFn: async () =>
      live
        ? (unwrap(await db().from('vehicles').select('*').order('plate_no')) ?? [])
        : mockQuery<Vehicle[]>(() => [...mockDb.vehicles].sort((a, b) => a.plate_no.localeCompare(b.plate_no)), []),
  });
}

// ---------------------------------------------------------------------------
// writes
// ---------------------------------------------------------------------------
function useCompanyId() {
  return useCurrentUser().profile.company_id ?? '';
}

export function useUpdateCompany() {
  const companyId = useCompanyId();
  const { refresh } = useSessionApi();
  return useDualMutation<CompanyProfileValues, void>({
    live: async (values) => {
      unwrap(
        await db()
          .from('companies')
          .update({
            name: values.name,
            name_ar: values.name_ar || null,
            country_code: values.country_code,
            timezone: values.timezone,
            default_language: values.default_language,
          })
          .eq('id', companyId),
      );
      if (values.eastern_arabic_digits !== undefined) {
        unwrap(await db().from('company_settings').update({ eastern_arabic_digits: values.eastern_arabic_digits }).eq('company_id', companyId));
      }
      await refresh();
    },
    mock: (values) => {
      Object.assign(mockDb.company, {
        name: values.name,
        name_ar: values.name_ar || null,
        country_code: values.country_code,
        timezone: values.timezone,
        default_language: values.default_language,
      });
      if (values.eastern_arabic_digits !== undefined) mockDb.companySettings.eastern_arabic_digits = values.eastern_arabic_digits;
    },
    invalidate: () => [['session'], companyKeys.settings(companyId)],
  });
}

/** Owner/admin only (RLS: company_settings R/W for owner/admin). */
export function useUpdateCompanyRules() {
  const companyId = useCompanyId();
  return useDualMutation<CompanyRulesValues, void>({
    live: async (values) => {
      unwrap(await db().from('company_settings').update(values).eq('company_id', companyId));
    },
    mock: (values) => {
      Object.assign(mockDb.companySettings, values, { updated_at: new Date().toISOString() });
    },
    invalidate: () => [companyKeys.settings(companyId)],
  });
}

export function useAddHoliday() {
  const companyId = useCompanyId();
  return useDualMutation<HolidayValues, void>({
    live: async (values) => {
      unwrap(await db().from('holidays').insert({ company_id: companyId, date: values.date, name: values.name, name_ar: values.name_ar || null }));
    },
    mock: (values) => {
      if (mockDb.holidays.some((h) => h.date === values.date)) throw new AppError('duplicate', 'settings.errors.holidayExists');
      mockDb.holidays.push({ id: crypto.randomUUID(), company_id: companyId, date: values.date, name: values.name, name_ar: values.name_ar || null });
    },
    invalidate: () => [companyKeys.holidays(companyId)],
  });
}

export function useDeleteHoliday() {
  const companyId = useCompanyId();
  return useDualMutation<string, void>({
    live: async (id) => {
      unwrap(await db().from('holidays').delete().eq('id', id));
    },
    mock: (id) => {
      mockDb.holidays = mockDb.holidays.filter((h) => h.id !== id);
    },
    invalidate: () => [companyKeys.holidays(companyId)],
  });
}

/** FR-05 — vehicles_write is staff. */
export function useSaveVehicle() {
  const companyId = useCompanyId();
  return useDualMutation<{ id?: string; values: VehicleValues }, void>({
    live: async ({ id, values }) => {
      const row = { company_id: companyId, ...values, site_id: values.site_id || null, grade_group_id: values.grade_group_id || null, make: values.make || null, model: values.model || null, color: values.color || null, notes: values.notes || null };
      unwrap(id ? await db().from('vehicles').update(row).eq('id', id) : await db().from('vehicles').insert(row));
    },
    mock: ({ id, values }) => {
      const now = new Date().toISOString();
      const row = { ...values, site_id: values.site_id || null, grade_group_id: values.grade_group_id || null, make: values.make || null, model: values.model || null, color: values.color || null, notes: values.notes || null };
      if (mockDb.vehicles.some((v) => v.plate_no === values.plate_no && v.id !== id)) throw new AppError('duplicate', 'vehicles.errors.plateExists');
      if (id) {
        const existing = mockDb.vehicles.find((v) => v.id === id);
        if (existing) Object.assign(existing, row, { updated_at: now });
      } else {
        mockDb.vehicles.push({ ...row, id: crypto.randomUUID(), company_id: companyId, created_at: now, updated_at: now });
      }
    },
    invalidate: () => [companyKeys.vehicles(companyId), ['sites', companyId]],
  });
}

/** FR-04 — invite-user Edge Function (service role) after the caller is authorised. */
export function useInviteUser() {
  const companyId = useCompanyId();
  return useDualMutation<InviteUserInput, InviteUserOutput>({
    live: async (input) => inviteUserOutput.parse(await invokeFunction('invite-user', inviteUserInput.parse(input))),
    mock: (raw) => {
      const input = inviteUserInput.parse(raw);
      if (mockDb.profiles.some((p) => p.email === input.email)) throw new AppError('exists', 'users.errors.alreadyRegistered');
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      mockDb.profiles.push({
        id,
        company_id: companyId,
        role: input.role,
        full_name: input.full_name,
        full_name_ar: input.full_name_ar || null,
        email: input.email,
        phone: input.phone || null,
        language: input.language,
        avatar_url: null,
        is_active: true,
        notif_in_app: true,
        notif_push: true,
        notif_email: false,
        created_at: now,
        updated_at: now,
      });
      if (input.role !== 'driver' && input.site_ids.length) mockDb.userSites[id] = input.site_ids;
      let driverId: string | null = null;
      if (input.role === 'driver') {
        const existing = input.driver_id ? mockDb.drivers.find((d) => d.id === input.driver_id) : undefined;
        if (existing) {
          existing.profile_id = id;
          driverId = existing.id;
        } else {
          driverId = crypto.randomUUID();
          mockDb.drivers.push({
            id: driverId,
            company_id: companyId,
            profile_id: id,
            home_site_id: input.home_site_id ?? null,
            employee_no: null,
            full_name: input.full_name,
            full_name_ar: input.full_name_ar || null,
            phone: input.phone || null,
            licence_no: null,
            licence_expiry: null,
            photo_url: null,
            max_daily_driving_min: null,
            grade: null,
            serve_group_id: null,
            job_title_id: null,
            nationality: null,
            english_rating: null,
            shift_start: '07:00:00',
            shift_end: '17:00:00',
            current_status: 'offline',
            last_seen_at: null,
            is_active: true,
            notes: null,
            created_at: now,
            updated_at: now,
          });
        }
      }
      return { user_id: id, driver_id: driverId };
    },
    invalidate: () => [companyKeys.users(companyId), ['drivers', companyId]],
  });
}

/** FR-60 — role + site scope. The 0002 guard enforces who may change what. */
export function useUpdateUserAccess() {
  const companyId = useCompanyId();
  return useDualMutation<{ userId: string; values: UserAccessValues }, void>({
    live: async ({ userId, values }) => {
      unwrap(await db().from('profiles').update({ role: values.role }).eq('id', userId));
      unwrap(await db().from('user_sites').delete().eq('user_id', userId));
      if (values.site_ids.length && values.role !== 'driver') {
        unwrap(await db().from('user_sites').insert(values.site_ids.map((site_id) => ({ user_id: userId, site_id }))));
      }
    },
    mock: ({ userId, values }) => {
      const p = mockDb.profiles.find((x) => x.id === userId);
      if (p) p.role = values.role;
      if (values.site_ids.length && values.role !== 'driver') mockDb.userSites[userId] = values.site_ids;
      else delete mockDb.userSites[userId];
    },
    invalidate: () => [companyKeys.users(companyId)],
  });
}

export function useSetUserActive() {
  const companyId = useCompanyId();
  return useDualMutation<{ userId: string; active: boolean }, void>({
    live: async ({ userId, active }) => {
      unwrap(await db().from('profiles').update({ is_active: active }).eq('id', userId));
    },
    mock: ({ userId, active }) => {
      const p = mockDb.profiles.find((x) => x.id === userId);
      if (p) p.is_active = active;
    },
    invalidate: () => [companyKeys.users(companyId)],
  });
}
