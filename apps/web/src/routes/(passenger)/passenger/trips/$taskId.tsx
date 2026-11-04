import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, FileQuestion, Pencil, Star, UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CategoryBadge } from '@/components/category-badge';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { CheckInCard } from '@/components/passenger/checkin-card';
import { LiveTripPanel } from '@/components/passenger/live-trip';
import { RegistrationStatusCard } from '@/components/passenger/registration-status';
import { RequestDialog } from '@/components/passenger/request-dialog';
import { SosButton } from '@/components/passenger/sos-button';
import { Stars } from '@/components/passenger/stars';
import { DriverCard, TripDocuments, TripTimeline } from '@/components/passenger/trip-parts';
import { StatusPill } from '@/components/status-pill';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePassengerHome } from '@/features/passenger/queries';
import { canRequestChange, needsRating } from '@/features/passenger/types';
import { formatDate, formatDateTime } from '@/lib/format';
import { useNow } from '@/lib/use-now';

export const Route = createFileRoute('/(passenger)/passenger/trips/$taskId')({
  component: PassengerTripPage,
});

function Section({ title, children, id }: { title: string; children: React.ReactNode; id: string }) {
  return (
    <section className="space-y-2" aria-labelledby={id}>
      <h2 id={id} className="eyebrow">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** One trip: live map + SOS, check-in code, ticket, driver, documents, co-passengers, requests, rating. */
function PassengerTripPage() {
  const { t } = useTranslation();
  const { taskId } = Route.useParams();
  const home = usePassengerHome();
  const now = useNow();

  const back = (
    <Link to="/passenger" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-500">
      <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
      {t('passenger.tabs.trips')}
    </Link>
  );

  if (home.isPending) return <Skeleton className="h-96 w-full" />;
  if (home.isError) return <ErrorState error={home.error} onRetry={() => void home.refetch()} />;
  if (home.data.status !== 'approved') return <RegistrationStatusCard home={home.data} />;
  const trip = home.data.trips.find((x) => x.id === taskId);
  if (!trip) {
    return (
      <div className="space-y-4">
        {back}
        <EmptyState icon={FileQuestion} title={t('passenger.tripNotFound')} />
      </div>
    );
  }
  const others = trip.co_passengers.filter((p) => !p.me);
  const canEditRating = trip.my_rating && now < new Date(trip.my_rating.editable_until).getTime();

  return (
    <div className="space-y-6">
      {back}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={trip.category} />
          <StatusPill status={trip.status} />
        </div>
        <h1 className="text-xl font-extrabold">{trip.title}</h1>
        <p className="tabular text-sm text-fg-2">{formatDate(trip.scheduled_start, 'long')}</p>
      </div>

      <SosButton trip={trip} />
      <LiveTripPanel trip={trip} />
      <CheckInCard trip={trip} />

      {needsRating(trip, now) && (
        <Button asChild className="w-full" size="lg">
          <Link to="/passenger/rate/$taskId" params={{ taskId: trip.id }}>
            <Star aria-hidden="true" />
            {t('passenger.rateThisTrip')}
          </Link>
        </Button>
      )}

      <Section id="trip-route" title={t('passenger.trip')}>
        <TripTimeline trip={trip} />
      </Section>

      <Section id="trip-driver" title={t('passenger.driver')}>
        <DriverCard trip={trip} />
      </Section>

      <Section id="trip-docs" title={t('passenger.documents')}>
        <TripDocuments trip={trip} />
      </Section>

      {others.length > 0 && (
        <Section id="trip-co" title={t('passenger.coPassengers')}>
          <ol className="space-y-1 rounded-lg border border-border p-3 text-sm">
            {trip.co_passengers.map((p) => (
              <li key={p.pickup_order} className="flex items-center gap-2">
                <UsersRound className="size-4 text-fg-3" aria-hidden="true" />
                <span className="tabular text-xs text-fg-3">{t('passenger.pickupOrder', { n: p.pickup_order })}</span>
                <span className={p.me ? 'font-bold' : ''}>{p.me ? t('passenger.you') : p.first_name}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {canRequestChange(trip, now) && (
        <Section id="trip-requests" title={t('requests.changeTitle')}>
          <div className="flex gap-2">
            <RequestDialog kind="reschedule" trip={trip} />
            <RequestDialog kind="cancel" trip={trip} />
          </div>
          <p className="text-xs text-fg-3">{t('requests.changeHint')}</p>
        </Section>
      )}

      {trip.my_rating && (
        <Section id="trip-rating" title={t('passenger.yourRating')}>
          <div className="space-y-2 rounded-lg border border-border p-4">
            <Stars value={trip.my_rating.stars} size="md" />
            {trip.my_rating.comment && <p className="text-sm text-fg-2">{trip.my_rating.comment}</p>}
            {canEditRating ? (
              <Button asChild variant="outline" size="sm">
                <Link to="/passenger/rate/$taskId" params={{ taskId: trip.id }}>
                  <Pencil aria-hidden="true" />
                  {t('passenger.editRating', { time: formatDateTime(trip.my_rating.editable_until) })}
                </Link>
              </Button>
            ) : (
              <p className="text-xs text-fg-3">{t('passenger.ratingLocked')}</p>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}
