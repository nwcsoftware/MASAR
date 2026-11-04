import { useMemo } from 'react';
import { CircleCheck, QrCode } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { encode } from 'uqr';
import { checkinPayload } from '@/features/passenger/trip-utils';
import type { PassengerTrip } from '@/features/passenger/types';
import { formatTime } from '@/lib/format';

/** QR modules as an SVG — dark on light whatever the theme, or scanners struggle. */
export function QrImage({ value, label, className }: { value: string; label: string; className?: string }) {
  const qr = useMemo(() => encode(value, { ecc: 'M', border: 2 }), [value]);
  const path = useMemo(
    () => qr.data.flatMap((row, y) => row.map((on, x) => (on ? `M${x} ${y}h1v1h-1z` : ''))).join(''),
    [qr],
  );
  return (
    <svg viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label={label} className={className} shapeRendering="crispEdges">
      <rect width={qr.size} height={qr.size} className="fill-white" />
      <path d={path} className="fill-black" />
    </svg>
  );
}

/** §8: show this to the driver at pickup — six digits, or the QR. */
export function CheckInCard({ trip }: { trip: PassengerTrip }) {
  const { t } = useTranslation();
  const { code, checked_in_at, dropped_off_at } = trip.checkin;

  if (checked_in_at) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4 text-sm" data-checked-in>
        <CircleCheck className="mt-0.5 size-5 shrink-0 text-success-fg" aria-hidden="true" />
        <div>
          <p className="font-semibold">{t('checkin.done', { time: formatTime(checked_in_at) })}</p>
          {dropped_off_at && <p className="text-fg-2">{t('checkin.droppedOff', { time: formatTime(dropped_off_at) })}</p>}
        </div>
      </div>
    );
  }
  if (!code) return null;
  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4 text-center" data-checkin>
      <p className="flex items-center justify-center gap-2 text-sm font-semibold">
        <QrCode className="size-4 text-brand-500" aria-hidden="true" />
        {t('checkin.title')}
      </p>
      <QrImage value={checkinPayload(trip.id, code)} label={t('checkin.qrLabel')} className="mx-auto size-44 rounded-md" />
      <p className="text-3xl font-extrabold tracking-[0.3em] tabular" dir="ltr" data-checkin-code>
        {code}
      </p>
      <p className="text-xs text-fg-3">{t('checkin.hint')}</p>
    </div>
  );
}
