import { describe, expect, it } from 'vitest';
import { tripRequestSchema } from '@/features/passenger/schema';
import { canRaiseSos, codeFromScan, checkinPayload } from '@/features/passenger/trip-utils';
import { canRequestChange } from '@/features/passenger/types';
import { mockDb } from '@/mocks/db';
import { at, IDS } from '@/mocks/fixtures';
import { mockPassengerHome } from '@/mocks/passenger';
import {
  mockCreateShareLink,
  mockDecideRequest,
  mockDriverCheckIn,
  mockDriverDropOff,
  mockPassengerLive,
  mockPassengerRequest,
  mockPassengerSos,
  mockRevokeShareLink,
  mockSharedTrip,
  mockSosEvents,
  mockSosUpdate,
  mockTripRequests,
  mockWithdrawRequest,
  taskPassengers,
} from '@/mocks/passenger-trips';
import { mockRescheduleTask, type MockActor } from '@/mocks/task-writes';

// demo mirror of 0007 — keep in sync with supabase/tests/0007_passenger_phase2.test.sql
const SARA = IDS.users.sara;
const AHMED = IDS.users.ahmed;
const T = IDS.tasks;
const NOW = new Date(at(0, '13:30')).getTime(); // T2 (Sara's RUH pickup) is under way
const actor = (id: string, role: MockActor['role'], siteIds: string[] = []): MockActor => ({ id, role, siteIds });
const OWNER = actor(IDS.users.owner, 'owner');
const NAWAF = actor(IDS.users.dispatcher, 'dispatcher', [IDS.sites.rhq, IDS.sites.yasmin]);
const HUDA = actor(IDS.users.dammam, 'dispatcher', [IDS.sites.dammam]);
const notified = (userId: string, type: string, taskId?: string) =>
  mockDb.notifications.filter((n) => n.user_id === userId && n.type === type && (!taskId || n.task_id === taskId)).length;
const tripOf = (taskId: string) => mockPassengerHome(SARA, NOW).trips.find((t) => t.id === taskId)!;

// Ahmed's last position is "now" for the fixed clock
for (const l of mockDb.driverLocations) if (l.driver_id === IDS.drivers.ahmed) l.recorded_at = new Date(NOW - 60_000).toISOString();

describe('live view + share link (rpc_passenger_live / rpc_shared_trip)', () => {
  it('shows the driver, the pickup and an ETA on the active trip only', () => {
    const live = mockPassengerLive(SARA, T[2]!, NOW);
    expect(live.live).toBe(true);
    expect(live.location).not.toBeNull();
    expect(live.next_stop?.label).toBe('RUH Terminal 1 · Arrivals'); // an arrival: the pickup is the airport
    expect(live.eta_at).not.toBeNull();
    expect(mockPassengerLive(SARA, T[16]!, NOW).location).toBeNull(); // in three days
    expect(() => mockPassengerLive(SARA, T[6]!, NOW)).toThrow('errors.forbidden');
  });

  it('one link per trip; anonymous viewers see no names or phones; it dies when revoked', () => {
    const token = mockCreateShareLink(SARA, T[2]!);
    expect(token).toHaveLength(64);
    expect(mockCreateShareLink(SARA, T[2]!)).toBe(token);
    const shared = mockSharedTrip(token, NOW);
    expect(shared.state).toBe('active');
    expect(JSON.stringify(shared)).not.toMatch(/Sara|\+966/);
    expect(mockSharedTrip('nope', NOW).state).toBe('invalid');
    expect(() => mockCreateShareLink(SARA, T[15]!)).toThrow('share.errors.tripEnded');
    mockRevokeShareLink(SARA, T[2]!);
    expect(mockSharedTrip(token, NOW).state).toBe('ended');
  });
});

