import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Pills per docs/DESIGN.md §2.1 — radius-full, small bold label, 12 % token tint.
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold',
  {
    variants: {
      variant: {
        default: 'bg-surface-2 text-fg-2',
        brand: 'tint-12 text-brand-600 [--tint-color:var(--brand-500)] dark:text-brand-300',
        danger: 'tint-12 text-danger [--tint-color:var(--danger)]',
        warning: 'tint-12 text-warning-fg [--tint-color:var(--warning)]',
        success: 'tint-12 text-success-fg [--tint-color:var(--success)]',
        outline: 'border border-border-strong text-fg-2',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
