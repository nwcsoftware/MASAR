import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/features/auth/session';
import { loadTasks } from '@/features/tasks/queries';
import type { TaskWithRelations } from '@/features/tasks/types';
import { db, unwrap, useDualMutation, useLiveData } from '@/lib/data-source';
import { companyDateKey } from '@/lib/format';
import { mockDb, mockQuery } from '@/mocks/db';
import { at, type Driver, type DriverAvailability, type DriverDaySummary, type DriverLocation, type Site, type Vehicle } from '@/mocks/fixtures';
import type { TablesInsert } from '@/lib/database.types';
import { ACTIVE_STATUSES, TERMINAL_STATUSES } from '@/lib/task-meta';
import type { AvailabilityValues, DriverValues } from './schema';

export type LatestLocation = Pick<DriverLocation, 'lat' | 'lng' | 'recorded_at' | 'battery_pct' | 'speed_kmh' | 'task_id'>;

export type DriverOverview = Driver & {
  homeSite: Site | null;
  location: LatestLocation | null;
  today: DriverDaySummary | null;
  /** effective daily driving cap (driver override → company default) */
  maxDailyMin: number;
  /** planned minutes today across all assigned tasks */
  plannedTodayMin: number;
  activeTask: TaskWithRelations | null;
  nextTask: TaskWithRelations | null;
  tasksToday: TaskWithRelations[];
  openConflicts: number;
};

export type DriverDetail = DriverOverview & {
  summaries: DriverDaySummary[];
  upcoming: TaskWithRelations[];
  availability: DriverAvailability[];
  vehicles: Vehicle[];
};

export const driverKeys = {
  all: (companyId: string) => ['drivers', companyId] as const,
  list: (companyId: string, siteIds: string[]) => ['drivers', companyId, { siteIds }] as const,
  detail: (companyId: string, driverId: string) => ['drivers', companyId, 'detail', driverId] as const,
};

// ---------------------------------------------------------------------------
// pure builder shared by both sources
// ---------------------------------------------------------------------------
export interface OverviewContext {
  sites: Site[];
  locationByDriver: Map<string, LatestLocation>;
  summaries: DriverDaySummary[];
  tasksToday: TaskWithRelations[];
  maxDailyDefault: number;
  todayKey: string;
}

export function buildOverview(driver: Driver, ctx: OverviewContext): DriverOverview {
  const tasksToday = ctx.tasksToday.filter((t) => t.assignments.some((a) => a.driver_id === driver.id));
  const live = tasksToday.filter((t) => !TERMINAL_STATUSES.includes(t.status));
  return {
    ...driver,
    homeSite: ctx.sites.find((s) => s.id === driver.home_site_id) ?? null,
    location: ctx.locationByDriver.get(driver.id) ?? null,
    today: ctx.summaries.find((s) => s.driver_id === driver.id && s.date === ctx.todayKey) ?? null,
    maxDailyMin: driver.max_daily_driving_min ?? ctx.maxDailyDefault,
    plannedTodayMin: tasksToday
      .filter((t) => t.status !== 'cancelled' && t.status !== 'declined')
      .reduce((sum, t) => sum + (t.estimated_duration_min ?? 60), 0),
    activeTask: live.find((t) => ACTIVE_STATUSES.includes(t.status)) ?? null,
    nextTask: live.find((t) => !ACTIVE_STATUSES.includes(t.status)) ?? null,
    tasksToday,
    openConflicts: tasksToday.reduce((sum, t) => sum + t.conflicts.length, 0),
  };
}

