import { describe, expect, it } from 'vitest';
import { routeEstimateInput } from '@shared/schemas';
import { airportDwell, airportStart, estimateLeg, estimateRoute, planTimeline } from '@/features/tasks/plan';
import { taskFormSchema } from '@/features/tasks/schema';
import type { SaveTaskPayload } from '@/features/tasks/types';
import { newTaskValues, seedStops, valuesToPayload } from '@/components/task-wizard/values';
import { deriveAttention } from '@/features/dashboard/attention';
import { selectMockTasks } from '@/features/tasks/queries';
import { companyDateTimeToIso, companyTimeKey } from '@/lib/format';
import { mockDb, mockTransition } from '@/mocks/db';
import { at, IDS } from '@/mocks/fixtures';
import {
  mockConflictsFor,
  mockOverrideConflicts,
  mockPreviewConflicts,
  mockRescheduleTask,
  mockSaveTask,
  mockShareTrip,
  type MockActor,
} from '@/mocks/task-writes';

const T = IDS.tasks;
const owner: MockActor = { id: IDS.users.owner, role: 'owner', siteIds: [] };
const dispatcher: MockActor = { id: IDS.users.dispatcher, role: 'dispatcher', siteIds: [IDS.sites.rhq, IDS.sites.yasmin] };

/** RHQ → SAB Bank escort, like the pgTAP suite's pg_temp.escort */
function escort(title: string, day: number, start: string, end: string, driverId: string | null, overrideReason: string | null = null): SaveTaskPayload {
  return {
    site_id: IDS.sites.rhq,
    category: 'escort',
    priority: 'normal',
    title,
    description: null,
    scheduled_start: at(day, start),
    scheduled_end: at(day, end),
    estimated_duration_min: 60,
    estimated_distance_km: 4.5,
    passengers: [{ name: 'Test Passenger' }],
    metadata: {},
    stops: [
      { label: 'Riyadh HQ', address: null, lat: 24.6948, lng: 46.6857, site_id: IDS.sites.rhq, airport_id: null, planned_arrival_at: at(day, start), dwell_min: 0, leg_distance_km: null, leg_duration_min: null, contact_name: null, contact_phone: null },
      { label: 'SAB Bank', address: null, lat: 24.711, lng: 46.6745, site_id: null, airport_id: null, planned_arrival_at: null, dwell_min: 30, leg_distance_km: 4.5, leg_duration_min: 15, contact_name: null, contact_phone: null },
    ],
    flight: null,
    driver_id: driverId,
    vehicle_id: null,
    override_reason: overrideReason,
    share_with_task_id: null,
  };
}

const byTitle = (title: string) => mockDb.tasks.find((t) => t.title === title)!;

describe('task planning (FR-11, FR-13)', () => {
  it('estimates road legs like route-estimate’s fallback', () => {
    expect(estimateLeg({ lat: 24.6948, lng: 46.6857 }, { lat: 24.6948, lng: 46.6857 })).toEqual({ distance_km: 0, duration_min: 0 });
    const leg = estimateLeg({ lat: 24.6948, lng: 46.6857 }, { lat: 24.9576, lng: 46.6988 });
    expect(leg.distance_km).toBeCloseTo(38, 0);
    expect(leg.duration_min).toBe(Math.round((leg.distance_km / 70) * 60));
    expect(estimateLeg({ lat: null, lng: null }, { lat: 1, lng: 1 })).toEqual({ distance_km: 0, duration_min: 0 });
    expect(estimateRoute([{ lat: 24.69, lng: 46.68 }, { lat: 24.82, lng: 46.64 }, { lat: 24.95, lng: 46.69 }]).legs).toHaveLength(2);
  });

  it('walks the timeline: arrive, wait, drive on', () => {
    const plan = planTimeline('2026-11-03T09:00:00.000Z', [{ dwell_min: 0 }, { dwell_min: 40 }, { dwell_min: 10 }], [
      { distance_km: 36, duration_min: 45 },
      { distance_km: 25, duration_min: 30 },
    ]);
    expect(plan.arrivals).toEqual(['2026-11-03T09:00:00.000Z', '2026-11-03T09:45:00.000Z', '2026-11-03T10:55:00.000Z']);
    expect(plan.end).toBe('2026-11-03T11:05:00.000Z');
    expect(plan.durationMin).toBe(125);
    expect(plan.distanceKm).toBe(61);
  });

  it('US-02 / PRD §7.2: flight 14:00, 45 min drive, 30 min buffer → leave 12:45', () => {
    const stops = [
      { dwell_min: 0, airport_id: null },
      { dwell_min: airportDwell('arrival', 30), airport_id: 'ruh' },
      { dwell_min: 0, airport_id: null },
    ];
    const legs = [{ distance_km: 36, duration_min: 45 }, { distance_km: 36, duration_min: 45 }];
    const result = airportStart('2026-11-03T11:00:00.000Z', 30, stops, legs, 'ruh');
    expect(result).toEqual({ start: '2026-11-03T09:45:00.000Z', driveMin: 45 });
    expect(airportStart('2026-11-03T11:00:00.000Z', 30, stops, legs, 'jed')).toBeNull();
    expect(airportDwell('departure', 90)).toBe(10);
  });

  it('reads form dates as company wall-clock time (Asia/Riyadh, UTC+3)', () => {
    expect(companyDateTimeToIso('2026-11-03', '12:45')).toBe('2026-11-03T09:45:00.000Z');
    expect(companyDateTimeToIso('2026-11-04', '01:30')).toBe('2026-11-03T22:30:00.000Z');
    expect(companyTimeKey('2026-11-03T22:30:00.000Z')).toBe('01:30');
  });

  it('route-estimate input: 2…10 stops', () => {
    expect(routeEstimateInput.safeParse({ stops: [{ lat: 1, lng: 1 }] }).success).toBe(false);
    expect(routeEstimateInput.safeParse({ stops: [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }], departure_time: '2026-11-03T09:00:00+03:00' }).success).toBe(true);
  });
});

