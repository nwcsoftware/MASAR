import { useMutation, useQuery } from '@tanstack/react-query';
import { suggestAirportsOutput, type AirportSuggestion } from '@shared/schemas';
import { useCurrentUser } from '@/features/auth/session';
import { loadTasks } from '@/features/tasks/queries';
import type { TaskWithRelations } from '@/features/tasks/types';
import { db, invokeFunction, unwrap, useDualMutation, useLiveData } from '@/lib/data-source';
import { distanceKm, estimateDrive } from '@/lib/geo';
import type { Json, TablesInsert } from '@/lib/database.types';
import { AIRPORT_CATALOGUE } from '@/mocks/airport-catalogue';
import { mockDb, mockQuery } from '@/mocks/db';
import { at, type Airport, type Driver, type Site, type SiteAirport, type Vehicle } from '@/mocks/fixtures';
import type { SiteAirportValues, SiteValues } from './schema';

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

// ---------------------------------------------------------------------------
// reads
// ---------------------------------------------------------------------------
interface SiteSources {
  sites: (Site & { airports: (SiteAirport & { airport: Airport | null })[] })[];
  drivers: Driver[];
  tasksToday: TaskWithRelations[];
}

function buildSites({ sites, drivers, tasksToday }: SiteSources): SiteWithAirports[] {
  return sites
    .map((site) => ({
      ...site,
      airports: site.airports
        .flatMap((sa) => (sa.airport ? [{ ...sa, airport: sa.airport }] : []))
        .sort((a, b) => Number(b.is_default) - Number(a.is_default) || (a.drive_minutes ?? 0) - (b.drive_minutes ?? 0)),
      driverCount: drivers.filter((d) => d.home_site_id === site.id && d.is_active).length,
      tasksToday: tasksToday.filter((t) => t.site_id === site.id).length,
    }))
    .sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name));
}

async function loadSources(live: boolean): Promise<SiteSources> {
  const tasksToday = await loadTasks(live, { from: at(0, '00:00'), to: at(1, '00:00') });
  if (!live) {
    return {
      sites: mockDb.sites.map((s) => ({
        ...s,
        airports: mockDb.siteAirports
          .filter((sa) => sa.site_id === s.id)
          .map((sa) => ({ ...sa, airport: mockDb.airports.find((a) => a.id === sa.airport_id) ?? null })),
      })),
      drivers: mockDb.drivers,
      tasksToday,
    };
  }
  const [sites, drivers] = await Promise.all([
    db().from('sites').select('*, airports:site_airports(*, airport:airports(*))'),
    db().from('drivers').select('*'),
  ]);
  return { sites: unwrap(sites) ?? [], drivers: unwrap(drivers) ?? [], tasksToday };
}

/** All sites in the company (RLS: everyone reads sites). */
export function useSites() {
  const { profile } = useCurrentUser();
  const live = useLiveData();
  return useQuery({
    queryKey: siteKeys.all(profile.company_id ?? ''),
    queryFn: () => (live ? loadSources(true).then(buildSites) : mockQuery(() => loadSources(false).then(buildSites), [])),
  });
}

export function useSite(siteId: string) {
  const { profile } = useCurrentUser();
  const live = useLiveData();
  return useQuery({
    queryKey: siteKeys.detail(profile.company_id ?? '', siteId),
    queryFn: async (): Promise<SiteDetail | null> => {
      const load = async () => {
        const sources = await loadSources(live);
        const site = buildSites(sources).find((s) => s.id === siteId);
        if (!site) return null;
        const vehicles = live
          ? (unwrap(await db().from('vehicles').select('*').eq('site_id', siteId).order('plate_no')) ?? [])
          : mockDb.vehicles.filter((v) => v.site_id === siteId);
        return {
          ...site,
          drivers: sources.drivers.filter((d) => d.home_site_id === siteId),
          vehicles,
          upcoming: await loadTasks(live, { from: at(0, '00:00'), to: at(8, '00:00'), siteIds: [siteId] }),
        };
      };
      return live ? load() : mockQuery(load, null);
    },
  });
}

// ---------------------------------------------------------------------------
// writes — sites_write is admin-only (FR-02)
// ---------------------------------------------------------------------------
type SiteFields = Omit<Site, 'id' | 'google_place_id' | 'created_at' | 'updated_at'>;

