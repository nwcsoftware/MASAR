import type { RouteLeg } from '@shared/schemas';
import type { Json } from '@/lib/database.types';
import type { TaskFormValues, StopValues, FlightValues, TicketDetailsValues } from '@/features/tasks/schema';
import { airportDwell, type Timeline } from '@/features/tasks/plan';
import { primaryAssignment, type SaveTaskPayload, type TaskDetail } from '@/features/tasks/types';
import type { SiteWithAirports } from '@/features/sites/queries';
import { companyDateKey, companyDateTimeToIso, companyTimeKey } from '@/lib/format';
import type { Airport, Site } from '@/mocks/fixtures';
import type { TaskCategory } from '@/lib/task-meta';
import { readPassengers } from '@/features/grades/rules';
import { readTicketMeta, type TicketMeta } from '@/features/tasks/ticket';

let stopKey = 0;
export const newStopKey = () => `stop-${++stopKey}`;

/** Next quarter hour, at least `leadMin` from now. */
function nextSlot(leadMin: number): Date {
  const at = Date.now() + leadMin * 60_000;
  return new Date(Math.ceil(at / 900_000) * 900_000);
}

export function siteStop(site: Site, dwell = 0): StopValues {
  return {
    key: newStopKey(),
    kind: 'site',
    site_id: site.id,
    airport_id: null,
    label: site.name,
    address: site.address ?? '',
    lat: site.lat,
    lng: site.lng,
    dwell_min: dwell,
    contact_name: site.contact_name ?? '',
    contact_phone: site.contact_phone ?? '',
  };
}

export function airportStop(airport: Airport, dwell: number): StopValues {
  return {
    key: newStopKey(),
    kind: 'airport',
    site_id: null,
    airport_id: airport.id,
    label: airport.iata ? `${airport.iata} · ${airport.name}` : airport.name,
    address: airport.city ?? '',
    lat: airport.lat,
    lng: airport.lng,
    dwell_min: dwell,
    contact_name: '',
    contact_phone: '',
  };
}

export function placeStop(dwell = 0): StopValues {
  return { key: newStopKey(), kind: 'place', site_id: null, airport_id: null, label: '', address: '', lat: null, lng: null, dwell_min: dwell, contact_name: '', contact_phone: '' };
}

/** What the Stops step pre-fills for a category (the user edits from there). */
export function seedStops(values: TaskFormValues, site: SiteWithAirports | undefined, airports: Airport[]): StopValues[] {
  if (!site) return [];
  const origin = siteStop(site);
  if (values.category === 'airport' && values.flight) {
    const airport = airports.find((a) => a.id === values.flight!.airport_id);
    if (!airport) return [origin];
    const stop = airportStop(airport, airportDwell(values.flight.direction, values.flight.buffer_min));
    // arrival: fetch the passenger and bring them back; departure: drop off
    return values.flight.direction === 'arrival' ? [origin, stop, siteStop(site)] : [origin, stop];
  }
  if (values.category === 'document_delivery') {
    return [origin, { ...placeStop(15), contact_name: values.recipient_name ?? '' }];
  }
  return [origin, placeStop(values.category === 'escort' ? 30 : 0)];
}

/** Stops are re-seeded when what they were derived from changes (and the user hasn't edited them). */
export function seedKey(values: TaskFormValues): string {
  return [values.category, values.site_id, values.flight?.airport_id ?? '', values.flight?.direction ?? '', values.flight?.buffer_min ?? ''].join('|');
}

export function defaultFlight(site: SiteWithAirports | undefined): FlightValues {
  const sa = site?.airports.find((a) => a.is_default) ?? site?.airports[0];
  const at = nextSlot(180);
  return {
    airport_id: sa?.airport_id ?? '',
    direction: 'arrival',
    airline: '',
    flight_no: '',
    terminal: '',
    date: companyDateKey(at),
    time: companyTimeKey(at),
    buffer_min: sa?.default_buffer_min ?? 30,
  };
}

export function emptyTicket(): TicketDetailsValues {
  return { other_iata: '', other_name: '', other_date: '', other_time: '', other_terminal: '', booking_ref: '', issuer: '', tickets: [] };
}

function ticketToMeta(t: TicketDetailsValues): TicketMeta | null {
  const text = (v: string | undefined) => v?.trim() || null;
  const meta: TicketMeta = {
    other: { iata: text(t.other_iata), name: text(t.other_name), date: text(t.other_date), time: text(t.other_time), terminal: text(t.other_terminal) },
    booking_ref: text(t.booking_ref),
    issuer: text(t.issuer),
    tickets: t.tickets,
  };
  const empty = !Object.values(meta.other!).some(Boolean) && !meta.booking_ref && !meta.issuer && !t.tickets.length;
  return empty ? null : meta;
}

export function newTaskValues(category: TaskCategory, site: SiteWithAirports | undefined): TaskFormValues {
  const at = nextSlot(60);
  return {
    category,
    site_id: site?.id ?? '',
    title: '',
    priority: 'normal',
    description: '',
    passengers: [],
    flight: category === 'airport' ? defaultFlight(site) : null,
    ticket: emptyTicket(),
    recipient_name: '',
    document_ref: '',
    stops: [],
    date: companyDateKey(at),
    start_time: companyTimeKey(at),
    duration_min: 60,
    driver_id: null,
    vehicle_id: null,
    share_with_task_id: null,
    override_reason: '',
  };
}

type DeliveryMeta = { recipient_name?: string; document_ref?: string };

