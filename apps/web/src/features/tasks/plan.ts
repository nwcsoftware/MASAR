import type { RouteEstimateOutput, RouteLeg } from '@shared/schemas';
import { distanceKm } from '@/lib/geo';

/**
 * Pure scheduling maths for the task wizard (FR-11, FR-13) — shared by the
 * Schedule step, the review summary and the demo-mode save, unit-tested in
 * features/__tests__/plan.test.ts.
 */

type Point = { lat: number | null; lng: number | null };

/** Rough road leg used before / without Distance Matrix — same as route-estimate's fallback. */
export function estimateLeg(from: Point, to: Point): RouteLeg {
  if (from.lat == null || from.lng == null || to.lat == null || to.lng == null) return { distance_km: 0, duration_min: 0 };
  const km = Math.round(distanceKm(from.lat, from.lng, to.lat, to.lng) * 1.3 * 10) / 10;
  return { distance_km: km, duration_min: km === 0 ? 0 : Math.max(5, Math.round((km / 70) * 60)) };
}

export function estimateRoute(stops: Point[]): RouteEstimateOutput {
  const legs = stops.slice(1).map((stop, i) => estimateLeg(stops[i]!, stop));
  return {
    legs,
    distance_km: Math.round(legs.reduce((sum, l) => sum + l.distance_km, 0) * 10) / 10,
    duration_min: legs.reduce((sum, l) => sum + l.duration_min, 0),
    estimated: true,
  };
}

export interface Timeline {
  /** planned arrival at each stop (ISO); [0] is the start */
  arrivals: string[];
  end: string;
  /** driving + dwell, start → leaving the last stop */
  durationMin: number;
  distanceKm: number;
}

/** Walk the stops: arrive, dwell, drive the next leg. Missing legs count as 0. */
export function planTimeline(start: string | number | Date, stops: { dwell_min: number }[], legs: (RouteLeg | null | undefined)[]): Timeline {
  const t0 = new Date(start).getTime();
  let at = t0;
  let km = 0;
  const arrivals = stops.map((stop, i) => {
    if (i > 0) {
      const leg = legs[i - 1];
      at += (leg?.duration_min ?? 0) * 60_000;
      km += leg?.distance_km ?? 0;
    }
    const arrival = new Date(at).toISOString();
    at += stop.dwell_min * 60_000;
    return arrival;
  });
  return {
    arrivals,
    end: new Date(at).toISOString(),
    durationMin: Math.round((at - t0) / 60_000),
    distanceKm: Math.round(km * 10) / 10,
  };
}

/**
 * FR-13 / US-02: start = flight time − (drive to the airport + buffer).
 * "Drive to the airport" is everything before arriving there — legs plus any
 * dwell at earlier stops. Returns null without an airport stop.
 */
export function airportStart(
  flightTime: string,
  bufferMin: number,
  stops: { dwell_min: number; airport_id: string | null }[],
  legs: (RouteLeg | null | undefined)[],
  airportId: string,
): { start: string; driveMin: number } | null {
  const index = stops.findIndex((s) => s.airport_id === airportId);
  if (index < 0) return null;
  const offsetMin = Math.round((new Date(planTimeline(0, stops, legs).arrivals[index]!).getTime()) / 60_000);
  return {
    start: new Date(new Date(flightTime).getTime() - (offsetMin + bufferMin) * 60_000).toISOString(),
    driveMin: offsetMin,
  };
}

/**
 * Default wait at the airport stop: an arrival waits from `buffer` before
 * landing until passengers are out (~30 min after); a departure only drops off.
 */
export function airportDwell(direction: 'arrival' | 'departure', bufferMin: number): number {
  return direction === 'arrival' ? bufferMin + 30 : 10;
}
