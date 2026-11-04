/**
 * Demo-mode mirror of migration 0007 (passenger module, phase 2): check-in
 * codes (fn_sync_task_passengers), passenger notifications, live view
 * (rpc_passenger_live / fn_trip_live_payload), share links, check-in /
 * drop-off, SOS and trip requests — keep in sync with the SQL. Errors carry
 * the same i18n keys.
 *
 * Demo codes and share tokens are derived from the ids (stable across page
 * loads) so a code shown to the passenger works for the driver after a reload.
 */
import { AppError } from '@/lib/data-source';
import type { Json } from '@/lib/database.types';
import { readPassengers } from '@/features/grades/rules';
import type { LiveTrip, SharedTrip, SosResult, SosStatus, TripRequestInput } from '@/features/passenger/types';
import { distanceKm } from '@/lib/geo';
import { mockDb, mockTransition, type TransitionAction } from './db';
import type { Notification, Task, TaskPassenger } from './fixtures';
import { mockRescheduleTask, type MockActor } from './task-writes';

const HOUR = 3_600_000;
const ms = (iso: string) => new Date(iso).getTime();
const ENDED: Task['status'][] = ['completed', 'cancelled', 'declined', 'no_show'];

/** FNV-1a — deterministic demo codes / tokens */
function hash(text: string, seed = 0x811c9dc5) {
  let h = seed;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
const demoCode = (taskId: string, key: string) => String(hash(`${taskId}:${key}`) % 1_000_000).padStart(6, '0');
const demoToken = (taskId: string, personId: string) =>
  Array.from({ length: 8 }, (_, i) => hash(`${taskId}:${personId}`, 0x811c9dc5 + i).toString(16).padStart(8, '0')).join('');

function notify(n: Pick<Notification, 'user_id' | 'type' | 'title'> & Partial<Notification>) {
  const now = new Date().toISOString();
  mockDb.notifications.push({
    id: crypto.randomUUID(),
    company_id: mockDb.company.id,
    task_id: null,
    body: null,
    data: {},
    actions: [],
    channels: ['in_app', 'push'],
    scheduled_for: now,
    sent_at: null,
    read_at: null,
    acted_at: null,
    created_at: now,
    ...n,
  });
}

function audit(action: string, table_name: string, row_id: string, actor_id: string | null, data: Record<string, unknown> = {}) {
  mockDb.auditLog.push({ action, table_name, row_id, actor_id, data: data as Json, created_at: new Date().toISOString() });
}

const personOf = (profileId: string) => mockDb.people.find((p) => p.profile_id === profileId && p.registration_status === 'approved') ?? null;
const driverOf = (profileId: string) => mockDb.drivers.find((d) => d.profile_id === profileId) ?? null;
const primaryOf = (taskId: string) => mockDb.taskAssignments.find((a) => a.task_id === taskId && a.is_primary) ?? null;

// ---------------------------------------------------------------------------
// task_passengers (fn_sync_task_passengers + codes + "you're on a trip")
// ---------------------------------------------------------------------------
export function syncTaskPassengers(taskId: string, notifyNew = true): TaskPassenger[] {
  const task = mockDb.tasks.find((t) => t.id === taskId);
  if (!task) return [];
  const keep = mockDb.taskPassengers.filter((r) => r.task_id === taskId);
  const rows: TaskPassenger[] = readPassengers(task.passengers).map((p, i) => {
    const old = keep.find((k) => (p.person_id ? k.person_id === p.person_id : !k.person_id && k.name === p.name));
    return {
      id: old?.id ?? crypto.randomUUID(),
      task_id: taskId,
      company_id: task.company_id,
      person_id: p.person_id ?? null,
      name: p.name,
      pickup_order: i + 1,
      pickup_stop_seq: null,
      dropoff_stop_seq: null,
      checkin_code: old?.checkin_code ?? demoCode(taskId, p.person_id ?? p.name),
      checked_in_at: old?.checked_in_at ?? null,
      dropped_off_at: old?.dropped_off_at ?? null,
      created_at: old?.created_at ?? new Date().toISOString(),
    };
  });
  mockDb.taskPassengers = [...mockDb.taskPassengers.filter((r) => r.task_id !== taskId), ...rows];

  if (notifyNew && !['draft', ...ENDED].includes(task.status) && ms(task.scheduled_start) > Date.now() - HOUR) {
    for (const row of rows) {
      if (row.person_id && !keep.some((k) => k.person_id === row.person_id)) notifyPassengers(task, 'passenger_trip_assigned', null, {}, row.person_id);
    }
  }
  return rows;
}

/** The rows for a trip (built on first use for fixture trips, without notifications). */
export function taskPassengers(taskId: string): TaskPassenger[] {
  const rows = mockDb.taskPassengers.filter((r) => r.task_id === taskId);
  return rows.length ? rows : syncTaskPassengers(taskId, false);
}

/** fn_notify_passengers */
export function notifyPassengers(task: Task, type: Notification['type'], body: string | null = null, data: Record<string, unknown> = {}, personId?: string) {
  for (const row of taskPassengers(task.id)) {
    if (!row.person_id || (personId && row.person_id !== personId)) continue;
    const person = mockDb.people.find((p) => p.id === row.person_id);
    if (!person?.profile_id || person.registration_status !== 'approved') continue;
    notify({ user_id: person.profile_id, type, task_id: task.id, title: task.title, body, data: { ...data, audience: 'passenger' } as Json });
  }
}

/** trg_task_status_passengers — called by mockTransition. */
export function onTaskStatus(task: Task, from: Task['status'], to: Task['status']) {
  if (from === to) return;
  const type: Notification['type'] | null =
    to === 'en_route'
      ? from === 'delayed' && task.actual_start_at
        ? null
        : 'driver_on_the_way'
      : to === 'in_progress'
        ? 'driver_arrived'
        : to === 'delayed'
          ? 'task_delayed'
          : to === 'cancelled'
            ? 'task_cancelled'
            : to === 'completed'
              ? 'task_completed'
              : null;
  if (type) notifyPassengers(task, type, type === 'task_cancelled' ? task.cancel_reason : null);
  if (to === 'completed' || to === 'cancelled') {
    const now = new Date().toISOString();
    for (const row of taskPassengers(task.id)) if (row.checked_in_at && !row.dropped_off_at) row.dropped_off_at = now;
    for (const link of mockDb.shareLinks) if (link.task_id === task.id && ms(link.expires_at) > Date.now()) link.expires_at = now;
  }
}

/** trg_assignment_passengers — called when the primary driver is set. */
export function onPrimaryDriver(task: Task, driverId: string) {
  const changed = mockDb.taskEvents.some(
    (e) => e.task_id === task.id && e.type === 'assigned' && (e.payload as { driver_id?: string } | null)?.driver_id !== driverId,
  );
  if (changed) notifyPassengers(task, 'driver_changed', null, { driver_name: mockDb.drivers.find((d) => d.id === driverId)?.full_name ?? null });
}

/** trg_attachment_passengers — a document marked for passengers. */
export function onTripDocument(taskId: string, title: string | null, attachmentId: string, actorId: string | null) {
  const task = mockDb.tasks.find((t) => t.id === taskId);
  audit('insert', 'task_attachments', attachmentId, actorId, { task_id: taskId, title });
  if (task) notifyPassengers(task, 'trip_document_added', title, { attachment_id: attachmentId });
}

// ---------------------------------------------------------------------------
// live view + share links
// ---------------------------------------------------------------------------
function effectiveStart(task: Task) {
  const delay = mockDb.taskDelays.filter((d) => d.task_id === task.id && !d.resolved_at && d.new_estimated_start).at(-1);
  return delay?.new_estimated_start ?? task.scheduled_start;
}

/** fn_trip_is_live */
export function isTripLive(task: Task, now = Date.now()) {
  if (!['acknowledged', 'en_route', 'in_progress', 'delayed'].includes(task.status)) return false;
  const end = Math.max(ms(task.scheduled_end ?? task.scheduled_start), ms(effectiveStart(task)));
  return now >= ms(task.scheduled_start) - 2 * HOUR && now <= end + 2 * HOUR;
}

/** fn_trip_live_payload */
function livePayload(task: Task, personId: string, now = Date.now()): LiveTrip {
  const row = taskPassengers(task.id).find((r) => r.person_id === personId);
  const assignment = primaryOf(task.id);
  const loc = mockDb.driverLocations
    .filter((l) => l.driver_id === assignment?.driver_id)
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0];
  const fresh = loc && ms(loc.recorded_at) > now - 30 * 60_000 ? loc : undefined;
  const stops = mockDb.taskStops.filter((s) => s.task_id === task.id).sort((a, b) => a.seq - b.seq);
  const arrival = mockDb.flightDetails.some((f) => f.task_id === task.id && f.direction === 'arrival');
  const next = row?.checked_in_at
    ? stops.at(-1)
    : ((row?.pickup_stop_seq != null ? stops.find((s) => s.seq === row.pickup_stop_seq) : undefined) ??
      (arrival ? stops.find((s) => s.airport_id) : undefined) ??
      stops[0]);
  const live = isTripLive(task, now);
  let km: number | null = null;
  let eta: string | null = null;
  if (fresh && next?.lat != null && next.lng != null) {
    km = distanceKm(fresh.lat, fresh.lng, next.lat, next.lng);
    // to this passenger's next stop — not the driver's eta_next_stop_at (often another stop)
    eta = new Date(now + ((km * 1.3) / 40) * HOUR).toISOString();
  }
  return {
    task_id: task.id,
    status: task.status,
    live,
    location: live && fresh ? { lat: fresh.lat, lng: fresh.lng, heading: fresh.heading, speed_kmh: fresh.speed_kmh, recorded_at: fresh.recorded_at } : null,
    next_stop: next ? { seq: next.seq, label: next.label, lat: next.lat, lng: next.lng, planned_arrival_at: next.planned_arrival_at } : null,
    distance_km: live && km != null ? Math.round(km * 10) / 10 : null,
    eta_at: live ? eta : null,
    checked_in_at: row?.checked_in_at ?? null,
  };
}

