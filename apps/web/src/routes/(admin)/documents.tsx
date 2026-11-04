import { useMemo } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { FileCheck2, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/data-table';
import { DocStatusPill } from '@/components/documents/doc-status';
import { DriverAvatar } from '@/components/driver-avatar';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { KpiTile } from '@/components/kpi-tile';
import { Page, Panel } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { isAdmin } from '@/features/auth/guards';
import { useCurrentUser } from '@/features/auth/session';
import { countByStatus, STATUS_RANK, type DocStatus, type DocumentItem } from '@/features/documents/status';
import { useCompliance } from '@/features/documents/use-compliance';
import { formatDate } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';
import { cn } from '@/lib/utils';

const FILTERS = ['attention', 'expired', 'expiring', 'missing', 'all'] as const;
type Filter = (typeof FILTERS)[number];

export const Route = createFileRoute('/(admin)/documents')({
  validateSearch: (search: Record<string, unknown>): { show?: Filter } => ({
    show: FILTERS.includes(search.show as Filter) ? (search.show as Filter) : undefined,
  }),
  component: DocumentsPage,
});

const matches = (filter: Filter, status: DocStatus) =>
  filter === 'all' ? true : filter === 'attention' ? status !== 'valid' : status === filter;

/**
 * 0005 — renewals at a glance: every active driver's required documents,
 * most urgent first. The same windows drive the owners' reminder
 * notifications (fn_document_reminders).
 */
function DocumentsPage() {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const { profile } = useCurrentUser();
  const navigate = useNavigate({ from: Route.fullPath });
  const { show = 'attention' } = Route.useSearch();
  const compliance = useCompliance();
  const counts = countByStatus(compliance.items);
  const driverOf = (id: string) => compliance.drivers.find((d) => d.id === id);

  const rows = compliance.items
    .filter((i) => matches(show, i.status))
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity));

  const columns = useMemo<ColumnDef<DocumentItem, unknown>[]>(
    () => [
      {
        id: 'driver',
        accessorFn: (i) => driverOf(i.driverId)?.full_name ?? '',
        header: () => t('documents.columns.driver'),
        meta: { label: t('documents.columns.driver'), csv: (i) => driverOf(i.driverId)?.full_name },
        cell: ({ row }) => {
          const driver = driverOf(row.original.driverId);
          return driver ? (
            <span className="flex items-center gap-2 whitespace-nowrap font-semibold">
              <DriverAvatar name={driver.full_name} className="size-7 text-[10px]" />
              {name(driver, 'full_name')}
            </span>
          ) : null;
        },
      },
      {
        id: 'document',
        accessorFn: (i) => i.type.name,
        header: () => t('documents.columns.document'),
        meta: { label: t('documents.columns.document'), csv: (i) => i.type.name },
        cell: ({ row }) => (
          <div>
            <div className="font-semibold">{name(row.original.type)}</div>
            {row.original.doc?.document_no && (
              <div className="text-xs text-fg-3" dir="ltr">
                {row.original.doc.document_no}
              </div>
            )}
          </div>
        ),
      },
      {
        id: 'expires',
        accessorFn: (i) => i.doc?.expires_on ?? '',
        header: () => t('documents.columns.expires'),
        meta: { label: t('documents.columns.expires'), csv: (i) => i.doc?.expires_on, className: 'whitespace-nowrap' },
        cell: ({ row }) => <span className="tabular">{row.original.doc?.expires_on ? formatDate(`${row.original.doc.expires_on}T12:00:00Z`) : '—'}</span>,
      },
      {
        id: 'status',
        accessorFn: (i) => STATUS_RANK[i.status],
        header: () => t('documents.columns.status'),
        meta: { label: t('documents.columns.status'), csv: (i) => i.status },
        cell: ({ row }) => <DocStatusPill status={row.original.status} daysLeft={row.original.daysLeft} />,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, name, compliance.drivers],
  );

  return (
    <Page>
      <PageHeader
        title={t('documents.page.title')}
        description={t('documents.page.subtitle')}
        actions={
          isAdmin(profile.role) && (
            <Button asChild variant="outline" size="sm">
              <Link to="/settings" search={{ tab: 'documents' }}>
                <Settings2 aria-hidden="true" />
                {t('documents.page.manage')}
              </Link>
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label={t('documents.status.expired')} value={String(counts.expired)} tone={counts.expired ? 'danger' : 'default'} />
        <KpiTile label={t('documents.page.expiringSoon')} value={String(counts.expiring)} tone={counts.expiring ? 'warning' : 'default'} />
        <KpiTile label={t('documents.status.missing')} value={String(counts.missing)} tone={counts.missing ? 'danger' : 'default'} />
        <KpiTile label={t('documents.status.valid')} value={String(counts.valid)} />
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t('documents.page.filter')}>
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={show === f}
            onClick={() => void navigate({ search: { show: f === 'attention' ? undefined : f } })}
            className={cn('rounded-full border px-3 py-1 text-xs font-bold', show === f ? 'border-brand-500 bg-brand-500 text-fg-on-brand' : 'border-border bg-surface text-fg-2')}
          >
            {t(`documents.page.filters.${f}`)}
          </button>
        ))}
      </div>

      <Panel>
        {compliance.error ? (
          <ErrorState error={compliance.error} onRetry={compliance.refetch} />
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            loading={compliance.isPending}
            getRowId={(i) => `${i.driverId}:${i.type.id}`}
            onRowClick={(i) => void navigate({ to: '/drivers/$driverId', params: { driverId: i.driverId } })}
            csvFilename="masar-driver-documents.csv"
            empty={
              <EmptyState
                icon={FileCheck2}
                title={show === 'attention' ? t('documents.page.allGood') : t('documents.page.emptyFiltered')}
                body={show === 'attention' ? t('documents.page.allGoodBody') : undefined}
              />
            }
          />
        )}
      </Panel>
    </Page>
  );
}
