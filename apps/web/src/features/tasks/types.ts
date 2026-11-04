import type {
  Airport,
  Driver,
  FlightDetails,
  Site,
  Task,
  TaskAssignment,
  TaskAttachment,
  TaskConflict,
  TaskDelay,
  TaskEvent,
  TaskStop,
  Vehicle,
} from '@/mocks/fixtures';
import type { Enums, Json } from '@/lib/database.types';
import type { Passenger } from '@/features/grades/rules';
import type { TaskCategory, TaskStatus } from '@/lib/task-meta';

/**
 * Shape of `tasks` with the joins the console needs — matches what
 *   supabase.from('tasks').select('*, site:sites(*), stops:task_stops(*),
 *     assignments:task_assignments(*, driver:drivers(*), vehicle:vehicles(*)),
 *     flight:flight_details(*, airport:airports(*)), conflicts:task_conflicts(*),
 *     delays:task_delays(*)')
 * returns, so swapping the mock for Supabase is a queryFn change only.
 */
export type TaskWithRelations = Task & {
  site: Site;
  stops: TaskStop[];
  assignments: (TaskAssignment & { driver: Driver; vehicle: Vehicle | null })[];
  flight: (FlightDetails & { airport: Airport | null }) | null;
  /** open conflicts only (resolved_at is null) */
  conflicts: TaskConflict[];
  delays: TaskDelay[];
};

export type TaskDetail = TaskWithRelations & {
  events: TaskEvent[];
  attachments: TaskAttachment[];
};

export interface TaskFilters {
  /** inclusive ISO lower bound on scheduled_start */
  from?: string;
  /** exclusive ISO upper bound on scheduled_start */
  to?: string;
  siteIds?: string[];
  driverId?: string;
  categories?: TaskCategory[];
  statuses?: TaskStatus[];
  search?: string;
}

export interface SimilarAirportTrip {
  task_id: string;
  site_id: string;
  site_name: string;
  direction: FlightDetails['direction'];
  flight_no: string | null;
  scheduled_time: string;
  scheduled_start: string;
  driver_name: string | null;
  minutes_apart: number;
  /** 0004: groups riding in that car, and the car's own group */
  passenger_groups: string[] | null;
  vehicle_group: string | null;
}

export const primaryAssignment = (task: TaskWithRelations) =>
  task.assignments.find((a) => a.is_primary) ?? task.assignments[0] ?? null;

export const openDelay = (task: TaskWithRelations) => task.delays.filter((d) => !d.resolved_at).at(-1) ?? null;

/** FR-15: a rider task travels in another site's car (rpc_share_trip sets metadata.shared_with). */
export const sharedHostId = (task: Pick<Task, 'metadata'>): string | null => {
  const meta = task.metadata as { shared_with?: unknown } | null;
  return typeof meta?.shared_with === 'string' ? meta.shared_with : null;
};

/** Statuses rpc_save_task / rpc_reschedule_task accept (0003). */
export const EDITABLE_STATUSES: TaskStatus[] = ['draft', 'scheduled', 'assigned', 'acknowledged', 'declined'];

export type SaveTaskStop = Pick<
  TaskStop,
  'label' | 'address' | 'lat' | 'lng' | 'site_id' | 'airport_id' | 'planned_arrival_at' | 'dwell_min' | 'leg_distance_km' | 'leg_duration_min' | 'contact_name' | 'contact_phone'
>;
export type SaveTaskFlight = Pick<FlightDetails, 'airport_id' | 'direction' | 'airline' | 'flight_no' | 'terminal' | 'scheduled_time' | 'buffer_min'>;

/** rpc_save_task(p_task) payload — the wizard's single write (0003 §3). */
export interface SaveTaskPayload {
  id?: string;
  site_id: string;
  category: TaskCategory;
  priority: Enums<'task_priority'>;
  title: string;
  description: string | null;
  scheduled_start: string;
  scheduled_end: string;
  estimated_duration_min: number;
  estimated_distance_km: number | null;
  /** directory people by id, visitors with their trip group; snapshotted server-side */
  passengers: Passenger[];
  metadata: { [key: string]: Json | undefined };
  stops: SaveTaskStop[];
  flight: SaveTaskFlight | null;
  driver_id: string | null;
  vehicle_id: string | null;
  override_reason: string | null;
  share_with_task_id: string | null;
}

/** A conflict as rpc_preview_task_conflicts returns it (driver_id null = vehicle conflict). */
export type PreviewConflict = Pick<TaskConflict, 'type' | 'severity' | 'other_task_id' | 'details'> & { driver_id: string | null };
