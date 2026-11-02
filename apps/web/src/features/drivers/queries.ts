import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/features/auth/session';
import { selectMockTasks } from '@/features/tasks/queries';
import type { TaskWithRelations } from '@/features/tasks/types';
import { mockDb, mockQuery } from '@/mocks/db';
import { at, dateKey, type Driver, type DriverAvailability, type DriverDaySummary, type DriverLocation, type Site, type Vehicle } from '@/mocks/fixtures';
import { ACTIVE_STATUSES, TERMINAL_STATUSES } from '@/lib/task-meta';

export type DriverOverview = Driver & {
  homeSite: Site | null;
  location: DriverLocation | null;
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

function overview(driver: Driver): DriverOverview {
  const db = mockDb;
  const tasksToday = selectMockTasks({ from: at(0, '00:00'), to: at(1, '00:00'), driverId: driver.id });
  const live = tasksToday.filter((t) => !TERMINAL_STATUSES.includes(t.status));
  const plannedTodayMin = tasksToday
    .filter((t) => t.status !== 'cancelled' && t.status !== 'declined')
    .reduce((sum, t) => sum + (t.estimated_duration_min ?? 60), 0);
  return {
    ...driver,
    homeSite: db.sites.find((s) => s.id === driver.home_site_id) ?? null,
    location: db.driverLocations.filter((l) => l.driver_id === driver.id).at(-1) ?? null,
    today: db.driverDaySummaries.find((s) => s.driver_id === driver.id && s.date === dateKey(0)) ?? null,
    maxDailyMin: driver.max_daily_driving_min ?? db.companySettings.max_daily_driving_min,
    plannedTodayMin,
    activeTask: live.find((t) => ACTIVE_STATUSES.includes(t.status)) ?? null,
    nextTask: live.find((t) => !ACTIVE_STATUSES.includes(t.status)) ?? null,
    tasksToday,
    openConflicts: tasksToday.reduce((sum, t) => sum + t.conflicts.length, 0),
  };
}

/** Drivers whose home site is in scope — or who have work for a scoped site today. */
export function useDrivers(siteIds: string[] = []) {
  const { profile } = useCurrentUser();
  const companyId = profile.company_id ?? '';
  return useQuery({
    queryKey: driverKeys.list(companyId, siteIds),
    queryFn: () =>
      mockQuery(
        () =>
          mockDb.drivers
            .filter((d) => d.is_active)
            .map(overview)
            .filter((d) => !siteIds.length || (d.home_site_id && siteIds.includes(d.home_site_id)) || d.tasksToday.some((t) => siteIds.includes(t.site_id)))
            .sort((a, b) => a.full_name.localeCompare(b.full_name)),
        [],
      ),
  });
}

export function useDriver(driverId: string) {
  const { profile } = useCurrentUser();
  const companyId = profile.company_id ?? '';
  return useQuery({
    queryKey: driverKeys.detail(companyId, driverId),
    queryFn: () =>
      mockQuery<DriverDetail | null>(() => {
        const driver = mockDb.drivers.find((d) => d.id === driverId);
        if (!driver) return null;
        return {
          ...overview(driver),
          summaries: mockDb.driverDaySummaries.filter((s) => s.driver_id === driverId).sort((a, b) => a.date.localeCompare(b.date)),
          upcoming: selectMockTasks({ from: at(0, '00:00'), to: at(8, '00:00'), driverId }).filter((t) => !TERMINAL_STATUSES.includes(t.status)),
          availability: mockDb.driverAvailability.filter((a) => a.driver_id === driverId),
          vehicles: mockDb.vehicles.filter((v) => v.site_id === driver.home_site_id),
        };
      }, null),
  });
}
