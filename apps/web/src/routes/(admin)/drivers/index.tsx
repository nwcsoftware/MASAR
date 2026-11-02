import { createFileRoute, Link } from '@tanstack/react-router';
import { IdCard, Plus, UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ConflictBadge } from '@/components/conflict-badge';
import { DriverAvatar } from '@/components/driver-avatar';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { HoursBar } from '@/components/hours-bar';
import { Page, Panel } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { isAdmin } from '@/features/auth/guards';
import { useCurrentUser } from '@/features/auth/session';
import { useDrivers, type DriverOverview } from '@/features/drivers/queries';
import { licenceExpiresSoon } from '@/features/drivers/utils';
import { useScopedSiteIds } from '@/features/sites/site-scope';
import { formatTime } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';
import { DRIVER_STATUS_COLOR } from '@/lib/task-meta';
import { tone } from '@/lib/utils';

export const Route = createFileRoute('/(admin)/drivers/')({
  component: DriversPage,
});

function DriverCard({ driver }: { driver: DriverOverview }) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const task = driver.activeTask ?? driver.nextTask;
  return (
    <Link
      to="/drivers/$driverId"
      params={{ driverId: driver.id }}
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <DriverAvatar name={driver.full_name} photoUrl={driver.photo_url} colorVar={DRIVER_STATUS_COLOR[driver.current_status]} className="size-11" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{name(driver, 'full_name')}</p>
          <p className="truncate text-xs text-fg-2">
            {driver.employee_no} · {driver.homeSite ? name(driver.homeSite) : '—'}
          </p>
        </div>
        <span className="tone-pill inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold" style={tone(DRIVER_STATUS_COLOR[driver.current_status])}>
          <span className="tone-dot size-1.5 rounded-full" aria-hidden="true" />
          {t(`driverStatus.${driver.current_status}`)}
        </span>
      </div>

      <div className="min-h-10 rounded-md bg-surface-2 px-3 py-2 text-xs">
        {task ? (
          <>
            <span className="eyebrow">{driver.activeTask ? t('map.currentTask') : t('map.nextTask')}</span>
            <p className="truncate font-semibold text-fg">
              <span className="tabular">{formatTime(task.scheduled_start)}</span> · {task.title}
            </p>
          </>
        ) : (
          <p className="py-1.5 text-fg-3">{t('drivers.noMoreToday')}</p>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-fg-2">{t('drivers.plannedToday')}</span>
          <ConflictBadge conflicts={driver.tasksToday.flatMap((x) => x.conflicts)} />
        </div>
        <HoursBar drivingMin={driver.plannedTodayMin} capMin={driver.maxDailyMin} />
      </div>

      {licenceExpiresSoon(driver.licence_expiry) && (
        <p className="tint-12 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-warning-fg [--tint-color:var(--warning)]">
          <IdCard className="size-3.5" aria-hidden="true" />
          {t('drivers.licenceExpiring', { date: driver.licence_expiry })}
        </p>
      )}
    </Link>
  );
}

/** Screen 8 — drivers card grid. */
function DriversPage() {
  const { t } = useTranslation();
  const { profile } = useCurrentUser();
  const siteIds = useScopedSiteIds();
  const drivers = useDrivers(siteIds);

  return (
    <Page>
      <PageHeader
        title={t('drivers.title')}
        description={t('drivers.subtitle')}
        actions={
          isAdmin(profile.role) && (
            <Button size="sm" disabled title={t('common.comingSoon')}>
              <Plus aria-hidden="true" />
              {t('drivers.add')}
            </Button>
          )
        }
      />
      {drivers.isError ? (
        <Panel>
          <ErrorState error={drivers.error} onRetry={() => void drivers.refetch()} />
        </Panel>
      ) : drivers.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-56 rounded-lg" />
          ))}
        </div>
      ) : !drivers.data.length ? (
        <Panel>
          <EmptyState icon={UsersRound} title={t('drivers.empty')} body={t('drivers.emptyBody')} />
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {drivers.data.map((driver) => (
            <DriverCard key={driver.id} driver={driver} />
          ))}
        </div>
      )}
    </Page>
  );
}
