import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Read-only stars: "★★★★☆ 4.2". `value` may be fractional. */
export function Stars({ value, count, className, size = 'sm' }: { value: number | null; count?: number; className?: string; size?: 'sm' | 'md' }) {
  const { t } = useTranslation();
  if (value == null) return <span className={cn('text-xs text-fg-3', className)}>{t('rating.none')}</span>;
  const icon = size === 'md' ? 'size-5' : 'size-3.5';
  return (
    <span className={cn('inline-flex items-center gap-1', className)} aria-label={t('rating.outOfFive', { value: formatNumber(value) })}>
      <span className="inline-flex" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} className={cn(icon, n <= Math.round(value) ? 'fill-warning text-warning' : 'text-border-strong')} />
        ))}
      </span>
      <span className="tabular text-xs font-bold text-fg">{formatNumber(value)}</span>
      {count != null && <span className="text-xs text-fg-3">({t('rating.count', { count })})</span>}
    </span>
  );
}

/** 1–5 star picker (radiogroup, arrow keys move). */
export function StarsInput({ value, onChange, id }: { value: number; onChange: (v: number) => void; id?: string }) {
  const { t } = useTranslation();
  return (
    <div id={id} role="radiogroup" aria-label={t('rating.overall')} className="flex gap-1" dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={t('rating.stars', { count: n })}
          tabIndex={value === n || (!value && n === 1) ? 0 : -1}
          onClick={() => onChange(n)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(Math.min(5, (value || 0) + 1));
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(Math.max(1, (value || 2) - 1));
          }}
          className="grid size-11 place-items-center rounded-md hover:bg-surface-2"
        >
          <Star className={cn('size-8', n <= value ? 'fill-warning text-warning' : 'text-border-strong')} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
