import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, Building2, CalendarX2, Car, Clock, MapPin, Phone, Plane, Star, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DriverAvatar } from '@/components/driver-avatar';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { useOpenTask } from '@/components/layout/task-sheet-context';
import { MapCanvas } from '@/components/map-canvas';
import { Page, Panel } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { TaskCard } from '@/components/task-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSite } from '@/features/sites/queries';
import { formatNumber } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';

export const Route = createFileRoute('/(admin)/sites/$siteId')({
  component: SiteDetailPage,
});

/** Screen 9b — site detail with airports (FR-02/03). */
function SiteDetailPage() {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const openTask = useOpenTask();
  const { siteId } = Route.useParams();
  const query = useSite(siteId);
  const site = query.data;

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ms-2">
      <Link to="/sites">
        <ArrowLeft className="rtl:-scale-x-100" aria-hidden="true" />
        {t('sites.title')}
      </Link>
    </Button>
  );

  if (query.isPending) {
    return (
      <Page>
        {back}
        <Skeleton className="h-14 w-1/2" />
        <Skeleton className="h-72" />
      </Page>
    );
  }
  if (query.isError || !site) {
    return (
      <Page>
        {back}
        <Panel>{query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : <EmptyState icon={Building2} title={t('sites.notFound')} />}</Panel>
      </Page>
    );
  }

  return (
    <Page>
      {back}
      <PageHeader
        eyebrow={`${site.code} · ${t(`sites.type.${site.type}`)}`}
        title={name(site)}
        description={name({ name: site.address ?? '', name_ar: site.address_ar })}
        actions={
          <Button size="sm" variant="outline" disabled title={t('common.comingSoon')}>
            {t('common.edit')}
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <Panel
            title={t('sites.airports')}
            action={
              <Button size="sm" variant="outline" disabled title={t('common.comingSoon')}>
                <Plane aria-hidden="true" />
                {t('sites.suggestAirports')}
              </Button>
            }
          >
            {site.airports.length ? (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t('sites.airport')}</TableHead>
                    <TableHead>{t('sites.distance')}</TableHead>
                    <TableHead>{t('sites.driveTime')}</TableHead>
                    <TableHead>{t('sites.buffer')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {site.airports.map((sa) => (
                    <TableRow key={sa.airport_id}>
                      <TableCell>
                        <div className="flex items-center gap-2 font-semibold">
                          {sa.is_default && <Star className="size-3.5 fill-current text-warning-fg" aria-label={t('sites.defaultAirport')} />}
                          {sa.airport.iata} · {name(sa.airport)}
                        </div>
                      </TableCell>
                      <TableCell className="tabular">{sa.distance_km != null ? t('units.km', { value: formatNumber(Number(sa.distance_km)) }) : '—'}</TableCell>
                      <TableCell className="tabular">{sa.drive_minutes != null ? t('units.minutes', { value: sa.drive_minutes }) : '—'}</TableCell>
                      <TableCell className="tabular">{t('units.minutes', { value: sa.default_buffer_min })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState compact icon={Plane} title={t('sites.noAirports')} body={t('sites.noAirportsBody')} />
            )}
          </Panel>

          <Panel title={t('sites.upcoming')} bodyClassName="space-y-2 p-4">
            {site.upcoming.length ? (
              site.upcoming.map((task) => <TaskCard key={task.id} task={task} onOpen={openTask} />)
            ) : (
              <EmptyState compact icon={CalendarX2} title={t('sites.noUpcoming')} />
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-5">
          <Panel>
            {site.lat != null && site.lng != null && (
              <MapCanvas
                className="h-48"
                pins={[
                  { id: site.id, lat: site.lat, lng: site.lng, label: site.code ?? name(site), colorVar: 'var(--brand-500)', kind: 'site' },
                  ...site.airports.map((sa) => ({ id: sa.airport_id, lat: sa.airport.lat, lng: sa.airport.lng, label: `✈ ${sa.airport.iata}`, colorVar: 'var(--cat-airport)', kind: 'airport' as const })),
                ]}
              />
            )}
            <dl className="space-y-3 p-4 text-sm">
              <div className="flex gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-fg-3" aria-hidden="true" />
                <dd className="tabular text-fg-2" dir="ltr">
                  {site.lat?.toFixed(4)}, {site.lng?.toFixed(4)}
                </dd>
              </div>
              <div className="flex gap-3">
                <Clock className="mt-0.5 size-4 shrink-0 text-fg-3" aria-hidden="true" />
                <dd className="tabular">{t('sites.workHours', { start: site.work_start?.slice(0, 5), end: site.work_end?.slice(0, 5) })}</dd>
              </div>
              {site.contact_name && (
                <div className="flex gap-3">
                  <UserRound className="mt-0.5 size-4 shrink-0 text-fg-3" aria-hidden="true" />
                  <dd>
                    {site.contact_name}
                    {site.contact_phone && (
                      <a href={`tel:${site.contact_phone.replace(/\s/g, '')}`} className="ms-2 inline-flex items-center gap-1 text-brand-500 hover:underline" dir="ltr">
                        <Phone className="size-3" aria-hidden="true" />
                        {site.contact_phone}
                      </a>
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </Panel>

          <Panel title={t('sites.homeDrivers')}>
            {site.drivers.length ? (
              <ul className="divide-y divide-border">
                {site.drivers.map((d) => (
                  <li key={d.id}>
                    <Link to="/drivers/$driverId" params={{ driverId: d.id }} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                      <DriverAvatar name={d.full_name} />
                      <span className="text-sm font-semibold">{name(d, 'full_name')}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={UserRound} title={t('sites.noDrivers')} />
            )}
          </Panel>

          <Panel title={t('sites.vehicles')}>
            {site.vehicles.length ? (
              <ul className="divide-y divide-border">
                {site.vehicles.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <Car className="size-4 text-fg-3" aria-hidden="true" />
                    <span className="flex-1 font-semibold">
                      {v.make} {v.model}
                    </span>
                    <span className="tabular text-xs text-fg-2" dir="ltr">
                      {v.plate_no}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={Car} title={t('sites.noVehicles')} />
            )}
          </Panel>
        </div>
      </div>
    </Page>
  );
}
