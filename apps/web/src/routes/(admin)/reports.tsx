import { useMemo } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { ChartColumn, FileSpreadsheet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/data-table';
import { DriverAvatar } from '@/components/driver-avatar';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { HoursChart } from '@/components/hours-chart';
import { KpiTile } from '@/components/kpi-tile';
import { Page, Panel } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCompanySettings } from '@/features/company/queries';
import { useDrivers } from '@/features/drivers/queries';
import { useHoursReport, type DriverHoursRow } from '@/features/reports/queries';
import { useScopedSiteIds } from '@/features/sites/site-scope';
import { dateKey } from '@/mocks/fixtures';
import { formatDate, formatHours, formatNumber } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';

const PRESETS = ['7d', '14d', '30d'] as const;
type Preset = (typeof PRESETS)[number];
const DAYS: Record<Preset, number> = { '7d': 7, '14d': 14, '30d': 30 };
const ALL = '__all';

export const Route = createFileRoute('/(admin)/reports')({
  validateSearch: (search: Record<string, unknown>): { range?: Preset; driver?: string } => ({
    range: PRESETS.includes(search.range as Preset) ? (search.range as Preset) : undefined,
    driver: typeof search.driver === 'string' ? search.driver : undefined,
  }),
  component: ReportsPage,
});

