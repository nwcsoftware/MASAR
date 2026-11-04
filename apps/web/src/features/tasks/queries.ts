import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseTicketOutput, routeEstimateOutput, type ParseTicketOutput, type RouteEstimateOutput } from '@shared/schemas';
import { useCurrentUser } from '@/features/auth/session';
import { AppError, db, invokeFunction, unwrap, useDualMutation, useLiveData } from '@/lib/data-source';
import { mockDb, mockQuery, mockTransition, type TransitionAction, type TransitionPayload } from '@/mocks/db';
import {
  mockOverrideConflicts,
  mockPreviewConflicts,
  mockRescheduleTask,
  mockSaveTask,
  mockShareTrip,
  type MockActor,
} from '@/mocks/task-writes';
import type { Json } from '@/lib/database.types';
import { readPassengers } from '@/features/grades/rules';
import { mockParseTicket } from '@/mocks/ticket';
import { estimateRoute } from './plan';
import { fileToBase64, ticketMediaType } from './ticket';
import { sharedHostId, type PreviewConflict, type SaveTaskPayload, type SimilarAirportTrip, type TaskDetail, type TaskFilters, type TaskWithRelations } from './types';

export const taskKeys = {
  all: (companyId: string) => ['tasks', companyId] as const,
  list: (companyId: string, filters: TaskFilters) => ['tasks', companyId, filters] as const,
  detail: (companyId: string, taskId: string) => ['tasks', companyId, 'detail', taskId] as const,
  similar: (companyId: string, input: SimilarTripsInput) => ['tasks', companyId, 'similar', input] as const,
  preview: (companyId: string, input: ConflictPreviewInput) => ['tasks', companyId, 'preview', input] as const,
  route: (companyId: string, input: RouteInput) => ['route', companyId, input] as const,
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

export interface SimilarTripsInput {
  airportId: string;
  /** flight time (ISO) */
  time: string;
  excludeTaskId?: string;
}

/** FR-15 cross-site airport hint — fn_similar_airport_trips (mirrored in demo mode). */
export function useSimilarTrips(input: SimilarTripsInput | null) {
  const { profile } = useCurrentUser();
  const live = useLiveData();
  return useQuery({
    queryKey: taskKeys.similar(profile.company_id ?? '', input ?? { airportId: '', time: '' }),
    enabled: Boolean(input?.airportId && input.time),
    queryFn: async (): Promise<SimilarAirportTrip[]> => {
      if (!input) return [];
      if (live) {
        const rows = unwrap(
          await db().rpc('fn_similar_airport_trips', {
            p_airport_id: input.airportId,
            p_time: input.time,
            p_exclude_task: input.excludeTaskId,
          }),
        );
        return rows ?? [];
      }
      return mockQuery<SimilarAirportTrip[]>(() => {
        const window = mockDb.companySettings.airport_share_window_min;
        const at = new Date(input.time).getTime();
        return mockDb.flightDetails
          .filter((f) => f.airport_id === input.airportId && f.task_id !== input.excludeTaskId)
          .map((f) => ({ f, other: withRelations(f.task_id) }))
          .filter(({ other }) => other && !['cancelled', 'completed', 'declined', 'no_show'].includes(other.status) && !sharedHostId(other))
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
            passenger_groups: [...new Set(readPassengers(other!.passengers).flatMap((p) => (p.group_code ? [p.group_code] : [])))],
            vehicle_group: mockDb.gradeGroups.find((g) => g.id === other!.assignments[0]?.vehicle?.grade_group_id)?.code ?? null,
          }))
          .filter((trip) => trip.minutes_apart <= window)
          .sort((a, b) => a.minutes_apart - b.minutes_apart);
      }, []);
    },
  });
}

/** Similar trips for an existing airport task. */
export function useSimilarAirportTrips(task: TaskWithRelations | null | undefined) {
  const flight = task?.flight;
  return useSimilarTrips(
    task && flight?.airport_id ? { airportId: flight.airport_id, time: flight.scheduled_time, excludeTaskId: task.id } : null,
  );
}

// ---------------------------------------------------------------------------
// FR-11 route estimate (Edge Function route-estimate; local estimate in demo
// mode or when the function is unreachable)
// ---------------------------------------------------------------------------
export interface RouteInput {
  stops: { lat: number; lng: number }[];
  departure_time?: string;
}

export function useRouteEstimate(input: RouteInput | null) {
  const { profile } = useCurrentUser();
  const live = useLiveData();
  return useQuery({
    queryKey: taskKeys.route(profile.company_id ?? '', input ?? { stops: [] }),
    enabled: Boolean(input && input.stops.length >= 2),
    staleTime: 10 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<RouteEstimateOutput> => {
      if (!input) return estimateRoute([]);
      if (!live) return mockQuery(() => estimateRoute(input.stops), estimateRoute(input.stops));
      try {
        return routeEstimateOutput.parse(await invokeFunction<unknown>('route-estimate', { ...input }));
      } catch {
        // not deployed / Maps down: the wizard still plans with the rough estimate (flagged)
        return estimateRoute(input.stops);
      }
    },
  });
}

// ---------------------------------------------------------------------------
// FR-18 ticket import — ai-parse-ticket reads the PDF / photo. Demo mode:
// the dev server reads it when ANTHROPIC_API_KEY is set (vite.config.ts),
// otherwise a sample ticket comes back flagged `sample`. Nothing is stored.
// ---------------------------------------------------------------------------
export interface ReadTicket {
  ticket: ParseTicketOutput;
  /** demo sample — the chosen file was not read */
  sample: boolean;
}

