import { useFormContext } from 'react-hook-form';
import { CircleAlert, Link2, UserX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ConflictBadge, worstSeverity } from '@/components/conflict-badge';
import { useConflictText } from '@/components/conflict-alert';
import { DriverAvatar } from '@/components/driver-avatar';
import { Field, NativeSelect } from '@/components/form';
import { ShareTripHint } from '@/components/share-trip-hint';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { DriverOverview } from '@/features/drivers/queries';
import { canShareWith } from '@/features/grades/rules';
import { useSimilarTrips } from '@/features/tasks/queries';
import type { TaskFormValues } from '@/features/tasks/schema';
import type { PreviewConflict } from '@/features/tasks/types';
import { distanceKm } from '@/lib/geo';
import { formatNumber, formatTime, isolate } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';
import { DRIVER_STATUS_COLOR, SEVERITY_RANK } from '@/lib/task-meta';
import type { Airport, GradeGroup, Vehicle } from '@/mocks/fixtures';
import { GradeBadge } from '@/components/grade-badge';
import { cn } from '@/lib/utils';
import type { WizardPlan } from './use-plan';

interface Candidate {
  driver: DriverOverview;
  conflicts: PreviewConflict[];
  km: number | null;
}

/** Step 5 — driver (FR-16: availability, proximity; conflicts inline, US-03) or a shared ride (FR-15). */
export function AssignStep({
  plan,
  drivers,
  vehicles,
  airports,
  preview,
  previewLoading,
  gradeFor,
  riderGroups,
  groups,
  taskId,
  riderOf,
}: {
  plan: WizardPlan;
  drivers: DriverOverview[];
  vehicles: Vehicle[];
  airports: Airport[];
  preview: PreviewConflict[];
  previewLoading: boolean;
  /** 0004 grade conflicts with a given driver (driver_id null = car / passengers) */
  gradeFor: (driverId: string | null) => PreviewConflict[];
  /** groups of this trip's passengers */
  riderGroups: string[];
  groups: GradeGroup[];
  taskId?: string;
  /** edit mode: the task already rides on this host */
  riderOf: string | null;
}) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const text = useConflictText();
  const form = useFormContext<TaskFormValues>();
  const [driverId, vehicleId, shareWith, stops, flight, siteId] = form.watch(['driver_id', 'vehicle_id', 'share_with_task_id', 'stops', 'flight', 'site_id']);
  const first = stops[0];

  const similar = useSimilarTrips(
    flight?.airport_id && plan.flightTime && !riderOf ? { airportId: flight.airport_id, time: plan.flightTime, excludeTaskId: taskId } : null,
  );
  // FR-15 within one group: never offer a car carrying another group
  const shareable = (similar.data ?? []).filter((trip) => trip.site_id !== siteId && canShareWith(riderGroups, trip));
  const sharedTrip = shareable.find((trip) => trip.task_id === shareWith) ?? null;
  const airportCode = airports.find((a) => a.id === flight?.airport_id)?.iata ?? '';

  const candidates: Candidate[] = drivers
        .map((driver) => ({
          driver,
          conflicts: [...preview.filter((c) => c.driver_id === driver.id), ...gradeFor(driver.id).filter((c) => c.driver_id === driver.id)],
          km:
            driver.location && first?.lat != null && first.lng != null
              ? Math.round(distanceKm(driver.location.lat, driver.location.lng, first.lat, first.lng) * 10) / 10
              : null,
        }))
        .sort((a, b) => {
          const rank = (c: Candidate) => {
            const worst = worstSeverity(c.conflicts);
            return worst ? SEVERITY_RANK[worst] + 1 : 0;
          };
          return rank(a) - rank(b) || (a.km ?? Infinity) - (b.km ?? Infinity) || a.driver.full_name.localeCompare(b.driver.full_name);
        });
  const vehicleConflicts = [...gradeFor(null).filter((c) => c.driver_id === null), ...preview.filter((c) => c.driver_id === null)];
  const groupCode = (id: string | null) => groups.find((g) => g.id === id)?.code;
  // cars of the passengers' group first
  const onlyGroup = riderGroups.length === 1 ? riderGroups[0] : null;
  const vehicleOptions = vehicles
    .filter((v) => v.is_active)
    .sort((a, b) => Number(groupCode(b.grade_group_id) === onlyGroup) - Number(groupCode(a.grade_group_id) === onlyGroup));

  const choose = (id: string | null) => {
    form.setValue('driver_id', id, { shouldDirty: true, shouldValidate: true });
    // the car is part of the driver's assignment — none without a driver
    if (!id) form.setValue('vehicle_id', null, { shouldDirty: true });
  };

  if (riderOf) {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-surface-2 px-4 py-3 text-sm text-fg-2">
        <Link2 className="mt-0.5 size-4 shrink-0 text-brand-500" aria-hidden="true" />
        {t('wizard.assign.riderLocked')}
      </p>
    );
  }

  if (shareWith) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[color-mix(in_srgb,var(--brand-500)_30%,var(--border))] bg-[color-mix(in_srgb,var(--brand-500)_8%,var(--surface))] px-4 py-3">
        <Link2 className="size-5 shrink-0 text-brand-500" aria-hidden="true" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-bold text-fg">{t('wizard.assign.sharing')}</p>
          {sharedTrip && (
            <p className="text-xs text-fg-2">
              {t('wizard.assign.sharingBody', {
                site: isolate(sharedTrip.site_name),
                flight: isolate(sharedTrip.flight_no ?? ''),
                time: formatTime(sharedTrip.scheduled_time),
                driver: isolate(sharedTrip.driver_name ?? t('tasks.unassigned')),
              })}
            </p>
          )}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => form.setValue('share_with_task_id', null, { shouldDirty: true })}>
          {t('wizard.assign.unshare')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {shareable[0] && (
        <ShareTripHint
          trip={shareable[0]}
          flightNo={flight?.flight_no || null}
          airportCode={airportCode}
          onShare={() => {
            form.setValue('share_with_task_id', shareable[0]!.task_id, { shouldDirty: true });
            choose(null);
          }}
        />
      )}

      <Field id="task-vehicle" label={t('wizard.assign.vehicle')} hint={driverId ? undefined : t('wizard.assign.vehicleNeedsDriver')}>
        <NativeSelect id="task-vehicle" value={vehicleId ?? ''} disabled={!driverId} onChange={(e) => form.setValue('vehicle_id', e.target.value || null, { shouldDirty: true })}>
          <option value="">{t('wizard.assign.noVehicle')}</option>
          {vehicleOptions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.plate_no} · {v.make} {v.model} · {t('wizard.assign.seats', { count: v.seats ?? 0 })}
              {groupCode(v.grade_group_id) ? ` · ${t('grades.groupLabel', { code: groupCode(v.grade_group_id) })}` : ''}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {vehicleConflicts.map((c, i) => (
        <p key={`${c.type}-${i}`} className={cn('flex items-center gap-2 text-xs font-semibold', c.severity === 'blocking' ? 'text-danger' : 'text-warning-fg')}>
          <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
          {text(c)}
        </p>
      ))}

      <div className="space-y-2" role="radiogroup" aria-label={t('wizard.assign.driver')}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-fg">{t('wizard.assign.driver')}</span>
          {previewLoading && <span className="text-xs text-fg-3">{t('wizard.assign.checking')}</span>}
        </div>
        <button
          type="button"
          role="radio"
          aria-checked={driverId === null}
          onClick={() => choose(null)}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-start text-sm hover:bg-surface-2',
            driverId === null && 'border-brand-500 ring-1 ring-brand-500',
          )}
        >
          <span className="grid size-8 place-items-center rounded-full bg-surface-2 text-fg-3">
            <UserX className="size-4" aria-hidden="true" />
          </span>
          <span className="font-semibold text-fg">{t('wizard.assign.unassigned')}</span>
          <span className="ms-auto text-xs text-fg-3">{t('wizard.assign.unassignedHint')}</span>
        </button>
        {!drivers.length && previewLoading ? (
          <Skeleton className="h-14 w-full" />
        ) : (
          candidates.map(({ driver, conflicts, km }) => {
            const selected = driverId === driver.id;
            const worst = worstSeverity(conflicts);
            const headline = [...conflicts].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])[0];
            return (
              <button
                key={driver.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => choose(driver.id)}
                data-driver={driver.full_name}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg border border-border px-3 py-2.5 text-start text-sm hover:bg-surface-2',
                  selected && 'border-brand-500 ring-1 ring-brand-500',
                )}
              >
                <DriverAvatar name={driver.full_name} colorVar={DRIVER_STATUS_COLOR[driver.current_status]} className="size-8" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-fg">{name(driver, 'full_name')}</span>
                    <ConflictBadge conflicts={conflicts} />
                    {!worst && !previewLoading && <span className="text-xs font-semibold text-success-fg">{t('wizard.assign.free')}</span>}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-1 text-xs text-fg-3">
                    {driver.homeSite ? name(driver.homeSite) : '—'}
                    {km != null && ` · ${t('wizard.assign.away', { value: formatNumber(km) })}`}
                    {groupCode(driver.serve_group_id) && (
                      <>
                        {' · '}
                        {t('wizard.assign.drivesFor')} <GradeBadge code={groupCode(driver.serve_group_id)} className="px-1.5 py-0" />
                      </>
                    )}
                  </span>
                  {headline && (
                    <span className={cn('mt-0.5 block text-xs font-semibold', headline.severity === 'blocking' ? 'text-danger' : headline.severity === 'warning' ? 'text-warning-fg' : 'text-fg-2')}>
                      {text(headline)}
                    </span>
                  )}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