describe('check-in (rpc_driver_check_in)', () => {
  it('codes are six digits; the driver types or scans them', () => {
    const code = tripOf(T[2]!).checkin.code!;
    expect(code).toMatch(/^\d{6}$/);
    expect(codeFromScan(checkinPayload(T[2]!, code))).toBe(code);
    expect(codeFromScan('hello')).toBeNull();
  });

  it('wrong codes are refused, the right one starts the pickup; five misses lock it', () => {
    const code = tripOf(T[2]!).checkin.code!;
    const sara = taskPassengers(T[2]!).find((r) => r.person_id === IDS.people.sara)!;
    expect(mockDriverCheckIn(AHMED, T[2]!, '000000', {}, NOW)).toEqual({ ok: false, error: 'checkin.errors.invalid' });
    expect(mockDriverCheckIn(AHMED, T[16]!, code, {}, NOW)).toMatchObject({ ok: false, error: 'checkin.errors.notActive' });
    expect(mockDriverCheckIn(AHMED, T[2]!, '', {}, NOW, sara.id)).toMatchObject({ ok: false, error: 'checkin.errors.codeRequired' });
    expect(() => mockDriverCheckIn(IDS.users.khalid, T[2]!, code, {}, NOW)).toThrow('errors.forbidden');

    expect(mockDriverCheckIn(AHMED, T[2]!, code, {}, NOW)).toMatchObject({ ok: true, status: 'in_progress' });
    expect(notified(SARA, 'driver_arrived', T[2])).toBe(1);
    expect(tripOf(T[2]!).checkin).toMatchObject({ code: null });
    expect(mockDriverCheckIn(AHMED, T[2]!, code, {}, NOW)).toMatchObject({ ok: false, error: 'checkin.errors.already' });
    for (let i = 0; i < 3; i++) mockDriverCheckIn(AHMED, T[2]!, '111111', {}, NOW);
    expect(mockDriverCheckIn(AHMED, T[2]!, '222222', {}, NOW)).toMatchObject({ error: 'checkin.errors.locked' });
    expect(mockDb.auditLog.some((a) => a.action === 'checked_in' && a.row_id === sara.id)).toBe(true);
  });
});

describe('SOS (rpc_passenger_sos / rpc_sos_update)', () => {
  it('alerts the owner and the site’s dispatcher, not other sites; a second press only moves the pin', () => {
    expect(canRaiseSos(tripOf(T[2]!))).toBe(true);
    const res = mockPassengerSos(SARA, T[2]!, { lat: 24.8, lng: 46.65, accuracy: 15 }, 'Car stopped', NOW);
    expect(res.emergency_contacts).toEqual([{ name: 'Faisal Al-Otaibi', phone: '+966 55 999 1234' }]);
    mockPassengerSos(SARA, T[2]!, { lat: 24.81, lng: 46.66 }, undefined, NOW);
    expect(mockDb.sosEvents).toHaveLength(1);
    expect(mockDb.sosEvents[0]).toMatchObject({ lat: 24.81, message: 'Car stopped', status: 'open' });
    expect(notified(IDS.users.owner, 'sos_alert')).toBe(1);
    expect(notified(IDS.users.dispatcher, 'sos_alert')).toBe(1);
    expect(notified(IDS.users.dammam, 'sos_alert')).toBe(0);
    expect(tripOf(T[2]!).open_sos).toMatchObject({ status: 'open' });
    expect(() => mockPassengerSos(SARA, T[16]!, {}, undefined, NOW)).toThrow('sos.errors.notActive');
  });

  it('staff of the site handle it; drivers and other sites cannot', () => {
    const id = mockDb.sosEvents[0]!.id;
    expect(mockSosEvents(HUDA)).toHaveLength(0);
    expect(() => mockSosUpdate(actor(AHMED, 'driver'), id, 'resolve')).toThrow('errors.forbidden');
    mockSosUpdate(NAWAF, id, 'acknowledge');
    mockSosUpdate(NAWAF, id, 'resolve', 'Replacement car sent');
    expect(mockDb.sosEvents[0]).toMatchObject({ status: 'resolved', resolution_note: 'Replacement car sent' });
  });

  it('dropping off the last passenger completes the trip', () => {
    const sara = taskPassengers(T[2]!).find((r) => r.person_id === IDS.people.sara)!;
    expect(mockDriverDropOff(AHMED, sara.id)).toEqual({ ok: true, completed: true });
    expect(mockDb.tasks.find((t) => t.id === T[2])!.status).toBe('completed');
    expect(notified(SARA, 'task_completed', T[2])).toBe(1);
  });
});

