import { useMemo } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { CalendarX2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { FormError } from '@/components/form';
import { useOpenTask } from '@/components/layout/task-sheet-context';
import { Page, Panel } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { ResourceCalendar, rowsFromTasks, type CalendarMove } from '@/components/resource-calendar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { isStaff } from '@/features/auth/guards';
import { useCurrentUser } from '@/features/auth/session';
import { useDrivers } from '@/features/drivers/queries';
import { useScopedSiteIds } from '@/features/sites/site-scope';
import { useRescheduleTask, useTasks } from '@/features/tasks/queries';
import { EDITABLE_STATUSES, sharedHostId, type TaskWithRelations } from '@/features/tasks/types';
import { at, dateKey } from '@/mocks/fixtures';
import { formatDate, formatTime, formatWeekday } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';
import { CATEGORY_ICON, categoryColorVar, TASK_CATEGORIES, type TaskCategory } from '@/lib/task-meta';
import { cn, tone } from '@/lib/utils';

type View = 'day' | 'week';

export const Route = createFileRoute('/(admin)/calendar')({
  validateSearch: (search: Record<string, unknown>): { day?: number; view?: View; cat?: TaskCategory } => ({
    day: typeof search.day === 'number' && Number.isInteger(search.day) ? search.day : undefined,
    view: search.view === 'week' ? 'week' : undefined,
    cat: TASK_CATEGORIES.includes(search.cat as TaskCategory) ? (search.cat as TaskCategory) : undefined,
  }),
  component: CalendarPage,
});

/** Screen 4 — resource view by driver with site filter (FR-42). */
function CalendarPage() {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const openTask = useOpenTask();
  const navigate = useNavigate({ from: Route.fullPath });
  const { day = 0, view = 'day', cat } = Route.useSearch();
  const siteIds = useScopedSiteIds();
  const span = view === 'week' ? 7 : 1;
  const tasks = useTasks({ from: at(day, '00:00'), to: at(day + span, '00:00'), siteIds, categories: cat ? [cat] : undefined });
  const drivers = useDrivers(siteIds);
  const user = useCurrentUser();
  const reschedule = useRescheduleTask();
  const staff = isStaff(user.profile.role);
  // US-14: open work moves; a shared rider follows its host instead
  const canMove = (task: TaskWithRelations) => staff && EDITABLE_STATUSES.includes(task.status) && !sharedHostId(task);
  const move = (m: CalendarMove) =>
    reschedule.mutate({ taskId: m.taskId, start: m.start, changeDriver: m.driverId !== undefined, driverId: m.driverId ?? null });

  const rows = useMemo(
    () =>
      rowsFromTasks(
        tasks.data ?? [],
        (drivers.data ?? []).map((d) => ({ ...d, subtitle: d.homeSite ? name(d.homeSite) : undefined })),
        t('tasks.unassigned'),
      ),
    [tasks.data, drivers.data, name, t],
  );

  const setSearch = (next: { day?: number; view?: View; cat?: TaskCategory | undefined }) =>
    void navigate({ search: (prev) => ({ ...prev, ...next }) });

  const rangeLabel =
    view === 'week'
      ? `${formatDate(at(day, '12:00'), 'short')} – ${formatDate(at(day + 6, '12:00'), 'short')}`
      : formatDate(at(day, '12:00'), 'long');

  return (
    <Page>
      <PageHeader
        title={t('nav.calendar')}
        description={rangeLabel}
        actions={
          <>
            <div className="inline-flex rounded-md border border-border bg-surface-2 p-0.5" role="group" aria-label={t('calendar.view')}>
              {(['day', 'week'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setSearch({ view: v === 'day' ? undefined : v })}
                  className={cn('rounded px-3 py-1 text-sm font-semibold text-fg-2', view === v && 'bg-surface text-fg shadow-sm')}
                >
                  {t(`calendar.${v}`)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="size-9" onClick={() => setSearch({ day: day - span })} aria-label={t('calendar.previous')}>
                <ChevronLeft className="rtl:-scale-x-100" aria-hidden="true" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSearch({ day: undefined })} disabled={day === 0}>
                {t('calendar.today')}
              </Button>
              <Button variant="outline" size="icon" className="size-9" onClick={() => setSearch({ day: day + span })} aria-label={t('calendar.next')}>
                <ChevronRight className="rtl:-scale-x-100" aria-hidden="true" />
              </Button>
            </div>
          </>
        }
      />

      <div className="flex flex-wrap gap-2" role="group" aria-label={t('tasks.filters.category')}>
        <button
          type="button"
          aria-pressed={!cat}
          onClick={() => setSearch({ cat: undefined })}
          className={cn('rounded-full border px-3 py-1 text-xs font-bold', !cat ? 'border-brand-500 bg-brand-500 text-fg-on-brand' : 'border-border bg-surface text-fg-2')}
        >
          {t('common.all')}
        </button>
        {TASK_CATEGORIES.map((c) => {
          const Icon = CATEGORY_ICON[c];
          return (
            <button
              key={c}
              type="button"
              aria-pressed={cat === c}
              onClick={() => setSearch({ cat: cat === c ? undefined : c })}
              className={cn('tone-text inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold', cat === c ? 'tone-pill border-transparent' : 'border-border bg-surface')}
              style={tone(categoryColorVar(c))}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {t(`tasks.category.${c}`)}
            </button>
          );
        })}
      </div>

      {reschedule.isError && (
        <div className="flex items-start gap-2">
          <FormError error={reschedule.error} className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => reschedule.reset()}>
            {t('common.close')}
          </Button>
        </div>
      )}

      <Panel className={cn(reschedule.isPending && 'pointer-events-none opacity-70')}>
        {tasks.isError ? (
          <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} />
        ) : tasks.isPending || drivers.isPending ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : !tasks.data.length ? (
          <EmptyState icon={CalendarX2} title={t('calendar.empty')} body={t('calendar.emptyBody')} />
        ) : view === 'day' ? (
          <ResourceCalendar rows={rows} day={dateKey(day)} onOpenTask={openTask} onMove={staff ? move : undefined} canMove={canMove} />
        ) : (
          <WeekGrid rows={rows} startDay={day} onOpenTask={openTask} />
        )}
      </Panel>
    </Page>
  );
}

function WeekGrid({ rows, startDay, onOpenTask }: { rows: ReturnType<typeof rowsFromTasks>; startDay: number; onOpenTask: (id: string) => void }) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const days = Array.from({ length: 7 }, (_, i) => startDay + i);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="eyebrow w-44 px-4 py-2.5 text-start">{t('calendar.driver')}</th>
            {days.map((d) => (
              <th key={d} className={cn('border-s border-border px-2 py-2.5 text-start text-xs font-semibold text-fg-2', d === 0 && 'text-brand-500')}>
                {formatWeekday(at(d, '12:00'))} <span className="tabular">{formatDate(at(d, '12:00'), 'short')}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border last:border-0">
              <td className={cn('px-4 py-2 font-semibold', row.id === 'unassigned' && 'text-warning-fg')}>
                {row.name_ar !== undefined ? name({ full_name: row.name, full_name_ar: row.name_ar }, 'full_name') : row.name}
              </td>
              {days.map((d) => {
                const dayTasks = row.tasks.filter((task) => task.scheduled_start >= at(d, '00:00') && task.scheduled_start < at(d + 1, '00:00'));
                return (
                  <td key={d} className="h-16 border-s border-border p-1 align-top">
                    <div className="flex flex-col gap-1">
                      {dayTasks.map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => onOpenTask(task.id)}
                          className={cn('tone-block truncate rounded px-1.5 py-0.5 text-start text-[11px] font-semibold', task.conflicts.some((c) => c.severity === 'blocking') && 'shadow-[inset_0_0_0_2px_var(--danger)]')}
                          style={tone(categoryColorVar(task.category))}
                          title={task.title}
                        >
                          <span className="tabular">{formatTime(task.scheduled_start)}</span> {task.title}
                        </button>
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
