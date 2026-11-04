import { useMemo } from 'react';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { MessageSquareWarning, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DriverAvatar } from '@/components/driver-avatar';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { KpiTile } from '@/components/kpi-tile';
import { Page, Panel } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { Stars } from '@/components/passenger/stars';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { isAdmin } from '@/features/auth/guards';
import { useDrivers } from '@/features/drivers/queries';
import { useRatingOptions, useRatings } from '@/features/passenger/queries';
import { usePeople } from '@/features/people/queries';
import { useTasks } from '@/features/tasks/queries';
import { formatDateTime, formatNumber } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';
import { at } from '@/mocks/fixtures';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/(admin)/ratings')({
  validateSearch: (search: Record<string, unknown>): { low?: boolean } => ({ low: search.low === true || search.low === 'true' ? true : undefined }),
  // §14: who rated whom is for owners/admins only
  beforeLoad: ({ context }) => {
    if (context.session.status === 'signed-in' && !isAdmin(context.session.user.profile.role)) throw redirect({ to: '/dashboard' });
  },
  component: RatingsPage,
});

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Passenger ratings (0006): per-driver scores, low-rating alerts, every rating with its passenger. */
function RatingsPage() {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const navigate = useNavigate({ from: Route.fullPath });
  const { low } = Route.useSearch();
  const ratings = useRatings();
  const options = useRatingOptions();
  const drivers = useDrivers();
  const people = usePeople();
  const tasks = useTasks({ from: at(-90, '00:00') });

  const data = ratings.data;
  const optionOf = (id: string) => options.data?.find((o) => o.id === id);
  const choicesOf = (ratingId: string) => (data?.choices ?? []).filter((c) => c.rating_id === ratingId).map((c) => optionOf(c.option_id)).filter(Boolean);

  const perDriver = useMemo(() => {
    if (!data) return [];
    return (drivers.data ?? [])
      .map((d) => {
        const mine = data.ratings.filter((r) => r.driver_id === d.id);
        const driving = mine
          .flatMap((r) => data.choices.filter((c) => c.rating_id === r.id))
          .map((c) => options.data?.find((o) => o.id === c.option_id))
          .filter((o) => o?.category === 'driving' && o.score != null)
          .map((o) => o!.score!);
        return { driver: d, count: mine.length, stars: avg(mine.map((r) => r.stars)), driving: avg(driving), low: mine.filter((r) => r.is_low).length };
      })
      .filter((x) => x.count > 0)
      .sort((a, b) => b.low - a.low || (a.stars ?? 5) - (b.stars ?? 5));
  }, [data, drivers.data, options.data]);

  if (ratings.isError) return <ErrorState error={ratings.error} onRetry={() => void ratings.refetch()} />;
  const loading = ratings.isPending || options.isPending || drivers.isPending;
  const list = (data?.ratings ?? []).filter((r) => !low || r.is_low);

  return (
    <Page>
      <PageHeader title={t('ratings.title')} description={t('ratings.subtitle')} />
      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiTile label={t('ratings.kpi.count')} value={String(data!.ratings.length)} />
            <KpiTile label={t('ratings.kpi.average')} value={avg(data!.ratings.map((r) => r.stars)) == null ? '—' : formatNumber(avg(data!.ratings.map((r) => r.stars))!)} />
            <KpiTile label={t('ratings.kpi.low')} value={String(data!.ratings.filter((r) => r.is_low).length)} tone={data!.ratings.some((r) => r.is_low) ? 'danger' : 'default'} />
            <KpiTile label={t('ratings.kpi.drivers')} value={String(perDriver.length)} />
          </div>

          <Panel title={t('ratings.byDriver')} bodyClassName="p-0">
            {!perDriver.length ? (
              <EmptyState compact icon={Star} title={t('ratings.empty')} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t('ratings.columns.driver')}</TableHead>
                    <TableHead>{t('ratings.columns.stars')}</TableHead>
                    <TableHead>{t('ratings.columns.driving')}</TableHead>
                    <TableHead>{t('ratings.columns.low')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perDriver.map((x) => (
                    <TableRow key={x.driver.id} className="cursor-pointer" onClick={() => void navigate({ to: '/drivers/$driverId', params: { driverId: x.driver.id } })}>
                      <TableCell>
                        <span className="flex items-center gap-2 font-semibold">
                          <DriverAvatar name={x.driver.full_name} className="size-7 text-[10px]" />
                          {name(x.driver, 'full_name')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Stars value={x.stars} count={x.count} />
                      </TableCell>
                      <TableCell>
                        <Stars value={x.driving} />
                      </TableCell>
                      <TableCell className={cn('tabular font-bold', x.low > 0 && 'text-danger')}>{x.low}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>

          <Panel
            title={t('ratings.recent')}
            action={
              <button
                type="button"
                aria-pressed={Boolean(low)}
                onClick={() => void navigate({ search: { low: low ? undefined : true } })}
                className={cn('rounded-full border px-3 py-1 text-xs font-bold', low ? 'border-danger bg-danger text-fg-on-brand' : 'border-border bg-surface text-fg-2')}
              >
                {t('ratings.lowOnly')}
              </button>
            }
            bodyClassName="p-0"
          >
            {!list.length ? (
              <EmptyState compact icon={MessageSquareWarning} title={low ? t('ratings.noLow') : t('ratings.empty')} />
            ) : (
              <ul className="divide-y divide-border">
                {list.map((r) => {
                  const person = people.data?.find((p) => p.id === r.person_id);
                  const driver = drivers.data?.find((d) => d.id === r.driver_id);
                  const task = tasks.data?.find((x) => x.id === r.task_id);
                  return (
                    <li key={r.id} className="space-y-1.5 px-4 py-3" data-rating={r.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Stars value={r.stars} />
                        {r.is_low && <Badge variant="danger">{t('ratings.lowBadge')}</Badge>}
                        <span className="ms-auto tabular text-xs text-fg-3">{formatDateTime(r.created_at)}</span>
                      </div>
                      <p className="text-sm text-fg">
                        <span className="font-semibold">{person ? name(person, 'full_name') : '—'}</span>
                        <span className="text-fg-3"> → </span>
                        {driver ? name(driver, 'full_name') : '—'}
                        {task && <span className="text-fg-3"> · {task.title}</span>}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {choicesOf(r.id).map((o) => (
                          <Badge key={o!.id} variant={o!.alerts ? 'danger' : undefined}>
                            {name({ label: o!.label, label_ar: o!.label_ar }, 'label')}
                          </Badge>
                        ))}
                      </div>
                      {r.comment && <p className="text-sm text-fg-2">“{r.comment}”</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </>
      )}
    </Page>
  );
}
