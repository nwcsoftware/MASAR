import { useFormContext } from 'react-hook-form';
import { Plane, RefreshCw, Repeat } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Field } from '@/components/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TaskFormValues } from '@/features/tasks/schema';
import { companyDateKey, companyTimeKey, formatTime, isolate } from '@/lib/format';
import type { WizardPlan } from './use-plan';

/** Step 4 — when (FR-13: airport start = flight − (drive + buffer), editable). */
export function ScheduleStep({
  plan,
  durationAuto,
  onDurationAuto,
  onStartEdited,
}: {
  plan: WizardPlan;
  durationAuto: boolean;
  onDurationAuto: (auto: boolean) => void;
  onStartEdited: () => void;
}) {
  const { t } = useTranslation();
  const form = useFormContext<TaskFormValues>();
  const { register, setValue, formState } = form;
  const errors = formState.errors;
  const [category, flight, stops, duration] = form.watch(['category', 'flight', 'stops', 'duration_min']);
  const suggested = plan.suggested;
  const usingSuggested = suggested && plan.start === suggested.start;

  const applySuggested = () => {
    if (!suggested) return;
    setValue('date', companyDateKey(suggested.start), { shouldValidate: true });
    setValue('start_time', companyTimeKey(suggested.start), { shouldValidate: true });
  };

  return (
    <div className="space-y-5">
      {category === 'airport' && flight && plan.flightTime && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[color-mix(in_srgb,var(--cat-airport)_30%,var(--border))] bg-[color-mix(in_srgb,var(--cat-airport)_8%,var(--surface))] px-4 py-3">
          <Plane className="size-5 shrink-0 text-cat-airport" aria-hidden="true" />
          <div className="min-w-0 flex-1 text-sm">
            {suggested ? (
              <>
                <p className="font-bold text-fg">{t('wizard.schedule.suggested', { time: formatTime(suggested.start) })}</p>
                <p className="tabular text-xs text-fg-2">
                  {t('wizard.schedule.formula', {
                    flight: isolate(flight.flight_no || t(`flight.${flight.direction}`)),
                    time: formatTime(plan.flightTime),
                    drive: suggested.driveMin,
                    buffer: flight.buffer_min,
                  })}
                </p>
              </>
            ) : (
              <p className="text-fg-2">{t('wizard.schedule.noAirportStop')}</p>
            )}
          </div>
          {suggested && !usingSuggested && (
            <Button type="button" size="sm" variant="outline" onClick={applySuggested}>
              {t('wizard.schedule.useSuggested')}
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="task-date" label={t('wizard.schedule.date')} error={errors.date?.message}>
          <Input id="task-date" type="date" {...register('date', { onChange: onStartEdited })} />
        </Field>
        <Field id="task-start" label={t('wizard.schedule.start')} error={errors.start_time?.message}>
          <Input id="task-start" type="time" {...register('start_time', { onChange: onStartEdited })} />
        </Field>
        <Field
          id="task-duration"
          label={t('wizard.schedule.duration')}
          error={errors.duration_min?.message}
          hint={
            durationAuto ? (
              t('wizard.schedule.durationAuto')
            ) : (
              <button type="button" className="inline-flex items-center gap-1 font-semibold text-brand-500 hover:underline" onClick={() => onDurationAuto(true)}>
                <RefreshCw className="size-3" aria-hidden="true" />
                {t('wizard.schedule.recalculate', { value: plan.timeline.durationMin })}
              </button>
            )
          }
        >
          <Input id="task-duration" type="number" min={5} max={1440} {...register('duration_min', { valueAsNumber: true, onChange: () => onDurationAuto(false) })} />
        </Field>
      </div>

      <div className="rounded-lg border border-border">
        <div className="eyebrow border-b border-border px-4 py-2">{t('wizard.schedule.timeline')}</div>
        <ol className="divide-y divide-border">
          {stops.map((stop, i) => (
            <li key={stop.key} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="tabular text-xs text-fg-3">{i + 1}</span>
                <span className="truncate" dir="auto">
                  {stop.label || '—'}
                </span>
              </span>
              <span className="tabular shrink-0 text-fg-2">
                {plan.timeline.arrivals[i] ? formatTime(plan.timeline.arrivals[i]!) : '—'}
                {stop.dwell_min > 0 && <span className="text-xs text-fg-3"> · {t('taskDetail.dwell', { value: stop.dwell_min })}</span>}
              </span>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 bg-surface-2 px-4 py-2 text-sm font-semibold">
            <span>{t('wizard.schedule.end')}</span>
            <span className="tabular">{plan.start ? formatTime(new Date(new Date(plan.start).getTime() + (duration || 0) * 60_000)) : '—'}</span>
          </li>
        </ol>
      </div>

      {category === 'daily_routine' && (
        <p className="flex items-center gap-2 text-xs text-fg-3">
          <Repeat className="size-3.5" aria-hidden="true" />
          {t('wizard.schedule.recurrenceLater')}
        </p>
      )}
    </div>
  );
}
