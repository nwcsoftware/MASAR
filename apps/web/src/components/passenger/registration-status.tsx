import { CircleX, Hourglass } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import type { PassengerHome } from '@/features/passenger/types';
import { isolate } from '@/lib/format';

/** Pending / rejected sign-ups see their status, never trip data (§1). */
export function RegistrationStatusCard({ home }: { home: PassengerHome }) {
  const { t } = useTranslation();
  const rejected = home.status === 'rejected';
  return (
    <EmptyState
      icon={rejected ? CircleX : Hourglass}
      title={rejected ? t('passenger.rejectedTitle') : t('passenger.pendingTitle')}
      body={rejected ? (home.note ? t('passenger.rejectedReason', { reason: isolate(home.note) }) : t('passenger.rejectedBody')) : t('passenger.pendingBody')}
    />
  );
}
