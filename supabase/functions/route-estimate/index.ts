/**
 * route-estimate (FR-11, docs/DATABASE.md §8)
 *
 * POST {stops:[{lat,lng}] (2…10), departure_time?} → {legs, distance_km, duration_min, estimated}
 *
 * One Distance Matrix call (origins = stops[0…n-2], destinations = stops[1…n-1],
 * the diagonal is each leg), traffic-aware for the task's departure time.
 * No key, a failed call or a leg without a route → haversine × 1.3 @ 70 km/h,
 * flagged `estimated` so the wizard can say so.
 *
 * Results are cached per isolate for 10 min by (stops, 15-min departure
 * bucket) — NFR-02. Staff only (NFR-07: Maps calls server-side, on explicit
 * wizard use). Secret: GOOGLE_MAPS_SERVER_KEY (optional).
 */
import { getCaller, requireRole } from '../_shared/auth.ts';
import { handle, HttpError, json } from '../_shared/http.ts';
import { routeEstimateInput, routeEstimateOutput, type RouteEstimateOutput, type RouteLeg } from '../_shared/schemas.ts';

const CACHE_TTL_MS = 10 * 60_000;
const BUCKET_MS = 15 * 60_000;
const cache = new Map<string, { at: number; value: RouteEstimateOutput }>();

type Point = { lat: number; lng: number };

function distanceKm(a: Point, b: Point): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Same rough estimate as lib/geo.ts estimateDrive and seed.sql. */
function estimateLeg(a: Point, b: Point): RouteLeg {
  const km = Math.round(distanceKm(a, b) * 1.3 * 10) / 10;
  return { distance_km: km, duration_min: km === 0 ? 0 : Math.max(5, Math.round((km / 70) * 60)) };
}

async function distanceMatrix(stops: Point[], departure: number, key: string): Promise<(RouteLeg | null)[]> {
  const origins = stops.slice(0, -1);
  const destinations = stops.slice(1);
  const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
  url.searchParams.set('origins', origins.map((p) => `${p.lat},${p.lng}`).join('|'));
  url.searchParams.set('destinations', destinations.map((p) => `${p.lat},${p.lng}`).join('|'));
  // Distance Matrix only accepts now or a future departure for traffic
  url.searchParams.set('departure_time', departure > Date.now() ? String(Math.floor(departure / 1000)) : 'now');
  url.searchParams.set('key', key);
  const response = await fetch(url);
  if (!response.ok) return origins.map(() => null);
  const body = (await response.json()) as {
    status?: string;
    rows?: { elements: { status: string; distance?: { value: number }; duration?: { value: number }; duration_in_traffic?: { value: number } }[] }[];
  };
  if (body.status !== 'OK') return origins.map(() => null);
  return origins.map((_, i) => {
    const e = body.rows?.[i]?.elements[i];
    if (!e || e.status !== 'OK' || !e.distance || !e.duration) return null;
    return {
      distance_km: Math.round((e.distance.value / 1000) * 10) / 10,
      duration_min: Math.round((e.duration_in_traffic ?? e.duration).value / 60),
    };
  });
}

Deno.serve(
  handle(async (req) => {
    const caller = await getCaller(req);
    requireRole(caller, ['owner', 'admin', 'dispatcher']);

    const input = routeEstimateInput.safeParse(await req.json().catch(() => null));
    if (!input.success) throw new HttpError(400, 'errors.invalidInput', input.error.message);
    const { stops } = input.data;
    const departure = input.data.departure_time ? new Date(input.data.departure_time).getTime() : Date.now();

    const cacheKey = `${stops.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|')}@${Math.floor(departure / BUCKET_MS)}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return json(hit.value);

    const key = Deno.env.get('GOOGLE_MAPS_SERVER_KEY') || undefined;
    const fromApi = key ? await distanceMatrix(stops, departure, key).catch(() => stops.slice(1).map(() => null)) : [];
    let estimated = false;
    const legs = stops.slice(1).map((stop, i) => {
      const leg = fromApi[i];
      if (leg) return leg;
      estimated = true;
      return estimateLeg(stops[i]!, stop);
    });

    const value = routeEstimateOutput.parse({
      legs,
      distance_km: Math.round(legs.reduce((sum, l) => sum + l.distance_km, 0) * 10) / 10,
      duration_min: legs.reduce((sum, l) => sum + l.duration_min, 0),
      estimated,
    });
    // only cache real answers; estimates are free to recompute
    if (!estimated) cache.set(cacheKey, { at: Date.now(), value });
    return json(value);
  }),
);
