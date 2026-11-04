import { createFileRoute } from '@tanstack/react-router';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { HoursChart } from '@/components/hours-chart';
import { KpiTile } from '@/components/kpi-tile';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/features/auth/session';
import { useCompanySettings } from '@/features/company/queries';
import { useMyDaySummaries } from '@/features/reports/queries';
import { dateKey } from '@/mocks/fixtures';
import { formatHours, formatNumber } from '@/lib/format';

export const Route = createFileRoute('/(driver)/driver/hours')({
  component: DriverHours,
});

/** Screen 12d — personal hours: today / this week — driving, working, overtime, km (FR-35). */
function DriverHours() {
  const { t } = useTranslation();
  const { driverId } = useCurrentUser();
  const settings = useCompanySettings();
  const summaries = useMyDaySummaries(driverId, dateKey(-13), dateKey(0));
  const rows = summaries.data ?? [];
  const today = rows.find((s) => s.date === dateKey(0));
  const week = rows.filter((s) => s.date >= dateKey(-6));
  const total = (key: 'driving_min' | 'working_min' | 'overtime_min') => week.reduce((n, s) => n + s[key], 0);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold">{t('driver.tabs.hours')}</h1>
      {summaries.isPending ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : summaries.isError ? (
        <ErrorState error={summaries.error} onRetry={() => void summaries.refetch()} />
      ) : !rows.length ? (
        <EmptyState icon={Clock} title={t('driver.hoursEmpty')} />
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="eyebrow">{t('driver.today')}</h2>
            <div className="grid grid-cols-2 gap-3">
              <KpiTile label={t('hours.driving')} value={`${t('units.hours', { value: formatHours(today?.driving_min ?? 0) })}`} />
              <KpiTile label={t('hours.distance')} value={t('units.km', { value: formatNumber(Number(today?.distance_km ?? 0), 0) })} />
            </div>
          </section>
          <section className="space-y-2">
            <h2 className="eyebrow">{t('driver.last7')}</h2>
            <div className="grid grid-cols-3 gap-3">
              <KpiTile label={t('hours.driving')} value={formatHours(total('driving_min'))} />
              <KpiTile label={t('hours.working')} value={formatHours(total('working_min'))} />
              <KpiTile label={t('hours.overtime')} value={formatHours(total('overtime_min'))} tone={total('overtime_min') ? 'danger' : 'default'} />
            </div>
          </section>
          <section className="rounded-lg border border-border bg-surface p-4 pt-6">
            <HoursChart standardMin={settings.data?.standard_day_min ?? 480} points={rows.map((s) => ({ date: s.date, drivingMin: s.driving_min, overtimeMin: s.overtime_min }))} height={140} />
          </section>
        </>
      )}
    </div>
  );
}