function ownTrip(profileId: string, taskId: string) {
  const person = personOf(profileId);
  const task = mockDb.tasks.find((t) => t.id === taskId);
  if (!person || !task || !taskPassengers(taskId).some((r) => r.person_id === person.id)) throw new AppError('errors.forbidden', 'errors.forbidden');
  return { person, task };
}

/** rpc_passenger_live */
export function mockPassengerLive(profileId: string, taskId: string, now = Date.now()): LiveTrip {
  const { person, task } = ownTrip(profileId, taskId);
  return livePayload(task, person.id, now);
}

/** rpc_passenger_home additions (checkin, share_token, open_sos, live) for one trip */
export function passengerTripExtras(task: Task, personId: string, now = Date.now()) {
  const row = taskPassengers(task.id).find((r) => r.person_id === personId);
  const link = mockDb.shareLinks.find((l) => l.task_id === task.id && l.person_id === personId && !l.revoked_at && ms(l.expires_at) > now);
  const sos = mockDb.sosEvents.filter((e) => e.task_id === task.id && e.person_id === personId && e.status !== 'resolved').at(-1);
  return {
    live: isTripLive(task, now),
    checkin: {
      code: ['scheduled', 'assigned', 'acknowledged', 'en_route', 'in_progress', 'delayed'].includes(task.status) && !row?.checked_in_at ? (row?.checkin_code ?? null) : null,
      checked_in_at: row?.checked_in_at ?? null,
      dropped_off_at: row?.dropped_off_at ?? null,
    },
    share_token: link?.token ?? null,
    open_sos: sos ? { id: sos.id, status: sos.status as SosStatus, created_at: sos.created_at } : null,
  };
}

