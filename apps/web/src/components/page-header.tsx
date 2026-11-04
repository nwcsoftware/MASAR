import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** docs/DESIGN.md §4.1 — page header: title, breadcrumb/description, primary action. */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0 space-y-0.5">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="text-xl font-extrabold tracking-tight text-fg">{title}</h1>
        {description && <p className="text-sm text-fg-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
