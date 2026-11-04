import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, Car, ExternalLink, FileText, Link2, MapPin, Phone, Plane, UserRound } from 'lucide-react';
import { CategoryBadge } from '@/components/category-badge';
import { ConflictAlert, OverrideForm, OverriddenNote } from '@/components/conflict-alert';
import { ConflictBadge } from '@/components/conflict-badge';
import { DriverAvatar } from '@/components/driver-avatar';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Field as FormField, FormError } from '@/components/form';
import { useOpenTask } from '@/components/layout/task-sheet-context';
import { useOpenWizard } from '@/components/layout/task-wizard-context';
import { GradeBadge } from '@/components/grade-badge';
import { ShareTripHint } from '@/components/share-trip-hint';
import { TripDocumentsTab } from '@/components/trip-documents-tab';
import { StatusPill } from '@/components/status-pill';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { isAdmin, isStaff } from '@/features/auth/guards';
import { canShareWith, readPassengers } from '@/features/grades/rules';
import { useCurrentUser } from '@/features/auth/session';
import { useOverrideConflicts, useShareTrip, useSimilarAirportTrips, useTask, useTaskTransition } from '@/features/tasks/queries';
import { EDITABLE_STATUSES, primaryAssignment, sharedHostId, type TaskDetail } from '@/features/tasks/types';
import { readTicketMeta } from '@/features/tasks/ticket';
import { formatDate, formatDateTime, formatNumber, formatTime, formatTimeRange, isolate } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';
import { mapsLink } from '@/lib/maps';
import { categoryColorVar, statusColorVar, TERMINAL_STATUSES } from '@/lib/task-meta';
import { cn, tone } from '@/lib/utils';


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

/** FR-15: this task rides in another site's car. */
function SharedRideNote({ hostId }: { hostId: string }) {
  const { t } = useTranslation();
  const openTask = useOpenTask();
  const host = useTask(hostId);
  const driver = host.data ? primaryAssignment(host.data)?.driver : null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[color-mix(in_srgb,var(--brand-500)_30%,var(--border))] bg-[color-mix(in_srgb,var(--brand-500)_8%,var(--surface))] px-4 py-3">
      <Link2 className="size-5 shrink-0 text-brand-500" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm text-fg">
        {host.data
          ? t('share.ridesWith', { title: isolate(host.data.title), driver: isolate(driver?.full_name ?? t('tasks.unassigned')) })
          : t('common.loading')}
      </p>
      <Button size="sm" variant="outline" onClick={() => openTask(hostId)}>
        {t('share.openHost')}
      </Button>
    </div>
  );
}

/** FR-15 / US-04 on an unassigned airport task: offer another site's trip. */
function ShareHintForTask({ task }: { task: TaskDetail }) {
  const similar = useSimilarAirportTrips(task);
  const share = useShareTrip();
  const groups = [...new Set(readPassengers(task.passengers).flatMap((p) => (p.group_code ? [p.group_code] : [])))];
  const trip = similar.data?.find((s) => s.site_id !== task.site_id && canShareWith(groups, s));
  if (!trip) return null;
  return (
    <div className="space-y-2">
      <ShareTripHint
        trip={trip}
        flightNo={task.flight?.flight_no ?? null}
        airportCode={task.flight?.airport?.iata ?? ''}
        onShare={share.isPending ? undefined : () => share.mutate({ taskId: task.id, hostTaskId: trip.task_id })}
      />
      <FormError error={share.error} />
    </div>
  );
}

