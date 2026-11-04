import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Dashboard KPI tile (design/preview.html .kpi). `tone` colours the value. */
export function KpiTile({
  label,
  value,
  detail,
  tone = 'default',
  loading,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: 'default' | 'warning' | 'danger';
  loading?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-surface px-4 py-3.5',
        tone === 'warning' ? 'border-[color-mix(in_srgb,var(--warning)_45%,var(--border))]' : 'border-border',
      )}
    >
      <div className="eyebrow">{label}</div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-12" />
      ) : (
        <div
          className={cn(
            'tabular mt-1.5 text-[26px] font-extrabold leading-tight tracking-tight',
            tone === 'warning' ? 'text-warning-fg' : tone === 'danger' ? 'text-danger' : 'text-fg',
          )}
        >
          {value}
        </div>
      )}
      {detail && <div className="mt-1 truncate text-xs text-fg-2">{detail}</div>}
    </div>
  );
}