describe('task wizard values', () => {
  const site = { ...mockDb.sites[0]!, airports: [], allAirports: [], driverCount: 0, tasksToday: 0 };

  it('schema: airport trips need a flight; stops need coordinates; a shared ride has no driver', () => {
    const base = { ...newTaskValues('escort', site), title: 'Bank run', stops: seedStops(newTaskValues('escort', site), site, []) };
    const messages = (v: object) => taskFormSchema.safeParse(v).error?.issues.map((i) => i.message) ?? [];
    expect(messages(base)).toEqual(['tasks.errors.stopLabel', 'tasks.errors.stopCoords']);
    expect(messages({ ...base, passengers: [{ name: '', phone: '+966 5' }] })).toContain('tasks.errors.passengerName');
    expect(messages({ ...base, stops: [base.stops[0], { ...base.stops[1], label: 'SAB', lat: 24.711, lng: 46.6745 }] })).toEqual([]);
    expect(messages({ ...base, category: 'airport', flight: null })).toContain('tasks.errors.flightNo');
    expect(messages({ ...base, driver_id: 'd', share_with_task_id: 't' })).toContain('share.errors.riderAssigned');
  });

  it('seeds an arrival as site → airport → back to site, and builds the RPC payload', () => {
    const ruh = mockDb.airports.find((a) => a.id === IDS.airports.ruh)!;
    const values = { ...newTaskValues('airport', site), title: 'RUH arrival · SV 9', flight: { airport_id: ruh.id, direction: 'arrival' as const, airline: '', flight_no: 'sv 9', terminal: '', date: '2026-11-03', time: '14:00', buffer_min: 30 } };
    const stops = seedStops(values, site, [ruh]);
    expect(stops.map((s) => s.kind)).toEqual(['site', 'airport', 'site']);
    expect(stops[1]!.dwell_min).toBe(60);
    const legs = estimateRoute(stops).legs;
    const timeline = planTimeline('2026-11-03T09:45:00.000Z', stops, legs);
    const payload = valuesToPayload({ ...values, stops, date: '2026-11-03', start_time: '12:45', duration_min: 150 }, timeline, legs);
    expect(payload.scheduled_start).toBe('2026-11-03T09:45:00.000Z');
    expect(payload.scheduled_end).toBe('2026-11-03T12:15:00.000Z');
    expect(payload.flight).toMatchObject({ flight_no: 'SV 9', scheduled_time: '2026-11-03T11:00:00.000Z' });
    expect(payload.stops[1]!.planned_arrival_at).toBe(timeline.arrivals[1]);
    expect(payload.passengers).toEqual([]);
  });
});