// ---------------------------------------------------------------------------
// loading
// ---------------------------------------------------------------------------
async function loadContext(live: boolean): Promise<{ drivers: Driver[]; ctx: OverviewContext }> {
  const todayKey = companyDateKey();
  const tasksToday = await loadTasks(live, { from: at(0, '00:00'), to: at(1, '00:00') });
  if (!live) {
    return {
      drivers: mockDb.drivers,
      ctx: {
        sites: mockDb.sites,
        locationByDriver: new Map(mockDb.driverLocations.map((l) => [l.driver_id, l])),
        summaries: mockDb.driverDaySummaries,
        tasksToday,
        maxDailyDefault: mockDb.companySettings.max_daily_driving_min,
        todayKey,
      },
    };
  }
  const client = db();
  const [drivers, sites, locations, summaries, settings] = await Promise.all([
    client.from('drivers').select('*').order('full_name'),
    client.from('sites').select('*'),
    client.from('v_driver_latest_location').select('driver_id, lat, lng, recorded_at, battery_pct, speed_kmh, task_id'),
    client.from('driver_day_summary').select('*').eq('date', todayKey),
    client.from('company_settings').select('max_daily_driving_min').maybeSingle(),
  ]);
  const locationByDriver = new Map<string, LatestLocation>();
  for (const l of unwrap(locations) ?? []) {
    if (l.driver_id && l.lat != null && l.lng != null && l.recorded_at) {
      locationByDriver.set(l.driver_id, { lat: l.lat, lng: l.lng, recorded_at: l.recorded_at, battery_pct: l.battery_pct, speed_kmh: l.speed_kmh, task_id: l.task_id });
    }
  }
  return {
    drivers: unwrap(drivers) ?? [],
    ctx: {
      sites: unwrap(sites) ?? [],
      locationByDriver,
      summaries: unwrap(summaries) ?? [],
      tasksToday,
      maxDailyDefault: unwrap(settings)?.max_daily_driving_min ?? 600,
      todayKey,
    },
  };
}

/** Drivers whose home site is in scope — or who have work for a scoped site today. */
export function useDrivers(siteIds: string[] = [], options: { includeInactive?: boolean } = {}) {
  const { profile } = useCurrentUser();
  const live = useLiveData();
  return useQuery({
    queryKey: [...driverKeys.list(profile.company_id ?? '', siteIds), { inactive: Boolean(options.includeInactive) }],
    queryFn: async () => {
      const load = async () => {
        const { drivers, ctx } = await loadContext(live);
        return drivers
          .filter((d) => options.includeInactive || d.is_active)
          .map((d) => buildOverview(d, ctx))
          .filter((d) => !siteIds.length || (d.home_site_id && siteIds.includes(d.home_site_id)) || d.tasksToday.some((t) => siteIds.includes(t.site_id)))
          .sort((a, b) => a.full_name.localeCompare(b.full_name));
      };
      return live ? load() : mockQuery(load, [] as DriverOverview[]);
    },
  });
}

export function useDriver(driverId: string) {
  const { profile } = useCurrentUser();
  const live = useLiveData();
  return useQuery({
    queryKey: driverKeys.detail(profile.company_id ?? '', driverId),
    enabled: Boolean(driverId),
    queryFn: async (): Promise<DriverDetail | null> => {
      const load = async () => {
        const { drivers, ctx } = await loadContext(live);
        const driver = drivers.find((d) => d.id === driverId);
        if (!driver) return null;
        const upcoming = (await loadTasks(live, { from: at(0, '00:00'), to: at(8, '00:00'), driverId })).filter(
          (t) => !TERMINAL_STATUSES.includes(t.status),
        );
        if (!live) {
          return {
            ...buildOverview(driver, ctx),
            summaries: mockDb.driverDaySummaries.filter((s) => s.driver_id === driverId).sort((a, b) => a.date.localeCompare(b.date)),
            upcoming,
            availability: mockDb.driverAvailability.filter((a) => a.driver_id === driverId),
            vehicles: mockDb.vehicles.filter((v) => v.site_id === driver.home_site_id),
          };
        }
        const client = db();
        const [summaries, availability, vehicles] = await Promise.all([
          client.from('driver_day_summary').select('*').eq('driver_id', driverId).gte('date', companyDateKey(at(-30, '12:00'))).order('date'),
          client.from('driver_availability').select('*').eq('driver_id', driverId).gte('ends_at', at(-30, '00:00')).order('starts_at'),
          driver.home_site_id ? client.from('vehicles').select('*').eq('site_id', driver.home_site_id) : Promise.resolve({ data: [], error: null }),
        ]);
        return {
          ...buildOverview(driver, ctx),
          summaries: unwrap(summaries) ?? [],
          upcoming,
          availability: unwrap(availability) ?? [],
          vehicles: unwrap(vehicles) ?? [],
        };
      };
      return live ? load() : mockQuery(load, null);
    },
  });
}

