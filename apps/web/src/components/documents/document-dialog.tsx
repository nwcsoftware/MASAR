import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileCheck2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Field, FormError, NativeSelect } from '@/components/form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useSaveDriverDocument } from '@/features/documents/queries';
import { ACCEPTED_FILES, driverDocumentSchema, fileProblem, MAX_FILE_MB, type DriverDocumentValues } from '@/features/documents/schema';
import { useLocalizedName } from '@/lib/i18n-data';
import type { DocumentType, DriverDocument } from '@/mocks/fixtures';

/**
 * Upload / renew one driver document: the copy plus its number, issue date
 * and expiry date (expiry required when the type expires). A new document
 * needs a copy; when renewing, a new copy replaces the old one. Mounted
 * fresh for each document, so its state starts clean.
 */
export function DocumentDialog({
  open,
  onOpenChange,
  driverId,
  type,
  existing,
  choosableTypes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driverId: string;
  /** fixed type (a requirement row); when absent the user picks from choosableTypes */
  type: DocumentType | null;
  existing: DriverDocument | null;
  choosableTypes?: DocumentType[];
}) {
  const { t, i18n } = useTranslation();
  const name = useLocalizedName();
  const save = useSaveDriverDocument();
  const [typeId, setTypeId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const chosen = type ?? choosableTypes?.find((x) => x.id === typeId) ?? null;
  const form = useForm<DriverDocumentValues>({
    resolver: zodResolver(driverDocumentSchema),
    defaultValues: {
      document_no: existing?.document_no ?? '',
      issued_on: existing?.issued_on ?? '',
      expires_on: existing?.expires_on ?? '',
      notes: existing?.notes ?? '',
      has_expiry: type?.has_expiry ?? true,
    },
  });
  const errors = form.formState.errors;

  useEffect(() => {
    form.setValue('has_expiry', chosen?.has_expiry ?? true);
  }, [chosen?.has_expiry, form]);

  const needsFile = !existing?.storage_path;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? t('documents.renewTitle', { type: chosen ? name(chosen) : '' }) : chosen ? t('documents.uploadTitle', { type: name(chosen) }) : t('documents.addOther')}</DialogTitle>
          <DialogDescription>{t('documents.dialogHint', { mb: MAX_FILE_MB })}</DialogDescription>
        </DialogHeader>
        <form
          id="document-form"
          noValidate
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={form.handleSubmit((values) => {
            if (!chosen) return;
            if (needsFile && !file) return setFileError('documents.errors.fileRequired');
            save.mutate({ driverId, typeId: chosen.id, existing, values, file }, { onSuccess: () => onOpenChange(false) });
          })}
        >
          {!type && (
            <Field id="doc-type" label={t('documents.type')} className="sm:col-span-2">
              <NativeSelect id="doc-type" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                <option value="">{t('documents.chooseType')}</option>
                {(choosableTypes ?? []).map((x) => (
                  <option key={x.id} value={x.id}>
                    {name(x)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          <Field
            id="doc-file"
            label={t('documents.copy')}
            className="sm:col-span-2"
            error={fileError ?? undefined}
            hint={existing?.file_name ? t('documents.currentCopy', { file: existing.file_name }) : undefined}
          >
            <Input
              id="doc-file"
              type="file"
              accept={ACCEPTED_FILES.join(',')}
              onChange={(e) => {
                const picked = e.target.files?.[0] ?? null;
                const problem = picked ? fileProblem(picked) : null;
                setFileError(problem);
                setFile(problem ? null : picked);
              }}
            />
          </Field>
          {file && (
            <p className="flex items-center gap-2 text-xs font-semibold text-success-fg sm:col-span-2">
              <FileCheck2 className="size-4" aria-hidden="true" />
              {file.name}
            </p>
          )}
          <Field id="doc-no" label={t('documents.number')} className="sm:col-span-2">
            <Input id="doc-no" dir="ltr" {...form.register('document_no')} />
          </Field>
          <Field id="doc-issued" label={t('documents.issued')} error={errors.issued_on?.message}>
            <Input id="doc-issued" type="date" dir="ltr" lang={i18n.language} {...form.register('issued_on')} />
          </Field>
          {chosen?.has_expiry !== false && (
            <Field id="doc-expires" label={t('documents.expires')} error={errors.expires_on?.message}>
              <Input id="doc-expires" type="date" dir="ltr" lang={i18n.language} {...form.register('expires_on')} />
            </Field>
          )}
          <Field id="doc-notes" label={t('sites.notes')} className="sm:col-span-2">
            <Textarea id="doc-notes" rows={2} {...form.register('notes')} />
          </Field>
          <FormError error={save.error} className="sm:col-span-2" />
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="document-form" disabled={save.isPending || !chosen}>
            {save.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