/** rpc_create_share_link */
export function mockCreateShareLink(profileId: string, taskId: string): string {
  const { person, task } = ownTrip(profileId, taskId);
  if (['draft', ...ENDED].includes(task.status)) throw new AppError('share.errors.tripEnded');
  const now = Date.now();
  const existing = mockDb.shareLinks.find((l) => l.task_id === taskId && l.person_id === person.id && !l.revoked_at && ms(l.expires_at) > now);
  if (existing) return existing.token;
  const token = demoToken(taskId, person.id);
  mockDb.shareLinks = mockDb.shareLinks.filter((l) => l.token !== token);
  mockDb.shareLinks.push({
    id: crypto.randomUUID(),
    token,
    company_id: task.company_id,
    task_id: taskId,
    person_id: person.id,
    created_by: profileId,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(Math.max(ms(task.scheduled_end ?? task.scheduled_start), ms(effectiveStart(task))) + 3 * HOUR).toISOString(),
    revoked_at: null,
  });
  return token;
}

/** rpc_revoke_share_link */
export function mockRevokeShareLink(profileId: string, taskId: string) {
  const person = personOf(profileId);
  const now = new Date().toISOString();
  for (const l of mockDb.shareLinks) if (l.task_id === taskId && l.person_id === person?.id && !l.revoked_at) l.revoked_at = now;
}

