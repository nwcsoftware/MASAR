import { useMemo } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight, CalendarX2, CircleCheck, Inbox, Plane } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { EtaChip } from '@/components/eta-chip';
import { KpiTile } from '@/components/kpi-tile';
import { useOpenTask } from '@/components/layout/task-sheet-context';
import { MapCanvas } from '@/components/map-canvas';
import { Page, Panel } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { ResourceCalendar, rowsFromTasks } from '@/components/resource-calendar';
import { ShareTripHint } from '@/components/share-trip-hint';
import { StatusPill } from '@/components/status-pill';
import { DriverAvatar } from '@/components/driver-avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { isStaff } from '@/features/auth/guards';
import { canShareWith, readPassengers } from '@/features/grades/rules';
import { useCurrentUser } from '@/features/auth/session';
import { deriveAttention, type AttentionItem } from '@/features/dashboard/attention';
import { useDrivers } from '@/features/drivers/queries';
import { useScopedSiteIds } from '@/features/sites/site-scope';
import { useSites } from '@/features/sites/queries';
import { useShareTrip, useSimilarAirportTrips, useTasks } from '@/features/tasks/queries';
import { primaryAssignment, sharedHostId, type TaskWithRelations } from '@/features/tasks/types';
import { at } from '@/mocks/fixtures';
import { companyDateKey, formatDate, formatRelative, formatTime, isolate } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';
import { DRIVER_STATUS_COLOR, TASK_CATEGORIES } from '@/lib/task-meta';
import { useNow } from '@/lib/use-now';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/(admin)/dashboard')({
  component: DashboardPage,
});

function greetingKey(hour: number) {
  if (hour < 12) return 'dashboard.goodMorning';
  if (hour < 17) return 'dashboard.goodAfternoon';
  return 'dashboard.goodEvening';
}

const BAR: Record<AttentionItem['kind'], string> = {
  double_booked: 'bg-danger',
  delayed: 'bg-status-delayed',
  not_acknowledged: 'bg-warning',
  over_hours: 'bg-warning',
  unassigned: 'bg-brand-400',
};

function AttentionRow({ item }: { item: AttentionItem }) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const openTask = useOpenTask();
  const assignment = primaryAssignment(item.task);
  const driver = isolate(assignment ? name(assignment.driver, 'full_name') : '');
  const title = isolate(item.task.title);
  const starts =
    companyDateKey(item.task.scheduled_start) === companyDateKey()
      ? formatTime(item.task.scheduled_start)
      : `${formatDate(item.task.scheduled_start, 'short')} ${formatTime(item.task.scheduled_start)}`;

  const heading = {
    double_booked: t('attention.doubleBooked', { driver }),
    delayed: t('attention.delayed', { title: isolate(item.task.flight?.flight_no ?? item.task.title), minutes: item.delayMin ?? '?' }),
    not_acknowledged: t('attention.notAcknowledged', { driver, title }),
    over_hours: t('attention.overHours', { driver }),
    unassigned: t('attention.unassigned', { title }),
  }[item.kind];

  const detail = {
    double_booked: t('attention.overlaps', { a: title, b: isolate(item.other?.title ?? '') }),
    delayed: `${driver} · ${name(item.task.site)}`,
    not_acknowledged:
      item.deadlineInMin !== undefined && item.deadlineInMin < 0
        ? t('attention.deadlinePassed', { time: starts })
        : t('attention.deadlineIn', { time: starts, relative: item.deadlineAt ? formatRelative(item.deadlineAt) : '' }),
    over_hours: name(item.task.site),
    unassigned: `${formatDate(item.task.scheduled_start, 'short')} ${formatTime(item.task.scheduled_start)} · ${name(item.task.site)}`,
  }[item.kind];

  return (
    <li className="grid grid-cols-[4px_1fr_auto] items-center gap-3 px-4 py-3">
      <span className={cn('h-full min-h-9 rounded-full', BAR[item.kind])} aria-hidden="true" />
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-fg">{heading}</p>
        <p className="truncate text-xs text-fg-2">{detail}</p>
      </div>
      <div className="flex gap-1.5">
        {item.kind === 'not_acknowledged' && assignment?.driver.phone && (
          <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
            <a href={`tel:${assignment.driver.phone.replace(/\s/g, '')}`}>{t('attention.call')}</a>
          </Button>
        )}
        {item.kind === 'delayed' ? (
          <StatusPill status="delayed" />
        ) : (
          <Button size="sm" variant={item.kind === 'not_acknowledged' ? 'outline' : 'default'} className="h-7 px-2 text-xs" onClick={() => openTask(item.task.id)}>
            {item.kind === 'double_booked' ? t('attention.reassign') : item.kind === 'unassigned' ? t('attention.assign') : t('attention.open')}
          </Button>
        )}
      </div>
    </li>
  );
}

