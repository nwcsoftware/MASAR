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
}

export const primaryAssignment = (task: TaskWithRelations) =>
  task.assignments.find((a) => a.is_primary) ?? task.assignments[0] ?? null;

export const openDelay = (task: TaskWithRelations) => task.delays.filter((d) => !d.resolved_at).at(-1) ?? null;
