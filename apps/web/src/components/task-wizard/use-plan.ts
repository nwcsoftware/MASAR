import { useMemo } from 'react';
import type { RouteLeg } from '@shared/schemas';
import { useRouteEstimate } from '@/features/tasks/queries';
import { airportStart, estimateLeg, planTimeline, type Timeline } from '@/features/tasks/plan';
import type { TaskFormValues } from '@/features/tasks/schema';
import { flightIso, startIso } from './values';

const BUCKET_MS = 15 * 60_000;

function safeIso(read: () => string): string | null {
  try {
    const iso = read();
    return Number.isNaN(new Date(iso).getTime()) ? null : iso;
  } catch {
    return null;
  }
}

export interface WizardPlan {
  legs: (RouteLeg | null)[];
  timeline: Timeline;
  /** FR-13 suggested start for airport trips */
  suggested: { start: string; driveMin: number } | null;
  /** Distance Matrix unavailable → rough estimate */
  estimated: boolean;
  routing: boolean;
  start: string | null;
  flightTime: string | null;
}

/**
 * Everything the Schedule / Assign / Review steps derive from the form:
 * route legs (route-estimate), the stop timeline and the airport start.
 */
export function useWizardPlan(values: TaskFormValues): WizardPlan {
  const start = safeIso(() => startIso(values));
  const flightTime = values.flight ? safeIso(() => flightIso(values.flight!)) : null;
  const located = values.stops.length >= 2 && values.stops.every((s) => s.lat != null && s.lng != null);
  // Traffic depends on departure; key it on a 15-min bucket of something the
  // result doesn't move (the flight time for airport trips), so a derived
  // start can't feed back into its own estimate.
  const anchor = values.category === 'airport' ? flightTime : start;
  const departure = anchor ? new Date(Math.floor((new Date(anchor).getTime() - (values.category === 'airport' ? 3_600_000 : 0)) / BUCKET_MS) * BUCKET_MS).toISOString() : undefined;
  const route = useRouteEstimate(located ? { stops: values.stops.map((s) => ({ lat: s.lat!, lng: s.lng! })), departure_time: departure } : null);

  const stops = values.stops;
  const routeLegs = route.data?.legs;
  const flight = values.flight;
  return useMemo(() => {
    const legs = stops.slice(1).map((stop, i) => (located && routeLegs?.[i]) || estimateLeg(stops[i]!, stop));
    const suggested =
      values.category === 'airport' && flight && flightTime ? airportStart(flightTime, flight.buffer_min, stops, legs, flight.airport_id) : null;
    return {
      legs,
      timeline: planTimeline(start ?? flightTime ?? 0, stops, legs),
      suggested,
      estimated: !located || (route.data?.estimated ?? true),
      routing: route.isFetching,
      start,
      flightTime,
    };
  }, [stops, routeLegs, located, flight, flightTime, start, values.category, route.data?.estimated, route.isFetching]);
}
