import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useTaskTransition } from '@/features/tasks/queries';
import type { TaskWithRelations } from '@/features/tasks/types';
import type { Enums } from '@/lib/database.types';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

type Reason = Enums<'delay_reason'>;
const REASONS: Reason[] = ['flight_delayed', 'traffic', 'passenger_late', 'vehicle_issue', 'weather', 'other'];
const MINUTES = [15, 30, 45, 60, 90];

/** FR-32 / US-08 — reason → optional minutes → (airport) new estimate preview. */
export function DelaySheet({ task, open, onOpenChange }: { task: TaskWithRelations; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const transition = useTaskTransition();
  const [reason, setReason] = useState<Reason>(task.category === 'airport' ? 'flight_delayed' : 'traffic');
  const [minutes, setMinutes] = useState<number | null>(30);
  const [note, setNote] = useState('');
  const flightBase = task.flight ? (task.flight.estimated_time ?? task.flight.scheduled_time) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-md">
        <SheetHeader>
          <SheetTitle>{t('driver.delay.title')}</SheetTitle>
          <SheetDescription>{task.title}</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 overflow-y-auto px-5">
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">{t('driver.delay.reason')}</legend>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={reason === r}
                  onClick={() => setReason(r)}
                  className={cn('touch-target rounded-md border px-3 text-start text-sm font-semibold', reason === r ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900 dark:text-brand-100' : 'border-border-strong')}
                >
                  {t(`delay.reason.${r}`)}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">{t('driver.delay.minutes')}</legend>
            <div className="flex flex-wrap gap-2">
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={minutes === m}
                  onClick={() => setMinutes(minutes === m ? null : m)}
                  className={cn('touch-target tabular rounded-full border px-4 text-sm font-bold', minutes === m ? 'border-status-delayed bg-status-delayed text-fg-on-brand' : 'border-border-strong')}
                >
                  +{m}
                </button>
              ))}
            </div>
            {flightBase && minutes && (
              <p className="tabular text-sm text-fg-2">
                {t('driver.delay.newFlightTime', { time: formatTime(new Date(new Date(flightBase).getTime() + minutes * 60_000)) })}
              </p>
            )}
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="delay-note">{t('driver.delay.note')}</Label>
            <Textarea id="delay-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
          {transition.isError && <p className="text-sm font-semibold text-danger">{transition.error.message}</p>}
        </div>
        <SheetFooter>
          <Button
            size="hero"
            className="bg-status-delayed hover:bg-status-delayed hover:opacity-90"
            disabled={transition.isPending}
            onClick={() =>
              transition.mutate(
                { taskId: task.id, action: 'delay', payload: { reason, delay_min: minutes ?? undefined, note: note || undefined } },
                { onSuccess: () => onOpenChange(false) },
              )
            }
          >
            {t('driver.delay.submit')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
