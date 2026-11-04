import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarClock, CalendarPlus, CalendarX2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Field, FormError } from '@/components/form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCreateRequest } from '@/features/passenger/queries';
import { tripRequestSchema, type TripRequestValues } from '@/features/passenger/schema';
import type { PassengerTrip, RequestKind } from '@/features/passenger/types';
import { companyDateKey, companyDateTimeToIso, companyTimeKey } from '@/lib/format';

const ICONS = { new: CalendarPlus, reschedule: CalendarClock, cancel: CalendarX2 } as const;

/** §10: ask dispatch for a new trip, or to move / cancel one of yours. */
export function RequestDialog({ kind, trip, onSent }: { kind: RequestKind; trip?: PassengerTrip; onSent?: () => void }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const create = useCreateRequest();
  const form = useForm<TripRequestValues>({
    resolver: zodResolver(tripRequestSchema),
    defaultValues: {
      kind,
      date: trip ? companyDateKey(trip.scheduled_start) : '',
      time: trip ? companyTimeKey(trip.scheduled_start) : '',
      pickup: '',
      dropoff: '',
      passengers_count: 1,
      notes: '',
    },
  });
  const errors = form.formState.errors;
  const Icon = ICONS[kind];

  const submit = form.handleSubmit(async (v) => {
    await create.mutateAsync({
      kind,
      task_id: trip?.id ?? null,
      requested_start: v.date && v.time ? companyDateTimeToIso(v.date, v.time) : null,
      pickup: v.pickup || null,
      dropoff: v.dropoff || null,
      passengers_count: v.passengers_count,
      notes: v.notes || null,
    });
    setOpen(false);
    form.reset();
    onSent?.();
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) create.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant={kind === 'new' ? 'default' : 'outline'} className={kind === 'new' ? 'w-full' : 'flex-1'} data-request={kind}>
          <Icon aria-hidden="true" />
          {t(`requests.open.${kind}`)}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`requests.title.${kind}`)}</DialogTitle>
          <DialogDescription>{trip ? trip.title : t('requests.newHint')}</DialogDescription>
        </DialogHeader>
        <form id="trip-request-form" className="space-y-3" onSubmit={(e) => void submit(e)} noValidate>
          {kind !== 'cancel' && (
            <div className="grid grid-cols-2 gap-3">
              <Field id="req-date" label={t('requests.date')} error={errors.date?.message}>
                <Input id="req-date" type="date" dir="ltr" lang={i18n.language} min={companyDateKey()} {...form.register('date')} />
              </Field>
              <Field id="req-time" label={t('requests.time')} error={errors.time?.message}>
                <Input id="req-time" type="time" dir="ltr" lang={i18n.language} {...form.register('time')} />
              </Field>
            </div>
          )}
          {kind === 'new' && (
            <>
              <Field id="req-pickup" label={t('requests.pickup')} error={errors.pickup?.message}>
                <Input id="req-pickup" autoComplete="off" {...form.register('pickup')} />
              </Field>
              <Field id="req-dropoff" label={t('requests.dropoff')} error={errors.dropoff?.message}>
                <Input id="req-dropoff" autoComplete="off" {...form.register('dropoff')} />
              </Field>
              <Field id="req-count" label={t('requests.passengers')} error={errors.passengers_count?.message}>
                <Input id="req-count" type="number" inputMode="numeric" min={1} max={20} className="w-24" {...form.register('passengers_count', { valueAsNumber: true })} />
              </Field>
            </>
          )}
          <Field id="req-notes" label={t(kind === 'cancel' ? 'requests.reason' : 'requests.notes')} error={errors.notes?.message}>
            <Textarea id="req-notes" rows={3} maxLength={1000} {...form.register('notes')} />
          </Field>
          <FormError error={create.error} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="trip-request-form" disabled={create.isPending}>
            {t('requests.send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
