import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, CalendarOff, CalendarX2, IdCard, Pencil, Phone, Plus, Trash2, UserRoundX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DriverAvatar } from '@/components/driver-avatar';
import { DriverDocumentsPanel } from '@/components/documents/driver-documents-panel';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { HoursBar } from '@/components/hours-bar';
import { HoursChart } from '@/components/hours-chart';
import { KpiTile } from '@/components/kpi-tile';
import { useOpenTask } from '@/components/layout/task-sheet-context';
import { Page, Panel } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { TaskCard } from '@/components/task-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCompanySettings } from '@/features/company/queries';
import { useDeleteAvailability, useDriver } from '@/features/drivers/queries';
import { AvailabilityDialog } from '@/components/drivers/availability-dialog';
import { DriverFormSheet } from '@/components/drivers/driver-form-sheet';
import { isAdmin, isStaff } from '@/features/auth/guards';
import { useCurrentUser } from '@/features/auth/session';
import { formatDate, formatHours, formatNumber } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';
import { DRIVER_STATUS_COLOR } from '@/lib/task-meta';
import { tone } from '@/lib/utils';
import { licenceExpiresSoon } from '@/features/drivers/utils';

export const Route = createFileRoute('/(admin)/drivers/$driverId')({
  component: DriverDetailPage,
});

