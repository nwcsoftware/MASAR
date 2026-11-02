import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { TaskConflict } from '@/mocks/fixtures';
import { formatHours, formatTimeRange } from '@/lib/format';
import { SEVERITY_RANK } from '@/lib/task-meta';
import { cn } from '@/lib/utils';

type Details = Record<string, string | number | undefined>;

/** Human sentence for a task_conflicts row (FR-14). */
export function useConflictText() {
  const { t } = useTranslation();
  return (conflict: TaskConflict) => {
    const d = (conflict.details ?? {}) as Details;
    switch (conflict.type) {
      case 'driver_overlap':
      case 'vehicle_overlap':
        return t(`conflicts.type.${conflict.type}`, {
          title: d.title ?? '',
          time: d.start ? formatTimeRange(String(d.start), d.end ? String(d.end) : null) : '',
        });
      case 'driver_over_hours':
        return t('conflicts.type.driver_over_hours', {
          planned: formatHours(Number(d.planned_min ?? 0)),
          max: formatHours(Number(d.max_min ?? 0)),
        });
      case 'outside_working_hours':
        return t('conflicts.type.outside_working_hours', {
          start: String(d.shift_start ?? '').slice(0, 5),
          end: String(d.shift_end ?? '').slice(0, 5),
        });
      case 'driver_multi_location_same_day':
        return t('conflicts.type.driver_multi_location_same_day', { title: d.title ?? '', km: d.distance_km ?? '' });
      case 'driver_unavailable':
        return t('conflicts.type.driver_unavailable');
    }
  };
}

/** docs/DESIGN.md §5 ConflictAlert — severity-sorted list; admins may override with a reason. */
export function ConflictAlert({ conflicts, canOverride }: { conflicts: TaskConflict[]; canOverride?: boolean }) {
  const { t } = useTranslation();
  const text = useConflictText();
  const sorted = [...conflicts].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {sorted.map((conflict) => {
          const Icon = conflict.severity === 'blocking' ? CircleAlert : conflict.severity === 'warning' ? TriangleAlert : Info;
          return (
            <li
              key={conflict.id}
              className={cn(
                'tint-12 flex gap-3 rounded-md p-3',
                conflict.severity === 'blocking'
                  ? '[--tint-color:var(--danger)]'
                  : conflict.severity === 'warning'
                    ? '[--tint-color:var(--warning)]'
                    : '[--tint-color:var(--text-3)]',
              )}
            >
              <Icon
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  conflict.severity === 'blocking' ? 'text-danger' : conflict.severity === 'warning' ? 'text-warning-fg' : 'text-fg-3',
                )}
                aria-hidden="true"
              />
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-semibold text-fg">{text(conflict)}</p>
                <p className="text-xs text-fg-2">{t(`conflicts.severity.${conflict.severity}`)}</p>
              </div>
            </li>
          );
        })}
      </ul>
      {canOverride && sorted.some((c) => c.severity === 'blocking') && (
        <Button variant="outline" size="sm" disabled title={t('common.comingSoon')}>
          {t('conflicts.override')}
        </Button>
      )}
    </div>
  );
}
