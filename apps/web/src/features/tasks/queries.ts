import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/features/auth/session';
import { db, unwrap, useLiveData } from '@/lib/data-source';
import { mockDb, mockQuery, mockTransition, type TransitionAction, type TransitionPayload } from '@/mocks/db';
import type { Json } from '@/lib/database.types';
import type { SimilarAirportTrip, TaskDetail, TaskFilters, TaskWithRelations } from './types';

export const taskKeys = {
  all: (companyId: string) => ['tasks', companyId] as const,
  list: (companyId: string, filters: TaskFilters) => ['tasks', companyId, filters] as const,
  detail: (companyId: string, taskId: string) => ['tasks', companyId, 'detail', taskId] as const,
  similar: (companyId: string, taskId: string) => ['tasks', companyId, 'similar', taskId] as const,
};

// ---------------------------------------------------------------------------
// shared: filters the select can't express cheaply (search across joins,
// driver via assignment) run client-side over the date-bounded result
// ---------------------------------------------------------------------------
function applyClientFilters(tasks: TaskWithRelations[], filters: TaskFilters): TaskWithRelations[] {
  const search = filters.search?.trim().toLowerCase();
  return tasks
    .filter((t) => !filters.driverId || t.assignments.some((a) => a.driver_id === filters.driverId))
    .filter(
      (t) =>
        !search ||
        [t.title, t.site.name, t.site.name_ar, t.flight?.flight_no, ...t.assignments.map((a) => a.driver.full_name)]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(search)),
    )
    .map((t) => ({
      ...t,
      stops: [...t.stops].sort((a, b) => a.seq - b.seq),
      conflicts: t.conflicts.filter((c) => !c.resolved_at),
    }))
    .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));
}

// ---------------------------------------------------------------------------
// live (Supabase) — explicit FK hints keep embeds unambiguous
// ---------------------------------------------------------------------------
const TASK_SELECT =
  '*, site:sites!tasks_site_id_fkey(*), stops:task_stops(*), assignments:task_assignments(*, driver:drivers!task_assignments_driver_id_fkey(*), vehicle:vehicles!task_assignments_vehicle_id_fkey(*)), flight:flight_details(*, airport:airports!flight_details_airport_id_fkey(*)), conflicts:task_conflicts!task_conflicts_task_id_fkey(*), delays:task_delays(*)' as const;

export async function fetchTasks(filters: TaskFilters): Promise<TaskWithRelations[]> {
  let query = db().from('tasks').select(TASK_SELECT);
  if (filters.from) query = query.gte('scheduled_start', filters.from);
  if (filters.to) query = query.lt('scheduled_start', filters.to);
  if (filters.siteIds?.length) query = query.in('site_id', filters.siteIds);
  if (filters.categories?.length) query = query.in('category', filters.categories);
  if (filters.statuses?.length) query = query.in('status', filters.statuses);
  const rows = unwrap(await query.order('scheduled_start').limit(1000)) ?? [];
  return applyClientFilters(rows, filters);
}

async function fetchTaskDetail(taskId: string): Promise<TaskDetail | null> {
  const row = unwrap(
    await db()
      .from('tasks')
      .select(`${TASK_SELECT}, events:task_events(*), attachments:task_attachments(*)`)
      .eq('id', taskId)
      .maybeSingle(),
  );
  if (!row) return null;
  const [task] = applyClientFilters([row], {});
  return { ...task!, events: [...row.events].sort((a, b) => a.created_at.localeCompare(b.created_at)), attachments: row.attachments };
}

// ---------------------------------------------------------------------------
// mock (demo mode)
// ---------------------------------------------------------------------------
function withRelations(taskId: string): TaskWithRelations | null {
  const store = mockDb;
  const task = store.tasks.find((t) => t.id === taskId);
  const site = task && store.sites.find((s) => s.id === task.site_id);
  if (!task || !site) return null;
  const flight = store.flightDetails.find((f) => f.task_id === task.id) ?? null;
  return {
    ...task,
    site,
    stops: store.taskStops.filter((s) => s.task_id === task.id),
    assignments: store.taskAssignments
      .filter((a) => a.task_id === task.id)
      .flatMap((a) => {
        const driver = store.drivers.find((d) => d.id === a.driver_id);
        return driver ? [{ ...a, driver, vehicle: store.vehicles.find((v) => v.id === a.vehicle_id) ?? null }] : [];
      }),
    flight: flight ? { ...flight, airport: store.airports.find((a) => a.id === flight.airport_id) ?? null } : null,
    conflicts: store.taskConflicts.filter((c) => c.task_id === task.id),
    delays: store.taskDelays.filter((d) => d.task_id === task.id),
  };
}

