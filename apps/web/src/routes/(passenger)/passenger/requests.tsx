import { createFileRoute } from '@tanstack/react-router';
import { ClipboardList } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { RequestStatusPill } from '@/components/requests/request-status';
import { RegistrationStatusCard } from '@/components/passenger/registration-status';
import { RequestDialog } from '@/components/passenger/request-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePassengerHome, useTripRequests, useWithdrawRequest } from '@/features/passenger/queries';
import { formatDateTime } from '@/lib/format';

export const Route = createFileRoute('/(passenger)/passenger/requests')({
  component: PassengerRequestsPage,
});

/** §10 trip requests: ask for a new trip; follow new / reschedule / cancel requests. */
function PassengerRequestsPage() {
  const { t } = useTranslation();
  const home = usePassengerHome();
  const requests = useTripRequests();
  const withdraw = useWithdrawRequest();

  if (home.isPending || requests.isPending) return <Skeleton className="h-64 w-full" />;
  if (home.isError) return <ErrorState error={home.error} onRetry={() => void home.refetch()} />;
  if (home.data.status !== 'approved') return <RegistrationStatusCard home={home.data} />;
  if (requests.isError) return <ErrorState error={requests.error} onRetry={() => void requests.refetch()} />;
  const tripTitle = (id: string | null) => home.data.trips.find((x) => x.id === id)?.title;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">{t('requests.pageTitle')}</h1>
        <p className="text-sm text-fg-2">{t('requests.pageSubtitle')}</p>
      </div>
      <RequestDialog kind="new" />

      {requests.data.length ? (
        <ul className="space-y-3">
          {requests.data.map((r) => (
            <li key={r.id} className="space-y-2 rounded-lg border border-border bg-surface p-4" data-my-request={r.kind}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold">{t(`requests.kind.${r.kind}`)}</span>
                <RequestStatusPill status={r.status} />
                <span className="ms-auto text-xs text-fg-3 tabular">{formatDateTime(r.created_at)}</span>
              </div>
              {r.kind === 'new' ? (
                <p className="text-sm text-fg-2">
                  {r.pickup} <span className="inline-block rtl:-scale-x-100">→</span> {r.dropoff}
                </p>
              ) : (
                <p className="text-sm text-fg-2">{tripTitle(r.task_id) ?? tripTitle(r.created_task_id) ?? '—'}</p>
              )}
              {r.requested_start && <p className="text-sm tabular">{t('requests.when', { time: formatDateTime(r.requested_start) })}</p>}
              {r.notes && <p className="text-xs text-fg-3">{r.notes}</p>}
              {r.decision_note && (
                <p className="rounded-md bg-surface-2 px-3 py-2 text-xs">
                  <span className="font-semibold">{t('requests.dispatchNote')}</span> {r.decision_note}
                </p>
              )}
              {r.status === 'pending' && (
                <Button size="sm" variant="ghost" onClick={() => withdraw.mutate(r.id)} disabled={withdraw.isPending}>
                  {t('requests.withdraw')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={ClipboardList} title={t('requests.empty')} body={t('requests.emptyBody')} />
      )}
    </div>
  );
}