/**
 * rpc_shared_trip (anonymous). A demo link opened in a fresh tab has no
 * stored row, so the token is matched against every passenger's derived one.
 */
export function mockSharedTrip(token: string, now = Date.now()): SharedTrip {
  let link = mockDb.shareLinks.find((l) => l.token === token);
  if (!link) {
    const match = mockDb.tasks
      .flatMap((t) => taskPassengers(t.id))
      .find((r) => r.person_id && demoToken(r.task_id, r.person_id) === token);
    if (!match) return { state: 'invalid' };
    const task = mockDb.tasks.find((t) => t.id === match.task_id)!;
    link = {
      id: '',
      token,
      company_id: task.company_id,
      task_id: task.id,
      person_id: match.person_id!,
      created_by: null,
      created_at: new Date(now).toISOString(),
      expires_at: new Date(Math.max(ms(task.scheduled_end ?? task.scheduled_start), ms(effectiveStart(task))) + 3 * HOUR).toISOString(),
      revoked_at: null,
    };
  }
  const task = mockDb.tasks.find((t) => t.id === link.task_id)!;
  if (link.revoked_at || ms(link.expires_at) <= now || ENDED.includes(task.status)) return { state: 'ended' };
  const assignment = primaryOf(task.id);
  const driver = mockDb.drivers.find((d) => d.id === assignment?.driver_id);
  const vehicle = mockDb.vehicles.find((v) => v.id === assignment?.vehicle_id);
  const stops = mockDb.taskStops.filter((s) => s.task_id === task.id).sort((a, b) => a.seq - b.seq);
  return {
    ...livePayload(task, link.person_id, now),
    state: 'active',
    scheduled_start: task.scheduled_start,
    company: mockDb.company.name,
    driver_first_name: driver ? driver.full_name.split(' ')[0]! : null,
    vehicle: vehicle ? { make: vehicle.make, model: vehicle.model, color: vehicle.color, plate_no: vehicle.plate_no } : null,
    destination: stops.at(-1)?.label ?? null,
  };
}

// ---------------------------------------------------------------------------
// check-in / drop-off (driver)
// ---------------------------------------------------------------------------
function assignedTask(profileId: string, taskId: string) {
  const driver = driverOf(profileId);
  const task = mockDb.tasks.find((t) => t.id === taskId);
  if (!driver || !task || primaryOf(taskId)?.driver_id !== driver.id) throw new AppError('errors.forbidden', 'errors.forbidden');
  return task;
}

function transition(task: Task, action: TransitionAction, profileId: string, payload: { lat?: number; lng?: number }) {
  mockTransition(task.id, action, payload, crypto.randomUUID(), profileId);
}

export type CheckInResult = { ok: true; name: string; pickup_order: number; status: Task['status'] } | { ok: false; error: string; name?: string };

