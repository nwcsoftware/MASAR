import { describe, expect, it } from 'vitest';
import { mockDb, mockTransition } from '@/mocks/db';
import { IDS } from '@/mocks/fixtures';

const T = IDS.tasks;

describe('mockTransition mirrors rpc_task_transition', () => {
  it('walks a task through acknowledge → start → arrive → complete', () => {
    const id = T[9]!; // Fahad, acknowledged
    expect(mockDb.tasks.find((t) => t.id === id)?.status).toBe('acknowledged');
    expect(mockTransition(id, 'start', {}, crypto.randomUUID(), IDS.users.fahad).status).toBe('en_route');
    expect(mockTransition(id, 'arrive', {}, crypto.randomUUID(), IDS.users.fahad).status).toBe('in_progress');
    const done = mockTransition(id, 'complete', { distance_km: 11.2, notes: 'ok' }, crypto.randomUUID(), IDS.users.fahad);
    expect(done.status).toBe('completed');
    expect(done.actual_end_at).not.toBeNull();
    expect(done.actual_distance_km).toBe(11.2);
    expect(mockDb.drivers.find((d) => d.id === IDS.drivers.fahad)?.current_status).toBe('idle');
  });

  it('rejects transitions the state machine forbids', () => {
    expect(() => mockTransition(T[1]!, 'start', {}, crypto.randomUUID(), null)).toThrow(/cannot start from completed/);
    expect(() => mockTransition(T[10]!, 'acknowledge', {}, crypto.randomUUID(), null)).toThrow(/cannot acknowledge from scheduled/);
  });

  it('is idempotent on the client event id (offline replay, FR-34)', () => {
    const id = T[5]!; // Khalid, assigned
    const eventId = crypto.randomUUID();
    mockTransition(id, 'acknowledge', {}, eventId, IDS.users.khalid);
    const events = mockDb.taskEvents.length;
    expect(mockTransition(id, 'acknowledge', {}, eventId, IDS.users.khalid).status).toBe('acknowledged');
    expect(mockDb.taskEvents.length).toBe(events);
  });

  it('records a delay, shifts the flight estimate, and resumes to the previous status', () => {
    const id = T[7]!; // Yousef JED departure, assigned; flight 15:40
    const flight = mockDb.flightDetails.find((f) => f.task_id === id)!;
    const before = new Date(flight.scheduled_time).getTime();
    mockTransition(id, 'delay', { reason: 'flight_delayed', delay_min: 30 }, crypto.randomUUID(), IDS.users.yousef);
    expect(mockDb.tasks.find((t) => t.id === id)?.status).toBe('delayed');
    expect(new Date(flight.estimated_time!).getTime() - before).toBe(30 * 60_000);
    expect(flight.flight_status).toBe('delayed');

    expect(mockTransition(id, 'resume', {}, crypto.randomUUID(), IDS.users.yousef).status).toBe('assigned');
    expect(mockDb.taskDelays.filter((d) => d.task_id === id && !d.resolved_at)).toHaveLength(0);
  });
});
