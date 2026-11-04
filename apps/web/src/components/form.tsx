import { forwardRef, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { AppError } from '@/lib/data-source';
import { cn } from '@/lib/utils';

/** Label + control + translated validation message (zod messages are i18n keys). */
export function Field({
  id,
  label,
  error,
  hint,
  children,
  className,
}: {
  id: string;
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-semibold text-danger">
          {i18n.exists(error) ? t(error) : error}
        </p>
      ) : (
        hint && <p className="text-xs text-fg-3">{hint}</p>
      )}
    </div>
  );
}

/** Human message for a failed mutation: the AppError's i18n key when known, else its text. */
export function useErrorMessage() {
  const { t, i18n } = useTranslation();
  return (error: unknown): string => {
    if (error instanceof AppError && error.code && i18n.exists(error.code)) return t(error.code);
    if (error instanceof Error && i18n.exists(error.message)) return t(error.message);
    return error instanceof Error ? error.message : t('errors.generic');
  };
}

export function FormError({ error, className }: { error: unknown; className?: string }) {
  const message = useErrorMessage();
  if (!error) return null;
  return (
    <p role="alert" className={cn('tint-12 flex items-start gap-2 rounded-md px-3 py-2 text-sm font-semibold text-danger [--tint-color:var(--danger)]', className)}>
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {message(error)}
    </p>
  );
}

/**
 * Native <select> styled like the inputs — simpler than Radix Select inside
 * long forms. forwardRef: react-hook-form's register() reads values via the ref.
 */
export const NativeSelect = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'flex h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-fg focus-visible:border-brand-400 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger',
      className,
    )}
    {...props}
  />
));
NativeSelect.displayName = 'NativeSelect';
