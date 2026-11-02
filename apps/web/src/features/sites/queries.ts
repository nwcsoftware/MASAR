import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/features/auth/session';
import { selectMockTasks } from '@/features/tasks/queries';
import type { TaskWithRelations } from '@/features/tasks/types';
import { mockDb, mockQuery } from '@/mocks/db';
import { at, type Airport, type Driver, type Site, type SiteAirport, type Vehicle } from '@/mocks/fixtures';

export type SiteWithAirports = Site & {
  airports: (SiteAirport & { airport: Airport })[];
  driverCount: number;
  tasksToday: number;
};

export type SiteDetail = SiteWithAirports & {
  drivers: Driver[];
  vehicles: Vehicle[];
  upcoming: TaskWithRelations[];
};

export const siteKeys = {
  all: (companyId: string) => ['sites', companyId] as const,
  detail: (companyId: string, siteId: string) => ['sites', companyId, 'detail', siteId] as const,
};

function withAirports(site: Site): SiteWithAirports {
  const db = mockDb;
  return {
    ...site,
    airports: db.siteAirports
      .filter((sa) => sa.site_id === site.id)
      .flatMap((sa) => {
        const airport = db.airports.find((a) => a.id === sa.airport_id);
        return airport ? [{ ...sa, airport }] : [];
      }),
    driverCount: db.drivers.filter((d) => d.home_site_id === site.id).length,
    tasksToday: selectMockTasks({ from: at(0, '00:00'), to: at(1, '00:00'), siteIds: [site.id] }).length,
  };
}

/** All sites in the company (RLS: everyone reads sites). */
export function useSites() {
  const { profile } = useCurrentUser();
  const companyId = profile.company_id ?? '';
  return useQuery({
    queryKey: siteKeys.all(companyId),
    queryFn: () => mockQuery(() => mockDb.sites.map(withAirports), []),
  });
}

export function useSite(siteId: string) {
  const { profile } = useCurrentUser();
  const companyId = profile.company_id ?? '';
  return useQuery({
    queryKey: siteKeys.detail(companyId, siteId),
    queryFn: () =>
      mockQuery<SiteDetail | null>(() => {
        const site = mockDb.sites.find((s) => s.id === siteId);
        if (!site) return null;
        return {
          ...withAirports(site),
          drivers: mockDb.drivers.filter((d) => d.home_site_id === siteId),
          vehicles: mockDb.vehicles.filter((v) => v.site_id === siteId),
          upcoming: selectMockTasks({ from: at(0, '00:00'), to: at(8, '00:00'), siteIds: [siteId] }),
        };
      }, null),
  });
}
