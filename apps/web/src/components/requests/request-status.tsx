import { useTranslation } from 'react-i18next';
import type { RequestStatus } from '@/features/passenger/types';
import { cn, tone } from '@/lib/utils';

const COLOR: Record<RequestStatus, string> = {
  pending: '--status-assigned',
  approved: '--status-completed',
  rejected: '--status-cancelled',
  withdrawn: '--status-draft',
};

/** A trip request's state (pending → approved / rejected, or withdrawn by the passenger). */
export function RequestStatusPill({ status, className }: { status: string; className?: string }) {
  const { t } = useTranslation();
  const s = (status in COLOR ? status : 'pending') as RequestStatus;
  return (
    <span className={cn('tone-pill inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold', className)} style={tone(COLOR[s])}>
      <span className="tone-dot size-1.5 rounded-full" aria-hidden="true" />
      {t(`requests.status.${s}`)}
    </span>
  );
}
