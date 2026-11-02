import { createFileRoute } from '@tanstack/react-router';
import { CalendarX2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TaskTimeline } from '@/components/driver/task-timeline';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyTasks } from '@/features/tasks/driver';
import { at } from '@/mocks/fixtures';
import { formatDate, formatWeekday } from '@/lib/format';

export const Route = createFileRoute('/(driver)/driver/week')({
  component: DriverWeek,
});

/** Screen 12c — the next 7 days (FR-35). */
function DriverWeek() {
  const { t } = useTranslation();
  const tasks = useMyTasks(0, 7);
  const days = Array.from({ length: 7 }, (_, i) => i);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold">{t('driver.tabs.week')}</h1>
      {tasks.isPending ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : tasks.isError ? (
        <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} />
      ) : !tasks.data.length ? (
        <EmptyState icon={CalendarX2} title={t('driver.weekEmpty')} />
      ) : (
        days.map((d) => {
          const dayTasks = tasks.data.filter((x) => x.scheduled_start >= at(d, '00:00') && x.scheduled_start < at(d + 1, '00:00'));
          return (
            <section key={d} className="space-y-1.5">
              <h2 className="flex items-baseline justify-between text-sm font-bold">
                <span>{d === 0 ? t('driver.today') : d === 1 ? t('driver.tomorrow') : formatWeekday(at(d, '12:00'), 'long')}</span>
                <span className="tabular text-xs font-medium text-fg-3">{formatDate(at(d, '12:00'), 'short')}</span>
              </h2>
              {dayTasks.length ? <TaskTimeline tasks={dayTasks} /> : <p className="text-sm text-fg-3">{t('driver.dayOff')}</p>}
            </section>
          );
        })
      )}
    </div>
  );
}