/** Screen 8b — driver detail: hours chart, upcoming, availability. */
function DriverDetailPage() {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const openTask = useOpenTask();
  const { driverId } = Route.useParams();
  const query = useDriver(driverId);
  const settings = useCompanySettings();
  const driver = query.data;
  const { profile } = useCurrentUser();
  const removeLeave = useDeleteAvailability(driverId);
  const [editOpen, setEditOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ms-2">
      <Link to="/drivers">
        <ArrowLeft className="rtl:-scale-x-100" aria-hidden="true" />
        {t('drivers.title')}
      </Link>
    </Button>
  );

  if (query.isPending) {
    return (
      <Page>
        {back}
        <Skeleton className="h-16 w-1/2" />
        <div className="grid gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </Page>
    );
  }
  if (query.isError) {
    return (
      <Page>
        {back}
        <Panel>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </Panel>
      </Page>
    );
  }
  if (!driver) {
    return (
      <Page>
        {back}
        <Panel>
          <EmptyState icon={UserRoundX} title={t('drivers.notFound')} />
        </Panel>
      </Page>
    );
  }

  const last14 = driver.summaries.slice(-14);
  const week = driver.summaries.slice(-5);
  const sum = (rows: typeof last14, key: 'driving_min' | 'overtime_min') => rows.reduce((n, s) => n + s[key], 0);
  const km = last14.reduce((n, s) => n + Number(s.distance_km), 0);
  const standard = settings.data?.standard_day_min ?? 480;

  return (
    <Page>
      <DriverFormSheet open={editOpen} onOpenChange={setEditOpen} driver={driver} />
      <AvailabilityDialog driverId={driver.id} open={leaveOpen} onOpenChange={setLeaveOpen} />
      {back}
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <DriverAvatar name={driver.full_name} colorVar={DRIVER_STATUS_COLOR[driver.current_status]} className="size-11" />
            {name(driver, 'full_name')}
            <span className="tone-pill inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold" style={tone(DRIVER_STATUS_COLOR[driver.current_status])}>
              <span className="tone-dot size-1.5 rounded-full" aria-hidden="true" />
              {t(`driverStatus.${driver.current_status}`)}
            </span>
          </span>
        }
        description={`${driver.employee_no} · ${driver.homeSite ? name(driver.homeSite) : '—'} · ${t('drivers.shift', { start: driver.shift_start?.slice(0, 5), end: driver.shift_end?.slice(0, 5) })}`}
        actions={
          <>
            {driver.phone && (
              <Button asChild variant="outline" size="sm">
                <a href={`tel:${driver.phone.replace(/\s/g, '')}`}>
                  <Phone aria-hidden="true" />
                  <span dir="ltr">{driver.phone}</span>
                </a>
              </Button>
            )}
            {isAdmin(profile.role) && (
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil aria-hidden="true" />
                {t('common.edit')}
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label={t('drivers.kpi.plannedToday')} value={`${t('units.hours', { value: formatHours(driver.plannedTodayMin) })}`} detail={t('drivers.kpi.cap', { value: formatHours(driver.maxDailyMin) })} tone={driver.plannedTodayMin > driver.maxDailyMin ? 'warning' : 'default'} />
        <KpiTile label={t('drivers.kpi.thisWeek')} value={`${t('units.hours', { value: formatHours(sum(week, 'driving_min')) })}`} detail={t('drivers.kpi.days', { count: week.length })} />
        <KpiTile label={t('drivers.kpi.overtime14')} value={`${t('units.hours', { value: formatHours(sum(last14, 'overtime_min')) })}`} tone={sum(last14, 'overtime_min') > 0 ? 'danger' : 'default'} />
        <KpiTile label={t('drivers.kpi.distance14')} value={t('units.km', { value: formatNumber(km, 0) })} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <DriverDocumentsPanel driver={driver} />
          <Panel title={t('drivers.hours14')} bodyClassName="p-4 pt-6">
            {last14.length ? (
              <HoursChart standardMin={standard} points={last14.map((s) => ({ date: s.date, drivingMin: s.driving_min, overtimeMin: s.overtime_min }))} />
            ) : (
              <EmptyState compact icon={CalendarX2} title={t('reports.empty')} />
            )}
          </Panel>
          <Panel title={t('drivers.upcoming')} bodyClassName="space-y-2 p-4">
            {driver.upcoming.length ? (
              driver.upcoming.map((task) => <TaskCard key={task.id} task={task} onOpen={openTask} />)
            ) : (
              <EmptyState compact icon={CalendarX2} title={t('drivers.noUpcoming')} />
            )}
          </Panel>
        </div>
        <div className="min-w-0 space-y-5">
          <Panel title={t('drivers.today')} bodyClassName="p-4">
            <HoursBar drivingMin={driver.plannedTodayMin} capMin={driver.maxDailyMin} />
          </Panel>
          <Panel
            title={t('drivers.availability')}
            bodyClassName="p-4"
            action={
              isStaff(profile.role) && (
                <Button variant="ghost" size="sm" onClick={() => setLeaveOpen(true)}>
                  <Plus aria-hidden="true" />
                  {t('common.add')}
                </Button>
              )
            }
          >
            {driver.availability.length ? (
              <ul className="space-y-2">
                {driver.availability.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-2 rounded-md border border-border p-3 text-sm">
                    <div>
                      <p className="font-semibold">{t(`availability.${a.type}`)}</p>
                      <p className="tabular text-xs text-fg-2">
                        {formatDate(a.starts_at, 'short')} – {formatDate(a.ends_at, 'short')}
                        {a.note && ` · ${a.note}`}
                      </p>
                    </div>
                    {isStaff(profile.role) && (
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => removeLeave.mutate(a.id)} aria-label={t('common.remove')}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={CalendarOff} title={t('drivers.noAvailability')} />
            )}
          </Panel>
          <Panel title={t('drivers.licence')} bodyClassName="space-y-1 p-4 text-sm">
            <p className="flex items-center gap-2">
              <IdCard className="size-4 text-fg-3" aria-hidden="true" />
              <span dir="ltr">{driver.licence_no ?? '—'}</span>
            </p>
            {driver.licence_expiry && (
              <p className={licenceExpiresSoon(driver.licence_expiry) ? 'font-semibold text-warning-fg' : 'text-fg-2'}>
                {t('drivers.expires', { date: formatDate(`${driver.licence_expiry}T12:00:00Z`) })}
              </p>
            )}
          </Panel>
        </div>
      </div>
    </Page>
  );
}
