import { useTranslation } from 'react-i18next';
import { cn, tone } from '@/lib/utils';
import { statusColorVar, type TaskStatus } from '@/lib/task-meta';

/** docs/DESIGN.md §2.1 — status is a pill with a dot. */
export function StatusPill({ status, label, className }: { status: TaskStatus; label?: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn('tone-pill inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold', className)}
      style={tone(statusColorVar(status))}
    >
      <span className="tone-dot size-1.5 rounded-full" aria-hidden="true" />
      {label ?? t(`tasks.status.${status}`)}
    </span>
  );
}
