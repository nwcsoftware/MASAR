import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Console page frame: max 1440 px, 24 px gutter desktop / 16 px mobile (docs/DESIGN.md §2.3). */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-content space-y-5 p-4 lg:p-6', className)}>{children}</div>;
}

export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('overflow-hidden rounded-lg border border-border bg-surface', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          {title && <h2 className="text-sm font-bold text-fg">{title}</h2>}
          {action}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
