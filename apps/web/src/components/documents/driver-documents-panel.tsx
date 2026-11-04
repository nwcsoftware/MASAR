import { useState } from 'react';
import { Eye, FilePlus2, FileText, FileWarning, RefreshCw, Trash2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { FormError } from '@/components/form';
import { Panel } from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { isAdmin } from '@/features/auth/guards';
import { useCurrentUser } from '@/features/auth/session';
import { documentFileUrl, useDeleteDriverDocument, useDocumentTypes, useDriverDocuments, useJobTitles } from '@/features/documents/queries';
import { driverDocumentItems, type DocumentItem } from '@/features/documents/status';
import { useLiveData } from '@/lib/data-source';
import { companyDateKey, formatDate } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';
import type { Driver } from '@/mocks/fixtures';
import { DocStatusPill } from './doc-status';
import { DocumentDialog } from './document-dialog';

const day = (d: string) => formatDate(`${d}T12:00:00Z`);

/**
 * Driver profile → Documents (0005): what the driver's job title requires,
 * plus anything else on file, with status, dates and the copy.
 */
export function DriverDocumentsPanel({ driver }: { driver: Pick<Driver, 'id' | 'job_title_id' | 'full_name'> }) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const { profile } = useCurrentUser();
  const admin = isAdmin(profile.role);
  const live = useLiveData();
  const types = useDocumentTypes();
  const jobs = useJobTitles();
  const docs = useDriverDocuments();
  const remove = useDeleteDriverDocument();
  const [dialog, setDialog] = useState<{ item: DocumentItem | null } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState<unknown>(null);

  const pending = types.isPending || jobs.isPending || docs.isPending;
  const error = types.error ?? jobs.error ?? docs.error;
  const items = pending || error ? [] : driverDocumentItems(driver, types.data!, jobs.data!.requirements, docs.data!, companyDateKey());
  const job = jobs.data?.titles.find((j) => j.id === driver.job_title_id);
  const otherTypes = (types.data ?? []).filter((type) => type.is_active && !items.some((i) => i.type.id === type.id));

  const open = async (item: DocumentItem) => {
    if (!item.doc?.storage_path) return;
    setOpening(item.doc.id);
    setOpenError(null);
    // open the tab first so the browser doesn't treat it as a popup
    const tab = window.open('', '_blank');
    try {
      const url = await documentFileUrl(item.doc.storage_path, live, `${name(item.type)} · ${driver.full_name}`);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch (e) {
      tab?.close();
      setOpenError(e);
    } finally {
      setOpening(null);
    }
  };

  return (
    <Panel
      title={t('documents.title')}
      action={
        admin && otherTypes.length > 0 ? (
          <Button size="sm" variant="outline" onClick={() => setDialog({ item: null })}>
            <FilePlus2 aria-hidden="true" />
            {t('documents.addOther')}
          </Button>
        ) : undefined
      }
      bodyClassName="p-0"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 text-sm">
        <span className="text-fg-3">{t('documents.jobTitle')}:</span>
        {job ? <span className="font-semibold">{name(job)}</span> : <span className="font-semibold text-warning-fg">{t('documents.noJobTitle')}</span>}
      </div>
      {pending ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => [types, jobs, docs].forEach((q) => void q.refetch())} />
      ) : !items.length ? (
        <EmptyState compact icon={FileText} title={t('documents.none')} body={job ? undefined : t('documents.noneBody')} />
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.type.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3" data-document={item.type.name}>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-fg">
                  {name(item.type)}
                  {!item.required && <Badge>{t('documents.extra')}</Badge>}
                </p>
                {item.doc ? (
                  <p className="tabular flex flex-wrap gap-x-2 text-xs text-fg-2">
                    {item.doc.document_no && <span dir="ltr">{item.doc.document_no}</span>}
                    <span>
                      {t('documents.issuedOn', { date: day(item.doc.issued_on) })}
                      {item.doc.expires_on && ` · ${t('documents.expiresOn', { date: day(item.doc.expires_on) })}`}
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-fg-3">{t('documents.notUploaded')}</p>
                )}
                {item.doc && !item.doc.storage_path && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-warning-fg">
                    <FileWarning className="size-3.5" aria-hidden="true" />
                    {t('documents.noCopy')}
                  </p>
                )}
              </div>
              <DocStatusPill status={item.status} daysLeft={item.daysLeft} />
              <div className="flex gap-1">
                {item.doc?.storage_path && (
                  <Button size="sm" variant="ghost" onClick={() => void open(item)} disabled={opening === item.doc.id} aria-label={`${t('documents.view')} ${name(item.type)}`}>
                    <Eye aria-hidden="true" />
                    <span className="hidden sm:inline">{t('documents.view')}</span>
                  </Button>
                )}
                {admin && (
                  <Button size="sm" variant={item.status === 'valid' ? 'ghost' : 'outline'} onClick={() => setDialog({ item })} aria-label={`${item.doc ? t('documents.renew') : t('documents.upload')} ${name(item.type)}`}>
                    {item.doc ? <RefreshCw aria-hidden="true" /> : <Upload aria-hidden="true" />}
                    <span className="hidden sm:inline">{item.doc ? t('documents.renew') : t('documents.upload')}</span>
                  </Button>
                )}
                {admin && item.doc && !item.required && (
                  <Button size="icon" variant="ghost" className="size-9 text-danger" onClick={() => remove.mutate(item.doc!)} aria-label={`${t('common.remove')} ${name(item.type)}`}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <FormError error={openError ?? remove.error} className="m-4" />
      {dialog && (
        <DocumentDialog
          open
          onOpenChange={(next) => !next && setDialog(null)}
          driverId={driver.id}
          type={dialog.item?.type ?? null}
          existing={dialog.item?.doc ?? null}
          choosableTypes={otherTypes}
        />
      )}
    </Panel>
  );
}
