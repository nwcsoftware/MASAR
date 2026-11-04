/**
 * Demo-mode mirror of migration 0003 (conflict engine, rpc_save_task,
 * rpc_reschedule_task, rpc_override_task_conflicts, rpc_share_trip) over the
 * in-memory store — keep the two in sync, like mockTransition and
 * rpc_task_transition. Errors carry the same i18n keys the SQL raises.
 * Every write is all-or-nothing: the store is restored if a step throws,
 * as the RPC's transaction would roll back.
 */
import { AppError } from '@/lib/data-source';
import type { AppRole } from '@/lib/task-meta';
import type { Json } from '@/lib/database.types';
import { distanceKm } from '@/lib/geo';
import { gradeConflicts, readPassengers, snapshotPassengers, type Passenger } from '@/features/grades/rules';
import type { PreviewConflict, SaveTaskPayload } from '@/features/tasks/types';
import { EDITABLE_STATUSES, sharedHostId } from '@/features/tasks/types';
import { mockDb } from './db';
import { onPrimaryDriver, syncTaskPassengers, taskPassengers } from './passenger-trips';
import type { Task, TaskConflict, TaskEvent } from './fixtures';

export interface MockActor {
  id: string;
  role: AppRole;
  /** user_sites scope; empty = all sites */
  siteIds: string[];
}

type ConflictRow = Omit<PreviewConflict, 'driver_id'>;

const CLOSED: Task['status'][] = ['cancelled', 'completed', 'declined', 'no_show', 'draft'];
const MIN = 60_000;

const isStaff = (a: MockActor) => a.role === 'owner' || a.role === 'admin' || a.role === 'dispatcher';
const isAdmin = (a: MockActor) => a.role === 'owner' || a.role === 'admin';
/** auth_can_access_site */
const canAccessSite = (a: MockActor, siteId: string) => isAdmin(a) || !a.siteIds.length || a.siteIds.includes(siteId);

