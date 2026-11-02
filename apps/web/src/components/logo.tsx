import { cn } from '@/lib/utils';

/** Brand mark — route line forming an "M" (docs/DESIGN.md §9). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-brand-500 to-brand-900 text-fg-on-brand',
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="size-[58%]" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 19 8 5l4 9 4-9 5 14" />
      </svg>
    </span>
  );
}

/** Wordmark "Masar" + Arabic "مسار" stacked. */
export function Logo({ className, collapsed }: { className?: string; collapsed?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      {!collapsed && (
        <span className="flex flex-col leading-none">
          <span className="font-sans text-base font-extrabold tracking-tight text-fg [font-family:Manrope,var(--font-sans)]">Masar</span>
          <span className="font-arabic text-xs font-semibold text-fg-3">مسار</span>
        </span>
      )}
    </span>
  );
}