/** rpc_driver_check_in — by code, or by row for riders without the app (visitors, no login) */
export function mockDriverCheckIn(
  profileId: string,
  taskId: string,
  code: string,
  at: { lat?: number; lng?: number } = {},
  now = Date.now(),
  riderId?: string,
): CheckInResult {
  const task = assignedTask(profileId, taskId);
  const nearPlan = now >= ms(task.scheduled_start) - 2 * HOUR && now <= ms(task.scheduled_end ?? task.scheduled_start) + 2 * HOUR;
  if (!(['en_route', 'in_progress', 'delayed'].includes(task.status) || (['assigned', 'acknowledged'].includes(task.status) && nearPlan))) {
    return { ok: false, error: 'checkin.errors.notActive' };
  }
  const fails = mockDb.auditLog.filter((a) => a.action === 'checkin_failed' && a.row_id === taskId && ms(a.created_at) > now - 10 * 60_000).length;
  if (fails >= 5) return { ok: false, error: 'checkin.errors.locked' };
  let row: TaskPassenger | undefined;
  if (riderId) {
    row = taskPassengers(taskId).find((r) => r.id === riderId);
    if (!row) throw new AppError('errors.invalidInput');
    const person = mockDb.people.find((p) => p.id === row!.person_id);
    if (person?.profile_id && person.registration_status === 'approved') return { ok: false, error: 'checkin.errors.codeRequired', name: row.name };
  } else {
    row = taskPassengers(taskId).find((r) => r.checkin_code === code.replace(/\D/g, ''));
  }
  if (!row) {
    audit('checkin_failed', 'task_passengers', taskId, profileId, at);
    return { ok: false, error: fails >= 4 ? 'checkin.errors.locked' : 'checkin.errors.invalid' };
  }
  if (row.checked_in_at) return { ok: false, error: 'checkin.errors.already', name: row.name };
  row.checked_in_at = new Date(now).toISOString();
  audit('checked_in', 'task_passengers', row.id, profileId, { task_id: taskId, person_id: row.person_id, method: riderId ? 'no_app' : 'code', ...at });
  if (task.status === 'assigned' || task.status === 'acknowledged') transition(task, 'start', profileId, at);
  if (task.status === 'en_route' || task.status === 'delayed') transition(task, 'arrive', profileId, at);
  return { ok: true, name: row.name, pickup_order: row.pickup_order, status: task.status };
}

/** rpc_driver_drop_off */
export function mockDriverDropOff(profileId: string, taskPassengerId: string, at: { lat?: number; lng?: number } = {}) {
  const row = mockDb.taskPassengers.find((r) => r.id === taskPassengerId);
  const task = assignedTask(profileId, row?.task_id ?? '');
  if (!row!.checked_in_at) throw new AppError('checkin.errors.notCheckedIn');
  if (row!.dropped_off_at) return { ok: true, completed: false };
  row!.dropped_off_at = new Date().toISOString();
  audit('dropped_off', 'task_passengers', row!.id, profileId, { task_id: task.id, person_id: row!.person_id, ...at });
  const done = taskPassengers(task.id).every((r) => r.checked_in_at && r.dropped_off_at);
  if (done && ['en_route', 'in_progress', 'delayed'].includes(task.status)) transition(task, 'complete', profileId, at);
  return { ok: true, completed: done };
}

// ---------------------------------------------------------------------------
// SOS
// ---------------------------------------------------------------------------
/** fn_notify_site_staff: owners/admins + dispatchers who can act on the site */
const siteStaff = (siteId: string | null) =>
  mockDb.profiles.filter((p) => {
    const scope = mockDb.userSites[p.id] ?? [];
    return p.is_active && (p.role === 'owner' || p.role === 'admin' || (p.role === 'dispatcher' && (!siteId || !scope.length || scope.includes(siteId))));
  });

/** rpc_passenger_sos */
export function mockPassengerSos(profileId: string, taskId: string, loc: { lat?: number; lng?: number; accuracy?: number } = {}, message?: string, now = Date.now()): SosResult {
  const { person, task } = ownTrip(profileId, taskId);
  const row = taskPassengers(taskId).find((r) => r.person_id === person.id)!;
  if (!(isTripLive(task, now) || (row.checked_in_at && !row.dropped_off_at && !['completed', 'cancelled'].includes(task.status)))) {
    throw new AppError('sos.errors.notActive');
  }
  const at = new Date(now).toISOString();
  let event = mockDb.sosEvents.find((e) => e.task_id === taskId && e.person_id === person.id && e.status !== 'resolved');
  if (event) {
    Object.assign(event, {
      lat: loc.lat ?? event.lat,
      lng: loc.lng ?? event.lng,
      accuracy_m: loc.accuracy ?? event.accuracy_m,
      location_at: loc.lat != null ? at : event.location_at,
      message: message?.trim() || event.message,
    });
  } else {
    event = {
      id: crypto.randomUUID(),
      company_id: task.company_id,
      task_id: taskId,
      person_id: person.id,
      raised_by: profileId,
      lat: loc.lat ?? null,
      lng: loc.lng ?? null,
      accuracy_m: loc.accuracy ?? null,
      message: message?.trim() || null,
      location_at: loc.lat != null ? at : null,
      status: 'open',
      acknowledged_by: null,
      acknowledged_at: null,
      resolved_by: null,
      resolved_at: null,
      resolution_note: null,
      created_at: at,
    };
    mockDb.sosEvents.push(event);
    for (const p of siteStaff(task.site_id)) {
      notify({ user_id: p.id, type: 'sos_alert', task_id: task.id, title: person.full_name, body: event.message, data: { sos_id: event.id, lat: loc.lat ?? null, lng: loc.lng ?? null } });
    }
  }
  audit('sos_raised', 'sos_events', event.id, profileId, { task_id: taskId, ...loc, message });
  return {
    id: event.id,
    emergency_contacts: mockDb.emergencyContacts.filter((c) => c.person_id === person.id).map((c) => ({ name: c.name, phone: c.phone })),
    dispatch_phone: mockDb.sites.find((s) => s.id === task.site_id)?.contact_phone ?? null,
  };
}

