import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ConflictBadge } from '@/components/conflict-badge';
import { DriverAvatar } from '@/components/driver-avatar';
import { primaryAssignment, sharedHostId, type TaskWithRelations } from '@/features/tasks/types';
import { companyDateKey, companyMinutesOfDay, formatHours, formatTime, formatTimeRange } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';
import { categoryColorVar, DRIVER_STATUS_COLOR, TASK_CATEGORIES, type DriverStatus } from '@/lib/task-meta';
import { cn, tone } from '@/lib/utils';

export interface CalendarRow {
  id: string;
  name: string;
  name_ar?: string | null;
  subtitle?: string;
  status?: DriverStatus;
  tasks: TaskWithRelations[];
}

/** Build one row per driver plus an "Unassigned" row (FR-42 resource view). */
export function rowsFromTasks(
  tasks: TaskWithRelations[],
  drivers: { id: string; full_name: string; full_name_ar: string | null; current_status: DriverStatus; subtitle?: string }[],
  unassignedLabel: string,
): CalendarRow[] {
  const rows: CalendarRow[] = drivers.map((d) => ({
    id: d.id,
    name: d.full_name,
    name_ar: d.full_name_ar,
    subtitle: d.subtitle,
    status: d.current_status,
    tasks: tasks.filter((t) => primaryAssignment(t)?.driver_id === d.id),
  }));
  // shared riders (FR-15) ride in their host's block, not in the unassigned row
  const unassigned = tasks.filter((t) => !primaryAssignment(t) && !sharedHostId(t));
  if (unassigned.length) rows.push({ id: 'unassigned', name: unassignedLabel, tasks: unassigned });
  return rows;
}