describe('demo mirror of 0003 (keep in sync with supabase/tests/0003_tasks.test.sql)', () => {
  it('the engine reproduces the seeded conflicts (Yousef double-booked and over hours)', () => {
    const t6 = mockDb.tasks.find((t) => t.id === T[6])!;
    const types = mockConflictsFor({ driverId: IDS.drivers.yousef, vehicleId: null, start: t6.scheduled_start, end: t6.scheduled_end, firstLat: 21.735, firstLng: 39.085, excludeTaskId: t6.id }).map((c) => `${c.type}:${c.severity}`);
    expect(types).toEqual(['driver_overlap:blocking', 'driver_over_hours:warning']);
  });

  it('US-03: preview flags Ahmed at 13:00, Fahad free; Fahad’s leave blocks next week', () => {
    const preview = mockPreviewConflicts({ driverIds: [IDS.drivers.ahmed, IDS.drivers.fahad], vehicleId: null, start: at(0, '13:00'), end: at(0, '14:00') });
    expect(preview.some((c) => c.driver_id === IDS.drivers.ahmed && c.type === 'driver_overlap' && c.severity === 'blocking')).toBe(true);
    expect(preview.some((c) => c.driver_id === IDS.drivers.fahad && c.severity === 'blocking')).toBe(false);
    const leave = mockPreviewConflicts({ driverIds: [IDS.drivers.fahad], vehicleId: null, start: at(8, '10:00'), end: at(8, '11:00') });
    expect(leave.map((c) => c.type)).toContain('driver_unavailable');
    expect(() => mockPreviewConflicts({ driverIds: [], vehicleId: null, start: at(0, '10:00'), end: at(0, '09:00') })).toThrow('tasks.errors.endBeforeStart');
  });

  it('FR-10: saves a task with stops and a free driver, notifying them', () => {
    const id = mockSaveTask(escort('T-free', 2, '10:00', '11:00', IDS.drivers.fahad), dispatcher);
    const task = mockDb.tasks.find((t) => t.id === id)!;
    expect(task.status).toBe('assigned');
    expect(mockDb.taskStops.filter((s) => s.task_id === id)).toHaveLength(2);
    expect(mockDb.notifications.some((n) => n.task_id === id && n.user_id === IDS.users.fahad && n.type === 'task_assigned')).toBe(true);
  });

  it('FR-14: a double booking is refused, dispatchers cannot override, nothing is written', () => {
    const before = mockDb.tasks.length;
    expect(() => mockSaveTask(escort('T-clash', 0, '13:00', '14:00', IDS.drivers.ahmed), dispatcher)).toThrow('conflicts.errors.blocking');
    expect(() => mockSaveTask(escort('T-clash', 0, '13:00', '14:00', IDS.drivers.ahmed, 'VIP'), dispatcher)).toThrow('conflicts.errors.adminOnly');
    expect(mockDb.tasks.length).toBe(before);
    expect(() => mockSaveTask({ ...escort('T-scope', 2, '10:00', '11:00', null), site_id: IDS.sites.dammam }, dispatcher)).toThrow('errors.forbidden');
  });

  it('an owner overrides with a reason; the other side of the collision sees it', () => {
    mockSaveTask(escort('T-clash', 0, '13:00', '14:00', IDS.drivers.ahmed, 'VIP visit'), owner);
    const clash = byTitle('T-clash');
    expect(clash).toMatchObject({ conflicts_overridden: true, override_reason: 'VIP visit' });
    expect(mockDb.taskConflicts.some((c) => c.task_id === T[2] && c.other_task_id === clash.id && !c.resolved_at)).toBe(true);
    expect(mockDb.taskEvents.some((e) => e.task_id === clash.id && e.type === 'conflict_overridden')).toBe(true);
    expect(() => mockOverrideConflicts(T[7]!, 'ok', dispatcher)).toThrow('conflicts.errors.adminOnly');
  });

  it('US-14: rescheduling keeps the duration, moves stops, re-checks conflicts', () => {
    const task = byTitle('T-free');
    mockRescheduleTask({ taskId: task.id, start: at(2, '11:30') }, dispatcher);
    expect(new Date(task.scheduled_end!).getTime() - new Date(task.scheduled_start).getTime()).toBe(3_600_000);
    expect(mockDb.taskStops.find((s) => s.task_id === task.id && s.seq === 1)?.planned_arrival_at).toBe(at(2, '11:30'));
    expect(() => mockRescheduleTask({ taskId: task.id, start: at(8, '10:00') }, dispatcher)).toThrow('conflicts.errors.blocking');
    // a refused write restores the store (fresh rows, like a rolled-back transaction)
    expect(byTitle('T-free').scheduled_start).toBe(at(2, '11:30'));
    mockRescheduleTask({ taskId: task.id, start: at(2, '11:30'), changeDriver: true, driverId: null }, dispatcher);
    expect(byTitle('T-free').status).toBe('scheduled');
  });

  it('FR-15 / US-04: EK 817 rides with SV 1234, leaves the unassigned list, completes with its host', () => {
    expect(() => mockShareTrip(T[10]!, T[5]!, dispatcher)).toThrow('share.errors.invalid');
    expect(() => mockShareTrip(T[10]!, T[2]!, { id: IDS.users.dammam, role: 'dispatcher', siteIds: [IDS.sites.dammam] })).toThrow('errors.forbidden');
    mockShareTrip(T[10]!, T[2]!, dispatcher);
    const rider = () => mockDb.tasks.find((t) => t.id === T[10])!;
    const host = mockDb.tasks.find((t) => t.id === T[2])!;
    expect(rider().metadata).toMatchObject({ shared_with: T[2] });
    expect(host.passengers).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Mr. David Lee', note: 'Al Yasmin Site' })]));
    expect(() => mockShareTrip(T[10]!, T[2]!, dispatcher)).toThrow('share.errors.already');

    const today = selectMockTasks({ from: at(0, '00:00'), to: at(1, '00:00') });
    expect(deriveAttention(today).some((i) => i.kind === 'unassigned' && i.task.id === T[10])).toBe(false);

    mockTransition(T[2]!, 'complete', {}, crypto.randomUUID(), IDS.users.ahmed);
    expect(rider().status).toBe('completed');
  });
});
