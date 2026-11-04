import { useTranslation } from 'react-i18next';
import type { DocStatus } from '@/features/documents/status';
import { cn, tone } from '@/lib/utils';

const STATUS_COLOR: Record<DocStatus, string> = {
  expired: 'var(--danger)',
  missing: 'var(--danger)',
  expiring: 'var(--warning)',
  valid: 'var(--success)',
};

/** "Expired 5 days ago" · "Expires in 20 days" · "Missing" · "Valid" (0005). */
export function DocStatusPill({ status, daysLeft, className }: { status: DocStatus; daysLeft: number | null; className?: string }) {
  const { t } = useTranslation();
  const label =
    status === 'expired'
      ? t('documents.status.expiredAgo', { count: Math.abs(daysLeft ?? 0) })
      : status === 'expiring'
        ? daysLeft === 0
          ? t('documents.status.expiresToday')
          : t('documents.status.expiresIn', { count: daysLeft ?? 0 })
        : t(`documents.status.${status}`);
  return (
    <span className={cn('tone-pill inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold', className)} style={tone(STATUS_COLOR[status])}>
      <span className="tone-dot size-1.5 rounded-full" aria-hidden="true" />
      {label}
    </span>
  );
}
