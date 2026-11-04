import { useState } from 'react';
import { MessageSquareText, Phone, Siren, LocateFixed } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FormError } from '@/components/form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useRaiseSos } from '@/features/passenger/queries';
import { canRaiseSos, currentPosition, mapsUrl, type Position } from '@/features/passenger/trip-utils';
import { EMERGENCY_NUMBER, type PassengerTrip, type SosResult } from '@/features/passenger/types';
import { formatTime } from '@/lib/format';

const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

/** §9 SOS: alerts dispatch with the live location, then hands it to emergency contacts. */
export function SosButton({ trip }: { trip: PassengerTrip }) {
  const { t } = useTranslation();
  const sos = useRaiseSos();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<SosResult | null>(null);
  const [position, setPosition] = useState<Position | null>(null);

  if (!canRaiseSos(trip)) return null;

  const send = async () => {
    const pos = await currentPosition();
    setPosition(pos);
    const res = await sos.mutateAsync({ taskId: trip.id, lat: pos?.lat, lng: pos?.lng, accuracy: pos?.accuracy, message: message.trim() || undefined });
    setResult(res);
  };
  const smsBody = encodeURIComponent(
    position ? t('sos.smsWithLocation', { link: mapsUrl(position.lat, position.lng) }) : t('sos.smsNoLocation'),
  );

  return (
    <>
      {trip.open_sos && (
        <p role="status" className="tint-12 rounded-md px-3 py-2 text-sm font-semibold text-danger [--tint-color:var(--danger)]" data-open-sos>
          {t(trip.open_sos.status === 'acknowledged' ? 'sos.acknowledged' : 'sos.sent', { time: formatTime(trip.open_sos.created_at) })}
        </p>
      )}
      <Button variant="destructive" size="lg" className="w-full text-base font-extrabold" onClick={() => setOpen(true)} data-sos>
        <Siren aria-hidden="true" />
        {t('sos.button')}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setResult(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{result ? t('sos.alerted') : t('sos.confirmTitle')}</DialogTitle>
            <DialogDescription>{result ? t('sos.alertedHint') : t('sos.confirmBody')}</DialogDescription>
          </DialogHeader>

          {result ? (
            <div className="space-y-2" data-sos-result>
              <Button asChild variant="destructive" className="w-full">
                <a href={tel(EMERGENCY_NUMBER)}>
                  <Phone aria-hidden="true" />
                  {t('sos.callEmergency', { number: EMERGENCY_NUMBER })}
                </a>
              </Button>
              {result.dispatch_phone && (
                <Button asChild variant="outline" className="w-full">
                  <a href={tel(result.dispatch_phone)}>
                    <Phone aria-hidden="true" />
                    {t('sos.callDispatch')}
                  </a>
                </Button>
              )}
              {result.emergency_contacts.map((c) => (
                <div key={c.phone} className="flex items-center gap-2 rounded-md border border-border p-2" data-sos-contact>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.name}</span>
                  <Button asChild size="sm" variant="secondary">
                    <a href={`sms:${c.phone.replace(/[^\d+]/g, '')}?&body=${smsBody}`}>
                      <MessageSquareText aria-hidden="true" />
                      {t('sos.sendLocation')}
                    </a>
                  </Button>
                  <Button asChild size="icon" variant="ghost" aria-label={t('sos.callContact', { name: c.name })}>
                    <a href={tel(c.phone)}>
                      <Phone aria-hidden="true" />
                    </a>
                  </Button>
                </div>
              ))}
              {!result.emergency_contacts.length && <p className="text-xs text-fg-3">{t('sos.noContacts')}</p>}
              <Button variant="ghost" className="w-full" onClick={() => void send()} disabled={sos.isPending}>
                <LocateFixed aria-hidden="true" />
                {t('sos.refresh')}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="sos-message">{t('sos.message')}</Label>
              <Textarea id="sos-message" rows={2} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t('sos.messagePlaceholder')} />
            </div>
          )}
          <FormError error={sos.error} />
          {!result && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button variant="destructive" onClick={() => void send()} disabled={sos.isPending} data-sos-send>
                <Siren aria-hidden="true" />
                {sos.isPending ? t('sos.sending') : t('sos.send')}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
