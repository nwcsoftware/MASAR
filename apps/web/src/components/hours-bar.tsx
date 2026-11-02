import { useTranslation } from 'react-i18next';
import { formatHours } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * docs/DESIGN.md §5 HoursBar — driving within the day's cap, overtime past it.
 * Fills toward inline-end, so the bar mirrors in Arabic.
 */
export function HoursBar({
  drivingMin,
  capMin,
  overtimeMin = 0,
  showLabel = true,
  className,
}: {
  drivingMin: number;
  capMin: number;
  overtimeMin?: number;
  showLabel?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const scale = Math.max(capMin, drivingMin + overtimeMin, 1);
  const within = Math.min(drivingMin, capMin);
  const over = Math.max(drivingMin - capMin, 0) + overtimeMin;
  const pct = (m: number) => `${(m / scale) * 100}%`;

  return (
    <div className={cn('space-y-1', className)}>
      <div
        className="flex h-2 overflow-hidden rounded-full bg-surface-3"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={capMin}
        aria-valuenow={drivingMin}
        aria-label={t('hours.driving')}
      >
        <span className={cn('h-full', drivingMin > capMin ? 'bg-warning' : 'bg-brand-500')} style={{ width: pct(within) }} />
        {over > 0 && <span className="h-full bg-danger" style={{ width: pct(over) }} />}
      </div>
      {showLabel && (
        <div className="tabular flex justify-between text-xs text-fg-2">
          <span>{t('hours.hoursOf', { value: formatHours(drivingMin), cap: formatHours(capMin) })}</span>
          {over > 0 && <span className="font-semibold text-danger">{t('hours.overBy', { value: formatHours(over) })}</span>}
        </div>
      )}
    </div>
  );
}
