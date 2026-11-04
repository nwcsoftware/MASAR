import { Navigation } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatNumber, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

/** "ETA 14:32 · 18 km" (docs/DESIGN.md §5). */
export function EtaChip({ eta, distanceKm, className }: { eta: string; distanceKm?: number | null; className?: string }) {
  const { t } = useTranslation();
  return (
    <span className={cn('tabular inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-fg-2', className)}>
      <Navigation className="size-3 text-brand-500" aria-hidden="true" />
      {t('map.eta', { time: formatTime(eta) })}
      {distanceKm != null && <span className="text-fg-3">· {t('units.km', { value: formatNumber(distanceKm) })}</span>}
    </span>
  );
}
