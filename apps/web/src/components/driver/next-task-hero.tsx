import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Check, Clock, Map, Phone, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { actionLabelKey } from '@/components/driver/action-labels';
import { CompleteSheet } from '@/components/driver/complete-sheet';
import { DelaySheet } from '@/components/driver/delay-sheet';
import { StatusPill } from '@/components/status-pill';
import { Button } from '@/components/ui/button';
import { useTaskTransition } from '@/features/tasks/queries';
import { openDelay, type TaskWithRelations } from '@/features/tasks/types';
import { formatTime } from '@/lib/format';
import { mapsLink } from '@/lib/maps';
import { canReportDelay, CATEGORY_ICON, categoryColorVar, primaryDriverAction } from '@/lib/task-meta';
import { cn, tone } from '@/lib/utils';

type Passenger = { name?: string; phone?: string };

function useCountdown(target: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return Math.round((new Date(target).getTime() - now) / 60_000);
}

/**
 * docs/DESIGN.md §4.2 NEXT TASK hero — category tint, countdown, flight card,
 * stops, ONE full-width primary action (56 px) that changes with status;
 * Delayed is always one tap away.
 */
export function NextTaskHero({ task }: { task: TaskWithRelations }) {
  const { t } = useTranslation();
  const transition = useTaskTransition();
  const [delayOpen, setDelayOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const delay = openDelay(task);
  const action = primaryDriverAction(task.status, delay?.previous_status);
  const minutes = useCountdown(task.scheduled_start);
  const Icon = CATEGORY_ICON[task.category];
  const passengers = (Array.isArray(task.passengers) ? task.passengers : []) as Passenger[];
  const phone = passengers.find((p) => p.phone)?.phone;
  const destination = task.stops[1] ?? task.stops[0];
  const live = task.status === 'en_route' || task.status === 'in_progress' || task.status === 'delayed';

  const runPrimary = () => {
    if (!action) return;
    if (action === 'complete') {
      setCompleteOpen(true);
      return;
    }
    transition.mutate({ taskId: task.id, action });
  };

  return (
    <article className="rounded-lg border border-border border-s-[5px] bg-surface p-4 shadow-sm" style={tone(categoryColorVar(task.category), { borderInlineStartColor: 'var(--tone)' })}>
      <div className="flex items-center justify-between gap-2">
        <span className="tone-text inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide rtl:tracking-normal">
          <Icon className="size-3.5" aria-hidden="true" />
          {t(`tasks.category.${task.category}`)}
        </span>
        {delay?.delay_min ? (
          <StatusPill status="delayed" label={t('tasks.delayedBy', { minutes: delay.delay_min })} />
        ) : live ? (
          <StatusPill status={task.status} />
        ) : (
          <span className="tabular inline-flex items-center gap-1 text-xs font-bold text-fg-2">
            <Clock className="size-3.5" aria-hidden="true" />
            {minutes > 0 ? t('driver.startsIn', { minutes }) : t('driver.startedAgo', { time: formatTime(task.scheduled_start) })}
          </span>
        )}
      </div>

      <Link to="/driver/tasks/$taskId" params={{ taskId: task.id }} className="mt-2 block">
        <h2 className="text-lg font-extrabold leading-tight">{task.title}</h2>
        {task.description && <p className="mt-0.5 text-sm text-fg-2">{task.description}</p>}
      </Link>

      {task.flight && (
        <div className="mt-3 flex items-center gap-3 rounded-md bg-surface-2 px-3 py-2 text-sm">
          <b>{task.flight.flight_no}</b>
          <span className="tabular text-fg-2">{t('flight.scheduled', { time: formatTime(task.flight.scheduled_time) })}</span>
          {task.flight.estimated_time && task.flight.estimated_time !== task.flight.scheduled_time && (
            <span className="tabular ms-auto font-bold text-delayed-fg">{t('flight.now', { time: formatTime(task.flight.estimated_time) })}</span>
          )}
        </div>
      )}

      <ol className="my-3 space-y-2 text-sm">
        {task.stops.map((stop, i) => (
          <li key={stop.id} className="grid grid-cols-[14px_1fr_auto] items-center gap-2.5">
            <span className={cn('size-2.5 justify-self-center rounded-full border-2 border-[var(--tone)]', i === task.stops.length - 1 ? 'tone-dot' : 'bg-surface')} aria-hidden="true" />
            <span className="truncate">{stop.label}</span>
            <span className="tabular text-xs text-fg-3">{stop.planned_arrival_at ? formatTime(stop.planned_arrival_at) : ''}</span>
          </li>
        ))}
      </ol>

      {action && (
        <Button
          size="hero"
          className={cn('mt-1', action === 'complete' && 'bg-status-completed hover:bg-status-completed hover:opacity-90')}
          onClick={runPrimary}
          disabled={transition.isPending}
        >
          {action === 'start' ? <Play aria-hidden="true" /> : <Check aria-hidden="true" />}
          {t(actionLabelKey(action, task.category))}
        </Button>
      )}
      {transition.isError && <p className="mt-2 text-sm font-semibold text-danger">{transition.error.message}</p>}

      <div className="mt-2 grid grid-cols-3 gap-2">
        {task.status === 'delayed' ? (
          <Button variant="outline" className="h-11" onClick={() => transition.mutate({ taskId: task.id, action: 'resume' })}>
            {t('driver.actions.resume')}
          </Button>
        ) : (
          <Button variant="outline" className="h-11" onClick={() => setDelayOpen(true)} disabled={!canReportDelay(task.status)}>
            <Clock aria-hidden="true" />
            {t('driver.actions.delay')}
          </Button>
        )}
        <Button asChild variant="outline" className="h-11">
          <a href={destination ? mapsLink(destination.lat, destination.lng, destination.label) : '#'} target="_blank" rel="noreferrer">
            <Map aria-hidden="true" />
            {t('driver.maps')}
          </a>
        </Button>
        <Button asChild variant="outline" className="h-11" disabled={!phone}>
          <a href={phone ? `tel:${phone.replace(/\s/g, '')}` : undefined} aria-disabled={!phone}>
            <Phone aria-hidden="true" />
            {t('driver.call')}
          </a>
        </Button>
      </div>

      <DelaySheet task={task} open={delayOpen} onOpenChange={setDelayOpen} />
      <CompleteSheet task={task} open={completeOpen} onOpenChange={setCompleteOpen} />
    </article>
  );
}