describe('trip requests (rpc_passenger_request / rpc_decide_request)', () => {
  it('validates the form', () => {
    expect(tripRequestSchema.safeParse({ kind: 'cancel', passengers_count: 1 }).success).toBe(true);
    const issues = tripRequestSchema.safeParse({ kind: 'new', passengers_count: 0 }).error?.issues.map((i) => i.message);
    expect(issues).toEqual(expect.arrayContaining(['requests.errors.dateRequired', 'requests.errors.pickup', 'requests.errors.passengers']));
  });

  it('a reschedule is checked, routed to the site, and approved through the conflict gate', () => {
    expect(canRequestChange(tripOf(T[16]!), NOW)).toBe(true);
    const start = new Date(new Date(tripOf(T[16]!).scheduled_start).getTime() + 86_400_000).toISOString();
    const id = mockPassengerRequest(SARA, { kind: 'reschedule', task_id: T[16], requested_start: start, notes: 'Meeting moved' }, NOW);
    expect(() => mockPassengerRequest(SARA, { kind: 'cancel', task_id: T[16] }, NOW)).toThrow('requests.errors.duplicate');
    expect(() => mockPassengerRequest(SARA, { kind: 'cancel', task_id: T[15] }, NOW)).toThrow('requests.errors.tooLate');
    expect(() => mockPassengerRequest(SARA, { kind: 'new', requested_start: start }, NOW)).toThrow('requests.errors.places');
    expect(() => mockPassengerRequest(IDS.users.laila, { kind: 'new' }, NOW)).toThrow('errors.forbidden');

    expect(mockTripRequests(HUDA).some((r) => r.id === id)).toBe(false);
    expect(() => mockDecideRequest(HUDA, { requestId: id, approve: true })).toThrow('errors.forbidden');
    expect(() => mockDecideRequest(NAWAF, { requestId: id, approve: false })).toThrow('requests.errors.reasonRequired');
    mockDecideRequest(NAWAF, { requestId: id, approve: true, note: 'OK', overrideReason: 'Approved passenger request' });
    expect(mockDb.tasks.find((t) => t.id === T[16])!.scheduled_start).toBe(start);
    expect(notified(SARA, 'trip_request_decided')).toBe(1);
    expect(() => mockDecideRequest(NAWAF, { requestId: id, approve: true })).toThrow('requests.errors.decided');
  });

  it('the passenger withdraws a pending request; a new-trip request links the planned task', () => {
    const fixture = mockDb.tripRequests.find((r) => r.kind === 'new' && r.status === 'pending')!;
    mockDecideRequest(OWNER, { requestId: fixture.id, approve: true, createdTaskId: T[13] });
    expect(fixture).toMatchObject({ status: 'approved', created_task_id: T[13] });

    const id = mockPassengerRequest(SARA, { kind: 'new', requested_start: new Date(NOW + 2 * 86_400_000).toISOString(), pickup: 'HQ', dropoff: 'Site' }, NOW);
    mockWithdrawRequest(SARA, id);
    expect(mockDb.tripRequests.find((r) => r.id === id)!.status).toBe('withdrawn');
    expect(() => mockWithdrawRequest(SARA, id)).toThrow('errors.invalidInput');
  });

  it('passengers hear when their driver changes', () => {
    mockRescheduleTask(
      { taskId: T[16]!, start: mockDb.tasks.find((t) => t.id === T[16])!.scheduled_start, changeDriver: true, driverId: IDS.drivers.fahad, overrideReason: 'Ahmed on leave' },
      OWNER,
    );
    expect(notified(SARA, 'driver_changed', T[16])).toBe(1);
  });
});
