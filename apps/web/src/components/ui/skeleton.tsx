import type * as React from 'react';
import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-surface-3', className)} {...props} />
  );
}

export { Skeleton };
