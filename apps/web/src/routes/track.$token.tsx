import { createFileRoute } from '@tanstack/react-router';
import { CarFront, Flag, LinkIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LanguageToggle } from '@/components/language-toggle';
import { LogoMark } from '@/components/logo';
import { LiveView } from '@/components/passenger/live-trip';
import { StatusPill } from '@/components/status-pill';
import { Skeleton } from '@/components/ui/skeleton';
import { useSharedTrip } from '@/features/passenger/queries';
import { formatDateTime } from '@/lib/format';

/** §6 share link — anyone with the link follows the trip until it ends (no sign-in, no names). */
export const Route = createFileRoute('/track/$token')({
  component: SharedTripPage,
});

function SharedTripPage() {
  const { t } = useTranslation();
  const { token } = Route.useParams();
  const trip = useSharedTrip(token);

  return (
    <div className="mx-auto min-h-dvh max-w-md space-y-4 bg-bg px-4 pb-10 pt-4 sm:border-x sm:border-border">
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <LogoMark className="size-8" />
          <span className="text-base font-extrabold">{t('common.appName')}</span>
        </span>
        <LanguageToggle compact />
      </header>

      {trip.isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : trip.isError ? (
        <ErrorState error={trip.error} onRetry={() => void trip.refetch()} />
      ) : trip.data.state !== 'active' ? (
        <EmptyState icon={LinkIcon} title={t(trip.data.state === 'ended' ? 'shareLink.ended' : 'shareLink.invalid')} body={t('shareLink.endedBody')} />
      ) : (
        <main className="space-y-4" data-shared-trip>
          <div className="space-y-1">
            <p className="eyebrow">{trip.data.company}</p>
            <h1 className="text-xl font-extrabold">{t('shareLink.heading')}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-fg-2">
              <StatusPill status={trip.data.status} />
              <span className="tabular">{formatDateTime(trip.data.scheduled_start)}</span>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <LiveView live={trip.data} caption={t('live.caption')} />
          </div>
          <dl className="space-y-2 rounded-lg border border-border bg-surface p-4 text-sm">
            {trip.data.vehicle && (
              <div className="flex items-center gap-2">
                <CarFront className="size-4 text-fg-3" aria-hidden="true" />
                <dt className="sr-only">{t('shareLink.vehicle')}</dt>
                <dd>
                  {[trip.data.vehicle.make, trip.data.vehicle.model, trip.data.vehicle.color].filter(Boolean).join(' · ')} ·{' '}
                  <span className="font-semibold" dir="ltr">
                    {trip.data.vehicle.plate_no}
                  </span>
                  {trip.data.driver_first_name && <> · {t('shareLink.driver', { name: trip.data.driver_first_name })}</>}
                </dd>
              </div>
            )}
            {trip.data.destination && (
              <div className="flex items-center gap-2">
                <Flag className="size-4 text-fg-3" aria-hidden="true" />
                <dt className="sr-only">{t('shareLink.destination')}</dt>
                <dd>{trip.data.destination}</dd>
              </div>
            )}
          </dl>
          <p className="text-center text-xs text-fg-3">{t('shareLink.footer')}</p>
        </main>
      )}
    </div>
  );
}