/** Company-local date and wall-clock time (company timezone, like the SQL). */
function local(value: string | number): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: mockDb.company.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(value))
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}:${parts.second}` };
}

const ms = (iso: string) => new Date(iso).getTime();
const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

/** fn_task_effective_start / _end */
function effectiveStart(task: Task): number {
  const open = mockDb.taskDelays.filter((d) => d.task_id === task.id && !d.resolved_at).at(-1);
  return ms(open?.new_estimated_start ?? task.scheduled_start);
}
function effectiveEnd(task: Task): number {
  return task.scheduled_end ? ms(task.scheduled_end) : effectiveStart(task) + (task.estimated_duration_min ?? 60) * MIN;
}

function firstStop(taskId: string) {
  return mockDb.taskStops.filter((s) => s.task_id === taskId).sort((a, b) => a.seq - b.seq)[0] ?? null;
}

function tasksOf(filter: (a: (typeof mockDb.taskAssignments)[number]) => boolean, exclude: string | null) {
  return mockDb.taskAssignments
    .filter(filter)
    .map((a) => mockDb.tasks.find((t) => t.id === a.task_id))
    .filter((t): t is Task => Boolean(t) && t!.id !== exclude);
}

// ---------------------------------------------------------------------------
// fn_conflicts_for
// ---------------------------------------------------------------------------
export function mockConflictsFor(input: {
  driverId: string | null;
  vehicleId: string | null;
  start: string;
  end: string | null;
  firstLat?: number | null;
  firstLng?: number | null;
  excludeTaskId?: string | null;
}): ConflictRow[] {
  const settings = mockDb.companySettings;
  const start = ms(input.start);
  const end = input.end && ms(input.end) > start ? ms(input.end) : start + 60 * MIN;
  const exclude = input.excludeTaskId ?? null;
  const day = local(start).date;
  const rows: ConflictRow[] = [];

  if (input.driverId) {
    const driver = mockDb.drivers.find((d) => d.id === input.driverId);
    if (!driver) throw new AppError(`driver ${input.driverId} not found`);
    const theirs = tasksOf((a) => a.driver_id === driver.id, exclude);
    const open = theirs.filter((t) => !CLOSED.includes(t.status));

    for (const t of open) {
      if (!overlaps(ms(t.scheduled_start) - 15 * MIN, effectiveEnd(t) + 15 * MIN, start, end)) continue;
      const site = mockDb.sites.find((s) => s.id === t.site_id);
      rows.push({
        type: 'driver_overlap',
        severity: 'blocking',
        other_task_id: t.id,
        details: { title: t.title, site: site?.name ?? '', start: t.scheduled_start, end: new Date(effectiveEnd(t)).toISOString() },
      });
    }

    if (input.firstLat != null && input.firstLng != null) {
      for (const t of open) {
        const stop = firstStop(t.id);
        if (local(t.scheduled_start).date !== day || stop?.lat == null || stop.lng == null) continue;
        const km = distanceKm(input.firstLat, input.firstLng, stop.lat, stop.lng);
        if (km <= settings.far_location_km) continue;
        const site = mockDb.sites.find((s) => s.id === t.site_id);
        rows.push({
          type: 'driver_multi_location_same_day',
          severity: 'warning',
          other_task_id: t.id,
          details: { title: t.title, site: site?.name ?? '', distance_km: Math.round(km * 10) / 10 },
        });
      }
    }

    const plannedMin =
      theirs
        .filter((t) => !['cancelled', 'declined', 'no_show', 'draft'].includes(t.status) && local(t.scheduled_start).date === day)
        .reduce((sum, t) => sum + Math.trunc((effectiveEnd(t) - ms(t.scheduled_start)) / MIN), 0) + Math.round((end - start) / MIN);
    const maxMin = driver.max_daily_driving_min ?? settings.max_daily_driving_min;
    if (plannedMin > maxMin) {
      rows.push({ type: 'driver_over_hours', severity: 'warning', other_task_id: null, details: { planned_min: plannedMin, max_min: maxMin } });
    }

    if (driver.shift_start && driver.shift_end) {
      const s = local(start);
      const e = local(end);
      if (s.time < driver.shift_start || e.time > driver.shift_end || e.date > s.date) {
        rows.push({
          type: 'outside_working_hours',
          severity: 'info',
          other_task_id: null,
          details: { shift_start: driver.shift_start, shift_end: driver.shift_end },
        });
      }
    }

    for (const a of mockDb.driverAvailability) {
      if (a.driver_id !== driver.id || !overlaps(ms(a.starts_at), ms(a.ends_at), start, end)) continue;
      rows.push({ type: 'driver_unavailable', severity: 'blocking', other_task_id: null, details: { availability: a.type, from: a.starts_at, to: a.ends_at } });
    }
  }

  if (input.vehicleId) {
    for (const t of tasksOf((a) => a.vehicle_id === input.vehicleId, exclude)) {
      if (CLOSED.includes(t.status) || !overlaps(ms(t.scheduled_start), effectiveEnd(t), start, end)) continue;
      rows.push({
        type: 'vehicle_overlap',
        severity: 'warning',
        other_task_id: t.id,
        details: { title: t.title, start: t.scheduled_start, end: new Date(effectiveEnd(t)).toISOString() },
      });
    }
  }
  return rows;
}

/** rpc_preview_task_conflicts */
export function mockPreviewConflicts(input: {
  driverIds: string[];
  vehicleId: string | null;
  start: string;
  end: string;
  firstLat?: number | null;
  firstLng?: number | null;
  excludeTaskId?: string | null;
}): PreviewConflict[] {
  if (ms(input.end) <= ms(input.start)) throw new AppError('tasks.errors.endBeforeStart');
  const base = { start: input.start, end: input.end, firstLat: input.firstLat, firstLng: input.firstLng, excludeTaskId: input.excludeTaskId };
  return [
    ...input.driverIds
      .filter((id) => mockDb.drivers.some((d) => d.id === id))
      .flatMap((driverId) => mockConflictsFor({ ...base, driverId, vehicleId: null }).map((c) => ({ ...c, driver_id: driverId }))),
    ...(input.vehicleId ? mockConflictsFor({ ...base, driverId: null, vehicleId: input.vehicleId }).map((c) => ({ ...c, driver_id: null })) : []),
  ];
}

// ---------------------------------------------------------------------------
// fn_refresh_task_conflicts / fn_conflict_gate
// ---------------------------------------------------------------------------
function refreshConflicts(taskId: string, now: string) {
  const task = mockDb.tasks.find((t) => t.id === taskId);
  if (!task) return;
  for (const c of mockDb.taskConflicts) if (c.task_id === taskId && !c.resolved_at) c.resolved_at = now;
  const stop = firstStop(taskId);
  for (const a of mockDb.taskAssignments.filter((x) => x.task_id === taskId)) {
    const rows = mockConflictsFor({
      driverId: a.driver_id,
      vehicleId: a.vehicle_id,
      start: task.scheduled_start,
      end: new Date(effectiveEnd(task)).toISOString(),
      firstLat: stop?.lat,
      firstLng: stop?.lng,
      excludeTaskId: taskId,
    });
    for (const row of rows) {
      mockDb.taskConflicts.push({
        id: crypto.randomUUID(),
        task_id: taskId,
        driver_id: a.driver_id,
        vehicle_id: a.vehicle_id,
        resolved_at: null,
        created_at: now,
        ...row,
      } satisfies TaskConflict);
    }
  }
  const main = mockDb.taskAssignments.find((x) => x.task_id === taskId && x.is_primary);
  for (const row of taskGradeConflicts(readPassengers(task.passengers), main?.vehicle_id ?? null, main?.driver_id ?? null)) {
    mockDb.taskConflicts.push({
      id: crypto.randomUUID(),
      task_id: taskId,
      driver_id: main?.driver_id ?? null,
      vehicle_id: main?.vehicle_id ?? null,
      resolved_at: null,
      created_at: now,
      ...row,
    } satisfies TaskConflict);
  }
}

/** fn_grade_conflicts against the store's vehicles and drivers. */
function taskGradeConflicts(passengers: Passenger[], vehicleId: string | null, driverId: string | null) {
  return gradeConflicts({
    passengers,
    groups: mockDb.gradeGroups,
    vehicleGroupId: mockDb.vehicles.find((v) => v.id === vehicleId)?.grade_group_id,
    serveGroupId: mockDb.drivers.find((d) => d.id === driverId)?.serve_group_id,
  });
}

/** fn_snapshot_passengers over the store, with the RPC's error keys. */
function snapshot(passengers: Passenger[]): Json {
  try {
    return snapshotPassengers(passengers, mockDb.people, mockDb.gradeGroups) as unknown as Json;
  } catch {
    throw new AppError('errors.invalidInput');
  }
}

function event(task: Task, type: TaskEvent['type'], actorId: string | null, now: string, extra: Partial<TaskEvent> = {}) {
  mockDb.taskEvents.push({
    id: crypto.randomUUID(),
    task_id: task.id,
    company_id: task.company_id,
    type,
    actor_id: actorId,
    from_status: null,
    to_status: null,
    lat: null,
    lng: null,
    payload: {},
    client_ts: now,
    created_at: now,
    ...extra,
  });
}

function conflictGate(task: Task, reason: string | null | undefined, actor: MockActor, now: string) {
  refreshConflicts(task.id, now);
  const others = new Set<string>();
  for (const c of mockDb.taskConflicts) {
    if (c.task_id === task.id && c.other_task_id && (!c.resolved_at || c.resolved_at === now)) others.add(c.other_task_id);
    if (c.other_task_id === task.id && !c.resolved_at) others.add(c.task_id);
  }
  others.forEach((id) => refreshConflicts(id, now));

  const trimmed = reason?.trim() || null;
  if (mockDb.taskConflicts.some((c) => c.task_id === task.id && !c.resolved_at && c.severity === 'blocking')) {
    if (!trimmed) throw new AppError('conflicts.errors.blocking');
    if (!isAdmin(actor)) throw new AppError('conflicts.errors.adminOnly');
    if (!task.conflicts_overridden || task.override_reason !== trimmed) {
      Object.assign(task, { conflicts_overridden: true, override_reason: trimmed, override_by: actor.id });
      event(task, 'conflict_overridden', actor.id, now, { payload: { reason: trimmed } });
    }
  } else if (task.conflicts_overridden) {
    Object.assign(task, { conflicts_overridden: false, override_reason: null, override_by: null });
  }
}

/** fn_set_primary_driver (+ trg_notify_assignment) */
function setPrimaryDriver(task: Task, driverId: string | null, vehicleId: string | null, actor: MockActor, now: string) {
  const current = mockDb.taskAssignments.find((a) => a.task_id === task.id && a.is_primary);
  if (current && current.driver_id === driverId) {
    current.vehicle_id = vehicleId;
    return;
  }
  if (current) {
    mockDb.taskAssignments = mockDb.taskAssignments.filter((a) => a !== current);
    event(task, 'unassigned', actor.id, now, { payload: { driver_id: current.driver_id } });
  }
  if (['assigned', 'acknowledged', 'declined'].includes(task.status)) task.status = 'scheduled';
  if (!driverId) return;

  mockDb.taskAssignments.push({
    id: crypto.randomUUID(),
    task_id: task.id,
    driver_id: driverId,
    vehicle_id: vehicleId,
    is_primary: true,
    assigned_by: actor.id,
    assigned_at: now,
    acknowledged_at: null,
    declined_at: null,
    decline_reason: null,
    eta_next_stop_at: null,
    eta_updated_at: null,
  });
  const profileId = mockDb.drivers.find((d) => d.id === driverId)?.profile_id;
  if (profileId) {
    mockDb.notifications.push({
      id: crypto.randomUUID(),
      company_id: task.company_id,
      user_id: profileId,
      type: 'task_assigned',
      task_id: task.id,
      title: task.title,
      body: null,
      data: {},
      actions: [
        { id: 'acknowledge', label: 'Acknowledge' },
        { id: 'decline', label: 'Decline' },
      ],
      channels: ['in_app', 'push'],
      scheduled_for: now,
      sent_at: null,
      read_at: null,
      acted_at: null,
      created_at: now,
    });
  }
  if (task.status === 'draft' || task.status === 'scheduled') task.status = 'assigned';
  onPrimaryDriver(task, driverId);
  event(task, 'assigned', actor.id, now, { to_status: 'assigned', payload: { driver_id: driverId } });
}

/** Run a write atomically against the store. */
function transaction<T>(write: (now: string) => T): T {
  const snapshot = structuredClone(mockDb);
  try {
    return write(new Date().toISOString());
  } catch (error) {
    Object.assign(mockDb, snapshot);
    throw error;
  }
}

function editableTask(taskId: string, actor: MockActor): Task {
  const task = mockDb.tasks.find((t) => t.id === taskId && canAccessSite(actor, t.site_id));
  if (!task) throw new AppError('taskDetail.notFound');
  if (!EDITABLE_STATUSES.includes(task.status)) throw new AppError('tasks.errors.notEditable');
  return task;
}

// ---------------------------------------------------------------------------
// rpc_save_task
// ---------------------------------------------------------------------------
export function mockSaveTask(input: SaveTaskPayload, actor: MockActor): string {
  if (!isStaff(actor)) throw new AppError('errors.forbidden', 'errors.forbidden');
  if (!input.title.trim()) throw new AppError('tasks.errors.title');
  if (ms(input.scheduled_end) <= ms(input.scheduled_start)) throw new AppError('tasks.errors.endBeforeStart');
  if (input.stops.length < 2) throw new AppError('tasks.errors.stopsMin');
  if (input.category === 'airport' && !input.flight?.scheduled_time) throw new AppError('tasks.errors.flightTime');
  if (!mockDb.sites.some((s) => s.id === input.site_id)) throw new AppError('errors.invalidInput');
  if (input.driver_id && !mockDb.drivers.some((d) => d.id === input.driver_id && d.is_active)) throw new AppError('errors.invalidInput');
  if (!canAccessSite(actor, input.site_id)) throw new AppError('errors.forbidden', 'errors.forbidden');

  return transaction((now) => {
    let task: Task;
    let wasRider = false;
    if (input.id) {
      task = editableTask(input.id, actor);
      taskPassengers(task.id); // keep check-in state, notify only newcomers
      wasRider = Boolean(sharedHostId(task));
      Object.assign(task, {
        site_id: input.site_id,
        category: input.category,
        priority: input.priority,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        scheduled_start: input.scheduled_start,
        scheduled_end: input.scheduled_end,
        estimated_duration_min: input.estimated_duration_min,
        estimated_distance_km: input.estimated_distance_km,
        passengers: snapshot(input.passengers),
        metadata: { ...(task.metadata as object), ...input.metadata } as Json,
        updated_at: now,
      });
      event(task, 'updated', actor.id, now);
    } else {
      task = {
        id: crypto.randomUUID(),
        company_id: mockDb.company.id,
        site_id: input.site_id,
        category: input.category,
        status: 'scheduled',
        priority: input.priority,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        scheduled_start: input.scheduled_start,
        scheduled_end: input.scheduled_end,
        estimated_duration_min: input.estimated_duration_min,
        estimated_distance_km: input.estimated_distance_km,
        actual_start_at: null,
        actual_end_at: null,
        actual_distance_km: null,
        odometer_start_km: null,
        odometer_end_km: null,
        passengers: snapshot(input.passengers),
        requested_by: actor.id,
        created_by: actor.id,
        recurrence_rule_id: null,
        recurrence_date: null,
        remind_offsets_min: null,
        cancel_reason: null,
        completion_notes: null,
        conflicts_overridden: false,
        override_reason: null,
        override_by: null,
        metadata: input.metadata as Json,
        created_at: now,
        updated_at: now,
      };
      mockDb.tasks.push(task);
      event(task, 'created', actor.id, now, { to_status: 'scheduled' });
    }

    mockDb.taskStops = [
      ...mockDb.taskStops.filter((s) => s.task_id !== task.id),
      ...input.stops.map((s, i) => ({
        ...s,
        id: crypto.randomUUID(),
        task_id: task.id,
        seq: i + 1,
        google_place_id: null,
        actual_arrival_at: null,
        actual_departure_at: null,
        notes: null,
      })),
    ];

    const existingFlight = mockDb.flightDetails.find((f) => f.task_id === task.id);
    mockDb.flightDetails = mockDb.flightDetails.filter((f) => f.task_id !== task.id);
    if (input.category === 'airport' && input.flight) {
      mockDb.flightDetails.push({
        ...input.flight,
        task_id: task.id,
        flight_no: input.flight.flight_no?.trim().toUpperCase() || null,
        estimated_time: existingFlight?.scheduled_time === input.flight.scheduled_time ? existingFlight.estimated_time : null,
        actual_time: null,
        flight_status: existingFlight?.flight_status ?? 'scheduled',
        provider_payload: null,
        updated_at: now,
      });
    }

    if (input.share_with_task_id || wasRider) {
      if (input.driver_id) throw new AppError('share.errors.riderAssigned');
    } else {
      setPrimaryDriver(task, input.driver_id, input.vehicle_id, actor, now);
    }
    syncTaskPassengers(task.id);
    conflictGate(task, input.override_reason, actor, now);
    if (input.share_with_task_id) shareTrip(task.id, input.share_with_task_id, actor, now);
    return task.id;
  });
}

// ---------------------------------------------------------------------------
// rpc_reschedule_task
// ---------------------------------------------------------------------------
export function mockRescheduleTask(
  input: { taskId: string; start: string; changeDriver?: boolean; driverId?: string | null; overrideReason?: string | null },
  actor: MockActor,
): void {
  if (!isStaff(actor)) throw new AppError('errors.forbidden', 'errors.forbidden');
  transaction((now) => {
    const task = editableTask(input.taskId, actor);
    if (input.changeDriver && input.driverId && sharedHostId(task)) throw new AppError('share.errors.riderAssigned');
    const delta = ms(input.start) - ms(task.scheduled_start);
    const shift = (iso: string) => new Date(ms(iso) + delta).toISOString();
    const previousOverride = task.conflicts_overridden ? task.override_reason : null;
    if (delta !== 0) {
      event(task, 'updated', actor.id, now, { payload: { rescheduled_from: task.scheduled_start, rescheduled_to: input.start } });
      task.scheduled_start = shift(task.scheduled_start);
      if (task.scheduled_end) task.scheduled_end = shift(task.scheduled_end);
      for (const s of mockDb.taskStops) if (s.task_id === task.id && s.planned_arrival_at) s.planned_arrival_at = shift(s.planned_arrival_at);
    }
    if (input.changeDriver) {
      const vehicle = mockDb.taskAssignments.find((a) => a.task_id === task.id && a.is_primary)?.vehicle_id ?? null;
      setPrimaryDriver(task, input.driverId ?? null, vehicle, actor, now);
    }
    conflictGate(task, input.overrideReason ?? previousOverride, actor, now);
  });
}

/** rpc_override_task_conflicts */
export function mockOverrideConflicts(taskId: string, reason: string, actor: MockActor): void {
  if (!isAdmin(actor)) throw new AppError('conflicts.errors.adminOnly');
  if (!reason.trim()) throw new AppError('conflicts.errors.reason');
  transaction((now) => {
    const task = mockDb.tasks.find((t) => t.id === taskId);
    if (!task) throw new AppError('taskDetail.notFound');
    conflictGate(task, reason, actor, now);
  });
}

// ---------------------------------------------------------------------------
// rpc_share_trip (FR-15)
// ---------------------------------------------------------------------------
function shareTrip(riderId: string, hostId: string, actor: MockActor, now: string) {
  const rider = mockDb.tasks.find((t) => t.id === riderId);
  if (!rider || !isStaff(actor) || !canAccessSite(actor, rider.site_id)) throw new AppError('errors.forbidden', 'errors.forbidden');
  const host = mockDb.tasks.find((t) => t.id === hostId && t.company_id === rider.company_id);
  if (!host || host.id === rider.id || rider.category !== 'airport' || host.category !== 'airport') throw new AppError('share.errors.invalid');
  const fr = mockDb.flightDetails.find((f) => f.task_id === rider.id);
  const fh = mockDb.flightDetails.find((f) => f.task_id === host.id);
  if (!fr?.airport_id || fr.airport_id !== fh?.airport_id) throw new AppError('share.errors.invalid');
  if (!['draft', 'scheduled', 'declined'].includes(rider.status) || mockDb.taskAssignments.some((a) => a.task_id === rider.id)) {
    throw new AppError('share.errors.riderAssigned');
  }
  if (['completed', 'cancelled', 'declined', 'no_show'].includes(host.status) || sharedHostId(host)) throw new AppError('share.errors.hostClosed');
  if (sharedHostId(rider)) throw new AppError('share.errors.already');
  const hostMain = mockDb.taskAssignments.find((a) => a.task_id === host.id && a.is_primary);
  if (taskGradeConflicts([...readPassengers(host.passengers), ...readPassengers(rider.passengers)], hostMain?.vehicle_id ?? null, hostMain?.driver_id ?? null).length) {
    throw new AppError('share.errors.gradeMismatch');
  }

  mockDb.taskLinks.push({ task_id: rider.id, related_task_id: host.id, relation: 'shared_ride', created_by: actor.id, created_at: now });
  rider.metadata = { ...(rider.metadata as object), shared_with: host.id };
  if (rider.status === 'declined') rider.status = 'scheduled';

  const site = mockDb.sites.find((s) => s.id === rider.site_id)!;
  const riderPassengers = (Array.isArray(rider.passengers) ? rider.passengers : []) as { name?: string; note?: string }[];
  host.passengers = [
    ...((Array.isArray(host.passengers) ? host.passengers : []) as Json[]),
    ...riderPassengers.map((p) => (p.note ? p : { ...p, note: site.name })),
  ] as Json;

  const hostStops = mockDb.taskStops.filter((s) => s.task_id === host.id).sort((a, b) => a.seq - b.seq);
  if (!hostStops.some((s) => s.site_id === site.id)) {
    const base = {
      id: crypto.randomUUID(),
      task_id: host.id,
      label: site.name,
      address: site.address,
      lat: site.lat,
      lng: site.lng,
      google_place_id: null,
      site_id: site.id,
      airport_id: null,
      dwell_min: 10,
      actual_arrival_at: null,
      actual_departure_at: null,
      contact_name: site.contact_name,
      contact_phone: site.contact_phone,
      notes: null,
    };
    if (fh.direction === 'departure') {
      const seq = hostStops.find((s) => s.airport_id === fh.airport_id)?.seq ?? hostStops.at(-1)?.seq ?? 1;
      for (const s of hostStops) if (s.seq >= seq) s.seq += 1;
      mockDb.taskStops.push({ ...base, seq, planned_arrival_at: null, leg_distance_km: null, leg_duration_min: null });
    } else {
      const last = hostStops.at(-1);
      const leg =
        last?.lat != null && last.lng != null && site.lat != null && site.lng != null
          ? (() => {
              const km = Math.round(distanceKm(last.lat!, last.lng!, site.lat!, site.lng!) * 1.3 * 10) / 10;
              return { km, minutes: Math.max(15, Math.round((km / 70) * 60)) };
            })()
          : { km: null, minutes: 0 };
      mockDb.taskStops.push({
        ...base,
        seq: (last?.seq ?? 0) + 1,
        leg_distance_km: leg.km,
        leg_duration_min: leg.minutes,
        planned_arrival_at: host.scheduled_end ? new Date(ms(host.scheduled_end) + leg.minutes * MIN).toISOString() : null,
      });
      if (host.scheduled_end) {
        const extra = leg.minutes + 10;
        host.scheduled_end = new Date(ms(host.scheduled_end) + extra * MIN).toISOString();
        if (host.estimated_duration_min != null) host.estimated_duration_min += extra;
      }
    }
  }

  event(rider, 'updated', actor.id, now, { payload: { shared_ride_with: host.id } });
  event(host, 'updated', actor.id, now, { payload: { shared_ride_from: rider.id } });
  refreshConflicts(host.id, now);
}

export function mockShareTrip(riderId: string, hostId: string, actor: MockActor): void {
  transaction((now) => shareTrip(riderId, hostId, actor, now));
}
