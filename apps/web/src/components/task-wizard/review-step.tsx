import { useFormContext } from 'react-hook-form';
import { CalendarClock, Car, Link2, MapPin, Plane, UserRound, UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CategoryBadge } from '@/components/category-badge';
import { ConflictAlert } from '@/components/conflict-alert';
import { Field } from '@/components/form';
import { Textarea } from '@/components/ui/textarea';
import type { DriverOverview } from '@/features/drivers/queries';
import type { SiteWithAirports } from '@/features/sites/queries';
import type { TaskFormValues } from '@/features/tasks/schema';
import type { PreviewConflict } from '@/features/tasks/types';
import { formatDate, formatNumber, formatTime, formatTimeRange } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';
import type { Airport, Vehicle } from '@/mocks/fixtures';
import type { WizardPlan } from './use-plan';

function Row({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-fg-3" aria-hidden="true" />
      <div className="min-w-0">
        <div className="eyebrow">{label}</div>
        <div className="text-sm text-fg">{children}</div>
      </div>
    </div>
  );
}

/** Step 6 — everything at a glance; blocking conflicts need an admin's reason (FR-14). */
export function ReviewStep({
  plan,
  sites,
  airports,
  drivers,
  vehicles,
  conflicts,
  canOverride,
}: {
  plan: WizardPlan;
  sites: SiteWithAirports[];
  airports: Airport[];
  drivers: DriverOverview[];
  vehicles: Vehicle[];
  /** preview conflicts of the chosen driver + vehicle */
  conflicts: PreviewConflict[];
  canOverride: boolean;
}) {
  const { t, i18n } = useTranslation();
  const name = useLocalizedName();
  const form = useFormContext<TaskFormValues>();
  const values = form.watch();
  const site = sites.find((s) => s.id === values.site_id);
  const airport = airports.find((a) => a.id === values.flight?.airport_id);
  const driver = drivers.find((d) => d.id === values.driver_id);
  const vehicle = vehicles.find((v) => v.id === values.vehicle_id);
  const end = plan.start ? new Date(new Date(plan.start).getTime() + values.duration_min * 60_000).toISOString() : null;
  const blocking = conflicts.some((c) => c.severity === 'blocking');
  const passengers = values.passengers.filter((p) => p.name.trim());

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <CategoryBadge category={values.category} />
        <p className="text-lg font-bold text-fg">{values.title}</p>
        {site && <p className="text-sm text-fg-2">{name(site)}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Row icon={CalendarClock} label={t('wizard.step.schedule')}>
          <span className="tabular">
            {plan.start ? `${formatDate(plan.start, 'short')} · ${formatTimeRange(plan.start, end)}` : '—'}
          </span>
        </Row>
        <Row icon={MapPin} label={t('taskDetail.distance')}>
          <span className="tabular">
            {t('units.km', { value: formatNumber(plan.timeline.distanceKm) })} · {t('units.minutes', { value: values.duration_min })}
          </span>
        </Row>
        {values.flight && (
          <Row icon={Plane} label={t('wizard.flight.legend')}>
            <span className="tabular">
              {values.flight.flight_no} · {t(`flight.${values.flight.direction}`)} · {airport?.iata} · {plan.flightTime ? formatTime(plan.flightTime) : ''}
            </span>
          </Row>
        )}
        <Row icon={values.share_with_task_id ? Link2 : UserRound} label={t('taskDetail.driver')}>
          {values.share_with_task_id ? (
            <span className="font-semibold text-brand-500">{t('wizard.assign.sharing')}</span>
          ) : driver ? (
            name(driver, 'full_name')
          ) : (
            <span className="font-semibold text-warning-fg">{t('tasks.unassigned')}</span>
          )}
        </Row>
        {vehicle && !values.share_with_task_id && (
          <Row icon={Car} label={t('taskDetail.vehicle')}>
            {vehicle.plate_no} · {vehicle.make} {vehicle.model}
          </Row>
        )}
        {passengers.length > 0 && (
          <Row icon={UsersRound} label={t('taskDetail.passengers')}>
            {new Intl.ListFormat(i18n.language, { style: 'narrow', type: 'unit' }).format(passengers.map((p) => p.name))}
          </Row>
        )}
      </div>

      <ol className="space-y-1 rounded-lg border border-border p-3 text-sm">
        {values.stops.map((stop, i) => (
          <li key={stop.key} className="flex justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="tabular text-xs text-fg-3">{i + 1}</span>
              <span className="truncate" dir="auto">
                {stop.label}
              </span>
            </span>
            <span className="tabular shrink-0 text-fg-2">{plan.timeline.arrivals[i] ? formatTime(plan.timeline.arrivals[i]!) : ''}</span>
          </li>
        ))}
      </ol>

      {conflicts.length > 0 && (
        <div className="space-y-2">
          <div className="eyebrow">{t('taskDetail.tabs.conflicts')}</div>
          <ConflictAlert conflicts={conflicts}>
            {blocking &&
              (canOverride ? (
                <Field id="task-override" label={t('conflicts.overrideReason')} hint={t('conflicts.overrideHint')} error={form.formState.errors.override_reason?.message}>
                  <Textarea id="task-override" rows={2} {...form.register('override_reason')} />
                </Field>
              ) : (
                <p role="alert" className="text-sm font-semibold text-danger">
                  {t('wizard.review.blockedDispatcher')}
                </p>
              ))}
          </ConflictAlert>
        </div>
      )}
    </div>
  );
}
