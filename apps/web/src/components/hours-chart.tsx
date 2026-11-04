import { useTranslation } from 'react-i18next';
import { formatHours, formatWeekday } from '@/lib/format';

export interface HoursPoint {
  /** YYYY-MM-DD */
  date: string;
  drivingMin: number;
  overtimeMin: number;
}

/**
 * Stacked bars: driving (brand) + overtime (danger), with the standard day
 * as a reference line. Bars run along the inline axis, so they mirror in RTL
 * (oldest day at inline-start), which reads naturally in both languages.
 */
export function HoursChart({ points, standardMin, height = 160 }: { points: HoursPoint[]; standardMin: number; height?: number }) {
  const { t } = useTranslation();
  const max = Math.max(standardMin * 1.25, ...points.map((p) => p.drivingMin + p.overtimeMin), 1);
  const linePct = (standardMin / max) * 100;

  return (
    <figure className="space-y-2">
      <div className="relative flex items-end gap-1.5" style={{ height }} role="img" aria-label={t('hours.chartLabel')}>
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border-strong" style={{ bottom: `${linePct}%` }} aria-hidden="true">
          <span className="absolute -top-4 end-0 text-[10px] font-semibold text-fg-3">{t('hours.standardDay', { value: formatHours(standardMin) })}</span>
        </div>
        {points.map((p) => (
          <div key={p.date} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${p.date}: ${t('units.hours', { value: formatHours(p.drivingMin) })}`}>
            {p.overtimeMin > 0 && <div className="rounded-t-sm bg-danger" style={{ height: `${(p.overtimeMin / max) * 100}%` }} />}
            <div className={p.overtimeMin > 0 ? 'bg-brand-500' : 'rounded-t-sm bg-brand-500'} style={{ height: `${(p.drivingMin / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        {points.map((p) => (
          <span key={p.date} className="min-w-0 flex-1 truncate text-center text-[10px] text-fg-3">
            {formatWeekday(`${p.date}T12:00:00Z`)}
          </span>
        ))}
      </div>
      <figcaption className="flex gap-4 text-xs text-fg-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-brand-500" aria-hidden="true" />
          {t('hours.driving')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-danger" aria-hidden="true" />
          {t('hours.overtime')}
        </span>
      </figcaption>
    </figure>
  );
}