const canSeeSite = (actor: MockActor, siteId: string | null) => actor.role === 'owner' || actor.role === 'admin' || !siteId || !actor.siteIds.length || actor.siteIds.includes(siteId);
const isStaff = (actor: MockActor) => actor.role === 'owner' || actor.role === 'admin' || actor.role === 'dispatcher';

/** rpc_sos_update (acknowledge | resolve) */
export function mockSosUpdate(actor: MockActor, sosId: string, action: 'acknowledge' | 'resolve', note?: string) {
  const event = mockDb.sosEvents.find((e) => e.id === sosId);
  const task = mockDb.tasks.find((t) => t.id === event?.task_id);
  if (!event || !task || !isStaff(actor) || !canSeeSite(actor, task.site_id)) throw new AppError('errors.forbidden', 'errors.forbidden');
  const now = new Date().toISOString();
  if (action === 'acknowledge' && event.status === 'open') {
    Object.assign(event, { status: 'acknowledged', acknowledged_by: actor.id, acknowledged_at: now });
  } else if (action === 'resolve' && event.status !== 'resolved') {
    Object.assign(event, {
      status: 'resolved',
      resolved_by: actor.id,
      resolved_at: now,
      acknowledged_by: event.acknowledged_by ?? actor.id,
      acknowledged_at: event.acknowledged_at ?? now,
      resolution_note: note?.trim() || null,
    });
  } else {
    throw new AppError('errors.invalidInput');
  }
  audit(`sos_${action}`, 'sos_events', sosId, actor.id, { note });
}

/** SOS events the actor may see (RLS: staff of the trip's site, viewers too). */
export function mockSosEvents(actor: MockActor) {
  return mockDb.sosEvents.filter((e) => {
    const task = mockDb.tasks.find((t) => t.id === e.task_id);
    return task && (isStaff(actor) || actor.role === 'viewer') && canSeeSite(actor, task.site_id);
  });
}

// ---------------------------------------------------------------------------
// trip requests
// ---------------------------------------------------------------------------
/** rpc_passenger_request */
export function mockPassengerRequest(profileId: string, input: TripRequestInput, now = Date.now()): string {
  const person = personOf(profileId);
  if (!person) throw new AppError('errors.forbidden', 'errors.forbidden');
  if ((input.notes ?? '').length > 1000) throw new AppError('requests.errors.notesLong');
  let task: Task | undefined;
  if (input.kind !== 'new') {
    task = mockDb.tasks.find((t) => t.id === input.task_id);
    if (!task || !taskPassengers(task.id).some((r) => r.person_id === person.id)) throw new AppError('errors.forbidden', 'errors.forbidden');
    if (!['scheduled', 'assigned', 'acknowledged', 'declined', 'draft'].includes(task.status) || ms(task.scheduled_start) <= now) {
      throw new AppError('requests.errors.tooLate');
    }
    if (mockDb.tripRequests.some((r) => r.task_id === task!.id && r.person_id === person.id && r.status === 'pending')) throw new AppError('requests.errors.duplicate');
  }
  if (input.kind !== 'cancel' && (!input.requested_start || ms(input.requested_start) <= now)) throw new AppError('requests.errors.startFuture');
  if (input.kind === 'new' && (!input.pickup?.trim() || !input.dropoff?.trim())) throw new AppError('requests.errors.places');

  const at = new Date(now).toISOString();
  const id = crypto.randomUUID();
  const siteId = task?.site_id ?? person.site_id;
  mockDb.tripRequests.push({
    id,
    company_id: person.company_id,
    person_id: person.id,
    requested_by: profileId,
    kind: input.kind,
    task_id: input.kind === 'new' ? null : (task?.id ?? null),
    site_id: siteId,
    requested_start: input.kind === 'cancel' ? null : (input.requested_start ?? null),
    pickup: input.pickup?.trim() || null,
    dropoff: input.dropoff?.trim() || null,
    passengers_count: Math.min(20, Math.max(1, input.passengers_count ?? 1)),
    notes: input.notes?.trim() || null,
    status: 'pending',
    decided_by: null,
    decided_at: null,
    decision_note: null,
    created_task_id: null,
    created_at: at,
    updated_at: at,
  });
  for (const p of siteStaff(siteId)) {
    notify({ user_id: p.id, type: 'trip_request', task_id: input.kind === 'new' ? null : (task?.id ?? null), title: person.full_name, body: input.notes?.trim() || null, data: { request_id: id, kind: input.kind } });
  }
  return id;
}