export function selectMockTasks(filters: TaskFilters): TaskWithRelations[] {
  const rows = mockDb.tasks
    .filter((t) => !filters.from || t.scheduled_start >= filters.from)
    .filter((t) => !filters.to || t.scheduled_start < filters.to)
    .filter((t) => !filters.siteIds?.length || filters.siteIds.includes(t.site_id))
    .filter((t) => !filters.categories?.length || filters.categories.includes(t.category))
    .filter((t) => !filters.statuses?.length || filters.statuses.includes(t.status))
    .map((t) => withRelations(t.id))
    .filter((t): t is TaskWithRelations => t !== null);
  return applyClientFilters(rows, filters);
}

/** Today's (or any range's) tasks from whichever source is active — used by other features' builders. */
export function loadTasks(live: boolean, filters: TaskFilters): Promise<TaskWithRelations[]> {
  return live ? fetchTasks(filters) : Promise.resolve(selectMockTasks(filters));
}

// ---------------------------------------------------------------------------
// hooks
// ---------------------------------------------------------------------------
export function useTasks(filters: TaskFilters) {
  const { profile } = useCurrentUser();
  const live = useLiveData();
  return useQuery({
    queryKey: taskKeys.list(profile.company_id ?? '', filters),
    queryFn: () => (live ? fetchTasks(filters) : mockQuery(() => selectMockTasks(filters), [])),
  });
}

export function useTask(taskId: string | undefined) {
  const { profile } = useCurrentUser();
  const live = useLiveData();
  return useQuery({
    queryKey: taskKeys.detail(profile.company_id ?? '', taskId ?? ''),
    enabled: Boolean(taskId),
    queryFn: () =>
      live
        ? fetchTaskDetail(taskId!)
        : mockQuery<TaskDetail | null>(() => {
            const task = taskId ? withRelations(taskId) : null;
            if (!task) return null;
            const [normalised] = applyClientFilters([task], {});
            return {
              ...normalised!,
              events: mockDb.taskEvents.filter((e) => e.task_id === task.id).sort((a, b) => a.created_at.localeCompare(b.created_at)),
              attachments: mockDb.taskAttachments.filter((a) => a.task_id === task.id),
            };
          }, null),
  });
}

/** FR-15 cross-site airport hint — fn_similar_airport_trips (mirrored in demo mode). */
export function useSimilarAirportTrips(task: TaskWithRelations | null | undefined) {
  const { profile } = useCurrentUser();
  const live = useLiveData();
  const flight = task?.flight;
  return useQuery({
    queryKey: taskKeys.similar(profile.company_id ?? '', task?.id ?? ''),
    enabled: Boolean(flight?.airport_id),
    queryFn: async (): Promise<SimilarAirportTrip[]> => {
      if (!task || !flight?.airport_id) return [];
      if (live) {
        const rows = unwrap(
          await db().rpc('fn_similar_airport_trips', {
            p_airport_id: flight.airport_id,
            p_time: flight.scheduled_time,
            p_exclude_task: task.id,
          }),
        );
        return rows ?? [];
      }
      return mockQuery<SimilarAirportTrip[]>(() => {
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
      }, []);
    },
  });
}

/**
 * Status change — always through rpc_task_transition (CLAUDE.md), never a
 * raw UPDATE. The client-generated eventId makes offline replay idempotent;
 * the IndexedDB queue (lib/offline-queue.ts) lands in Phase 3.
 */
export function useTaskTransition() {
  const user = useCurrentUser();
  const live = useLiveData();
  const queryClient = useQueryClient();
  const companyId = user.profile.company_id ?? '';
  return useMutation({
    mutationFn: async (input: { taskId: string; action: TransitionAction; payload?: TransitionPayload; eventId?: string }) => {
      const eventId = input.eventId ?? crypto.randomUUID();
      const payload = { client_ts: new Date().toISOString(), ...input.payload };
      if (live) {
        return unwrap(
          await db().rpc('rpc_task_transition', {
            p_task_id: input.taskId,
            p_action: input.action,
            p_payload: payload as unknown as Json,
            p_event_id: eventId,
          }),
        );
      }
      return mockTransition(input.taskId, input.action, payload, eventId, user.id);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.all(companyId) });
      void queryClient.invalidateQueries({ queryKey: ['drivers', companyId] });
    },
  });
}
