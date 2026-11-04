import type { CSSProperties } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Sets --tone for the .tone-* classes in globals.css. Pass a token var, e.g. var(--cat-airport). */
export function tone(colorVar: string, style?: CSSProperties): CSSProperties {
  return { ...style, ['--tone' as string]: colorVar };
}
