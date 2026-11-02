import { useMemo } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { ListX, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CategoryBadge } from '@/components/category-badge';
import { ConflictBadge } from '@/components/conflict-badge';
import { DataTable } from '@/components/data-table';
import { DriverAvatar } from '@/components/driver-avatar';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { useOpenTask } from '@/components/layout/task-sheet-context';
import { Page, Panel } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDrivers } from '@/features/drivers/queries';
import { useScopedSiteIds } from '@/features/sites/site-scope';
import { useTasks } from '@/features/tasks/queries';
import { primaryAssignment, type TaskWithRelations } from '@/features/tasks/types';
import { at } from '@/mocks/fixtures';
import { formatDate, formatTimeRange } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';
import { TASK_CATEGORIES, TASK_STATUSES, type TaskCategory, type TaskStatus } from '@/lib/task-meta';

const RANGES = ['today', 'tomorrow', 'week', 'all'] as const;
type Range = (typeof RANGES)[number];

interface TasksSearch {
  q?: string;
  category?: TaskCategory;
  status?: TaskStatus;
  driver?: string;
  range?: Range;
}

export const Route = createFileRoute('/(admin)/tasks')({
  validateSearch: (search: Record<string, unknown>): TasksSearch => ({
    q: typeof search.q === 'string' && search.q ? search.q : undefined,
    category: TASK_CATEGORIES.includes(search.category as TaskCategory) ? (search.category as TaskCategory) : undefined,
    status: TASK_STATUSES.includes(search.status as TaskStatus) ? (search.status as TaskStatus) : undefined,
    driver: typeof search.driver === 'string' ? search.driver : undefined,
    range: RANGES.includes(search.range as Range) ? (search.range as Range) : undefined,
  }),
  component: TasksPage,
});

function rangeBounds(range: Range): { from?: string; to?: string } {
  switch (range) {
    case 'today':
      return { from: at(0, '00:00'), to: at(1, '00:00') };
    case 'tomorrow':
      return { from: at(1, '00:00'), to: at(2, '00:00') };
    case 'week':
      return { from: at(0, '00:00'), to: at(7, '00:00') };
    case 'all':
      return {};
  }
}

const ALL = '__all';

