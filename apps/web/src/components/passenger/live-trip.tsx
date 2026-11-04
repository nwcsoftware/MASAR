import { useState } from 'react';
import { Check, Copy, ExternalLink, Link2, Link2Off, Navigation, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FormError } from '@/components/form';
import { MapCanvas, type MapPin } from '@/components/map-canvas';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePassengerLive, useShareLink } from '@/features/passenger/queries';
import { mapsUrl, trackUrl } from '@/features/passenger/trip-utils';
import type { LiveTrip, PassengerTrip } from '@/features/passenger/types';
import { formatNumber, formatRelative, formatTime } from '@/lib/format';
import { useNow } from '@/lib/use-now';

/** Driver + next stop on the map, ETA, distance, last update — shared by the passenger and the public page. */
export function LiveView({ live, caption }: { live: LiveTrip; caption?: string }) {
  const { t } = useTranslation();
  const now = useNow(15_000);
  const pins: MapPin[] = [];
  if (live.location) pins.push({ id: 'driver', lat: live.location.lat, lng: live.location.lng, label: t('live.driver'), colorVar: '--status-en-route', live: true, kind: 'driver' });
  if (live.next_stop?.lat != null && live.next_stop.lng != null) {
    pins.push({ id: 'stop', lat: live.next_stop.lat, lng: live.next_stop.lng, label: live.next_stop.label ?? '', colorVar: '--brand-500', kind: 'site' });
  }
  const etaMin = live.eta_at ? Math.max(0, Math.round((new Date(live.eta_at).getTime() - now) / 60_000)) : null;

  return (
    <div className="space-y-3" data-live>
      <MapCanvas pins={pins} className="h-56 rounded-lg" caption={caption} />
      {live.location ? (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-md bg-surface-2 p-3">
            <dt className="eyebrow">{live.checked_in_at ? t('live.toDestination') : t('live.toPickup')}</dt>
            <dd className="mt-1 text-lg font-extrabold tabular" data-eta>
              {etaMin == null ? '—' : etaMin <= 1 ? t('live.arrivingNow') : t('live.inMinutes', { n: etaMin })}
            </dd>
            {live.eta_at && <dd className="text-xs text-fg-3 tabular">{t('live.etaAt', { time: formatTime(live.eta_at) })}</dd>}
          </div>
          <div className="rounded-md bg-surface-2 p-3">
            <dt className="eyebrow">{t('live.distance')}</dt>
            <dd className="mt-1 text-lg font-extrabold tabular">{live.distance_km == null ? '—' : t('live.km', { n: formatNumber(live.distance_km) })}</dd>
            <dd className="text-xs text-fg-3">{t('live.updated', { time: formatRelative(live.location.recorded_at, new Date(now)) })}</dd>
          </div>
        </dl>
      ) : (
        <p className="rounded-md bg-surface-2 p-3 text-sm text-fg-2">{t('live.noPosition')}</p>
      )}
      {live.next_stop && (
        <p className="flex items-center gap-2 text-sm text-fg-2">
          <Navigation className="size-4 text-brand-500 rtl:-scale-x-100" aria-hidden="true" />
          {t(live.checked_in_at ? 'live.headingTo' : 'live.pickupAt', { place: live.next_stop.label ?? '—' })}
        </p>
      )}
      {live.location && (
        <Button asChild variant="outline" size="sm" className="w-full">
          <a href={mapsUrl(live.location.lat, live.location.lng)} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden="true" />
            {t('live.openInMaps')}
          </a>
        </Button>
      )}
    </div>
  );
}

/** §6: the passenger's live trip + "share my trip" link (expires when the trip ends). */
export function LiveTripPanel({ trip }: { trip: PassengerTrip }) {
  const { t } = useTranslation();
  const live = usePassengerLive(trip.id, trip.live);
  if (!trip.live) return null;
  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
      {live.isPending ? (
        <Skeleton className="h-72 w-full" />
      ) : live.isError ? (
        <FormError error={live.error} />
      ) : (
        <LiveView live={live.data} caption={t('live.caption')} />
      )}
      <ShareTrip trip={trip} />
    </div>
  );
}

function ShareTrip({ trip }: { trip: PassengerTrip }) {
  const { t } = useTranslation();
  const share = useShareLink();
  const [copied, setCopied] = useState(false);
  const url = trip.share_token ? trackUrl(trip.share_token) : null;

  const create = async () => {
    const token = await share.mutateAsync({ taskId: trip.id });
    if (!token) return;
    const link = trackUrl(token);
    if (navigator.share) await navigator.share({ title: t('shareLink.title'), text: t('shareLink.text'), url: link }).catch(() => undefined);
  };
  const copy = async () => {
    if (!url) return;
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!url) {
    return (
      <div className="space-y-1">
        <Button variant="secondary" className="w-full" onClick={() => void create()} disabled={share.isPending}>
          <Share2 aria-hidden="true" />
          {t('shareLink.create')}
        </Button>
        <p className="text-xs text-fg-3">{t('shareLink.hint')}</p>
        <FormError error={share.error} />
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-md bg-surface-2 p-3" data-share-link>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Link2 className="size-4 text-brand-500" aria-hidden="true" />
        {t('shareLink.active')}
      </p>
      <p className="truncate text-xs text-fg-3" dir="ltr" data-share-url>
        {url}
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={() => void copy()}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? t('shareLink.copied') : t('shareLink.copy')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => share.mutate({ taskId: trip.id, revoke: true })} disabled={share.isPending}>
          <Link2Off aria-hidden="true" />
          {t('shareLink.stop')}
        </Button>
      </div>
    </div>
  );
}