function ShareHintForDay({ tasks }: { tasks: TaskWithRelations[] }) {
  // First unassigned airport task today that has a same-airport trip from another site.
  const candidate = tasks.find(
    (t) => t.category === 'airport' && !primaryAssignment(t) && !sharedHostId(t) && t.flight?.airport_id && ['draft', 'scheduled', 'declined'].includes(t.status),
  );
  const similar = useSimilarAirportTrips(candidate);
  const share = useShareTrip();
  const { profile } = useCurrentUser();
  const groups = candidate ? [...new Set(readPassengers(candidate.passengers).flatMap((p) => (p.group_code ? [p.group_code] : [])))] : [];
  const trip = similar.data?.find((s) => s.site_id !== candidate?.site_id && canShareWith(groups, s));
  if (!candidate || !trip) return null;
  return (
    <ShareTripHint
      trip={trip}
      flightNo={candidate.flight?.flight_no ?? null}
      airportCode={candidate.flight?.airport?.iata ?? ''}
      onShare={isStaff(profile.role) && !share.isPending ? () => share.mutate({ taskId: candidate.id, hostTaskId: trip.task_id }) : undefined}
    />
  );
}

function DashboardPage() {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const user = useCurrentUser();
  const openTask = useOpenTask();
  const siteIds = useScopedSiteIds();
  // 15-minute buckets keep the "next 24 h" query key stable between ticks.
  const now = Math.floor(useNow() / 900_000) * 900_000;
  const today = useTasks({ from: at(0, '00:00'), to: at(1, '00:00'), siteIds });
  const next24 = useTasks({ from: new Date(now).toISOString(), to: new Date(now + 86_400_000).toISOString(), siteIds, categories: ['airport'] });
  const upcoming = useTasks({ from: at(0, '00:00'), to: at(2, '00:00'), siteIds });
  const drivers = useDrivers(siteIds);
  const sites = useSites();

  const tasks = useMemo(() => today.data ?? [], [today.data]);
  const attention = useMemo(() => deriveAttention(upcoming.data ?? []), [upcoming.data]);
  const counts = useMemo(() => {
    const byCategory = Object.fromEntries(TASK_CATEGORIES.map((c) => [c, tasks.filter((x) => x.category === c).length]));
    const unacked = tasks.filter((x) => x.status === 'assigned');
    const soon = unacked.filter((x) => new Date(x.scheduled_start).getTime() - now < 2 * 3_600_000);
    const delayed = tasks.filter((x) => x.status === 'delayed');
    return { byCategory, unacked: unacked.length, soon: soon.length, delayed };
  }, [tasks, now]);
  const driverList = drivers.data ?? [];
  const active = driverList.filter((d) => d.activeTask !== null);
  const onDuty = driverList.filter((d) => d.current_status !== 'offline');
  const firstName = name(user.profile, 'full_name').split(' ')[0];
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: user.company?.timezone ?? 'Asia/Riyadh' }).format(new Date()));

  return (
    <Page>
      <PageHeader
        title={t(greetingKey(hour), { name: firstName })}
        description={t('dashboard.subtitle', {
          date: formatDate(new Date(), 'long'),
          sites: siteIds.length || (sites.data?.length ?? 0),
          drivers: onDuty.length,
        })}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/calendar">
              {t('dashboard.openCalendar')}
              <ArrowRight className="rtl:-scale-x-100" aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      {today.isError ? (
        <Panel>
          <ErrorState error={today.error} onRetry={() => void today.refetch()} />
        </Panel>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiTile
                loading={today.isPending}
                label={t('dashboard.kpi.tasksToday')}
                value={tasks.length}
                detail={TASK_CATEGORIES.filter((c) => counts.byCategory[c]).map((c) => `${counts.byCategory[c]} ${t(`tasks.categoryShort.${c}`)}`).join(' · ')}
              />
              <KpiTile
                loading={today.isPending}
                tone={counts.unacked ? 'warning' : 'default'}
                label={t('dashboard.kpi.unacknowledged')}
                value={counts.unacked}
                detail={counts.soon ? t('dashboard.kpi.dueSoon', { count: counts.soon }) : t('dashboard.kpi.allClear')}
              />
              <KpiTile
                loading={today.isPending}
                tone={counts.delayed.length ? 'danger' : 'default'}
                label={t('dashboard.kpi.delayed')}
                value={counts.delayed.length}
                detail={counts.delayed[0]?.flight?.flight_no ?? counts.delayed[0]?.title}
              />
              <KpiTile
                loading={drivers.isPending}
                label={t('dashboard.kpi.driversActive')}
                value={`${active.length}/${driverList.length}`}
                detail={t('dashboard.kpi.onDuty', { count: onDuty.length })}
              />
            </div>

            <ShareHintForDay tasks={tasks} />

            <Panel
              title={t('dashboard.driversToday')}
              action={
                <Link to="/calendar" className="text-xs font-semibold text-brand-500 hover:underline">
                  {t('dashboard.openCalendar')}
                </Link>
              }
            >
              {today.isPending || drivers.isPending ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !tasks.length ? (
                <EmptyState compact icon={CalendarX2} title={t('dashboard.noTasksToday')} body={t('dashboard.noTasksTodayBody')} />
              ) : (
                <ResourceCalendar
                  day={companyDateKey()}
                  dense
                  startHour={7}
                  endHour={19}
                  rows={rowsFromTasks(
                    tasks,
                    driverList.map((d) => ({ ...d, subtitle: d.homeSite ? name(d.homeSite) : undefined })),
                    t('tasks.unassigned'),
                  )}
                  onOpenTask={openTask}
                />
              )}
            </Panel>

            <Panel
              title={t('dashboard.upcomingAirport')}
              action={
                <Link to="/tasks" search={{ category: 'airport' }} className="text-xs font-semibold text-brand-500 hover:underline">
                  {t('dashboard.allTasks')}
                </Link>
              }
            >
              {next24.isPending ? (
                <div className="space-y-2 p-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : !next24.data?.length ? (
                <EmptyState compact icon={Plane} title={t('dashboard.noAirport')} />
              ) : (
                <ul className="divide-y divide-border">
                  {next24.data.map((task) => {
                    const assignment = primaryAssignment(task);
                    return (
                      <li key={task.id}>
                        <button type="button" onClick={() => openTask(task.id)} className="grid w-full grid-cols-[4px_1fr_auto] items-center gap-3 px-4 py-3 text-start hover:bg-surface-2">
                          <span className="h-full min-h-9 rounded-full bg-cat-airport" aria-hidden="true" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold">
                              {task.flight?.airport?.iata} · {task.flight?.flight_no}
                            </span>
                            <span className="tabular block truncate text-xs text-fg-2">
                              {t(`flight.${task.flight?.direction ?? 'arrival'}`)} {task.flight ? formatTime(task.flight.scheduled_time) : ''} ·{' '}
                              {assignment ? name(assignment.driver, 'full_name') : t('tasks.unassigned')} · {name(task.site)}
                            </span>
                          </span>
                          <StatusPill status={task.status} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>

          <div className="min-w-0 space-y-5">
            <Panel
              title={t('dashboard.needsAttention')}
              action={
                attention.length > 0 && (
                  <span className="tint-12 tabular rounded-full px-2 text-xs font-bold text-danger [--tint-color:var(--danger)]">{attention.length}</span>
                )
              }
            >
              {upcoming.isPending ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 3 }, (_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : !attention.length ? (
                <EmptyState compact icon={CircleCheck} title={t('dashboard.allClear')} body={t('dashboard.allClearBody')} />
              ) : (
                <ul className="divide-y divide-border">
                  {attention.map((item) => (
                    <AttentionRow key={item.id} item={item} />
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              title={t('nav.liveMap')}
              action={
                <Link to="/map" className="text-xs font-semibold text-brand-500 hover:underline">
                  {t('dashboard.openMap')}
                </Link>
              }
            >
              {drivers.isPending ? (
                <Skeleton className="h-56 w-full rounded-none" />
              ) : !driverList.length ? (
                <EmptyState compact icon={Inbox} title={t('drivers.empty')} />
              ) : (
                <>
                  <MapCanvas
                    className="h-56"
                    pins={driverList
                      .filter((d) => d.location)
                      .map((d) => ({
                        id: d.id,
                        lat: d.location!.lat,
                        lng: d.location!.lng,
                        label: name(d, 'full_name').split(' ')[0] ?? d.full_name,
                        colorVar: DRIVER_STATUS_COLOR[d.current_status],
                        live: d.current_status === 'en_route' || d.current_status === 'in_progress',
                      }))}
                  />
                  <ul className="divide-y divide-border">
                    {driverList
                      .filter((d) => d.activeTask)
                      .map((d) => {
                        const assignment = d.activeTask && primaryAssignment(d.activeTask);
                        return (
                          <li key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                            <DriverAvatar name={d.full_name} colorVar={DRIVER_STATUS_COLOR[d.current_status]} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold">{name(d, 'full_name')}</p>
                              <p className="truncate text-xs text-fg-2">{d.activeTask?.title}</p>
                            </div>
                            {assignment?.eta_next_stop_at && <EtaChip eta={assignment.eta_next_stop_at} />}
                          </li>
                        );
                      })}
                  </ul>
                </>
              )}
            </Panel>
          </div>
        </div>
      )}
    </Page>
  );
}
