import { useTranslation } from 'react-i18next';
import { CalendarClock, Car, ExternalLink, FileText, MapPin, Paperclip, Phone, Plane, UserRound } from 'lucide-react';
import { CategoryBadge } from '@/components/category-badge';
import { ConflictAlert } from '@/components/conflict-alert';
import { ConflictBadge } from '@/components/conflict-badge';
import { DriverAvatar } from '@/components/driver-avatar';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { StatusPill } from '@/components/status-pill';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isAdmin, isStaff } from '@/features/auth/guards';
import { useCurrentUser } from '@/features/auth/session';
import { useTask } from '@/features/tasks/queries';
import { primaryAssignment, type TaskDetail } from '@/features/tasks/types';
import { formatDate, formatDateTime, formatNumber, formatTime, formatTimeRange } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';
import { mapsLink } from '@/lib/maps';
import { categoryColorVar, statusColorVar } from '@/lib/task-meta';
import { cn, tone } from '@/lib/utils';

type Passenger = { name?: string; phone?: string; note?: string };

function Field({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-fg-3" aria-hidden="true" />
      <div className="min-w-0">
        <div className="eyebrow">{label}</div>
        <div className="text-sm text-fg">{children}</div>
      </div>
    </div>
  );
}

function DetailsTab({ task }: { task: TaskDetail }) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const assignment = primaryAssignment(task);
  const passengers = (Array.isArray(task.passengers) ? task.passengers : []) as Passenger[];

  return (
    <div className="space-y-5">
      {task.description && <p className="text-sm text-fg-2">{task.description}</p>}

      {task.flight && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-surface-2 px-3 py-2.5 text-sm">
          <Plane className="size-4 text-cat-airport" aria-hidden="true" />
          <span className="font-bold">{task.flight.flight_no}</span>
          <span className="text-fg-2">
            {task.flight.airline} · {t(`flight.${task.flight.direction}`)} · {task.flight.airport?.iata}
            {task.flight.terminal ? ` T${task.flight.terminal}` : ''}
          </span>
          <span className="tabular text-fg-2">{t('flight.scheduled', { time: formatTime(task.flight.scheduled_time) })}</span>
          {task.flight.estimated_time && task.flight.estimated_time !== task.flight.scheduled_time && (
            <span className="tabular ms-auto font-bold text-delayed-fg">
              {t('flight.estimated', { time: formatTime(task.flight.estimated_time) })}
            </span>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field icon={CalendarClock} label={t('taskDetail.scheduled')}>
          <span className="tabular">
            {formatDate(task.scheduled_start, 'short')} · {formatTimeRange(task.scheduled_start, task.scheduled_end)}
          </span>
        </Field>
        <Field icon={CalendarClock} label={t('taskDetail.actual')}>
          <span className="tabular">
            {task.actual_start_at ? formatTimeRange(task.actual_start_at, task.actual_end_at) : '—'}
          </span>
        </Field>
        <Field icon={UserRound} label={t('taskDetail.driver')}>
          {assignment ? (
            <span className="flex items-center gap-2">
              <DriverAvatar name={assignment.driver.full_name} className="size-6" />
              {name(assignment.driver, 'full_name')}
              {assignment.acknowledged_at ? (
                <span className="text-xs font-semibold text-success-fg">✓ {t('taskDetail.acknowledged')}</span>
              ) : (
                <span className="text-xs font-semibold text-warning-fg">{t('taskDetail.notAcknowledged')}</span>
              )}
            </span>
          ) : (
            <span className="font-semibold text-warning-fg">{t('tasks.unassigned')}</span>
          )}
        </Field>
        <Field icon={Car} label={t('taskDetail.vehicle')}>
          {assignment?.vehicle ? `${assignment.vehicle.make} ${assignment.vehicle.model} · ${assignment.vehicle.plate_no}` : '—'}
        </Field>
        <Field icon={MapPin} label={t('taskDetail.distance')}>
          <span className="tabular">
            {task.estimated_distance_km != null ? t('units.km', { value: formatNumber(Number(task.estimated_distance_km)) }) : '—'}
            {task.actual_distance_km != null && ` · ${t('taskDetail.actualKm', { value: formatNumber(Number(task.actual_distance_km)) })}`}
          </span>
        </Field>
        <Field icon={MapPin} label={t('taskDetail.site')}>
          {name(task.site)}
        </Field>
      </div>

      {passengers.length > 0 && (
        <div className="space-y-2">
          <div className="eyebrow">{t('taskDetail.passengers')}</div>
          <ul className="divide-y divide-border rounded-md border border-border">
            {passengers.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="font-semibold">{p.name}</span>
                {p.phone && (
                  <a href={`tel:${p.phone.replace(/\s/g, '')}`} className="tabular inline-flex items-center gap-1 text-brand-500 hover:underline" dir="ltr">
                    <Phone className="size-3.5" aria-hidden="true" />
                    {p.phone}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StopsTab({ task }: { task: TaskDetail }) {
  const { t } = useTranslation();
  if (!task.stops.length) return <EmptyState compact icon={MapPin} title={t('taskDetail.noStops')} />;
  return (
    <ol className="relative space-y-4 before:absolute before:inset-y-2 before:start-[7px] before:w-0.5 before:bg-border">
      {task.stops.map((stop, i) => (
        <li key={stop.id} className="relative grid grid-cols-[16px_1fr_auto] items-start gap-3">
          <span
            className={cn('mt-1 size-4 rounded-full border-2 border-[var(--tone)]', i === task.stops.length - 1 ? 'tone-dot' : 'bg-surface')}
            style={tone(categoryColorVar(task.category))}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fg">{stop.label}</p>
            <p className="text-xs text-fg-2">
              {stop.address}
              {stop.leg_distance_km != null &&
                ` · ${t('units.km', { value: formatNumber(Number(stop.leg_distance_km)) })} · ${t('units.minutes', { value: stop.leg_duration_min })}`}
              {stop.dwell_min > 0 && ` · ${t('taskDetail.dwell', { value: stop.dwell_min })}`}
            </p>
            <a href={mapsLink(stop.lat, stop.lng, stop.label)} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-500 hover:underline">
              {t('driver.openInMaps')}
              <ExternalLink className="size-3 rtl:-scale-x-100" aria-hidden="true" />
            </a>
          </div>
          <span className="tabular text-xs text-fg-3">{stop.planned_arrival_at ? formatTime(stop.planned_arrival_at) : ''}</span>
        </li>
      ))}
    </ol>
  );
}

function TimelineTab({ task }: { task: TaskDetail }) {
  const { t } = useTranslation();
  if (!task.events.length) return <EmptyState compact icon={CalendarClock} title={t('taskDetail.noEvents')} />;
  return (
    <ol className="space-y-3">
      {task.events.map((event) => (
        <li key={event.id} className="flex items-start gap-3">
          <span
            className="tone-dot mt-1.5 size-2.5 shrink-0 rounded-full"
            style={tone(event.to_status ? statusColorVar(event.to_status) : 'var(--text-3)')}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-fg">{t(`events.${event.type}`)}</p>
            {event.from_status && event.to_status && (
              <p className="text-xs text-fg-2">
                {t(`tasks.status.${event.from_status}`)} <span className="inline-block rtl:-scale-x-100">→</span> {t(`tasks.status.${event.to_status}`)}
              </p>
            )}
          </div>
          <span className="tabular shrink-0 text-xs text-fg-3">{formatDateTime(event.created_at)}</span>
        </li>
      ))}
    </ol>
  );
}

function DelaysTab({ task }: { task: TaskDetail }) {
  const { t } = useTranslation();
  if (!task.delays.length) return <EmptyState compact icon={CalendarClock} title={t('taskDetail.noDelays')} />;
  return (
    <ul className="space-y-2">
      {task.delays.map((delay) => (
        <li key={delay.id} className="rounded-md border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-fg">{t(`delay.reason.${delay.reason}`)}</span>
            <StatusPill status={delay.resolved_at ? 'completed' : 'delayed'} label={delay.resolved_at ? t('delay.resolved') : t('delay.open')} />
          </div>
          <p className="tabular mt-1 text-xs text-fg-2">
            {delay.delay_min != null && `+${t('units.minutes', { value: delay.delay_min })} · `}
            {formatDateTime(delay.created_at)}
          </p>
          {delay.note && <p className="mt-1 text-sm text-fg-2">{delay.note}</p>}
        </li>
      ))}
    </ul>
  );
}

function AttachmentsTab({ task }: { task: TaskDetail }) {
  const { t } = useTranslation();
  if (!task.attachments.length)
    return <EmptyState compact icon={Paperclip} title={t('taskDetail.noAttachments')} body={t('taskDetail.noAttachmentsBody')} />;
  return (
    <ul className="grid grid-cols-2 gap-3">
      {task.attachments.map((a) => (
        <li key={a.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
          <div className="grid aspect-video place-items-center rounded bg-surface-2 text-fg-3">
            <FileText className="size-6" aria-hidden="true" />
          </div>
          <span className="truncate text-xs font-semibold">{a.caption ?? a.storage_path.split('/').at(-1)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Screen 7 — task detail slide-over (docs/DESIGN.md §6). */
export function TaskDetailSheet({ taskId, onClose }: { taskId: string | undefined; onClose: () => void }) {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const query = useTask(taskId);
  const task = query.data;
  const staff = isStaff(user.profile.role);

  return (
    <Sheet open={Boolean(taskId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-xl">
        {query.isPending ? (
          <div className="space-y-4 p-5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : query.isError ? (
          <>
            <SheetTitle className="sr-only">{t('errors.generic')}</SheetTitle>
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          </>
        ) : !task ? (
          <>
            <SheetTitle className="sr-only">{t('taskDetail.notFound')}</SheetTitle>
            <EmptyState icon={FileText} title={t('taskDetail.notFound')} />
          </>
        ) : (
          <>
            <SheetHeader className="border-b border-border">
              <div className="flex flex-wrap items-center gap-2">
                <CategoryBadge category={task.category} />
                <StatusPill status={task.status} />
                <ConflictBadge conflicts={task.conflicts} />
              </div>
              <SheetTitle>{task.title}</SheetTitle>
              <SheetDescription className="tabular">
                {formatDate(task.scheduled_start, 'long')} · {formatTimeRange(task.scheduled_start, task.scheduled_end)}
              </SheetDescription>
              {staff && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" disabled title={t('common.comingSoon')}>
                    {primaryAssignment(task) ? t('taskDetail.reassign') : t('taskDetail.assign')}
                  </Button>
                  <Button size="sm" variant="outline" disabled title={t('common.comingSoon')}>
                    {t('taskDetail.edit')}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-danger" disabled title={t('common.comingSoon')}>
                    {t('taskDetail.cancelTask')}
                  </Button>
                </div>
              )}
            </SheetHeader>
            <Tabs defaultValue="details" className="flex min-h-0 flex-1 flex-col">
              <TabsList className="w-full justify-start overflow-x-auto px-3">
                <TabsTrigger value="details">{t('taskDetail.tabs.details')}</TabsTrigger>
                <TabsTrigger value="stops">
                  {t('taskDetail.tabs.stops')} <span className="tabular text-fg-3">{task.stops.length}</span>
                </TabsTrigger>
                <TabsTrigger value="timeline">{t('taskDetail.tabs.timeline')}</TabsTrigger>
                <TabsTrigger value="delays">
                  {t('taskDetail.tabs.delays')} {task.delays.length > 0 && <span className="tabular text-fg-3">{task.delays.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="attachments">{t('taskDetail.tabs.attachments')}</TabsTrigger>
                <TabsTrigger value="conflicts">
                  {t('taskDetail.tabs.conflicts')}
                  {task.conflicts.length > 0 && <ConflictBadge conflicts={task.conflicts} variant="corner" />}
                </TabsTrigger>
              </TabsList>
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <TabsContent value="details" className="mt-0">
                  <DetailsTab task={task} />
                </TabsContent>
                <TabsContent value="stops" className="mt-0">
                  <StopsTab task={task} />
                </TabsContent>
                <TabsContent value="timeline" className="mt-0">
                  <TimelineTab task={task} />
                </TabsContent>
                <TabsContent value="delays" className="mt-0">
                  <DelaysTab task={task} />
                </TabsContent>
                <TabsContent value="attachments" className="mt-0">
                  <AttachmentsTab task={task} />
                </TabsContent>
                <TabsContent value="conflicts" className="mt-0">
                  {task.conflicts.length ? (
                    <ConflictAlert conflicts={task.conflicts} canOverride={isAdmin(user.profile.role)} />
                  ) : (
                    <EmptyState compact icon={FileText} title={t('taskDetail.noConflicts')} />
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