/** rpc_withdraw_request */
export function mockWithdrawRequest(profileId: string, requestId: string) {
  const person = personOf(profileId);
  const request = mockDb.tripRequests.find((r) => r.id === requestId && r.person_id === person?.id && r.status === 'pending');
  if (!request) throw new AppError('errors.invalidInput');
  Object.assign(request, { status: 'withdrawn', updated_at: new Date().toISOString() });
}

/** Requests the actor may see (own for passengers; site-scoped for staff). */
export function mockTripRequests(actor: MockActor) {
  if (actor.role === 'passenger') {
    const person = personOf(actor.id);
    return mockDb.tripRequests.filter((r) => r.person_id === person?.id);
  }
  if (!isStaff(actor) && actor.role !== 'viewer') return [];
  return mockDb.tripRequests.filter((r) => canSeeSite(actor, r.site_id));
}

/** rpc_decide_request */
export function mockDecideRequest(
  actor: MockActor,
  input: { requestId: string; approve: boolean; note?: string; createdTaskId?: string | null; overrideReason?: string | null },
) {
  const request = mockDb.tripRequests.find((r) => r.id === input.requestId);
  if (!request || !isStaff(actor) || !canSeeSite(actor, request.site_id)) throw new AppError('errors.forbidden', 'errors.forbidden');
  if (request.status !== 'pending') throw new AppError('requests.errors.decided');
  if (!input.approve && !input.note?.trim()) throw new AppError('requests.errors.reasonRequired');

  if (input.approve && request.task_id) {
    const task = mockDb.tasks.find((t) => t.id === request.task_id)!;
    if (request.kind === 'reschedule') {
      mockRescheduleTask({ taskId: task.id, start: request.requested_start!, overrideReason: input.overrideReason }, actor);
    } else if (request.kind === 'cancel') {
      if (taskPassengers(task.id).length <= 1) {
        mockTransition(task.id, 'cancel', { reason: input.note?.trim() || 'Passenger request' }, crypto.randomUUID(), actor.id);
      } else {
        task.passengers = readPassengers(task.passengers).filter((p) => p.person_id !== request.person_id) as unknown as Json;
        syncTaskPassengers(task.id);
      }
    }
  } else if (input.approve && input.createdTaskId && !mockDb.tasks.some((t) => t.id === input.createdTaskId)) {
    throw new AppError('errors.invalidInput');
  }

  const now = new Date().toISOString();
  Object.assign(request, {
    status: input.approve ? 'approved' : 'rejected',
    decided_by: actor.id,
    decided_at: now,
    decision_note: input.note?.trim() || null,
    created_task_id: request.kind === 'new' ? (input.createdTaskId ?? null) : null,
    updated_at: now,
  });
  const person = mockDb.people.find((p) => p.id === request.person_id);
  if (person?.profile_id) {
    notify({
      user_id: person.profile_id,
      type: 'trip_request_decided',
      task_id: input.createdTaskId ?? request.task_id,
      title: person.full_name,
      body: input.note?.trim() || null,
      data: { request_id: request.id, kind: request.kind, approved: input.approve, audience: 'passenger' },
    });
  }
  audit(input.approve ? 'approved' : 'rejected', 'trip_requests', request.id, actor.id, { kind: request.kind, note: input.note });
}
