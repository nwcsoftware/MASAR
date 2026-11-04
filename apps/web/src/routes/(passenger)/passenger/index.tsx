import { createFileRoute, Link } from '@tanstack/react-router';
import { Star, TicketsPlane } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { RegistrationStatusCard } from '@/components/passenger/registration-status';
import { TripCard } from '@/components/passenger/trip-parts';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/features/auth/session';
import { usePassengerHome } from '@/features/passenger/queries';
import { firstName, isUpcoming, needsRating } from '@/features/passenger/types';
import { isolate } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';

export const Route = createFileRoute('/(passenger)/passenger/')({
  component: PassengerTripsPage,
});

/** §2 scheduled trips + the rating prompt when a trip has ended (§14). */
function PassengerTripsPage() {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const { profile } = useCurrentUser();
  const home = usePassengerHome();

  if (home.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    );
  }
  if (home.isError) return <ErrorState error={home.error} onRetry={() => void home.refetch()} />;
  if (home.data.status !== 'approved') return <RegistrationStatusCard home={home.data} />;

  const trips = home.data.trips;
  const toRate = trips.filter((trip) => needsRating(trip));
  const upcoming = trips.filter(isUpcoming);
  const past = trips.filter((trip) => !isUpcoming(trip)).reverse();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">{t('passenger.hello', { name: isolate(firstName(name(profile, 'full_name'))) })}</h1>
        <p className="text-sm text-fg-2">{t('passenger.subtitle')}</p>
      </div>

      {toRate.map((trip) => (
        <div key={trip.id} role="status" className="flex items-center gap-3 rounded-lg border border-brand-500 bg-surface p-4">
          <Star className="size-6 shrink-0 fill-warning text-warning" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-fg">{t('passenger.ratePrompt')}</p>
            <p className="truncate text-xs text-fg-2">{trip.title}</p>
          </div>
          <Button asChild size="sm">
            <Link to="/passenger/rate/$taskId" params={{ taskId: trip.id }}>
              {t('passenger.rateNow')}
            </Link>
          </Button>
        </div>
      ))}

      <section className="space-y-3" aria-labelledby="upcoming-title">
        <h2 id="upcoming-title" className="eyebrow">
          {t('passenger.upcoming')}
        </h2>
        {upcoming.length ? (
          upcoming.map((trip) => <TripCard key={trip.id} trip={trip} />)
        ) : (
          <EmptyState compact icon={TicketsPlane} title={t('passenger.noUpcoming')} body={t('passenger.noUpcomingBody')} />
        )}
      </section>

      {past.length > 0 && (
        <section className="space-y-3" aria-labelledby="past-title">
          <h2 id="past-title" className="eyebrow">
            {t('passenger.recent')}
          </h2>
          {past.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </section>
      )}
    </div>
  );
}
