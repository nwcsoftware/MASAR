import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarHeart, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Field, FormError } from '@/components/form';
import { Panel } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAddHoliday, useDeleteHoliday, useHolidays } from '@/features/company/queries';
import { holidaySchema, type HolidayValues } from '@/features/company/schema';
import { formatDate } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';

/** FR-51 holiday calendar — holiday work counts as overtime in day summaries. */
export function HolidaysTab() {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const holidays = useHolidays();
  const add = useAddHoliday();
  const remove = useDeleteHoliday();
  const form = useForm<HolidayValues>({ resolver: zodResolver(holidaySchema), defaultValues: { date: '', name: '', name_ar: '' } });
  const errors = form.formState.errors;

  return (
    <div className="space-y-5">
      <Panel title={t('settings.holidays.add')} bodyClassName="p-5">
        <form
          noValidate
          className="grid items-start gap-4 sm:grid-cols-[10rem_1fr_1fr_auto]"
          onSubmit={form.handleSubmit((values) => add.mutate(values, { onSuccess: () => form.reset({ date: '', name: '', name_ar: '' }) }))}
        >
          <Field id="hol-date" label={t('settings.holidays.date')} error={errors.date?.message}>
            <Input id="hol-date" type="date" dir="ltr" {...form.register('date')} />
          </Field>
          <Field id="hol-name" label={t('settings.holidays.name')} error={errors.name?.message}>
            <Input id="hol-name" {...form.register('name')} />
          </Field>
          <Field id="hol-name-ar" label={t('settings.holidays.nameAr')}>
            <Input id="hol-name-ar" dir="rtl" {...form.register('name_ar')} />
          </Field>
          <Button type="submit" className="sm:mt-7" disabled={add.isPending}>
            <Plus aria-hidden="true" />
            {t('common.add')}
          </Button>
          <FormError error={add.error} className="sm:col-span-4" />
        </form>
      </Panel>
      <Panel title={t('settings.holidays.title')}>
        {holidays.isPending ? (
          <Skeleton className="m-4 h-24" />
        ) : holidays.isError ? (
          <ErrorState error={holidays.error} onRetry={() => void holidays.refetch()} />
        ) : !holidays.data.length ? (
          <EmptyState compact icon={CalendarHeart} title={t('settings.holidays.empty')} />
        ) : (
          <ul className="divide-y divide-border">
            {holidays.data.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="font-semibold">{name(h)}</span>
                <span className="flex items-center gap-2">
                  <span className="tabular text-fg-2">{formatDate(`${h.date}T12:00:00Z`)}</span>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => remove.mutate(h.id)} aria-label={t('common.remove')}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
