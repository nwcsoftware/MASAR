import { createFileRoute } from '@tanstack/react-router';
import { CalendarCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NextTaskHero } from '@/components/driver/next-task-hero';
import { TaskTimeline } from '@/components/driver/task-timeline';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/features/auth/session';
import { useMyTasks } from '@/features/tasks/driver';
import { formatHours, formatTime } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';
import { useDriver } from '@/features/drivers/queries';
import { useLocationSharing } from '@/features/drivers/location';
import { ACTIVE_STATUSES, TERMINAL_STATUSES } from '@/lib/task-meta';

export const Route = createFileRoute('/(driver)/driver/')({
  component: DriverToday,
});

/** Screen 12 — driver Home: sharing banner, next-task hero, today's timeline (FR-30). */
function DriverToday() {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const user = useCurrentUser();
  const tasks = useMyTasks(0, 1);
  const list = tasks.data ?? [];
  const live = list.filter((x) => !TERMINAL_STATUSES.includes(x.status));
  const hero = live.find((x) => ACTIVE_STATUSES.includes(x.status)) ?? live[0];
  const plannedMin = list.reduce((sum, x) => sum + (x.estimated_duration_min ?? 60), 0);
  const me = useDriver(user.driverId ?? '');
  // FR-33 sharing banner — the shell reports the position while a trip is under way
  const sharing = useLocationSharing();
  const lastPing = sharing.lastAt ?? me.data?.location?.recorded_at;
  const homeSite = me.data?.homeSite;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold">{t('driver.today')}</h1>
        <p className="text-sm text-fg-2">
          {name(user.profile, 'full_name')}
          {homeSite && ` · ${name(homeSite)}`}
        </p>
      </div>

      {sharing.taskId &&
        (sharing.state === 'denied' || sharing.state === 'unsupported' ? (
          <div role="alert" className="tone-pill rounded-lg px-3 py-2 text-xs font-bold [--tone:var(--status-delayed)]" data-sharing={sharing.state}>
            {t(sharing.state === 'denied' ? 'driver.sharingDenied' : 'driver.sharingUnsupported')}
          </div>
        ) : (
          <div role="status" className="tone-pill flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold [--tone:var(--status-in-progress)]" data-sharing={sharing.state}>
            <span className="tone-dot animate-pulse-ring size-2 rounded-full" aria-hidden="true" />
            {lastPing ? t('driver.sharing', { time: formatTime(lastPing) }) : t('driver.sharingStarting')}
          </div>
        ))}

      {tasks.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      ) : tasks.isError ? (
        <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} />
      ) : !hero ? (
        <EmptyState icon={CalendarCheck} title={list.length ? t('driver.allDone') : t('driver.noTasks')} body={list.length ? t('driver.allDoneBody') : t('driver.noTasksBody')} />
      ) : (
        <NextTaskHero task={hero} />
      )}

      {list.length > 0 && (
        <section className="space-y-2">
          <h2 className="eyebrow">{t('driver.timeline', { count: list.length, hours: formatHours(plannedMin) })}</h2>
          <TaskTimeline tasks={list} highlightId={hero?.id} />
        </section>
      )}
    </div>
  );
}
