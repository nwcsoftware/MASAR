import { Plane } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { SimilarAirportTrip } from '@/features/tasks/types';
import { formatTime, isolate } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * FR-15 / US-04 — "Site B already has a car going to RUH at 14:00 — share?"
 * Merge (task_links shared_ride) lands with the task wizard in Phase 2.
 */
export function ShareTripHint({
  trip,
  flightNo,
  airportCode,
  className,
  onShare,
}: {
  trip: SimilarAirportTrip;
  flightNo: string | null;
  airportCode: string;
  className?: string;
  onShare?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-lg border border-[color-mix(in_srgb,var(--brand-500)_30%,var(--border))] bg-[color-mix(in_srgb,var(--brand-500)_8%,var(--surface))] px-4 py-3',
        className,
      )}
    >
      <Plane className="size-5 shrink-0 text-brand-500" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-fg">
          {t('share.title', { site: isolate(trip.site_name), airport: isolate(airportCode), time: formatTime(trip.scheduled_time) })}
        </p>
        <p className="text-xs text-fg-2">
          {t('share.body', {
            flight: isolate(flightNo ?? ''),
            minutes: trip.minutes_apart,
            driver: isolate(trip.driver_name ?? t('tasks.unassigned')),
          })}
        </p>
      </div>
      <Button size="sm" onClick={onShare} disabled={!onShare} title={onShare ? undefined : t('common.comingSoon')}>
        {t('share.action')}
      </Button>
    </div>
  );
}
