import { MapPin, Plane } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CategoryBadge } from '@/components/category-badge';
import { ConflictBadge } from '@/components/conflict-badge';
import { DriverAvatar } from '@/components/driver-avatar';
import { StatusPill } from '@/components/status-pill';
import { openDelay, primaryAssignment, type TaskWithRelations } from '@/features/tasks/types';
import { formatTimeRange } from '@/lib/format';
import { categoryColorVar } from '@/lib/task-meta';
import { cn, tone } from '@/lib/utils';
import { useLocalizedName } from '@/lib/i18n-data';

/**
 * docs/DESIGN.md §5 TaskCard — category start-border + tint, time range,
 * driver avatar, stops preview. `compact` is the list row; default is expanded.
 */
export function TaskCard({
  task,
  compact,
  onOpen,
  className,
}: {
  task: TaskWithRelations;
  compact?: boolean;
  onOpen?: (taskId: string) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const assignment = primaryAssignment(task);
  const delay = openDelay(task);
  const first = task.stops[0];
  const last = task.stops.length > 1 ? task.stops[task.stops.length - 1] : undefined;

  return (
    <button
      type="button"
      onClick={() => onOpen?.(task.id)}
      className={cn(
        'tone-block group flex w-full flex-col gap-2 rounded-md p-3 text-start transition-shadow duration-base hover:shadow-md',
        task.conflicts.some((c) => c.severity === 'blocking') && 'ring-2 ring-inset ring-danger',
        className,
      )}
      style={tone(categoryColorVar(task.category))}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <CategoryBadge category={task.category} />
        <div className="flex items-center gap-1.5">
          <ConflictBadge conflicts={task.conflicts} variant="corner" />
          <StatusPill
            status={task.status}
            label={delay?.delay_min ? t('tasks.delayedBy', { minutes: delay.delay_min }) : undefined}
          />
        </div>
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-fg">{task.title}</p>
        <p className="tabular truncate text-xs text-fg-2">
          {formatTimeRange(task.scheduled_start, task.scheduled_end)} · {name(task.site)}
          {task.flight?.flight_no && (
            <>
              {' · '}
              <Plane className="inline size-3 align-[-2px]" aria-hidden="true" /> {task.flight.flight_no}
            </>
          )}
        </p>
      </div>
      {!compact && (first || assignment) && (
        <div className="flex w-full items-center justify-between gap-3 text-xs text-fg-2">
          {first && (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin className="size-3.5 shrink-0 text-fg-3" aria-hidden="true" />
              <span className="truncate">
                {first.label}
                {last && (
                  <>
                    {' '}
                    <span aria-hidden="true" className="inline-block rtl:-scale-x-100">→</span>{' '}
                    {last.label}
                  </>
                )}
              </span>
            </span>
          )}
          {assignment ? (
            <span className="flex shrink-0 items-center gap-1.5 font-semibold text-fg">
              <DriverAvatar name={assignment.driver.full_name} className="size-5 text-[9px]" />
              {name(assignment.driver, 'full_name')}
            </span>
          ) : (
            <span className="shrink-0 font-semibold text-warning-fg">{t('tasks.unassigned')}</span>
          )}
        </div>
      )}
    </button>
  );
}
