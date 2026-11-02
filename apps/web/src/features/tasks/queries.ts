import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/features/auth/session';
import { supabase } from '@/lib/supabase';
import {
  MOCK_DOMAIN_DATA,
  mockDb,
  mockQuery,
  mockTransition,
  type TransitionAction,
  type TransitionPayload,
} from '@/mocks/db';
import type { Json } from '@/lib/database.types';
import type { SimilarAirportTrip, TaskDetail, TaskFilters, TaskWithRelations } from './types';

export const taskKeys = {
  all: (companyId: string) => ['tasks', companyId] as const,
  list: (companyId: string, filters: TaskFilters) => ['tasks', companyId, filters] as const,
  detail: (companyId: string, taskId: string) => ['tasks', companyId, 'detail', taskId] as const,
  similar: (companyId: string, taskId: string) => ['tasks', companyId, 'similar', taskId] as const,
};

// ---------------------------------------------------------------------------
// mock reads (Phase 0). Phase 2 replaces these with the select in types.ts.
// ---------------------------------------------------------------------------
function withRelations(taskId: string): TaskWithRelations | null {
  const db = mockDb;
  const task = db.tasks.find((t) => t.id === taskId);
  const site = task && db.sites.find((s) => s.id === task.site_id);
  if (!task || !site) return null;
  const flight = db.flightDetails.find((f) => f.task_id === task.id) ?? null;
  return {
    ...task,
    site,
    stops: db.taskStops.filter((s) => s.task_id === task.id).sort((a, b) => a.seq - b.seq),
    assignments: db.taskAssignments
      .filter((a) => a.task_id === task.id)
      .flatMap((a) => {
        const driver = db.drivers.find((d) => d.id === a.driver_id);
        return driver ? [{ ...a, driver, vehicle: db.vehicles.find((v) => v.id === a.vehicle_id) ?? null }] : [];
      }),
    flight: flight ? { ...flight, airport: db.airports.find((a) => a.id === flight.airport_id) ?? null } : null,
    conflicts: db.taskConflicts.filter((c) => c.task_id === task.id && !c.resolved_at),
    delays: db.taskDelays.filter((d) => d.task_id === task.id),
  };
}

export function selectMockTasks(filters: TaskFilters): TaskWithRelations[] {
  const search = filters.search?.trim().toLowerCase();
  return mockDb.tasks
    .filter((t) => !filters.from || t.scheduled_start >= filters.from)
    .filter((t) => !filters.to || t.scheduled_start < filters.to)
    .filter((t) => !filters.siteIds?.length || filters.siteIds.includes(t.site_id))
    .filter((t) => !filters.categories?.length || filters.categories.includes(t.category))
    .filter((t) => !filters.statuses?.length || filters.statuses.includes(t.status))
    .map((t) => withRelations(t.id))
    .filter((t): t is TaskWithRelations => t !== null)
    .filter((t) => !filters.driverId || t.assignments.some((a) => a.driver_id === filters.driverId))
    .filter(
      (t) =>
        !search ||
        [t.title, t.site.name, t.site.name_ar, t.flight?.flight_no, ...t.assignments.map((a) => a.driver.full_name)]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(search)),
    )
    .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));
}

// ---------------------------------------------------------------------------
// hooks
// ---------------------------------------------------------------------------
export function useTasks(filters: TaskFilters) {
  const { profile } = useCurrentUser();
  const companyId = profile.company_id ?? '';
  return useQuery({
    queryKey: taskKeys.list(companyId, filters),
    queryFn: () => mockQuery(() => selectMockTasks(filters), []),
  });
}

export function useTask(taskId: string | undefined) {
  const { profile } = useCurrentUser();
  const companyId = profile.company_id ?? '';
  return useQuery({
    queryKey: taskKeys.detail(companyId, taskId ?? ''),
    enabled: Boolean(taskId),
    queryFn: () =>
      mockQuery<TaskDetail | null>(() => {
        const task = taskId ? withRelations(taskId) : null;
        if (!task) return null;
        return {
          ...task,
          events: mockDb.taskEvents.filter((e) => e.task_id === task.id).sort((a, b) => a.created_at.localeCompare(b.created_at)),
          attachments: mockDb.taskAttachments.filter((a) => a.task_id === task.id),
        };
      }, null),
  });
}

/** FR-15 cross-site airport hint — mirrors fn_similar_airport_trips. */
export function useSimilarAirportTrips(task: TaskWithRelations | null | undefined) {
  const { profile } = useCurrentUser();
  const companyId = profile.company_id ?? '';
  const flight = task?.flight;
  return useQuery({
    queryKey: taskKeys.similar(companyId, task?.id ?? ''),
    enabled: Boolean(flight?.airport_id),
    queryFn: () =>
      mockQuery<SimilarAirportTrip[]>(() => {
        if (!task || !flight?.airport_id) return [];
        const window = mockDb.companySettings.airport_share_window_min;
        const at = new Date(flight.scheduled_time).getTime();
        return mockDb.flightDetails
          .filter((f) => f.airport_id === flight.airport_id && f.task_id !== task.id)
          .map((f) => ({ f, other: withRelations(f.task_id) }))
          .filter(({ other }) => other && !['cancelled', 'completed', 'declined', 'no_show'].includes(other.status))
          .map(({ f, other }) => ({
            task_id: f.task_id,
            site_id: other!.site_id,
            site_name: other!.site.name,
            direction: f.direction,
            flight_no: f.flight_no,
            scheduled_time: f.scheduled_time,
            scheduled_start: other!.scheduled_start,
            driver_name: other!.assignments[0]?.driver.full_name ?? null,
            minutes_apart: Math.round(Math.abs(new Date(f.scheduled_time).getTime() - at) / 60_000),
          }))
          .filter((trip) => trip.minutes_apart <= window)
          .sort((a, b) => a.minutes_apart - b.minutes_apart);
      }, []),
  });
}

/**
 * Status change — always through rpc_task_transition (CLAUDE.md), never a
 * raw UPDATE. The client-generated eventId makes offline replay idempotent;
 * the IndexedDB queue (lib/offline-queue.ts) lands in Phase 3.
 */
export function useTaskTransition() {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const companyId = user.profile.company_id ?? '';
  return useMutation({
    mutationFn: async (input: { taskId: string; action: TransitionAction; payload?: TransitionPayload; eventId?: string }) => {
      const eventId = input.eventId ?? crypto.randomUUID();
      const payload = { client_ts: new Date().toISOString(), ...input.payload };
      if (supabase && user.mode === 'supabase' && !MOCK_DOMAIN_DATA) {
        const { data, error } = await supabase.rpc('rpc_task_transition', {
          p_task_id: input.taskId,
          p_action: input.action,
          p_payload: payload as unknown as Json,
          p_event_id: eventId,
        });
        if (error) throw error;
        return data;
      }
      return mockTransition(input.taskId, input.action, payload, eventId, user.id);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.all(companyId) });
      void queryClient.invalidateQueries({ queryKey: ['drivers', companyId] });
    },
  });
}