/** Screen 6 — tasks table with filters (category, status, site, driver, date). */
function TasksPage() {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const openTask = useOpenTask();
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const range = search.range ?? 'week';
  const siteIds = useScopedSiteIds();
  const drivers = useDrivers();
  const tasks = useTasks({
    ...rangeBounds(range),
    siteIds,
    categories: search.category ? [search.category] : undefined,
    statuses: search.status ? [search.status] : undefined,
    driverId: search.driver,
    search: search.q,
  });

  const setSearch = (patch: Partial<TasksSearch>) => void navigate({ search: (prev) => ({ ...prev, ...patch }) });
  const filtered = Boolean(search.q || search.category || search.status || search.driver || search.range);

  const columns = useMemo<ColumnDef<TaskWithRelations, unknown>[]>(
    () => [
      {
        id: 'when',
        accessorFn: (row) => row.scheduled_start,
        header: () => t('tasks.columns.when'),
        meta: { label: t('tasks.columns.when'), csv: (row) => row.scheduled_start, className: 'whitespace-nowrap' },
        cell: ({ row }) => (
          <div className="tabular">
            <div className="font-semibold">{formatTimeRange(row.original.scheduled_start, row.original.scheduled_end)}</div>
            <div className="text-xs text-fg-3">{formatDate(row.original.scheduled_start, 'short')}</div>
          </div>
        ),
      },
      {
        id: 'task',
        accessorFn: (row) => row.title,
        header: () => t('tasks.columns.task'),
        meta: { label: t('tasks.columns.task'), csv: (row) => row.title },
        cell: ({ row }) => (
          <div className="min-w-48 space-y-0.5">
            <div className="font-semibold">{row.original.title}</div>
            <CategoryBadge category={row.original.category} />
          </div>
        ),
      },
      {
        id: 'site',
        accessorFn: (row) => row.site.name,
        header: () => t('tasks.columns.site'),
        meta: { label: t('tasks.columns.site'), csv: (row) => row.site.name },
        cell: ({ row }) => <span className="whitespace-nowrap">{name(row.original.site)}</span>,
      },
      {
        id: 'driver',
        accessorFn: (row) => primaryAssignment(row)?.driver.full_name ?? '',
        header: () => t('tasks.columns.driver'),
        meta: { label: t('tasks.columns.driver'), csv: (row) => primaryAssignment(row)?.driver.full_name ?? '' },
        cell: ({ row }) => {
          const a = primaryAssignment(row.original);
          return a ? (
            <span className="flex items-center gap-2 whitespace-nowrap">
              <DriverAvatar name={a.driver.full_name} className="size-6 text-[10px]" />
              {name(a.driver, 'full_name')}
            </span>
          ) : (
            <span className="font-semibold text-warning-fg">{t('tasks.unassigned')}</span>
          );
        },
      },
      {
        id: 'flight',
        accessorFn: (row) => row.flight?.flight_no ?? '',
        header: () => t('tasks.columns.flight'),
        meta: { label: t('tasks.columns.flight'), csv: (row) => row.flight?.flight_no ?? '' },
        cell: ({ row }) => (row.original.flight ? <span className="whitespace-nowrap font-semibold">{row.original.flight.flight_no}</span> : <span className="text-fg-3">—</span>),
      },
      {
        id: 'status',
        accessorFn: (row) => row.status,
        header: () => t('tasks.columns.status'),
        meta: { label: t('tasks.columns.status'), csv: (row) => row.status },
        cell: ({ row }) => <StatusPill status={row.original.status} />,
      },
      {
        id: 'conflicts',
        accessorFn: (row) => row.conflicts.length,
        header: () => t('tasks.columns.conflicts'),
        meta: { label: t('tasks.columns.conflicts'), csv: (row) => row.conflicts.length },
        cell: ({ row }) => <ConflictBadge conflicts={row.original.conflicts} />,
      },
    ],
    [t, name],
  );

  return (
    <Page>
      <PageHeader title={t('tasks.title')} description={t('tasks.subtitle')} />
      <Panel>
        {tasks.isError ? (
          <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} />
        ) : (
          <DataTable
            columns={columns}
            data={tasks.data ?? []}
            loading={tasks.isPending}
            getRowId={(row) => row.id}
            onRowClick={(row) => openTask(row.id)}
            csvFilename="masar-tasks.csv"
            toolbar={
              <>
                <form
                  className="relative w-full sm:w-56"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const value = new FormData(event.currentTarget).get('q');
                    setSearch({ q: typeof value === 'string' && value.trim() ? value.trim() : undefined });
                  }}
                >
                  <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-fg-3" aria-hidden="true" />
                  <Input key={search.q} name="q" defaultValue={search.q} placeholder={t('common.search')} aria-label={t('common.search')} className="h-9 ps-9" />
                </form>
                <Select value={range} onValueChange={(v) => setSearch({ range: v === 'week' ? undefined : (v as Range) })}>
                  <SelectTrigger className="h-9 w-36" aria-label={t('tasks.filters.date')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RANGES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {t(`tasks.ranges.${r}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={search.category ?? ALL} onValueChange={(v) => setSearch({ category: v === ALL ? undefined : (v as TaskCategory) })}>
                  <SelectTrigger className="h-9 w-40" aria-label={t('tasks.filters.category')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t('tasks.filters.allCategories')}</SelectItem>
                    {TASK_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {t(`tasks.category.${c}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={search.status ?? ALL} onValueChange={(v) => setSearch({ status: v === ALL ? undefined : (v as TaskStatus) })}>
                  <SelectTrigger className="h-9 w-36" aria-label={t('tasks.filters.status')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t('tasks.filters.allStatuses')}</SelectItem>
                    {TASK_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`tasks.status.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={search.driver ?? ALL} onValueChange={(v) => setSearch({ driver: v === ALL ? undefined : v })}>
                  <SelectTrigger className="h-9 w-40" aria-label={t('tasks.filters.driver')}>
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
                {filtered && (
                  <Button variant="ghost" size="sm" onClick={() => void navigate({ search: {} })}>
                    {t('tasks.filters.clear')}
                  </Button>
                )}
              </>
            }
            empty={
              <EmptyState
                icon={ListX}
                title={filtered ? t('tasks.emptyFiltered') : t('tasks.empty')}
                body={filtered ? t('tasks.emptyFilteredBody') : t('tasks.emptyBody')}
                action={
                  filtered ? (
                    <Button variant="outline" size="sm" onClick={() => void navigate({ search: {} })}>
                      {t('tasks.filters.clear')}
                    </Button>
                  ) : undefined
                }
              />
            }
          />
        )}
      </Panel>
    </Page>
  );
}