function useNowMinutes(): number {
  const [now, setNow] = useState(() => companyMinutesOfDay(new Date()));
  useEffect(() => {
    const id = window.setInterval(() => setNow(companyMinutesOfDay(new Date())), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/** A drop on the calendar: new start, and the row it landed on when that changed. */
export interface CalendarMove {
  taskId: string;
  start: string;
  /** set when the task moved to another row: a driver id, or null for "Unassigned" */
  driverId?: string | null;
}

const SNAP_MIN = 15;
const DRAG_THRESHOLD_PX = 5;

interface DragState {
  taskId: string;
  rowId: string;
  pointerId: number;
  x: number;
  y: number;
  trackWidth: number;
  moved: boolean;
  deltaMin: number;
  targetRowId: string;
}

/**
 * Day view, rows = drivers (docs/DESIGN.md §5 ResourceCalendar).
 * The time grid stays LTR inside an RTL page (§7: "time still reads
 * left→right inside the grid"); labels follow the page direction.
 * US-14: with `onMove`, blocks drag along time (15-min snap) and across
 * driver rows; Shift+arrows do the same from the keyboard (§8).
 */
export function ResourceCalendar({
  rows,
  day,
  startHour = 6,
  endHour = 20,
  onOpenTask,
  onMove,
  canMove,
  showLegend = true,
  dense,
}: {
  rows: CalendarRow[];
  /** YYYY-MM-DD in company time; the now-line shows only for today */
  day: string;
  startHour?: number;
  endHour?: number;
  onOpenTask?: (taskId: string) => void;
  onMove?: (move: CalendarMove) => void;
  canMove?: (task: TaskWithRelations) => boolean;
  showLegend?: boolean;
  dense?: boolean;
}) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const nowMin = useNowMinutes();
  const span = (endHour - startHour) * 60;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const labelEvery = endHour - startHour > 10 ? 2 : 1;
  const pos = (minutes: number) => Math.min(Math.max(((minutes - startHour * 60) / span) * 100, 0), 100);
  const isToday = day === companyDateKey();
  const nowInRange = isToday && nowMin >= startHour * 60 && nowMin <= endHour * 60;

  const tracks = useRef(new Map<string, HTMLDivElement>());
  const [drag, setDrag] = useState<DragState | null>(null);
  const suppressClick = useRef(false);
  const movable = (task: TaskWithRelations) => Boolean(onMove) && (canMove?.(task) ?? true);

  const commit = (task: TaskWithRelations, rowId: string, deltaMin: number, targetRowId: string) => {
    if (!onMove || (deltaMin === 0 && targetRowId === rowId)) return;
    onMove({
      taskId: task.id,
      start: new Date(new Date(task.scheduled_start).getTime() + deltaMin * 60_000).toISOString(),
      ...(targetRowId !== rowId ? { driverId: targetRowId === 'unassigned' ? null : targetRowId } : {}),
    });
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>, task: TaskWithRelations, rowId: string) => {
    if (!movable(task) || event.button !== 0) return;
    const track = tracks.current.get(rowId);
    if (!track) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      taskId: task.id,
      rowId,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      trackWidth: track.getBoundingClientRect().width,
      moved: false,
      deltaMin: 0,
      targetRowId: rowId,
    });
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD_PX) return;
    const deltaMin = Math.round(((dx / drag.trackWidth) * span) / SNAP_MIN) * SNAP_MIN;
    let targetRowId = drag.targetRowId;
    for (const [rowId, el] of tracks.current) {
      const rect = el.getBoundingClientRect();
      if (event.clientY >= rect.top && event.clientY <= rect.bottom) targetRowId = rowId;
    }
    setDrag({ ...drag, moved: true, deltaMin, targetRowId });
  };

  const onPointerUp = (event: PointerEvent<HTMLButtonElement>, task: TaskWithRelations) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (drag.moved) {
      suppressClick.current = true;
      commit(task, drag.rowId, drag.deltaMin, drag.targetRowId);
    }
    setDrag(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, task: TaskWithRelations, rowIndex: number) => {
    if (!event.shiftKey || !movable(task)) return;
    const rowId = rows[rowIndex]!.id;
    const moves: Record<string, () => void> = {
      ArrowLeft: () => commit(task, rowId, -SNAP_MIN, rowId),
      ArrowRight: () => commit(task, rowId, SNAP_MIN, rowId),
      ArrowUp: () => rowIndex > 0 && commit(task, rowId, 0, rows[rowIndex - 1]!.id),
      ArrowDown: () => rowIndex < rows.length - 1 && commit(task, rowId, 0, rows[rowIndex + 1]!.id),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    move();
  };

  const draggedTask = drag?.moved ? rows.flatMap((r) => r.tasks).find((task) => task.id === drag.taskId) : undefined;
  const blockBox = (task: TaskWithRelations, offsetMin = 0) => {
    const start = companyMinutesOfDay(task.scheduled_start) + offsetMin;
    const end = (task.scheduled_end ? companyMinutesOfDay(task.scheduled_end) : companyMinutesOfDay(task.scheduled_start) + (task.estimated_duration_min ?? 60)) + offsetMin;
    const left = pos(start);
    return { left, width: Math.max(pos(end) - left, 2.5) };
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          {/* header */}
          <div className="flex border-b border-border">
            <div className="eyebrow w-44 shrink-0 px-4 py-2.5">{t('calendar.driver')}</div>
            <div dir="ltr" className="relative flex-1">
              {hours.map((h, i) =>
                i % labelEvery === 0 ? (
                  <span
                    key={h}
                    className="tabular absolute top-1/2 -translate-y-1/2 ps-1 text-[11px] font-medium text-fg-3"
                    style={{ insetInlineStart: `${(i / hours.length) * 100}%` }}
                  >
                    {String(h).padStart(2, '0')}:00
                  </span>
                ) : null,
              )}
            </div>
          </div>

          {rows.map((row, rowIndex) => {
            const plannedMin = row.tasks.reduce((sum, task) => sum + (task.estimated_duration_min ?? 60), 0);
            const dropHere = draggedTask && drag?.targetRowId === row.id;
            return (
              <div key={row.id} className="flex border-b border-border last:border-b-0">
                <div className="flex w-44 shrink-0 items-center gap-2.5 px-4 py-2">
                  {row.id !== 'unassigned' && (
                    <DriverAvatar
                      name={row.name}
                      colorVar={row.status ? DRIVER_STATUS_COLOR[row.status] : undefined}
                      className="size-7"
                    />
                  )}
                  <div className="min-w-0">
                    <p className={cn('truncate text-sm font-semibold', row.id === 'unassigned' ? 'text-warning-fg' : 'text-fg')}>
                      {row.name_ar !== undefined ? name({ full_name: row.name, full_name_ar: row.name_ar }, 'full_name') : row.name}
                    </p>
                    <p className="tabular truncate text-xs text-fg-3">
                      {row.subtitle ? `${row.subtitle} · ` : ''}
                      {t('units.hours', { value: formatHours(plannedMin) })}
                    </p>
                  </div>
                </div>
                <div
                  ref={(el) => {
                    if (el) tracks.current.set(row.id, el);
                    else tracks.current.delete(row.id);
                  }}
                  dir="ltr"
                  className={cn('relative flex-1 border-s border-border', dense ? 'h-12' : 'h-14', dropHere && 'bg-[color-mix(in_srgb,var(--brand-500)_6%,transparent)]')}
                  style={{
                    backgroundImage: 'linear-gradient(90deg, var(--border) 1px, transparent 1px)',
                    backgroundSize: `${100 / hours.length}% 100%`,
                  }}
                >
                  {row.tasks.map((task) => {
                    const { left, width } = blockBox(task);
                    const blocking = task.conflicts.some((c) => c.severity === 'blocking');
                    const draggable = movable(task);
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => {
                          if (suppressClick.current) {
                            suppressClick.current = false;
                            return;
                          }
                          onOpenTask?.(task.id);
                        }}
                        onPointerDown={(e) => onPointerDown(e, task, row.id)}
                        onPointerMove={onPointerMove}
                        onPointerUp={(e) => onPointerUp(e, task)}
                        onPointerCancel={() => setDrag(null)}
                        onKeyDown={(e) => onKeyDown(e, task, rowIndex)}
                        dir="auto"
                        data-task-id={task.id}
                        className={cn(
                          'tone-block absolute inset-y-1.5 overflow-hidden rounded-[6px] px-2 py-1 text-start transition-shadow hover:z-10 hover:shadow-md focus-visible:z-10',
                          draggable && 'cursor-grab touch-none active:cursor-grabbing',
                          blocking && 'shadow-[inset_0_0_0_2px_var(--danger)]',
                          task.status === 'completed' && 'opacity-60',
                          draggedTask?.id === task.id && 'opacity-40',
                        )}
                        style={tone(categoryColorVar(task.category), { left: `${left}%`, width: `${width}%` })}
                        aria-label={`${task.title}, ${formatTimeRange(task.scheduled_start, task.scheduled_end)}, ${t(`tasks.status.${task.status}`)}`}
                        aria-description={draggable ? t('calendar.moveHint') : undefined}
                      >
                        <span className="block truncate text-[11px] font-bold leading-tight text-fg">{task.title}</span>
                        <span className="tabular block truncate text-[11px] leading-tight text-fg-2">
                          {formatTimeRange(task.scheduled_start, task.scheduled_end)}
                        </span>
                        {task.conflicts.length > 0 && (
                          <ConflictBadge conflicts={task.conflicts} variant="corner" className="absolute end-1 top-1" />
                        )}
                      </button>
                    );
                  })}
                  {dropHere && draggedTask && (
                    <div
                      className="pointer-events-none absolute inset-y-1.5 z-30 rounded-[6px] border-2 border-dashed border-brand-500 bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] px-2 py-1"
                      style={{ left: `${blockBox(draggedTask, drag!.deltaMin).left}%`, width: `${blockBox(draggedTask, drag!.deltaMin).width}%` }}
                      aria-hidden="true"
                    >
                      <span className="tabular block truncate text-[11px] font-bold text-fg">
                        {formatTime(new Date(new Date(draggedTask.scheduled_start).getTime() + drag!.deltaMin * 60_000))}
                      </span>
                    </div>
                  )}
                  {nowInRange && (
                    <div className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-danger" style={{ left: `${pos(nowMin)}%` }} aria-hidden="true">
                      <span className="absolute -start-1 -top-0.5 size-2.5 rounded-full bg-danger" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showLegend && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border px-4 py-2.5 text-[11px] text-fg-2">
          {TASK_CATEGORIES.map((category) => (
            <span key={category} className="inline-flex items-center gap-1.5">
              <span className="tone-dot size-2.5 rounded-[3px]" style={tone(categoryColorVar(category))} aria-hidden="true" />
              {t(`tasks.category.${category}`)}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] shadow-[inset_0_0_0_2px_var(--danger)]" aria-hidden="true" />
            {t('conflicts.legend')}
          </span>
        </div>
      )}
    </div>
  );
}
