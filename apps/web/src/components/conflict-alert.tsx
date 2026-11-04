import { useState, type ReactNode } from 'react';
import { CircleAlert, Info, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Field, FormError } from '@/components/form';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { TaskConflict } from '@/mocks/fixtures';
import { formatHours, formatTimeRange, isolate } from '@/lib/format';
import { SEVERITY_RANK } from '@/lib/task-meta';
import { cn } from '@/lib/utils';

type Details = Record<string, string | number | string[] | undefined>;
/** a task_conflicts row, or a preview row before the task exists */
export type ConflictLike = Pick<TaskConflict, 'type' | 'severity' | 'details'> & { id?: string };

/** Human sentence for a task_conflicts row (FR-14). */
export function useConflictText() {
  const { t } = useTranslation();
  return (conflict: ConflictLike) => {
    const d = (conflict.details ?? {}) as Details;
    switch (conflict.type) {
      case 'driver_overlap':
      case 'vehicle_overlap':
        return t(`conflicts.type.${conflict.type}`, {
          title: isolate(String(d.title ?? '')),
          time: d.start ? formatTimeRange(String(d.start), d.end ? String(d.end) : null) : '',
        });
      case 'driver_over_hours':
        return t('conflicts.type.driver_over_hours', {
          planned: formatHours(Number(d.planned_min ?? 0)),
          max: formatHours(Number(d.max_min ?? 0)),
        });
      case 'outside_working_hours':
        return t('conflicts.type.outside_working_hours', {
          start: String(d.shift_start ?? '').slice(0, 5),
          end: String(d.shift_end ?? '').slice(0, 5),
        });
      case 'driver_multi_location_same_day':
        return t('conflicts.type.driver_multi_location_same_day', { title: isolate(String(d.title ?? '')), km: d.distance_km ?? '' });
      case 'driver_unavailable':
        return t('conflicts.type.driver_unavailable');
      // 0004 grade rules
      case 'grade_mixed':
        return t('conflicts.type.grade_mixed', { groups: (Array.isArray(d.groups) ? d.groups : []).join(' + ') });
      case 'vehicle_grade_mismatch':
        return t('conflicts.type.vehicle_grade_mismatch', {
          vehicle: String(d.vehicle_group ?? ''),
          groups: (Array.isArray(d.groups) ? d.groups : []).join(' + '),
        });
      case 'driver_grade_not_allowed':
        return t('conflicts.type.driver_grade_not_allowed', { serve: String(d.serve_group ?? ''), group: String(d.group ?? '') });
    }
  };
}

/** docs/DESIGN.md §5 ConflictAlert — severity-sorted list; `children` (e.g. OverrideForm) renders below. */
export function ConflictAlert({ conflicts, children }: { conflicts: ConflictLike[]; children?: ReactNode }) {
  const { t } = useTranslation();
  const text = useConflictText();
  const sorted = [...conflicts].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {sorted.map((conflict, i) => {
          const Icon = conflict.severity === 'blocking' ? CircleAlert : conflict.severity === 'warning' ? TriangleAlert : Info;
          return (
            <li
              key={conflict.id ?? `${conflict.type}-${i}`}
              className={cn(
                'tint-12 flex gap-3 rounded-md p-3',
                conflict.severity === 'blocking'
                  ? '[--tint-color:var(--danger)]'
                  : conflict.severity === 'warning'
                    ? '[--tint-color:var(--warning)]'
                    : '[--tint-color:var(--text-3)]',
              )}
            >
              <Icon
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  conflict.severity === 'blocking' ? 'text-danger' : conflict.severity === 'warning' ? 'text-warning-fg' : 'text-fg-3',
                )}
                aria-hidden="true"
              />
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-semibold text-fg">{text(conflict)}</p>
                <p className="text-xs text-fg-2">{t(`conflicts.severity.${conflict.severity}`)}</p>
              </div>
            </li>
          );
        })}
      </ul>
      {children}
    </div>
  );
}

/** FR-14: an admin keeps a blocking conflict with a written reason (audited as conflict_overridden). */
export function OverrideForm({
  id,
  defaultReason,
  pending,
  error,
  onSubmit,
}: {
  id: string;
  defaultReason?: string | null;
  pending?: boolean;
  error?: unknown;
  onSubmit: (reason: string) => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState(defaultReason ?? '');
  return (
    <form
      className="space-y-2 rounded-md border border-border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (reason.trim()) onSubmit(reason.trim());
      }}
    >
      <Field id={id} label={t('conflicts.overrideReason')} hint={t('conflicts.overrideHint')}>
        <Textarea id={id} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <FormError error={error} />
      <Button type="submit" size="sm" variant="outline" disabled={!reason.trim() || pending}>
        <ShieldCheck aria-hidden="true" />
        {pending ? t('common.saving') : t('conflicts.override')}
      </Button>
    </form>
  );
}

/** Shown on a task whose blocking conflicts an admin accepted. */
export function OverriddenNote({ reason }: { reason: string | null }) {
  const { t } = useTranslation();
  return (
    <p className="flex items-start gap-2 rounded-md bg-surface-2 px-3 py-2 text-xs text-fg-2">
      <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success-fg" aria-hidden="true" />
      <span>{t('conflicts.overridden', { reason: isolate(reason ?? '') })}</span>
    </p>
  );
}
