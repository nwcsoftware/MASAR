import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, FileQuestion, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NextTaskHero } from '@/components/driver/next-task-hero';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { StatusPill } from '@/components/status-pill';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTask } from '@/features/tasks/queries';
import { formatTimeRange } from '@/lib/format';
import { TERMINAL_STATUSES } from '@/lib/task-meta';

export const Route = createFileRoute('/(driver)/driver/tasks/$taskId')({
  component: DriverTaskDetail,
});

type Passenger = { name?: string; phone?: string; note?: string };

/** Screen 12b — driver task detail: stops + Open in Maps, passengers tap-to-call, flight (FR-31). */
function DriverTaskDetail() {
  const { t } = useTranslation();
  const { taskId } = Route.useParams();
  const query = useTask(taskId);
  const task = query.data;
  const passengers = (task && Array.isArray(task.passengers) ? task.passengers : []) as Passenger[];

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ms-2">
        <Link to="/driver">
          <ArrowLeft className="rtl:-scale-x-100" aria-hidden="true" />
          {t('driver.today')}
        </Link>
      </Button>

      {query.isPending ? (
        <Skeleton className="h-80 rounded-lg" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : !task ? (
        <EmptyState icon={FileQuestion} title={t('taskDetail.notFound')} />
      ) : (
        <>
          {TERMINAL_STATUSES.includes(task.status) ? (
            <div className="rounded-lg border border-border bg-surface p-4">
              <StatusPill status={task.status} />
              <h1 className="mt-2 text-lg font-extrabold">{task.title}</h1>
              <p className="tabular text-sm text-fg-2">{formatTimeRange(task.actual_start_at ?? task.scheduled_start, task.actual_end_at ?? task.scheduled_end)}</p>
            </div>
          ) : (
            <NextTaskHero task={task} />
          )}

          {passengers.length > 0 && (
            <section className="space-y-2">
              <h2 className="eyebrow">{t('taskDetail.passengers')}</h2>
              <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
                {passengers.map((p, i) => (
                  <li key={i} className="flex min-h-touch items-center justify-between gap-3 px-4 py-2">
                    <span className="font-semibold">{p.name}</span>
                    {p.phone && (
                      <Button asChild size="sm" variant="outline">
                        <a href={`tel:${p.phone.replace(/\s/g, '')}`}>
                          <Phone aria-hidden="true" />
                          {t('driver.call')}
                        </a>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {task.completion_notes && (
            <section className="space-y-1">
              <h2 className="eyebrow">{t('driver.complete.notes')}</h2>
              <p className="text-sm text-fg-2">{task.completion_notes}</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