function siteRow(values: SiteValues, companyId: string): SiteFields & TablesInsert<'sites'> {
  return {
    company_id: companyId,
    name: values.name,
    name_ar: values.name_ar || null,
    code: values.code || null,
    type: values.type,
    address: values.address || null,
    address_ar: values.address_ar || null,
    city: values.city || null,
    lat: values.lat,
    lng: values.lng,
    contact_name: values.contact_name || null,
    contact_phone: values.contact_phone || null,
    work_start: values.work_start,
    work_end: values.work_end,
    notes: values.notes || null,
    is_active: values.is_active,
  };
}

export function useSaveSite() {
  const { profile } = useCurrentUser();
  const companyId = profile.company_id ?? '';
  return useDualMutation<{ id?: string; values: SiteValues; companyId?: string }, string>({
    live: async ({ id, values, companyId: override }) => {
      const row = siteRow(values, override ?? companyId);
      const result = id
        ? await db().from('sites').update(row).eq('id', id).select('id').single()
        : await db().from('sites').insert(row).select('id').single();
      return unwrap(result)!.id;
    },
    mock: ({ id, values }) => {
      const now = new Date().toISOString();
      const row = siteRow(values, companyId);
      if (id) {
        const existing = mockDb.sites.find((s) => s.id === id);
        if (existing) Object.assign(existing, row, { updated_at: now });
        return id;
      }
      const newId = crypto.randomUUID();
      mockDb.sites.push({ ...row, id: newId, google_place_id: null, created_at: now, updated_at: now });
      return newId;
    },
    invalidate: () => [siteKeys.all(companyId), ['drivers', companyId]],
  });
}

/** FR-03 — replace a site's airports (rpc_set_site_airports, atomic, one default). */
export function useSetSiteAirports() {
  const { profile } = useCurrentUser();
  const companyId = profile.company_id ?? '';
  return useDualMutation<{ siteId: string; airports: SiteAirportValues[] }, void>({
    live: async ({ siteId, airports }) => {
      unwrap(await db().rpc('rpc_set_site_airports', { p_site_id: siteId, p_airports: airports as unknown as Json }));
    },
    mock: ({ siteId, airports }) => {
      const now = new Date().toISOString();
      const ids: string[] = [];
      for (const a of airports) {
        let airport = mockDb.airports.find((x) => x.iata === a.iata);
        if (!airport) {
          airport = {
            id: crypto.randomUUID(),
            company_id: companyId,
            iata: a.iata,
            icao: a.icao,
            name: a.name,
            name_ar: a.name_ar,
            city: a.city,
            city_ar: a.city_ar,
            country_code: a.country_code,
            lat: a.lat,
            lng: a.lng,
            google_place_id: null,
            is_international: a.is_international,
            terminals: [],
            source: a.source,
            created_at: now,
          };
          mockDb.airports.push(airport);
        }
        ids.push(airport.id);
      }
      const defaultId = ids[airports.findIndex((a) => a.is_default)] ?? ids[0];
      mockDb.siteAirports = [
        ...mockDb.siteAirports.filter((sa) => sa.site_id !== siteId),
        ...airports.map((a, i) => ({
          site_id: siteId,
          airport_id: ids[i]!,
          is_default: ids[i] === defaultId,
          distance_km: a.distance_km,
          drive_minutes: a.drive_minutes,
          default_buffer_min: a.default_buffer_min,
          created_at: now,
        })),
      ];
    },
    invalidate: () => [siteKeys.all(companyId)],
  });
}

/** FR-03 — ai-suggest-airports; demo mode ranks the bundled catalogue by distance. */
export function useSuggestAirports() {
  const live = useLiveData();
  return useMutation({
    mutationFn: async (input: { lat: number; lng: number; country_code?: string }): Promise<AirportSuggestion[]> => {
      if (live) {
        const result = await invokeFunction<unknown>('ai-suggest-airports', input);
        return suggestAirportsOutput.parse(result).airports;
      }
      await new Promise((resolve) => setTimeout(resolve, import.meta.env.MODE === 'test' ? 0 : 600));
      return AIRPORT_CATALOGUE.map((a) => {
        const drive = estimateDrive(distanceKm(input.lat, input.lng, a.lat, a.lng));
        return {
          ...a,
          country_code: 'SA',
          distance_km: drive.roadKm,
          drive_minutes: drive.minutes,
          source: 'ai' as const,
          drive_estimated: true,
        };
      })
        .sort((a, b) => a.drive_minutes - b.drive_minutes)
        .slice(0, 5);
    },
  });
}
