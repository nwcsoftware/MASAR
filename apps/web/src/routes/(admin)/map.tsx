import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Battery, Clock, MapPinOff, Phone, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DriverAvatar } from '@/components/driver-avatar';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { EtaChip } from '@/components/eta-chip';
import { useOpenTask } from '@/components/layout/task-sheet-context';
import { MapCanvas } from '@/components/map-canvas';
import { StatusPill } from '@/components/status-pill';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useDrivers, type DriverOverview } from '@/features/drivers/queries';
import { useScopedSiteIds } from '@/features/sites/site-scope';
import { primaryAssignment } from '@/features/tasks/types';
import { formatRelative } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';
import { DRIVER_STATUS_COLOR, type DriverStatus } from '@/lib/task-meta';
import { cn, tone } from '@/lib/utils';

export const Route = createFileRoute('/(admin)/map')({
  component: LiveMapPage,
});

const STATUS_FILTERS: (DriverStatus | 'all')[] = ['all', 'en_route', 'in_progress', 'delayed', 'idle', 'offline'];

function DriverStatusLabel({ status }: { status: DriverStatus }) {
  const { t } = useTranslation();
  return (
    <span className="tone-pill inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold" style={tone(DRIVER_STATUS_COLOR[status])}>
      <span className="tone-dot size-1.5 rounded-full" aria-hidden="true" />
      {t(`driverStatus.${status}`)}
    </span>
  );
}

/** docs/DESIGN.md §5 DriverPanel — current task, ETA, last seen, call. */
function DriverPanel({ driver }: { driver: DriverOverview }) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const openTask = useOpenTask();
  const task = driver.activeTask ?? driver.nextTask;
  const assignment = task ? primaryAssignment(task) : null;
  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-lg">
      <div className="flex items-center gap-3">
        <DriverAvatar name={driver.full_name} colorVar={DRIVER_STATUS_COLOR[driver.current_status]} className="size-10" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{name(driver, 'full_name')}</p>
          <p className="truncate text-xs text-fg-2">{driver.homeSite ? name(driver.homeSite) : '—'}</p>
        </div>
        <DriverStatusLabel status={driver.current_status} />
      </div>
      {task ? (
        <button type="button" onClick={() => openTask(task.id)} className="w-full rounded-md bg-surface-2 p-3 text-start hover:bg-surface-3">
          <div className="flex items-center justify-between gap-2">
            <span className="eyebrow">{driver.activeTask ? t('map.currentTask') : t('map.nextTask')}</span>
            <StatusPill status={task.status} />
          </div>
          <p className="mt-1 truncate text-sm font-bold">{task.title}</p>
          {assignment?.eta_next_stop_at && <EtaChip eta={assignment.eta_next_stop_at} className="mt-1" />}
        </button>
      ) : (
        <p className="text-sm text-fg-2">{t('map.noTask')}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-2">
        {driver.last_seen_at && (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden="true" />
            {t('map.lastSeen', { time: formatRelative(driver.last_seen_at) })}
          </span>
        )}
        {driver.location?.battery_pct != null && (
          <span className="inline-flex items-center gap-1">
            <Battery className="size-3.5" aria-hidden="true" />
            {driver.location.battery_pct}%
          </span>
        )}
      </div>
      {driver.phone && (
        <Button asChild variant="outline" size="sm" className="w-full">
          <a href={`tel:${driver.phone.replace(/\s/g, '')}`}>
            <Phone aria-hidden="true" />
            {t('map.call')}
          </a>
        </Button>
      )}
    </div>
  );
}

/** Screen 5 — full-bleed map, driver list at inline-start (FR-40). */
function LiveMapPage() {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const siteIds = useScopedSiteIds();
  const drivers = useDrivers(siteIds);
  const [status, setStatus] = useState<DriverStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useMemo(
    () =>
      (drivers.data ?? [])
        .filter((d) => status === 'all' || d.current_status === status)
        .filter((d) => !search || `${d.full_name} ${d.full_name_ar ?? ''}`.toLowerCase().includes(search.toLowerCase())),
    [drivers.data, status, search],
  );
  const selected = list.find((d) => d.id === selectedId) ?? null;

  return (
    <div className="flex h-full min-h-[560px] flex-col lg:flex-row">
      <aside className="flex max-h-[45vh] shrink-0 flex-col border-b border-border bg-surface lg:max-h-none lg:w-80 lg:border-b-0 lg:border-e">
        <div className="space-y-3 border-b border-border p-4">
          <h1 className="text-lg font-extrabold">{t('nav.liveMap')}</h1>
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-fg-3" aria-hidden="true" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('map.searchDrivers')} className="ps-9" aria-label={t('map.searchDrivers')} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={status === s}
                onClick={() => setStatus(s)}
                className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', status === s ? 'border-brand-500 bg-brand-500 text-fg-on-brand' : 'border-border text-fg-2')}
              >
                {s === 'all' ? t('common.all') : t(`driverStatus.${s}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {drivers.isPending ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : drivers.isError ? (
            <ErrorState error={drivers.error} onRetry={() => void drivers.refetch()} />
          ) : !list.length ? (
            <EmptyState compact icon={MapPinOff} title={t('map.noDrivers')} />
          ) : (
            <ul className="divide-y divide-border">
              {list.map((d) => {
                const assignment = d.activeTask ? primaryAssignment(d.activeTask) : null;
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(d.id === selectedId ? null : d.id)}
                      aria-pressed={d.id === selectedId}
                      className={cn('flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-surface-2', d.id === selectedId && 'bg-surface-2')}
                    >
                      <DriverAvatar name={d.full_name} colorVar={DRIVER_STATUS_COLOR[d.current_status]} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{name(d, 'full_name')}</span>
                        <span className="block truncate text-xs text-fg-2">{d.activeTask?.title ?? t(`driverStatus.${d.current_status}`)}</span>
                      </span>
                      {assignment?.eta_next_stop_at ? (
                        <EtaChip eta={assignment.eta_next_stop_at} />
                      ) : d.last_seen_at ? (
                        <span className="tabular text-[11px] text-fg-3">{formatRelative(d.last_seen_at)}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      <div className="relative min-h-[360px] flex-1">
        <MapCanvas
          className="absolute inset-0"
          onSelect={setSelectedId}
          pins={list
            .filter((d) => d.location)
            .map((d) => ({
              id: d.id,
              lat: d.location!.lat,
              lng: d.location!.lng,
              label: name(d, 'full_name'),
              colorVar: DRIVER_STATUS_COLOR[d.current_status],
              live: d.current_status === 'en_route' || d.current_status === 'in_progress',
              selected: d.id === selectedId,
            }))}
        />
        {selected && (
          <div className="absolute end-4 top-4 w-80 max-w-[calc(100%-2rem)]">
            <DriverPanel driver={selected} />
          </div>
        )}
      </div>
    </div>
  );
}
