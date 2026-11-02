import { Car, FileText, Plane, UsersRound, type LucideIcon } from 'lucide-react';
import type { Enums } from '@/lib/database.types';

export type TaskCategory = Enums<'task_category'>;
export type TaskStatus = Enums<'task_status'>;
export type ConflictType = Enums<'conflict_type'>;
export type ConflictSeverity = Enums<'conflict_severity'>;
export type DriverStatus = Enums<'driver_status'>;
export type AppRole = Enums<'app_role'>;

/**
 * DB enum → design token / CSS class. tokens.css names the categories
 * routine/airport/delivery/escort and the statuses with hyphens, while the
 * DB uses daily_routine/document_delivery and underscores.
 */
export const CATEGORY_TOKEN: Record<TaskCategory, 'routine' | 'airport' | 'delivery' | 'escort'> = {
  daily_routine: 'routine',
  airport: 'airport',
  document_delivery: 'delivery',
  escort: 'escort',
};

export const CATEGORY_ICON: Record<TaskCategory, LucideIcon> = {
  daily_routine: Car,
  airport: Plane,
  document_delivery: FileText,
  escort: UsersRound,
};

export const TASK_CATEGORIES: TaskCategory[] = ['daily_routine', 'airport', 'document_delivery', 'escort'];

export const TASK_STATUSES: TaskStatus[] = [
  'draft',
  'scheduled',
  'assigned',
  'acknowledged',
  'en_route',
  'in_progress',
  'delayed',
  'completed',
  'cancelled',
  'declined',
  'no_show',
];

/** `declined` has no token of its own; it reads as a no-show/danger state. */
export function statusColorVar(status: TaskStatus): string {
  if (status === 'declined') return 'var(--status-no-show)';
  return `var(--status-${status.replace('_', '-')})`;
}

export function categoryColorVar(category: TaskCategory): string {
  return `var(--cat-${CATEGORY_TOKEN[category]})`;
}

export const DRIVER_STATUS_COLOR: Record<DriverStatus, string> = {
  offline: 'var(--text-3)',
  idle: 'var(--status-scheduled)',
  en_route: 'var(--status-en-route)',
  in_progress: 'var(--status-in-progress)',
  delayed: 'var(--status-delayed)',
};

export const ACTIVE_STATUSES: TaskStatus[] = ['en_route', 'in_progress', 'delayed'];
export const OPEN_STATUSES: TaskStatus[] = ['draft', 'scheduled', 'assigned', 'acknowledged', 'en_route', 'in_progress', 'delayed'];
export const TERMINAL_STATUSES: TaskStatus[] = ['completed', 'cancelled', 'declined', 'no_show'];

/** Driver PWA primary action per status (FR-30). Mirrors rpc_task_transition. */
export type DriverAction = 'acknowledge' | 'start' | 'arrive' | 'complete' | 'resume';

export function primaryDriverAction(status: TaskStatus, previousStatus?: TaskStatus | null): DriverAction | null {
  switch (status) {
    case 'assigned':
      return 'acknowledge';
    case 'acknowledged':
      return 'start';
    case 'en_route':
      return 'arrive';
    case 'in_progress':
      return 'complete';
    case 'delayed':
      // rpc_task_transition lets start/arrive/complete leave `delayed` directly, so the
      // hero button skips ahead to the next real step; `resume` stays a secondary action.
      if (previousStatus === 'in_progress') return 'complete';
      if (previousStatus === 'en_route') return 'arrive';
      return 'start';
    default:
      return null;
  }
}

export function canReportDelay(status: TaskStatus): boolean {
  return status === 'assigned' || status === 'acknowledged' || status === 'en_route' || status === 'in_progress';
}

export const SEVERITY_RANK: Record<ConflictSeverity, number> = { info: 0, warning: 1, blocking: 2 };

export const STAFF_ROLES: AppRole[] = ['owner', 'admin', 'dispatcher'];
export const ADMIN_ROLES: AppRole[] = ['owner', 'admin'];
