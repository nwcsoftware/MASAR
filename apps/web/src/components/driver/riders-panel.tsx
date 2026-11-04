import { useEffect, useRef, useState } from 'react';
import { CircleCheck, LogOut, Phone, ScanLine, UserCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FormError } from '@/components/form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCheckIn, useDropOff, useTaskRiders } from '@/features/passenger/queries';
import { codeFromScan, currentPosition } from '@/features/passenger/trip-utils';
import type { Task } from '@/mocks/fixtures';
import { formatTime } from '@/lib/format';
import { TERMINAL_STATUSES } from '@/lib/task-meta';

type Passenger = { name?: string; phone?: string };

/** Chrome / Android ship BarcodeDetector; elsewhere the driver types the code. */
type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
const barcodeDetector = (): Detector | null => {
  const Ctor = (globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  return Ctor ? new Ctor({ formats: ['qr_code'] }) : null;
};

/** §8 who to pick up, check-in (code / QR) and drop-off; the first pickup starts the trip, the last drop-off ends it. */
export function RidersPanel({ task }: { task: Task }) {
  const { t } = useTranslation();
  const riders = useTaskRiders(task.id);
  const dropOff = useDropOff();
  const pickUp = useCheckIn();
  const [open, setOpen] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const phones = (Array.isArray(task.passengers) ? task.passengers : []) as Passenger[];
  const done = TERMINAL_STATUSES.includes(task.status);
  const rows = riders.data ?? [];
  if (!rows.length && !riders.isPending) return null;
  const waiting = rows.filter((r) => !r.checked_in_at).length;

  return (
    <section className="space-y-2" aria-labelledby="riders-title">
      <h2 id="riders-title" className="eyebrow">
        {t('taskDetail.passengers')}
      </h2>
      {!done && waiting > 0 && (
        <Button size="lg" className="w-full" onClick={() => setOpen(true)} data-checkin-open>
          <UserCheck aria-hidden="true" />
          {t('checkin.driverButton')}
        </Button>
      )}
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
        {rows.map((r) => {
          const phone = phones[r.pickup_order - 1]?.phone;
          return (
            <li key={r.id} className="flex min-h-touch items-center gap-3 px-4 py-2" data-rider={r.name}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.name}</p>
                <p className="text-xs text-fg-3">
                  {r.dropped_off_at
                    ? t('checkin.droppedOff', { time: formatTime(r.dropped_off_at) })
                    : r.checked_in_at
                      ? t('checkin.onBoard', { time: formatTime(r.checked_in_at) })
                      : t('checkin.waiting')}
                </p>
              </div>
              {!r.checked_in_at && !done && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pickUp.isPending}
                  onClick={() =>
                    void currentPosition(3_000)
                      .then((pos) => pickUp.mutateAsync({ taskId: task.id, code: '', riderId: r.id, lat: pos?.lat, lng: pos?.lng }))
                      .then((res) => setRefused(res.ok ? null : t(res.error, { name: res.name ?? r.name })))
                  }
                  data-picked-up
                >
                  {t('checkin.pickedUp')}
                </Button>
              )}
              {r.checked_in_at && !r.dropped_off_at && !done && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={dropOff.isPending}
                  onClick={() => void currentPosition(3_000).then((pos) => dropOff.mutate({ riderId: r.id, lat: pos?.lat, lng: pos?.lng }))}
                >
                  <LogOut aria-hidden="true" className="rtl:-scale-x-100" />
                  {t('checkin.dropOff')}
                </Button>
              )}
              {r.dropped_off_at && <CircleCheck className="size-5 text-success-fg" aria-label={t('checkin.droppedOffShort')} />}
              {phone && !r.dropped_off_at && (
                <Button asChild size="icon" variant="outline" aria-label={t('driver.callName', { name: r.name })}>
                  <a href={`tel:${phone.replace(/\s/g, '')}`}>
                    <Phone aria-hidden="true" />
                  </a>
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {refused && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {refused}
        </p>
      )}
      <FormError error={dropOff.error ?? pickUp.error} />
      <CheckInDialog taskId={task.id} open={open} onOpenChange={setOpen} />
    </section>
  );
}

function CheckInDialog({ taskId, open, onOpenChange }: { taskId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const checkIn = useCheckIn();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const canScan = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && barcodeDetector() !== null;

  const submit = async (value: string) => {
    setMessage(null);
    const pos = await currentPosition(3_000);
    const res = await checkIn.mutateAsync({ taskId, code: value, lat: pos?.lat, lng: pos?.lng });
    if (res.ok) {
      setCode('');
      setMessage({ ok: true, text: t('checkin.success', { name: res.name }) });
    } else {
      setMessage({ ok: false, text: t(res.error, { name: res.name ?? '' }) });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setMessage(null);
          setScanning(false);
          checkIn.reset();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('checkin.driverTitle')}</DialogTitle>
          <DialogDescription>{t('checkin.driverHint')}</DialogDescription>
        </DialogHeader>
        {scanning && (
          <QrScanner
            onCode={(value) => {
              setScanning(false);
              setCode(value);
              void submit(value);
            }}
            onError={() => setScanning(false)}
          />
        )}
        <form
          id="checkin-form"
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(code);
          }}
        >
          <Label htmlFor="checkin-code">{t('checkin.codeLabel')}</Label>
          <Input
            id="checkin-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            dir="ltr"
            className="text-center text-2xl font-extrabold tracking-[0.3em] tabular"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </form>
        {message && (
          <p role={message.ok ? 'status' : 'alert'} className={message.ok ? 'text-sm font-semibold text-success-fg' : 'text-sm font-semibold text-danger'} data-checkin-result={message.ok}>
            {message.text}
          </p>
        )}
        <FormError error={checkIn.error} />
        <DialogFooter className="gap-2">
          {canScan && (
            <Button variant="outline" onClick={() => setScanning((s) => !s)}>
              <ScanLine aria-hidden="true" />
              {scanning ? t('checkin.stopScan') : t('checkin.scan')}
            </Button>
          )}
          <Button type="submit" form="checkin-form" disabled={code.length !== 6 || checkIn.isPending}>
            <UserCheck aria-hidden="true" />
            {t('checkin.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Rear camera + BarcodeDetector; stops itself once a six-digit check-in code is read. */
function QrScanner({ onCode, onError }: { onCode: (code: string) => void; onError: () => void }) {
  const { t } = useTranslation();
  const video = useRef<HTMLVideoElement>(null);
  const handlers = useRef({ onCode, onError });
  useEffect(() => {
    handlers.current = { onCode, onError };
  });

  useEffect(() => {
    const detector = barcodeDetector();
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let stopped = false;
    void navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then(async (s) => {
        stream = s;
        if (stopped || !video.current || !detector) return;
        video.current.srcObject = s;
        await video.current.play();
        const tick = async () => {
          if (stopped || !video.current) return;
          const found = (await detector.detect(video.current).catch(() => [])).map((r) => codeFromScan(r.rawValue)).find(Boolean);
          if (found) handlers.current.onCode(found);
          else timer = window.setTimeout(() => void tick(), 300);
        };
        void tick();
      })
      .catch(() => handlers.current.onError());
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return <video ref={video} muted playsInline aria-label={t('checkin.camera')} className="aspect-square w-full rounded-md bg-surface-2 object-cover" />;
}
