import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { NativeSelect } from '@/components/form';
import { useLocalizedName } from '@/lib/i18n-data';
import type { GradeGroup } from '@/mocks/fixtures';
import { cn } from '@/lib/utils';

/** "B · 14" — a person's group and grade (0004). Group A is the most senior. */
export function GradeBadge({ code, grade, visitor, className }: { code?: string | null; grade?: number | null; visitor?: boolean; className?: string }) {
  const { t } = useTranslation();
  if (!code && grade == null && !visitor) return null;
  return (
    <span
      className={cn('tabular inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-fg-2', className)}
      title={code ? t('grades.groupLabel', { code }) : undefined}
    >
      {code && <span className="text-fg">{code}</span>}
      {code && grade != null && <span aria-hidden="true">·</span>}
      {grade != null && <span>{String(grade).padStart(2, '0')}</span>}
      {visitor && <span className="font-semibold text-fg-3">{t('people.visitor')}</span>}
    </span>
  );
}

/** "A · Executives (16–20)" options; forwardRef so register() can read it. */
export const GroupSelect = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { groups: GradeGroup[]; emptyLabel?: string }
>(({ groups, emptyLabel, ...props }, ref) => {
  const name = useLocalizedName();
  return (
    <NativeSelect ref={ref} {...props}>
      <option value="">{emptyLabel ?? '—'}</option>
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.code}
          {g.name ? ` · ${name(g)}` : ''} ({g.min_grade}–{g.max_grade})
        </option>
      ))}
    </NativeSelect>
  );
});
GroupSelect.displayName = 'GroupSelect';