async function readTicketOnDevServer(body: Record<string, unknown>): Promise<ParseTicketOutput | null> {
  const response = await fetch('/__dev/ai-parse-ticket', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  // 404: preview / built demo without the dev server; unavailable: no ANTHROPIC_API_KEY
  if (response.status === 404) return null;
  const payload = (await response.json().catch(() => null)) as { unavailable?: boolean; code?: string; message?: string } | null;
  if (response.ok && payload?.unavailable) return null;
  if (!response.ok) throw new AppError(payload?.message ?? response.statusText, payload?.code ?? 'ticketImport.errors.aiFailed');
  return parseTicketOutput.parse(payload);
}

export function useParseTicket() {
  const live = useLiveData();
  return useMutation({
    mutationFn: async (file: File): Promise<ReadTicket> => {
      const media_type = ticketMediaType(file);
      const body = { media_type, data: await fileToBase64(file), file_name: file.name };
      if (live) return { ticket: parseTicketOutput.parse(await invokeFunction<unknown>('ai-parse-ticket', body)), sample: false };
      const read = import.meta.env.DEV ? await readTicketOnDevServer(body) : null;
      if (read) return { ticket: read, sample: false };
      await new Promise((resolve) => setTimeout(resolve, import.meta.env.MODE === 'test' ? 0 : 800));
      return { ticket: mockParseTicket(), sample: true };
    },
  });
}

// ---------------------------------------------------------------------------
// FR-14 / FR-16 / US-03 conflict preview for candidate drivers
// ---------------------------------------------------------------------------
export interface ConflictPreviewInput {
  driverIds: string[];
  vehicleId: string | null;
  start: string;
  end: string;
  firstLat: number | null;
  firstLng: number | null;
  excludeTaskId: string | null;
}

export function useConflictPreview(input: ConflictPreviewInput | null) {
  const { profile } = useCurrentUser();
  const live = useLiveData();
  return useQuery({
    queryKey: taskKeys.preview(profile.company_id ?? '', input ?? ({} as ConflictPreviewInput)),
    enabled: Boolean(input && (input.driverIds.length || input.vehicleId)),
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<PreviewConflict[]> => {
      if (!input) return [];
      if (live) {
        const rows = unwrap(
          await db().rpc('rpc_preview_task_conflicts', {
            p_driver_ids: input.driverIds,
            p_start: input.start,
            p_end: input.end,
            p_vehicle_id: input.vehicleId ?? undefined,
            p_first_lat: input.firstLat ?? undefined,
            p_first_lng: input.firstLng ?? undefined,
            p_exclude_task: input.excludeTaskId ?? undefined,
          }),
        );
        return rows ?? [];
      }
      return mockQuery(() => mockPreviewConflicts(input), []);
    },
  });
}

// ---------------------------------------------------------------------------
// writes (0003) — all invalidate tasks + drivers (planned hours, conflicts)
// ---------------------------------------------------------------------------
function useActor(): MockActor {
  const user = useCurrentUser();
  return { id: user.id, role: user.profile.role, siteIds: user.siteIds };
}

function useTaskInvalidation() {
  const { profile } = useCurrentUser();
  const companyId = profile.company_id ?? '';
  return () => [taskKeys.all(companyId), ['drivers', companyId], ['sites', companyId]];
}

/** FR-10 … FR-16 — the wizard's single write (rpc_save_task). Resolves the task id. */
export function useSaveTask() {
  const actor = useActor();
  return useDualMutation<SaveTaskPayload, string>({
    live: async (payload) => unwrap(await db().rpc('rpc_save_task', { p_task: payload as unknown as Json }))!,
    mock: (payload) => mockSaveTask(payload, actor),
    invalidate: useTaskInvalidation(),
  });
}

export interface RescheduleInput {
  taskId: string;
  start: string;
  /** set to move the task to another driver row (null = unassigned) */
  changeDriver?: boolean;
  driverId?: string | null;
  overrideReason?: string | null;
}

/** US-14 calendar drag-and-drop (rpc_reschedule_task). */
export function useRescheduleTask() {
  const actor = useActor();
  return useDualMutation<RescheduleInput, void>({
    live: async (input) => {
      unwrap(
        await db().rpc('rpc_reschedule_task', {
          p_task_id: input.taskId,
          p_start: input.start,
          p_driver_id: input.driverId ?? undefined,
          p_change_driver: input.changeDriver ?? false,
          p_override_reason: input.overrideReason ?? undefined,
        }),
      );
    },
    mock: (input) => mockRescheduleTask(input, actor),
    invalidate: useTaskInvalidation(),
  });
}

/** FR-14 admin override from the task sheet (rpc_override_task_conflicts). */
export function useOverrideConflicts() {
  const actor = useActor();
  return useDualMutation<{ taskId: string; reason: string }, void>({
    live: async ({ taskId, reason }) => {
      unwrap(await db().rpc('rpc_override_task_conflicts', { p_task_id: taskId, p_reason: reason }));
    },
    mock: ({ taskId, reason }) => mockOverrideConflicts(taskId, reason, actor),
    invalidate: useTaskInvalidation(),
  });
}

/** FR-15 / US-04 "Share trip": the rider rides in the host's car (rpc_share_trip). */
export function useShareTrip() {
  const actor = useActor();
  return useDualMutation<{ taskId: string; hostTaskId: string }, void>({
    live: async ({ taskId, hostTaskId }) => {
      unwrap(await db().rpc('rpc_share_trip', { p_task_id: taskId, p_host_task_id: hostTaskId }));
    },
    mock: ({ taskId, hostTaskId }) => mockShareTrip(taskId, hostTaskId, actor),
    invalidate: useTaskInvalidation(),
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