function DetailsTab({ task, staff }: { task: TaskDetail; staff: boolean }) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const assignment = primaryAssignment(task);
  const passengers = readPassengers(task.passengers);
  const hostId = sharedHostId(task);
  const ticket = readTicketMeta(task.metadata);

  return (
    <div className="space-y-5">
      {hostId && <SharedRideNote hostId={hostId} />}
      {!hostId && staff && task.category === 'airport' && !assignment && EDITABLE_STATUSES.includes(task.status) && <ShareHintForTask task={task} />}
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
          {ticket && (ticket.other?.iata || ticket.booking_ref) && (
            <span className="tabular basis-full text-xs text-fg-2">
              {[
                ticket.other?.iata &&
                  t(task.flight.direction === 'arrival' ? 'flight.fromAt' : 'flight.toAt', {
                    iata: isolate(ticket.other.iata),
                    time: [ticket.other.date && formatDate(`${ticket.other.date}T12:00:00Z`, 'short'), ticket.other.time].filter(Boolean).join(' '),
                  }),
                ticket.booking_ref && t('ticketImport.bookingRef', { ref: isolate(ticket.booking_ref) }),
              ]
                .filter(Boolean)
                .join(' · ')}
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
          ) : hostId ? (
            <span className="font-semibold text-brand-500">{t('share.shared')}</span>
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
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-semibold" dir="auto">
                    {p.name}
                  </span>
                  <GradeBadge code={p.group_code} grade={p.grade} visitor={p.visitor} />
                </span>
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

/** Cancel with a reason (rpc_task_transition 'cancel', staff only). */
function CancelTaskButton({ task }: { task: TaskDetail }) {
  const { t } = useTranslation();
  const transition = useTaskTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  return (
    <>
      <Button size="sm" variant="ghost" className="text-danger" onClick={() => setOpen(true)}>
        {t('taskDetail.cancelTask')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) transition.reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('taskDetail.cancelTitle')}</DialogTitle>
            <DialogDescription>{t('taskDetail.cancelBody', { title: isolate(task.title) })}</DialogDescription>
          </DialogHeader>
          <FormField id="cancel-reason" label={t('taskDetail.cancelReason')}>
            <Textarea id="cancel-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </FormField>
          <FormError error={transition.error} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('taskDetail.keepTask')}
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim() || transition.isPending}
              onClick={() => transition.mutate({ taskId: task.id, action: 'cancel', payload: { reason: reason.trim() } }, { onSuccess: () => setOpen(false) })}
            >
              {t('taskDetail.cancelTask')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ConflictsTab({ task, admin }: { task: TaskDetail; admin: boolean }) {
  const { t } = useTranslation();
  const override = useOverrideConflicts();
  if (!task.conflicts.length) return <EmptyState compact icon={FileText} title={t('taskDetail.noConflicts')} />;
  const blocking = task.conflicts.some((c) => c.severity === 'blocking');
  return (
    <ConflictAlert conflicts={task.conflicts}>
      {task.conflicts_overridden && <OverriddenNote reason={task.override_reason} />}
      {admin && blocking && !task.conflicts_overridden && EDITABLE_STATUSES.includes(task.status) && (
        <OverrideForm id="override-reason" pending={override.isPending} error={override.error} onSubmit={(reason) => override.mutate({ taskId: task.id, reason })} />
      )}
    </ConflictAlert>
  );
}

/** Screen 7 — task detail slide-over (docs/DESIGN.md §6). */
export function TaskDetailSheet({ taskId, onClose }: { taskId: string | undefined; onClose: () => void }) {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const query = useTask(taskId);
  const task = query.data;
  const staff = isStaff(user.profile.role);
  const openWizard = useOpenWizard();

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
              {staff && !TERMINAL_STATUSES.includes(task.status) && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {EDITABLE_STATUSES.includes(task.status) && !sharedHostId(task) && (
                    <Button size="sm" onClick={() => openWizard({ taskId: task.id, step: 'assign' })}>
                      {primaryAssignment(task) ? t('taskDetail.reassign') : t('taskDetail.assign')}
                    </Button>
                  )}
                  {EDITABLE_STATUSES.includes(task.status) && (
                    <Button size="sm" variant="outline" onClick={() => openWizard({ taskId: task.id })}>
                      {t('taskDetail.edit')}
                    </Button>
                  )}
                  <CancelTaskButton task={task} />
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
                <TabsTrigger value="attachments">
                  {t('taskDetail.tabs.documents')} {task.attachments.length > 0 && <span className="tabular text-fg-3">{task.attachments.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="conflicts">
                  {t('taskDetail.tabs.conflicts')}
                  {task.conflicts.length > 0 && <ConflictBadge conflicts={task.conflicts} variant="corner" />}
                </TabsTrigger>
              </TabsList>
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <TabsContent value="details" className="mt-0">
                  <DetailsTab task={task} staff={staff} />
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
                  <TripDocumentsTab task={task} staff={staff} />
                </TabsContent>
                <TabsContent value="conflicts" className="mt-0">
                  <ConflictsTab task={task} admin={isAdmin(user.profile.role)} />
                </TabsContent>
              </div>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
