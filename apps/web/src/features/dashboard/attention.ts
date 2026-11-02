import { openDelay, primaryAssignment, type TaskWithRelations } from '@/features/tasks/types';
import { TERMINAL_STATUSES } from '@/lib/task-meta';

export type AttentionKind = 'double_booked' | 'delayed' | 'not_acknowledged' | 'over_hours' | 'unassigned';

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  task: TaskWithRelations;
  /** the other task in a double booking */
  other?: TaskWithRelations;
  delayMin?: number;
  /** minutes until the acknowledge deadline (negative = overdue) */
  deadlineInMin?: number;
  /** ISO time of the acknowledge deadline */
  deadlineAt?: string;
}

const RANK: Record<AttentionKind, number> = {
  double_booked: 0,
  delayed: 1,
  not_acknowledged: 2,
  over_hours: 3,
  unassigned: 4,
};

/**
 * FR-43 "Needs attention": what the dispatcher must act on now —
 * double bookings, delays, unacknowledged assignments, drivers over
 * their daily cap, and unassigned work in the next 24 h.
 */
export function deriveAttention(
  tasks: TaskWithRelations[],
  options: { now?: Date; ackDeadlineMin?: number; horizonHours?: number } = {},
): AttentionItem[] {
  const now = options.now ?? new Date();
  const ackDeadline = options.ackDeadlineMin ?? 120;
  const horizon = now.getTime() + (options.horizonHours ?? 24) * 3_600_000;
  const live = tasks.filter((t) => !TERMINAL_STATUSES.includes(t.status));
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const items: AttentionItem[] = [];
  const seenPairs = new Set<string>();
  const overHoursDrivers = new Set<string>();

  for (const task of live) {
    for (const conflict of task.conflicts) {
      if (conflict.type === 'driver_overlap' && conflict.other_task_id) {
        const pair = [task.id, conflict.other_task_id].sort().join(':');
        if (seenPairs.has(pair)) continue;
        seenPairs.add(pair);
        items.push({ id: `overlap:${pair}`, kind: 'double_booked', task, other: byId.get(conflict.other_task_id) });
      }
      if (conflict.type === 'driver_over_hours' && conflict.driver_id && !overHoursDrivers.has(conflict.driver_id)) {
        overHoursDrivers.add(conflict.driver_id);
        items.push({ id: `hours:${conflict.driver_id}`, kind: 'over_hours', task });
      }
    }

    if (task.status === 'delayed') {
      items.push({ id: `delay:${task.id}`, kind: 'delayed', task, delayMin: openDelay(task)?.delay_min ?? undefined });
    }

    const assignment = primaryAssignment(task);
    if (task.status === 'assigned' && assignment && !assignment.acknowledged_at) {
      const deadline = new Date(task.scheduled_start).getTime() - ackDeadline * 60_000;
      items.push({
        id: `ack:${task.id}`,
        kind: 'not_acknowledged',
        task,
        deadlineInMin: Math.round((deadline - now.getTime()) / 60_000),
        deadlineAt: new Date(deadline).toISOString(),
      });
    }

    if (!assignment && new Date(task.scheduled_start).getTime() <= horizon) {
      items.push({ id: `unassigned:${task.id}`, kind: 'unassigned', task });
    }
  }

  return items.sort((a, b) => RANK[a.kind] - RANK[b.kind] || a.task.scheduled_start.localeCompare(b.task.scheduled_start));
}
