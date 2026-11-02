import { TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { SEVERITY_RANK, type ConflictSeverity } from '@/lib/task-meta';

export function worstSeverity(conflicts: { severity: ConflictSeverity }[]): ConflictSeverity | null {
  return conflicts.reduce<ConflictSeverity | null>(
    (worst, c) => (worst === null || SEVERITY_RANK[c.severity] > SEVERITY_RANK[worst] ? c.severity : worst),
    null,
  );
}

/**
 * "Conflicts are the only red" (design/preview.html). Blocking = danger,
 * warning = amber, info = neutral. Shows as a corner count or an inline pill.
 */
export function ConflictBadge({
  conflicts,
  variant = 'pill',
  className,
}: {
  conflicts: { severity: ConflictSeverity }[];
  variant?: 'pill' | 'corner';
  className?: string;
}) {
  const { t } = useTranslation();
  const severity = worstSeverity(conflicts);
  if (!severity) return null;
  const label = t('conflicts.count', { count: conflicts.length });
  const color = severity === 'blocking' ? 'bg-danger' : severity === 'warning' ? 'bg-warning' : 'bg-fg-3';

  if (variant === 'corner') {
    return (
      <span
        className={cn('rounded-full px-1.5 text-[10px] font-extrabold leading-4 text-fg-on-brand', color, className)}
        title={label}
        aria-label={label}
      >
        {conflicts.length}
      </span>
    );
  }
  return (
    <span
      className={cn(
        'tint-12 inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold',
        severity === 'blocking' ? 'text-danger [--tint-color:var(--danger)]' : severity === 'warning' ? 'text-warning-fg [--tint-color:var(--warning)]' : 'text-fg-2 [--tint-color:var(--text-3)]',
        className,
      )}
    >
      <TriangleAlert className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}
