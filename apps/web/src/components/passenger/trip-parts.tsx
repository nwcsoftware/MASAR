import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { CalendarClock, ChevronRight, Download, FileText, Languages, Phone, Plane, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CategoryBadge } from '@/components/category-badge';
import { DriverAvatar } from '@/components/driver-avatar';
import { FormError } from '@/components/form';
import { StatusPill } from '@/components/status-pill';
import { Button } from '@/components/ui/button';
import { storageFileUrl } from '@/features/documents/queries';
import { daysUntil } from '@/features/documents/status';
import { TRIP_DOCUMENTS } from '@/features/passenger/queries';
import { needsRating, type PassengerTrip } from '@/features/passenger/types';
import { useLiveData } from '@/lib/data-source';
import { companyDateKey, formatDate, formatTime, formatTimeRange, isolate } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';
import { categoryColorVar } from '@/lib/task-meta';
import { cn, tone } from '@/lib/utils';
import { Stars } from './stars';

const first = (t: PassengerTrip) => t.stops[0];
const last = (t: PassengerTrip) => t.stops.at(-1);

/** One trip in the list: when, from → to, driver, status; "Rate" when due. */
export function TripCard({ trip }: { trip: PassengerTrip }) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const rate = needsRating(trip);
  return (
    <Link
      to="/passenger/trips/$taskId"
      params={{ taskId: trip.id }}
      className="tone-block block space-y-2 rounded-lg p-4 transition-shadow hover:shadow-md"
      style={tone(categoryColorVar(trip.category))}
      data-trip={trip.id}
    >
      <div className="flex flex-wrap items-center gap-2">
        <CategoryBadge category={trip.category} />
        <StatusPill status={trip.status} />
        {rate && <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[11px] font-bold text-fg-on-brand">{t('passenger.rateNow')}</span>}
        {trip.live && (
          <span className="tone-pill flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold [--tone:var(--status-in-progress)]" data-live-badge>
            <span className="tone-dot animate-pulse-ring size-1.5 rounded-full" aria-hidden="true" />
            {t('live.badge')}
          </span>
        )}
        <ChevronRight className="ms-auto size-4 text-fg-3 rtl:-scale-x-100" aria-hidden="true" />
      </div>
      <p className="font-bold text-fg">{trip.title}</p>
      <p className="tabular text-sm text-fg-2">
        {formatDate(trip.scheduled_start, 'long')} · {formatTimeRange(trip.scheduled_start, trip.scheduled_end)}
      </p>
      {first(trip) && last(trip) && (
        <p className="truncate text-xs text-fg-2" dir="auto">
          {first(trip)!.label} <span className="inline-block rtl:-scale-x-100">→</span> {last(trip)!.label}
        </p>
      )}
      {trip.driver && <p className="text-xs text-fg-3">{t('passenger.withDriver', { name: isolate(name({ full_name: trip.driver.name, full_name_ar: trip.driver.name_ar }, 'full_name')) })}</p>}
    </Link>
  );
}

/** §2 ticket + pickup / destination with date & time + duration. */
export function TripTimeline({ trip }: { trip: PassengerTrip }) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const pickup = first(trip);
  const destination = last(trip);
  return (
    <div className="space-y-3">
      {trip.flight && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-surface-2 px-3 py-2.5 text-sm" data-ticket>
          <Plane className="size-4 text-cat-airport" aria-hidden="true" />
          <span className="font-bold" dir="ltr">
            {trip.flight.flight_no}
          </span>
          <span className="text-fg-2">
            {trip.flight.airline} · {t(`flight.${trip.flight.direction}`)} · {trip.flight.airport}
            {trip.flight.terminal ? ` · ${t('passenger.terminal', { value: trip.flight.terminal })}` : ''}
          </span>
          <span className="tabular text-fg-2">{t('flight.scheduled', { time: formatTime(trip.flight.scheduled_time) })}</span>
          {trip.flight.estimated_time && trip.flight.estimated_time !== trip.flight.scheduled_time && (
            <span className="tabular font-bold text-delayed-fg">{t('flight.estimated', { time: formatTime(trip.flight.estimated_time) })}</span>
          )}
          {trip.flight.airport_name && (
            <span className="w-full text-xs text-fg-3">{name({ name: trip.flight.airport_name, name_ar: trip.flight.airport_name_ar })}</span>
          )}
        </div>
      )}
      <ol className="relative space-y-4 before:absolute before:inset-y-2 before:start-[7px] before:w-0.5 before:bg-border">
        {[pickup, destination].map((stop, i) =>
          stop ? (
            <li key={i} className="relative grid grid-cols-[16px_1fr] gap-3">
              <span className={cn('mt-1 size-4 rounded-full border-2 border-[var(--tone)]', i === 1 ? 'tone-dot' : 'bg-surface')} style={tone(categoryColorVar(trip.category))} aria-hidden="true" />
              <div className="min-w-0">
                <p className="eyebrow">{i === 0 ? t('passenger.pickup') : t('passenger.destination')}</p>
                <p className="text-sm font-semibold text-fg" dir="auto">
                  {stop.label}
                </p>
                {stop.planned_arrival_at && (
                  <p className="tabular text-xs text-fg-2">
                    {formatDate(stop.planned_arrival_at, 'short')} · {formatTime(stop.planned_arrival_at)}
                  </p>
                )}
              </div>
            </li>
          ) : null,
        )}
      </ol>
      <p className="flex items-center gap-2 text-sm text-fg-2">
        <CalendarClock className="size-4 text-fg-3" aria-hidden="true" />
        {t('passenger.duration', { value: trip.duration_min ?? '—' })}
      </p>
    </div>
  );
}

