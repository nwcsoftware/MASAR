/**
 * In-memory mock database for demo mode. Starts as a deep copy of the
 * fixtures; driver actions mutate it through `mockTransition`, which mirrors
 * the state machine in rpc_task_transition (0001_init.sql §11) so the demo
 * behaves like the real backend.
 */
import * as fx from './fixtures';
import type { Enums, Json } from '@/lib/database.types';

const clone = <T>(value: T): T => structuredClone(value);


export const mockDb = {
  company: clone(fx.company),
  companySettings: clone(fx.companySettings),
  profiles: clone(fx.profiles),
  userSites: clone(fx.userSites),
  sites: clone(fx.sites),
  airports: clone(fx.airports),
  siteAirports: clone(fx.siteAirports),
  drivers: clone(fx.drivers),
  vehicles: clone(fx.vehicles),
  driverAvailability: clone(fx.driverAvailability),
  driverLocations: clone(fx.driverLocations),
  tasks: clone(fx.tasks),
  taskStops: clone(fx.taskStops),
  taskAssignments: clone(fx.taskAssignments),
  flightDetails: clone(fx.flightDetails),
  taskDelays: clone(fx.taskDelays),
  taskEvents: clone(fx.taskEvents),
  taskConflicts: clone(fx.taskConflicts),
  taskAttachments: clone(fx.taskAttachments),
  notifications: clone(fx.notifications),
  holidays: clone(fx.holidays),
  driverDaySummaries: clone(fx.driverDaySummaries),
};

/** `?mock=empty` / `?mock=error` render every screen's empty or error state. */
export type MockMode = 'normal' | 'empty' | 'error';

export function mockMode(): MockMode {
  if (typeof window === 'undefined') return 'normal';
  const mode = new URLSearchParams(window.location.search).get('mock');
  return mode === 'empty' || mode === 'error' ? mode : 'normal';
}

const LATENCY_MS = import.meta.env.MODE === 'test' ? 0 : 250;

/**
 * Wraps a mock read so it behaves like a network call: async, a little
 * latency (so skeletons are visible), and honours ?mock=empty|error.
 */
export async function mockQuery<T>(read: () => T | Promise<T>, empty: T): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
  const mode = mockMode();
  if (mode === 'error') throw new Error('Mock error (?mock=error)');
  if (mode === 'empty') return empty;
  return clone(await read());
}

type TaskStatus = Enums<'task_status'>;
type DelayReason = Enums<'delay_reason'>;

export type TransitionAction = 'acknowledge' | 'decline' | 'start' | 'arrive' | 'delay' | 'resume' | 'complete' | 'cancel';

const ALLOWED_FROM: Record<TransitionAction, TaskStatus[]> = {
  acknowledge: ['assigned'],
  decline: ['assigned'],
  start: ['assigned', 'acknowledged', 'delayed'],
  arrive: ['en_route', 'delayed'],
  delay: ['assigned', 'acknowledged', 'en_route', 'in_progress'],
  resume: ['delayed'],
  complete: ['en_route', 'in_progress', 'delayed'],
  cancel: ['draft', 'scheduled', 'assigned', 'acknowledged', 'en_route', 'in_progress', 'delayed', 'declined', 'no_show'],
};

const EVENT_FOR: Record<TransitionAction, Enums<'task_event_type'>> = {
  acknowledge: 'acknowledged',
  decline: 'declined',
  start: 'started',
  arrive: 'arrived',
  delay: 'delayed',
  resume: 'resumed',
  complete: 'completed',
  cancel: 'cancelled',
};

export interface TransitionPayload {
  reason?: DelayReason | string;
  delay_min?: number;
  note?: string;
  notes?: string;
  odometer_km?: number;
  distance_km?: number;
  lat?: number;
  lng?: number;
  client_ts?: string;
}

/** Mirror of rpc_task_transition for demo mode. Idempotent on eventId. */
export function mockTransition(taskId: string, action: TransitionAction, payload: TransitionPayload, eventId: string, actorId: string | null) {
  const db = mockDb;
  const task = db.tasks.find((t) => t.id === taskId);
  if (!task) throw new Error('task not found');
  if (db.taskEvents.some((e) => e.id === eventId)) return clone(task);

  const from = task.status;
  if (!ALLOWED_FROM[action].includes(from)) throw new Error(`cannot ${action} from ${from}`);
  const now = new Date().toISOString();
  const assignment = db.taskAssignments.find((a) => a.task_id === taskId && a.is_primary);
  let to: TaskStatus;

  switch (action) {
    case 'acknowledge':
      to = 'acknowledged';
      if (assignment) assignment.acknowledged_at = now;
      break;
    case 'decline':
      to = 'declined';
      if (assignment) {
        assignment.declined_at = now;
        assignment.decline_reason = payload.reason ?? null;
      }
      break;
    case 'start':
      to = 'en_route';
      task.actual_start_at ??= now;
      if (payload.odometer_km !== undefined) task.odometer_start_km = payload.odometer_km;
      break;
    case 'arrive':
      to = 'in_progress';
      break;
    case 'delay': {
      to = 'delayed';
      const minutes = payload.delay_min;
      db.taskDelays.push({
        id: crypto.randomUUID(),
        task_id: taskId,
        reported_by: actorId,
        reason: (payload.reason as DelayReason | undefined) ?? 'other',
        delay_min: minutes ?? null,
        note: payload.note ?? null,
        previous_status: from,
        new_estimated_start: minutes ? new Date(new Date(task.scheduled_start).getTime() + minutes * 60_000).toISOString() : null,
        resolved_at: null,
        created_at: now,
      });
      const flight = db.flightDetails.find((f) => f.task_id === taskId);
      if (flight && minutes) {
        flight.estimated_time = new Date(new Date(flight.estimated_time ?? flight.scheduled_time).getTime() + minutes * 60_000).toISOString();
        if (payload.reason === 'flight_delayed') flight.flight_status = 'delayed';
      }
      break;
    }
    case 'resume': {
      const open = db.taskDelays.filter((d) => d.task_id === taskId && !d.resolved_at).at(-1);
      to = open?.previous_status ?? 'acknowledged';
      db.taskDelays.forEach((d) => {
        if (d.task_id === taskId && !d.resolved_at) d.resolved_at = now;
      });
      break;
    }
    case 'complete':
      to = 'completed';
      task.actual_end_at = now;
      task.actual_start_at ??= task.scheduled_start;
      if (payload.odometer_km !== undefined) task.odometer_end_km = payload.odometer_km;
      if (payload.distance_km !== undefined) task.actual_distance_km = payload.distance_km;
      if (payload.notes) task.completion_notes = payload.notes;
      db.taskDelays.forEach((d) => {
        if (d.task_id === taskId && !d.resolved_at) d.resolved_at = now;
      });
      break;
    case 'cancel':
      to = 'cancelled';
      task.cancel_reason = payload.reason ?? null;
      break;
  }

  task.status = to;
  task.updated_at = now;
  db.taskEvents.push({
    id: eventId,
    task_id: taskId,
    company_id: task.company_id,
    type: EVENT_FOR[action],
    actor_id: actorId,
    from_status: from,
    to_status: to,
    lat: payload.lat ?? null,
    lng: payload.lng ?? null,
    payload: payload as unknown as Json,
    client_ts: payload.client_ts ?? now,
    created_at: now,
  });

  const driver = db.drivers.find((d) => d.id === assignment?.driver_id);
  if (driver && action !== 'cancel') {
    driver.current_status = to === 'en_route' || to === 'in_progress' || to === 'delayed' ? to : 'idle';
    driver.last_seen_at = now;
  }
  return clone(task);
}
