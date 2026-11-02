import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/features/auth/session';
import { mockDb, mockQuery } from '@/mocks/db';
import type { Driver, DriverDaySummary, Site } from '@/mocks/fixtures';

export interface HoursFilters {
  /** inclusive YYYY-MM-DD */
  from: string;
  /** inclusive YYYY-MM-DD */
  to: string;
  siteIds?: string[];
  driverIds?: string[];
}

export interface DriverHoursRow {
  driver: Driver;
  homeSite: Site | null;
  days: number;
  tasks: number;
  drivingMin: number;
  workingMin: number;
  overtimeMin: number;
  distanceKm: number;
}

export interface HoursReport {
  rows: DriverHoursRow[];
  /** per-date totals for the trend chart */
  daily: { date: string; drivingMin: number; overtimeMin: number; distanceKm: number }[];
  totals: { drivingMin: number; workingMin: number; overtimeMin: number; distanceKm: number; tasks: number };
}

export const reportKeys = {
  hours: (companyId: string, filters: HoursFilters) => ['reports', companyId, 'hours', filters] as const,
};

/** FR-50/52 — aggregates driver_day_summary. Must match sum of task actuals (US-10). */
export function aggregateHours(summaries: DriverDaySummary[], drivers: Driver[], sites: Site[]): HoursReport {
  const rows = drivers
    .map((driver) => {
      const mine = summaries.filter((s) => s.driver_id === driver.id);
      return {
        driver,
        homeSite: sites.find((s) => s.id === driver.home_site_id) ?? null,
        days: mine.length,
        tasks: mine.reduce((n, s) => n + s.tasks_count, 0),
        drivingMin: mine.reduce((n, s) => n + s.driving_min, 0),
        workingMin: mine.reduce((n, s) => n + s.working_min, 0),
        overtimeMin: mine.reduce((n, s) => n + s.overtime_min, 0),
        distanceKm: Math.round(mine.reduce((n, s) => n + Number(s.distance_km), 0) * 10) / 10,
      };
    })
    .filter((row) => row.days > 0);

  const byDate = new Map<string, { drivingMin: number; overtimeMin: number; distanceKm: number }>();
  for (const s of summaries) {
    const day = byDate.get(s.date) ?? { drivingMin: 0, overtimeMin: 0, distanceKm: 0 };
    day.drivingMin += s.driving_min;
    day.overtimeMin += s.overtime_min;
    day.distanceKm += Number(s.distance_km);
    byDate.set(s.date, day);
  }

  return {
    rows,
    daily: [...byDate].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v })),
    totals: {
      drivingMin: rows.reduce((n, r) => n + r.drivingMin, 0),
      workingMin: rows.reduce((n, r) => n + r.workingMin, 0),
      overtimeMin: rows.reduce((n, r) => n + r.overtimeMin, 0),
      distanceKm: Math.round(rows.reduce((n, r) => n + r.distanceKm, 0) * 10) / 10,
      tasks: rows.reduce((n, r) => n + r.tasks, 0),
    },
  };
}

export function useHoursReport(filters: HoursFilters) {
  const { profile } = useCurrentUser();
  const companyId = profile.company_id ?? '';
  return useQuery({
    queryKey: reportKeys.hours(companyId, filters),
    queryFn: () =>
      mockQuery<HoursReport>(
        () => {
          const drivers = mockDb.drivers.filter(
            (d) =>
              (!filters.driverIds?.length || filters.driverIds.includes(d.id)) &&
              (!filters.siteIds?.length || (d.home_site_id !== null && filters.siteIds.includes(d.home_site_id))),
          );
          const summaries = mockDb.driverDaySummaries.filter(
            (s) => s.date >= filters.from && s.date <= filters.to && drivers.some((d) => d.id === s.driver_id),
          );
          return aggregateHours(summaries, drivers, mockDb.sites);
        },
        { rows: [], daily: [], totals: { drivingMin: 0, workingMin: 0, overtimeMin: 0, distanceKm: 0, tasks: 0 } },
      ),
  });
}

/** Driver PWA "Hours" tab (FR-35). */
export function useMyDaySummaries(driverId: string | null, from: string, to: string) {
  return useQuery({
    queryKey: ['reports', 'me', driverId, from, to] as const,
    enabled: Boolean(driverId),
    queryFn: () =>
      mockQuery(
        () => mockDb.driverDaySummaries.filter((s) => s.driver_id === driverId && s.date >= from && s.date <= to).sort((a, b) => a.date.localeCompare(b.date)),
        [],
      ),
  });
}