/** Screen 10 — hours, overtime and km per driver (FR-50/52, US-10). */
function ReportsPage() {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const navigate = useNavigate({ from: Route.fullPath });
  const { range = '14d', driver } = Route.useSearch();
  const siteIds = useScopedSiteIds();
  const drivers = useDrivers(siteIds);
  const settings = useCompanySettings();
  const from = dateKey(-(DAYS[range] - 1));
  const to = dateKey(0);
  const report = useHoursReport({ from, to, siteIds, driverIds: driver ? [driver] : undefined });
  const data = report.data;
  const maxMin = Math.max(...(data?.rows ?? []).map((r) => r.drivingMin + r.overtimeMin), 1);

  const columns = useMemo<ColumnDef<DriverHoursRow, unknown>[]>(
    () => [
      {
        id: 'driver',
        accessorFn: (r) => r.driver.full_name,
        header: () => t('reports.columns.driver'),
        meta: { label: t('reports.columns.driver'), csv: (r) => r.driver.full_name },
        cell: ({ row }) => (
          <span className="flex items-center gap-2 whitespace-nowrap font-semibold">
            <DriverAvatar name={row.original.driver.full_name} className="size-6 text-[10px]" />
            {name(row.original.driver, 'full_name')}
          </span>
        ),
      },
      {
        id: 'site',
        accessorFn: (r) => r.homeSite?.name ?? '',
        header: () => t('reports.columns.site'),
        meta: { label: t('reports.columns.site'), csv: (r) => r.homeSite?.name ?? '' },
        cell: ({ row }) => (row.original.homeSite ? name(row.original.homeSite) : '—'),
      },
      { id: 'days', accessorKey: 'days', header: () => t('reports.columns.days'), meta: { label: t('reports.columns.days'), csv: (r) => r.days, className: 'tabular text-end' } },
      { id: 'tasks', accessorKey: 'tasks', header: () => t('reports.columns.tasks'), meta: { label: t('reports.columns.tasks'), csv: (r) => r.tasks, className: 'tabular text-end' } },
      {
        id: 'driving',
        accessorKey: 'drivingMin',
        header: () => t('reports.columns.driving'),
        meta: { label: t('reports.columns.driving'), csv: (r) => (r.drivingMin / 60).toFixed(1), className: 'tabular text-end' },
        cell: ({ row }) => formatHours(row.original.drivingMin),
      },
      {
        id: 'working',
        accessorKey: 'workingMin',
        header: () => t('reports.columns.working'),
        meta: { label: t('reports.columns.working'), csv: (r) => (r.workingMin / 60).toFixed(1), className: 'tabular text-end' },
        cell: ({ row }) => formatHours(row.original.workingMin),
      },
      {
        id: 'overtime',
        accessorKey: 'overtimeMin',
        header: () => t('reports.columns.overtime'),
        meta: { label: t('reports.columns.overtime'), csv: (r) => (r.overtimeMin / 60).toFixed(1), className: 'tabular text-end' },
        cell: ({ row }) => <span className={row.original.overtimeMin ? 'font-bold text-danger' : ''}>{formatHours(row.original.overtimeMin)}</span>,
      },
      {
        id: 'km',
        accessorKey: 'distanceKm',
        header: () => t('reports.columns.km'),
        meta: { label: t('reports.columns.km'), csv: (r) => r.distanceKm, className: 'tabular text-end' },
        cell: ({ row }) => formatNumber(row.original.distanceKm, 0),
      },
    ],
    [t, name],
  );

  return (
    <Page>
      <PageHeader
        title={t('reports.title')}
        description={t('reports.subtitle', { from: formatDate(`${from}T12:00:00Z`, 'short'), to: formatDate(`${to}T12:00:00Z`, 'short') })}
        actions={
          <>
            <div className="inline-flex rounded-md border border-border bg-surface-2 p-0.5" role="group" aria-label={t('reports.range')}>
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={range === p}
                  onClick={() => void navigate({ search: (prev) => ({ ...prev, range: p === '14d' ? undefined : p }) })}
                  className={range === p ? 'rounded bg-surface px-3 py-1 text-sm font-semibold text-fg shadow-sm' : 'rounded px-3 py-1 text-sm font-semibold text-fg-2'}
                >
                  {t(`reports.presets.${p}`)}
                </button>
              ))}
            </div>
            <Select value={driver ?? ALL} onValueChange={(v) => void navigate({ search: (prev) => ({ ...prev, driver: v === ALL ? undefined : v }) })}>
              <SelectTrigger className="h-9 w-44" aria-label={t('tasks.filters.driver')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('tasks.filters.allDrivers')}</SelectItem>
                {(drivers.data ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {name(d, 'full_name')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" disabled title={t('common.comingSoon')}>
              <FileSpreadsheet aria-hidden="true" />
              {t('reports.exportXlsx')}
            </Button>
          </>
        }
      />

      {report.isError ? (
        <Panel>
          <ErrorState error={report.error} onRetry={() => void report.refetch()} />
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiTile loading={report.isPending} label={t('reports.kpi.driving')} value={`${t('units.hours', { value: formatHours(data?.totals.drivingMin ?? 0) })}`} />
            <KpiTile loading={report.isPending} label={t('reports.kpi.working')} value={`${t('units.hours', { value: formatHours(data?.totals.workingMin ?? 0) })}`} />
            <KpiTile loading={report.isPending} tone={data?.totals.overtimeMin ? 'danger' : 'default'} label={t('reports.kpi.overtime')} value={`${t('units.hours', { value: formatHours(data?.totals.overtimeMin ?? 0) })}`} />
            <KpiTile loading={report.isPending} label={t('reports.kpi.distance')} value={t('units.km', { value: formatNumber(data?.totals.distanceKm ?? 0, 0) })} detail={t('reports.kpi.tasks', { count: data?.totals.tasks ?? 0 })} />
          </div>

          {!report.isPending && !data?.rows.length ? (
            <Panel>
              <EmptyState icon={ChartColumn} title={t('reports.empty')} body={t('reports.emptyBody')} />
            </Panel>
          ) : (
            <div className="grid gap-5 xl:grid-cols-2">
              <Panel title={t('reports.byDriver')} bodyClassName="space-y-3 p-4">
                {report.isPending
                  ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-6 w-full" />)
                  : data?.rows.map((r) => (
                      <div key={r.driver.id} className="grid grid-cols-[8rem_1fr_3.5rem] items-center gap-3 text-sm">
                        <span className="truncate font-semibold">{name(r.driver, 'full_name')}</span>
                        <div className="flex h-3 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${t('units.hours', { value: formatHours(r.drivingMin) })} + ${t('units.hours', { value: formatHours(r.overtimeMin) })}`}>
                          <span className="h-full bg-brand-500" style={{ width: `${(r.drivingMin / maxMin) * 100}%` }} />
                          <span className="h-full bg-danger" style={{ width: `${(r.overtimeMin / maxMin) * 100}%` }} />
                        </div>
                        <span className="tabular text-end text-xs text-fg-2">{t('units.hours', { value: formatHours(r.drivingMin) })}</span>
                      </div>
                    ))}
              </Panel>
              <Panel title={t('reports.daily')} bodyClassName="p-4 pt-6">
                {report.isPending ? (
                  <Skeleton className="h-40 w-full" />
                ) : (
                  <HoursChart
                    standardMin={(settings.data?.standard_day_min ?? 480) * Math.max(data?.rows.length ?? 1, 1)}
                    points={(data?.daily ?? []).map((d) => ({ date: d.date, drivingMin: d.drivingMin, overtimeMin: d.overtimeMin }))}
                  />
                )}
              </Panel>
            </div>
          )}

          <Panel>
            <DataTable
              columns={columns}
              data={data?.rows ?? []}
              loading={report.isPending}
              getRowId={(r) => r.driver.id}
              csvFilename={`masar-hours-${from}-${to}.csv`}
              toolbar={<h2 className="text-sm font-bold">{t('reports.table')}</h2>}
            />
          </Panel>
        </>
      )}
    </Page>
  );
}