// ---------------------------------------------------------------------------
// writes (FR-04) — drivers_write is admin-only; availability is staff
// ---------------------------------------------------------------------------
type DriverFields = Omit<Driver, 'id' | 'profile_id' | 'photo_url' | 'current_status' | 'last_seen_at' | 'created_at' | 'updated_at'>;

function driverRow(values: DriverValues, companyId: string): DriverFields & TablesInsert<'drivers'> {
  return {
    company_id: companyId,
    full_name: values.full_name,
    full_name_ar: values.full_name_ar || null,
    employee_no: values.employee_no || null,
    phone: values.phone || null,
    home_site_id: values.home_site_id || null,
    licence_no: values.licence_no || null,
    licence_expiry: values.licence_expiry || null,
    shift_start: values.shift_start || null,
    shift_end: values.shift_end || null,
    max_daily_driving_min: values.max_daily_driving_min ?? null,
    grade: values.grade ?? null,
    serve_group_id: values.serve_group_id || null,
    job_title_id: values.job_title_id || null,
    nationality: values.nationality || null,
    english_rating: values.english_rating ?? null,
    notes: values.notes || null,
    is_active: values.is_active,
  };
}

export function useSaveDriver() {
  const { profile } = useCurrentUser();
  const companyId = profile.company_id ?? '';
  return useDualMutation<{ id?: string; values: DriverValues }, string>({
    live: async ({ id, values }) => {
      const row = driverRow(values, companyId);
      const result = id
        ? await db().from('drivers').update(row).eq('id', id).select('id').single()
        : await db().from('drivers').insert(row).select('id').single();
      return unwrap(result)!.id;
    },
    mock: ({ id, values }) => {
      const now = new Date().toISOString();
      const row = driverRow(values, companyId);
      if (id) {
        const existing = mockDb.drivers.find((d) => d.id === id);
        if (existing) Object.assign(existing, row, { updated_at: now });
        return id;
      }
      const newId = crypto.randomUUID();
      mockDb.drivers.push({ ...row, id: newId, profile_id: null, photo_url: null, current_status: 'offline', last_seen_at: null, created_at: now, updated_at: now });
      return newId;
    },
    invalidate: () => [driverKeys.all(companyId), ['sites', companyId]],
  });
}

export function useAddAvailability(driverId: string) {
  const user = useCurrentUser();
  const companyId = user.profile.company_id ?? '';
  return useDualMutation<AvailabilityValues, void>({
    live: async (values) => {
      unwrap(
        await db().from('driver_availability').insert({
          driver_id: driverId,
          type: values.type,
          starts_at: new Date(`${values.from}T00:00:00`).toISOString(),
          ends_at: new Date(`${values.to}T23:59:59`).toISOString(),
          note: values.note || null,
          created_by: user.id,
        }),
      );
    },
    mock: (values) => {
      mockDb.driverAvailability.push({
        id: crypto.randomUUID(),
        driver_id: driverId,
        type: values.type,
        starts_at: new Date(`${values.from}T00:00:00`).toISOString(),
        ends_at: new Date(`${values.to}T23:59:59`).toISOString(),
        note: values.note || null,
        created_by: user.id,
        created_at: new Date().toISOString(),
      });
    },
    invalidate: () => [driverKeys.detail(companyId, driverId)],
  });
}

export function useDeleteAvailability(driverId: string) {
  const { profile } = useCurrentUser();
  const companyId = profile.company_id ?? '';
  return useDualMutation<string, void>({
    live: async (id) => {
      unwrap(await db().from('driver_availability').delete().eq('id', id));
    },
    mock: (id) => {
      mockDb.driverAvailability = mockDb.driverAvailability.filter((a) => a.id !== id);
    },
    invalidate: () => [driverKeys.detail(companyId, driverId)],
  });
}
