import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Field, FormError, NativeSelect } from '@/components/form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAddAvailability } from '@/features/drivers/queries';
import { availabilitySchema, type AvailabilityValues } from '@/features/drivers/schema';
import { companyDateKey } from '@/lib/format';

/** Leave / off-days → driver_availability, which drives `driver_unavailable` conflicts (FR-14). */
export function AvailabilityDialog({ driverId, open, onOpenChange }: { driverId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const add = useAddAvailability(driverId);
  const today = companyDateKey();
  const form = useForm<AvailabilityValues>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: { type: 'leave', from: today, to: today, note: '' },
  });
  const errors = form.formState.errors;

  useEffect(() => {
    if (open) {
      form.reset({ type: 'leave', from: today, to: today, note: '' });
      add.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('drivers.addLeave')}</DialogTitle>
          <DialogDescription>{t('drivers.addLeaveHint')}</DialogDescription>
        </DialogHeader>
        <form
          id="leave-form"
          noValidate
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={form.handleSubmit((values) => add.mutate(values, { onSuccess: () => onOpenChange(false) }))}
        >
          <Field id="leave-type" label={t('drivers.leaveType')} className="sm:col-span-2">
            <NativeSelect id="leave-type" {...form.register('type')}>
              {(['leave', 'sick', 'off_day', 'training', 'other'] as const).map((type) => (
                <option key={type} value={type}>
                  {t(`availability.${type}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="leave-from" label={t('drivers.from')} error={errors.from?.message}>
            <Input id="leave-from" type="date" dir="ltr" {...form.register('from')} />
          </Field>
          <Field id="leave-to" label={t('drivers.to')} error={errors.to?.message}>
            <Input id="leave-to" type="date" dir="ltr" {...form.register('to')} />
          </Field>
          <Field id="leave-note" label={t('driver.delay.note')} className="sm:col-span-2">
            <Input id="leave-note" {...form.register('note')} />
          </Field>
          <FormError error={add.error} className="sm:col-span-2" />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="leave-form" disabled={add.isPending}>
            {add.isPending ? t('common.saving') : t('common.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
