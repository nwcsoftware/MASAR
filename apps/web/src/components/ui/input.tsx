import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg transition-colors duration-base placeholder:text-fg-3 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:border-brand-400 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
