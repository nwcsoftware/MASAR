import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * docs/DESIGN.md §5 EmptyState — line illustration (brand-300 / surface-3),
 * a title, one sentence and at most one primary action.
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-center',
        compact ? 'px-4 py-8' : 'px-6 py-16',
        className,
      )}
    >
      <div className="relative grid place-items-center" aria-hidden="true">
        <svg viewBox="0 0 120 72" className={cn(compact ? 'h-14' : 'h-20', 'w-auto')} fill="none">
          <path d="M6 58 C30 40 46 64 64 44 S96 22 114 30" stroke="var(--surface-3)" strokeWidth="6" strokeLinecap="round" />
          <path d="M6 58 C30 40 46 64 64 44 S96 22 114 30" stroke="var(--brand-300)" strokeWidth="2" strokeDasharray="4 6" strokeLinecap="round" />
          <circle cx="6" cy="58" r="4" fill="var(--surface)" stroke="var(--brand-300)" strokeWidth="2" />
          <circle cx="114" cy="30" r="4" fill="var(--brand-300)" />
        </svg>
        <span className="absolute grid size-11 place-items-center rounded-full border border-border bg-surface text-brand-500 shadow-sm">
          <Icon className="size-5" />
        </span>
      </div>
      <div className="max-w-sm space-y-1">
        <p className="text-base font-bold text-fg">{title}</p>
        {body && <p className="text-sm text-fg-2">{body}</p>}
      </div>
      {action}
    </div>
  );
}
