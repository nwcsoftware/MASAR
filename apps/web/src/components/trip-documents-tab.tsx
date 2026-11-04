import { useState } from 'react';
import { Eye, FilePlus2, FileText, Paperclip, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { Field, FormError, NativeSelect } from '@/components/form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { storageFileUrl } from '@/features/documents/queries';
import { ACCEPTED_FILES, fileProblem, MAX_FILE_MB } from '@/features/documents/schema';
import { TRIP_DOCUMENTS, useAddTripDocument, useDeleteTripDocument, useUpdateTripDocument } from '@/features/passenger/queries';
import { TRIP_DOCUMENT_CATEGORIES, type TripDocumentCategory } from '@/features/passenger/types';
import type { TaskDetail } from '@/features/tasks/types';
import { useLiveData } from '@/lib/data-source';
import { formatDate } from '@/lib/format';

function AddTripDocumentDialog({ taskId, open, onOpenChange }: { taskId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const add = useAddTripDocument();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TripDocumentCategory>('hotel_booking');
  const [expires, setExpires] = useState('');
  const [visible, setVisible] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('tripDocuments.add')}</DialogTitle>
          <DialogDescription>{t('tripDocuments.addHint', { mb: MAX_FILE_MB })}</DialogDescription>
        </DialogHeader>
        <form
          id="trip-doc-form"
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!file) return setProblem('documents.errors.fileRequired');
            if (!title.trim()) return setProblem('tripDocuments.errors.title');
            add.mutate(
              { taskId, file, title: title.trim(), category, expires_on: expires || null, visible_to_passengers: visible },
              { onSuccess: () => onOpenChange(false) },
            );
          }}
        >
          <Field id="trip-doc-file" label={t('documents.copy')} error={problem === 'documents.errors.fileRequired' || problem?.startsWith('documents.errors.file') ? problem : undefined}>
            <Input
              id="trip-doc-file"
              type="file"
              accept={ACCEPTED_FILES.join(',')}
              onChange={(e) => {
                const picked = e.target.files?.[0] ?? null;
                const issue = picked ? fileProblem(picked) : null;
                setProblem(issue);
                setFile(issue ? null : picked);
                if (picked && !issue && !title) setTitle(picked.name.replace(/\.[^.]+$/, ''));
              }}
            />
          </Field>
          <Field id="trip-doc-title" label={t('tripDocuments.title')} error={problem === 'tripDocuments.errors.title' ? problem : undefined}>
            <Input id="trip-doc-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="trip-doc-type" label={t('tripDocuments.type')}>
              <NativeSelect id="trip-doc-type" value={category} onChange={(e) => setCategory(e.target.value as TripDocumentCategory)}>
                {TRIP_DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`tripDocuments.category.${c}`)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="trip-doc-expires" label={t('tripDocuments.expires')}>
              <Input id="trip-doc-expires" type="date" dir="ltr" value={expires} onChange={(e) => setExpires(e.target.value)} />
            </Field>
          </div>
          <label className="flex items-center gap-3 text-sm font-semibold">
            <Switch checked={visible} onCheckedChange={setVisible} />
            {t('tripDocuments.visible')}
          </label>
          <FormError error={add.error} />
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="trip-doc-form" disabled={add.isPending}>
            {add.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Task sheet → Documents (§4): what the dispatcher attached, and whether passengers see it. */
export function TripDocumentsTab({ task, staff }: { task: TaskDetail; staff: boolean }) {
  const { t } = useTranslation();
  const live = useLiveData();
  const update = useUpdateTripDocument();
  const remove = useDeleteTripDocument();
  const [adding, setAdding] = useState(false);
  const [openError, setOpenError] = useState<unknown>(null);

  const open = async (path: string, label: string) => {
    setOpenError(null);
    const tab = window.open('', '_blank');
    try {
      const url = await storageFileUrl(TRIP_DOCUMENTS, path, live, label);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch (e) {
      tab?.close();
      setOpenError(e);
    }
  };

  return (
    <div className="space-y-3">
      {staff && (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <FilePlus2 aria-hidden="true" />
          {t('tripDocuments.add')}
        </Button>
      )}
      {!task.attachments.length ? (
        <EmptyState compact icon={Paperclip} title={t('taskDetail.noAttachments')} body={t('taskDetail.noAttachmentsBody')} />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {task.attachments.map((a) => {
            const label = a.title ?? a.caption ?? a.file_name ?? a.storage_path?.split('/').at(-1) ?? '';
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5" data-trip-document={label}>
                <FileText className="size-5 shrink-0 text-fg-3" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{label}</p>
                  <p className="text-xs text-fg-2">
                    {t(`tripDocuments.category.${a.category}`, { defaultValue: a.category })}
                    {a.expires_on && ` · ${t('tripDocuments.validUntil', { date: formatDate(`${a.expires_on}T12:00:00Z`) })}`}
                  </p>
                </div>
                {staff && a.kind === 'document' && (
                  <label className="flex items-center gap-2 text-xs font-semibold text-fg-2">
                    <Switch
                      checked={a.visible_to_passengers}
                      onCheckedChange={(v) => update.mutate({ id: a.id, visible_to_passengers: v })}
                      aria-label={`${t('tripDocuments.visible')} · ${label}`}
                    />
                    {t('tripDocuments.passengers')}
                  </label>
                )}
                {a.storage_path && (
                  <Button size="icon" variant="ghost" className="size-9" onClick={() => void open(a.storage_path!, label)} aria-label={`${t('tripDocuments.open')} ${label}`}>
                    <Eye aria-hidden="true" />
                  </Button>
                )}
                {staff && (
                  <Button size="icon" variant="ghost" className="size-9 text-danger" onClick={() => remove.mutate(a)} aria-label={`${t('common.remove')} ${label}`}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <FormError error={openError ?? update.error ?? remove.error} />
      {adding && <AddTripDocumentDialog taskId={task.id} open onOpenChange={setAdding} />}
    </div>
  );
}