/** §3 driver card — no phone number; the dispatch line only during the trip window (A3). */
export function DriverCard({ trip }: { trip: PassengerTrip }) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const driver = trip.driver;
  if (!driver) return <p className="rounded-lg border border-border p-4 text-sm text-fg-3">{t('passenger.noDriverYet')}</p>;
  const displayName = name({ full_name: driver.name, full_name_ar: driver.name_ar }, 'full_name');
  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4" data-driver-card>
      <div className="flex items-center gap-3">
        {driver.photo_url ? (
          <img src={driver.photo_url} alt="" className="size-14 rounded-full object-cover" />
        ) : (
          <DriverAvatar name={driver.name} className="size-14 text-base" />
        )}
        <div className="min-w-0">
          <p className="font-bold text-fg">{displayName}</p>
          <p className="text-xs text-fg-2">{[driver.nationality, driver.licence ? name(driver.licence) : null].filter(Boolean).join(' · ') || '—'}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="eyebrow flex items-center gap-1">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            {t('passenger.drivingRating')}
          </dt>
          <dd>
            <Stars value={driver.rating?.driving ?? driver.rating?.stars ?? null} count={driver.rating?.ratings} />
          </dd>
        </div>
        <div>
          <dt className="eyebrow flex items-center gap-1">
            <Languages className="size-3.5" aria-hidden="true" />
            {t('passenger.englishRating')}
          </dt>
          <dd>
            <Stars value={driver.english_rating} />
          </dd>
        </div>
      </dl>
      {trip.vehicle && (
        <p className="text-sm text-fg-2">
          {[trip.vehicle.make, trip.vehicle.model, trip.vehicle.color].filter(Boolean).join(' · ')} ·{' '}
          <span className="font-semibold text-fg" dir="ltr">
            {trip.vehicle.plate_no}
          </span>
        </p>
      )}
      {trip.contact_phone ? (
        <Button asChild variant="outline" className="w-full">
          <a href={`tel:${trip.contact_phone.replace(/\s/g, '')}`}>
            <Phone aria-hidden="true" />
            {t('passenger.callDispatch')}
          </a>
        </Button>
      ) : (
        <p className="text-xs text-fg-3">{t('passenger.callHint')}</p>
      )}
    </div>
  );
}

/** §4 trip documents — view / download, expiry shown. */
export function TripDocuments({ trip }: { trip: PassengerTrip }) {
  const { t } = useTranslation();
  const live = useLiveData();
  const [error, setError] = useState<unknown>(null);
  if (!trip.documents.length) return <p className="text-sm text-fg-3">{t('passenger.noDocuments')}</p>;
  const today = companyDateKey();

  const open = async (path: string, label: string) => {
    setError(null);
    const tab = window.open('', '_blank');
    try {
      const url = await storageFileUrl(TRIP_DOCUMENTS, path, live, label);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch (e) {
      tab?.close();
      setError(e);
    }
  };

  return (
    <div className="space-y-2">
      <ul className="divide-y divide-border rounded-lg border border-border">
        {trip.documents.map((doc) => {
          const days = doc.expires_on ? daysUntil(doc.expires_on, today) : null;
          return (
            <li key={doc.id} className="flex items-center gap-3 px-3 py-2.5" data-document={doc.title ?? doc.file_name}>
              <FileText className="size-5 shrink-0 text-fg-3" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-fg">{doc.title ?? doc.file_name}</p>
                <p className="text-xs text-fg-2">
                  {t(`tripDocuments.category.${doc.category}`, { defaultValue: doc.category })}
                  {doc.expires_on && (
                    <span className={cn(days != null && days < 0 ? 'font-semibold text-danger' : days != null && days <= 3 ? 'font-semibold text-warning-fg' : '')}>
                      {' · '}
                      {days != null && days < 0 ? t('tripDocuments.expired') : t('tripDocuments.validUntil', { date: formatDate(`${doc.expires_on}T12:00:00Z`) })}
                    </span>
                  )}
                </p>
              </div>
              {doc.storage_path ? (
                <Button size="sm" variant="outline" onClick={() => void open(doc.storage_path!, doc.title ?? doc.file_name ?? '')} aria-label={`${t('tripDocuments.open')} ${doc.title ?? ''}`}>
                  <Download aria-hidden="true" />
                  <span className="hidden min-[380px]:inline">{t('tripDocuments.open')}</span>
                </Button>
              ) : (
                <span className="text-xs text-fg-3">{t('tripDocuments.noFile')}</span>
              )}
            </li>
          );
        })}
      </ul>
      <FormError error={error} />
    </div>
  );
}
