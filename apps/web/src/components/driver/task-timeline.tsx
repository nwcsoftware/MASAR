import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { TaskWithRelations } from '@/features/tasks/types';
import { formatTime } from '@/lib/format';
import { statusColorVar } from '@/lib/task-meta';
import { cn, tone } from '@/lib/utils';

/** docs/DESIGN.md §4.2 — vertical timeline, dots coloured by status. */
export function TaskTimeline({ tasks, highlightId }: { tasks: TaskWithRelations[]; highlightId?: string }) {
  const { t } = useTranslation();
  return (
    <ol className="relative before:absolute before:inset-y-3 before:start-[7px] before:w-0.5 before:bg-border">
      {tasks.map((task) => (
        <li key={task.id}>
          <Link
            to="/driver/tasks/$taskId"
            params={{ taskId: task.id }}
            className={cn('relative grid min-h-touch grid-cols-[16px_1fr_auto] items-center gap-2.5 rounded-md py-1.5', task.id === highlightId && 'font-bold')}
          >
            <span className="tone-dot size-3 justify-self-center rounded-full ring-2 ring-[var(--tone)] ring-offset-2 ring-offset-bg" style={tone(statusColorVar(task.status))} aria-hidden="true" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{task.title}</span>
              <span className="block truncate text-xs text-fg-2">
                {t(`tasks.category.${task.category}`)} · {t(`tasks.status.${task.status}`)}
              </span>
            </span>
            <span className="tabular text-xs text-fg-3">{formatTime(task.scheduled_start)}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