/** Edit mode: a saved task back into the form. */
export function taskToValues(task: TaskDetail): TaskFormValues {
  const assignment = primaryAssignment(task);
  const meta = (task.metadata ?? {}) as DeliveryMeta;
  const ticket = readTicketMeta(task.metadata);
  const end = task.scheduled_end ? new Date(task.scheduled_end).getTime() : new Date(task.scheduled_start).getTime() + (task.estimated_duration_min ?? 60) * 60_000;
  return {
    category: task.category,
    site_id: task.site_id,
    title: task.title,
    priority: task.priority,
    description: task.description ?? '',
    passengers: readPassengers(task.passengers).map((p) => ({
      person_id: p.person_id,
      name: p.name ?? '',
      phone: p.phone ?? '',
      visitor: p.visitor,
      group_id: p.group_id ?? null,
      grade: p.grade ?? null,
      group_code: p.group_code ?? null,
    })),
    flight: task.flight
      ? {
          airport_id: task.flight.airport_id ?? '',
          direction: task.flight.direction,
          airline: task.flight.airline ?? '',
          flight_no: task.flight.flight_no ?? '',
          terminal: task.flight.terminal ?? '',
          date: companyDateKey(task.flight.scheduled_time),
          time: companyTimeKey(task.flight.scheduled_time),
          buffer_min: task.flight.buffer_min,
        }
      : null,
    ticket: {
      other_iata: ticket?.other?.iata ?? '',
      other_name: ticket?.other?.name ?? '',
      other_date: ticket?.other?.date ?? '',
      other_time: ticket?.other?.time ?? '',
      other_terminal: ticket?.other?.terminal ?? '',
      booking_ref: ticket?.booking_ref ?? '',
      issuer: ticket?.issuer ?? '',
      tickets: ticket?.tickets ?? [],
    },
    recipient_name: meta.recipient_name ?? '',
    document_ref: meta.document_ref ?? '',
    stops: task.stops.map((s) => ({
      key: newStopKey(),
      kind: s.airport_id ? 'airport' : s.site_id ? 'site' : 'place',
      site_id: s.site_id,
      airport_id: s.airport_id,
      label: s.label ?? '',
      address: s.address ?? '',
      lat: s.lat,
      lng: s.lng,
      dwell_min: s.dwell_min,
      contact_name: s.contact_name ?? '',
      contact_phone: s.contact_phone ?? '',
    })),
    date: companyDateKey(task.scheduled_start),
    start_time: companyTimeKey(task.scheduled_start),
    duration_min: Math.max(5, Math.round((end - new Date(task.scheduled_start).getTime()) / 60_000)),
    driver_id: assignment?.driver_id ?? null,
    vehicle_id: assignment?.vehicle_id ?? null,
    share_with_task_id: null,
    override_reason: task.conflicts_overridden ? (task.override_reason ?? '') : '',
  };
}

export const startIso = (v: Pick<TaskFormValues, 'date' | 'start_time'>) => companyDateTimeToIso(v.date, v.start_time);
export const flightIso = (f: Pick<FlightValues, 'date' | 'time'>) => companyDateTimeToIso(f.date, f.time);

/** Form + plan → rpc_save_task payload. */
export function valuesToPayload(values: TaskFormValues, timeline: Timeline, legs: (RouteLeg | null)[], id?: string): SaveTaskPayload {
  const start = startIso(values);
  const metadata: SaveTaskPayload['metadata'] =
    values.category === 'document_delivery'
      ? { recipient_name: values.recipient_name || undefined, document_ref: values.document_ref || undefined }
      : values.category === 'airport'
        ? // null clears a ticket removed in edit mode (the RPC merges metadata)
          { ticket: ticketToMeta(values.ticket) as Json | null }
        : {};
  return {
    id,
    site_id: values.site_id,
    category: values.category,
    priority: values.priority,
    title: values.title.trim(),
    description: values.description?.trim() || null,
    scheduled_start: start,
    scheduled_end: new Date(new Date(start).getTime() + values.duration_min * 60_000).toISOString(),
    estimated_duration_min: values.duration_min,
    estimated_distance_km: timeline.distanceKm || null,
    passengers: values.passengers.map((p) =>
      p.person_id
        ? { person_id: p.person_id, name: p.name.trim() }
        : { name: p.name.trim(), ...(p.phone?.trim() ? { phone: p.phone.trim() } : {}), ...(p.visitor ? { visitor: true, group_id: p.group_id ?? null } : {}) },
    ),
    metadata,
    stops: values.stops.map((s, i) => ({
      label: s.label.trim(),
      address: s.address?.trim() || null,
      lat: s.lat,
      lng: s.lng,
      site_id: s.site_id,
      airport_id: s.airport_id,
      planned_arrival_at: timeline.arrivals[i] ?? null,
      dwell_min: s.dwell_min,
      leg_distance_km: i > 0 ? (legs[i - 1]?.distance_km ?? null) : null,
      leg_duration_min: i > 0 ? (legs[i - 1]?.duration_min ?? null) : null,
      contact_name: s.contact_name?.trim() || null,
      contact_phone: s.contact_phone?.trim() || null,
    })),
    flight:
      values.category === 'airport' && values.flight
        ? {
            airport_id: values.flight.airport_id,
            direction: values.flight.direction,
            airline: values.flight.airline?.trim() || null,
            flight_no: values.flight.flight_no.trim().toUpperCase(),
            terminal: values.flight.terminal?.trim() || null,
            scheduled_time: flightIso(values.flight),
            buffer_min: values.flight.buffer_min,
          }
        : null,
    driver_id: values.share_with_task_id ? null : values.driver_id,
    vehicle_id: values.share_with_task_id ? null : values.vehicle_id,
    override_reason: values.override_reason?.trim() || null,
    share_with_task_id: values.share_with_task_id,
  };
}
