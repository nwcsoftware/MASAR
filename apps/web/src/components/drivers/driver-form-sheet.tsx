import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Field, FormError, NativeSelect } from '@/components/form';
import { GroupSelect } from '@/components/grade-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useJobTitles } from '@/features/documents/queries';
import { useSaveDriver } from '@/features/drivers/queries';
import { useGradeGroups } from '@/features/grades/queries';
import { driverSchema, type DriverValues } from '@/features/drivers/schema';
import { useSites } from '@/features/sites/queries';
import type { Driver } from '@/mocks/fixtures';
import { useLocalizedName } from '@/lib/i18n-data';

const DEFAULTS: DriverValues = {
  full_name: '',
  full_name_ar: '',
  employee_no: '',
  phone: '',
  home_site_id: '',
  licence_no: '',
  licence_expiry: '',
  shift_start: '07:00',
  shift_end: '17:00',
  max_daily_driving_min: null,
  grade: null,
  serve_group_id: '',
  job_title_id: '',
  nationality: '',
  english_rating: null,
  notes: '',
  is_active: true,
};

function toValues(d: Driver): DriverValues {
  return {
    full_name: d.full_name,
    full_name_ar: d.full_name_ar ?? '',
    employee_no: d.employee_no ?? '',
    phone: d.phone ?? '',
    home_site_id: d.home_site_id ?? '',
    licence_no: d.licence_no ?? '',
    licence_expiry: d.licence_expiry ?? '',
    shift_start: (d.shift_start ?? '').slice(0, 5),
    shift_end: (d.shift_end ?? '').slice(0, 5),
    max_daily_driving_min: d.max_daily_driving_min,
    grade: d.grade,
    serve_group_id: d.serve_group_id ?? '',
    job_title_id: d.job_title_id ?? '',
    nationality: d.nationality ?? '',
    english_rating: d.english_rating,
    notes: d.notes ?? '',
    is_active: d.is_active,
  };
}

/**
 * FR-04 driver record (admin). The login is separate: invite the driver from
 * Settings → Users and link this record, or invite first and the record is
 * created for you.
 */
export function DriverFormSheet({
  open,
  onOpenChange,
  driver,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver?: Driver;
  onSaved?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const sites = useSites();
  const save = useSaveDriver();
  const groups = useGradeGroups();
  const jobs = useJobTitles();
  const form = useForm<DriverValues>({ resolver: zodResolver(driverSchema), defaultValues: DEFAULTS });
  const errors = form.formState.errors;

  useEffect(() => {
    if (!open) return;
    form.reset(driver ? toValues(driver) : DEFAULTS);
    save.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, driver?.id]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{driver ? t('drivers.edit') : t('drivers.add')}</SheetTitle>
          <SheetDescription>{t('drivers.formHint')}</SheetDescription>
        </SheetHeader>
        <form
          id="driver-form"
          noValidate
          className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 sm:grid-cols-2"
          onSubmit={form.handleSubmit((values) =>
            save.mutate(
              { id: driver?.id, values },
              {
                onSuccess: (id) => {
                  onSaved?.(id);
                  onOpenChange(false);
                },
              },
            ),
          )}
        >
          <Field id="drv-name" label={t('invite.fullName')} error={errors.full_name?.message}>
            <Input id="drv-name" autoComplete="off" aria-invalid={Boolean(errors.full_name)} {...form.register('full_name')} />
          </Field>
          <Field id="drv-name-ar" label={t('drivers.nameAr')}>
            <Input id="drv-name-ar" dir="rtl" {...form.register('full_name_ar')} />
          </Field>
          <Field id="drv-emp" label={t('drivers.employeeNo')}>
            <Input id="drv-emp" dir="ltr" {...form.register('employee_no')} />
          </Field>
          <Field id="drv-phone" label={t('drivers.phone')}>
            <Input id="drv-phone" type="tel" dir="ltr" {...form.register('phone')} />
          </Field>
          <Field id="drv-site" label={t('drivers.homeSite')} className="sm:col-span-2">
            <NativeSelect id="drv-site" {...form.register('home_site_id')}>
              <option value="">—</option>
              {(sites.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {name(s)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="drv-job" label={t('documents.jobTitle')} hint={t('drivers.jobTitleHint')} className="sm:col-span-2">
            <NativeSelect id="drv-job" {...form.register('job_title_id')}>
              <option value="">—</option>
              {(jobs.data?.titles ?? [])
                .filter((j) => j.is_active || j.id === driver?.job_title_id)
                .map((j) => (
                  <option key={j.id} value={j.id}>
                    {name(j)}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          <Field id="drv-nationality" label={t('drivers.nationality')}>
            <Input id="drv-nationality" {...form.register('nationality')} />
          </Field>
          <Field id="drv-english" label={t('drivers.englishRating')} hint={t('drivers.englishRatingHint')} error={errors.english_rating?.message}>
            <NativeSelect id="drv-english" {...form.register('english_rating', { setValueAs: (v: string) => (v === '' || v == null ? null : Number(v)) })}>
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {'★'.repeat(n)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="drv-licence" label={t('drivers.licence')}>
            <Input id="drv-licence" dir="ltr" {...form.register('licence_no')} />
          </Field>
          <Field id="drv-expiry" label={t('drivers.licenceExpiry')}>
            <Input id="drv-expiry" type="date" dir="ltr" {...form.register('licence_expiry')} />
          </Field>
          <Field id="drv-shift-start" label={t('drivers.shiftStart')} error={errors.shift_start?.message}>
            <Input id="drv-shift-start" type="time" dir="ltr" {...form.register('shift_start')} />
          </Field>
          <Field id="drv-shift-end" label={t('drivers.shiftEnd')} error={errors.shift_end?.message}>
            <Input id="drv-shift-end" type="time" dir="ltr" {...form.register('shift_end')} />
          </Field>
          <Field
            id="drv-max"
            label={t('drivers.maxDaily')}
            hint={t('drivers.maxDailyHint')}
            error={errors.max_daily_driving_min?.message}
            className="sm:col-span-2"
          >
            <Input
              id="drv-max"
              type="number"
              inputMode="numeric"
              className="tabular"
              {...form.register('max_daily_driving_min', { setValueAs: (v: string) => (v === '' || v === null ? null : Number(v)) })}
            />
          </Field>
          {(groups.data ?? []).length > 0 && (
            <>
              <Field id="drv-grade" label={t('people.grade')} error={errors.grade?.message}>
                <Input
                  id="drv-grade"
                  type="number"
                  inputMode="numeric"
                  className="tabular"
                  {...form.register('grade', { setValueAs: (v: string) => (v === '' || v === null ? null : Number(v)) })}
                />
              </Field>
              <Field id="drv-serve" label={t('drivers.serveGroup')} hint={t('drivers.serveGroupHint')}>
                <GroupSelect id="drv-serve" groups={groups.data ?? []} emptyLabel={t('drivers.serveAny')} {...form.register('serve_group_id')} />
              </Field>
            </>
          )}
          <Field id="drv-notes" label={t('sites.notes')} className="sm:col-span-2">
            <Textarea id="drv-notes" rows={2} {...form.register('notes')} />
          </Field>
          {driver && (
            <label className="flex items-center gap-3 text-sm font-semibold sm:col-span-2">
              <Switch checked={form.watch('is_active')} onCheckedChange={(v) => form.setValue('is_active', v, { shouldDirty: true })} />
              {t('common.active')}
            </label>
          )}
          <FormError error={save.error} className="sm:col-span-2" />
        </form>
        <SheetFooter className="flex-row justify-end gap-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="driver-form" disabled={save.isPending}>
            {save.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
