import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BriefcaseBusiness, FileText, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Field, FormError } from '@/components/form';
import { Panel } from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/features/auth/session';
import {
  useAddDocumentPresets,
  useDeleteDocumentType,
  useDeleteJobTitle,
  useDocumentTypes,
  useJobTitles,
  useSaveDocumentType,
  useSaveJobTitle,
} from '@/features/documents/queries';
import { presetFor } from '@/features/documents/presets';
import { documentTypeSchema, jobTitleSchema, type DocumentTypeValues, type JobTitleValues } from '@/features/documents/schema';
import { useLocalizedName } from '@/lib/i18n-data';
import type { DocumentType, JobTitle } from '@/mocks/fixtures';

const TYPE_DEFAULTS: DocumentTypeValues = { name: '', name_ar: '', has_expiry: true, is_driving_licence: false, remind_days: 30, is_active: true };

function DocumentTypeDialog({ open, onOpenChange, type }: { open: boolean; onOpenChange: (open: boolean) => void; type?: DocumentType }) {
  const { t } = useTranslation();
  const save = useSaveDocumentType();
  const form = useForm<DocumentTypeValues>({ resolver: zodResolver(documentTypeSchema), defaultValues: TYPE_DEFAULTS });
  const errors = form.formState.errors;
  const hasExpiry = form.watch('has_expiry');

  useEffect(() => {
    if (!open) return;
    form.reset(type ? { name: type.name, name_ar: type.name_ar ?? '', has_expiry: type.has_expiry, is_driving_licence: type.is_driving_licence, remind_days: type.remind_days, is_active: type.is_active } : TYPE_DEFAULTS);
    save.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type?.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{type ? t('documents.types.edit') : t('documents.types.add')}</DialogTitle>
          <DialogDescription>{t('documents.types.hint')}</DialogDescription>
        </DialogHeader>
        <form id="doc-type-form" noValidate className="space-y-4" onSubmit={form.handleSubmit((values) => save.mutate({ id: type?.id, values }, { onSuccess: () => onOpenChange(false) }))}>
          <Field id="dt-name" label={t('documents.types.name')} error={errors.name?.message}>
            <Input id="dt-name" {...form.register('name')} />
          </Field>
          <Field id="dt-name-ar" label={t('documents.types.nameAr')}>
            <Input id="dt-name-ar" dir="rtl" {...form.register('name_ar')} />
          </Field>
          <label className="flex items-center gap-3 text-sm font-semibold">
            <Switch checked={hasExpiry} onCheckedChange={(v) => form.setValue('has_expiry', v, { shouldDirty: true })} />
            {t('documents.types.hasExpiry')}
          </label>
          <label className="flex items-center gap-3 text-sm font-semibold">
            <Switch checked={form.watch('is_driving_licence')} onCheckedChange={(v) => form.setValue('is_driving_licence', v, { shouldDirty: true })} />
            {t('documents.types.isLicence')}
          </label>
          {hasExpiry && (
            <Field id="dt-remind" label={t('documents.types.remindDays')} hint={t('documents.types.remindHint')} error={errors.remind_days?.message}>
              <Input id="dt-remind" type="number" min={0} max={365} className="tabular" {...form.register('remind_days', { valueAsNumber: true })} />
            </Field>
          )}
          {type && (
            <label className="flex items-center gap-3 text-sm font-semibold">
              <Switch checked={form.watch('is_active')} onCheckedChange={(v) => form.setValue('is_active', v, { shouldDirty: true })} />
              {t('common.active')}
            </label>
          )}
          <FormError error={save.error} />
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="doc-type-form" disabled={save.isPending}>
            {save.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JobTitleDialog({
  open,
  onOpenChange,
  job,
  required,
  types,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job?: JobTitle;
  required: string[];
  types: DocumentType[];
}) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const save = useSaveJobTitle();
  const form = useForm<JobTitleValues>({
    resolver: zodResolver(jobTitleSchema),
    defaultValues: { name: '', name_ar: '', description: '', is_active: true, document_type_ids: [] },
  });
  const errors = form.formState.errors;
  const selected = form.watch('document_type_ids');

  useEffect(() => {
    if (!open) return;
    form.reset({ name: job?.name ?? '', name_ar: job?.name_ar ?? '', description: job?.description ?? '', is_active: job?.is_active ?? true, document_type_ids: required });
    save.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, job?.id]);

  const toggle = (id: string, on: boolean) =>
    form.setValue('document_type_ids', on ? [...selected, id] : selected.filter((x) => x !== id), { shouldDirty: true });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{job ? t('documents.jobs.edit') : t('documents.jobs.add')}</DialogTitle>
          <DialogDescription>{t('documents.jobs.hint')}</DialogDescription>
        </DialogHeader>
        <form id="job-form" noValidate className="space-y-4" onSubmit={form.handleSubmit((values) => save.mutate({ id: job?.id, values }, { onSuccess: () => onOpenChange(false) }))}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="job-name" label={t('documents.jobs.name')} error={errors.name?.message}>
              <Input id="job-name" placeholder={t('documents.jobs.namePlaceholder')} {...form.register('name')} />
            </Field>
            <Field id="job-name-ar" label={t('documents.types.nameAr')}>
              <Input id="job-name-ar" dir="rtl" {...form.register('name_ar')} />
            </Field>
          </div>
          <Field id="job-desc" label={t('documents.jobs.description')}>
            <Textarea id="job-desc" rows={2} {...form.register('description')} />
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-fg">{t('documents.jobs.required')}</legend>
            {!types.length ? (
              <p className="text-xs text-fg-3">{t('documents.jobs.noTypes')}</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {types.map((type) => (
                  <li key={type.id}>
                    <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-2">
                      <Checkbox checked={selected.includes(type.id)} onCheckedChange={(v) => toggle(type.id, v === true)} aria-label={name(type)} />
                      {name(type)}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
          <FormError error={save.error} />
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="job-form" disabled={save.isPending}>
            {save.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 0005 — the documents drivers must hold: the company's document types, and
 * job titles listing what each job needs to work legally. A driver's job
 * title puts those documents on their profile.
 */
export function DocumentsTab() {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const { company } = useCurrentUser();
  const types = useDocumentTypes();
  const jobs = useJobTitles();
  const presets = useAddDocumentPresets();
  const removeType = useDeleteDocumentType();
  const removeJob = useDeleteJobTitle();
  const [typeDialog, setTypeDialog] = useState<{ type?: DocumentType } | null>(null);
  const [jobDialog, setJobDialog] = useState<{ job?: JobTitle } | null>(null);
  const country = presetFor(company?.country_code);

  if (types.isPending || jobs.isPending) return <Skeleton className="h-64 w-full" />;
  if (types.isError) return <ErrorState error={types.error} onRetry={() => void types.refetch()} />;
  if (jobs.isError) return <ErrorState error={jobs.error} onRetry={() => void jobs.refetch()} />;

  const requiredFor = (jobId: string) => jobs.data.requirements.filter((r) => r.job_title_id === jobId).map((r) => r.document_type_id);
  const activeTypes = types.data.filter((x) => x.is_active);

  return (
    <div className="space-y-5">
      <Panel
        title={t('documents.jobs.title')}
        action={
          <Button size="sm" onClick={() => setJobDialog({})}>
            <Plus aria-hidden="true" />
            {t('documents.jobs.add')}
          </Button>
        }
        bodyClassName="p-0"
      >
        {!jobs.data.titles.length ? (
          <EmptyState compact icon={BriefcaseBusiness} title={t('documents.jobs.empty')} body={t('documents.jobs.emptyBody')} />
        ) : (
          <ul className="divide-y divide-border">
            {jobs.data.titles.map((job) => {
              const required = requiredFor(job.id);
              return (
                <li key={job.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="flex items-center gap-2 text-sm font-bold text-fg">
                      {name(job)}
                      {!job.is_active && <Badge>{t('common.inactive')}</Badge>}
                    </p>
                    {job.description && <p className="text-xs text-fg-3">{job.description}</p>}
                    <div className="flex flex-wrap gap-1.5">
                      {required.length ? (
                        required.map((id) => {
                          const type = types.data.find((x) => x.id === id);
                          return type ? <Badge key={id}>{name(type)}</Badge> : null;
                        })
                      ) : (
                        <span className="text-xs text-warning-fg">{t('documents.jobs.noneRequired')}</span>
                      )}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="size-9" onClick={() => setJobDialog({ job })} aria-label={`${t('common.edit')} ${name(job)}`}>
                    <Pencil aria-hidden="true" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-9 text-danger" onClick={() => removeJob.mutate(job.id)} aria-label={`${t('common.remove')} ${name(job)}`}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel
        title={t('documents.types.title')}
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={presets.isPending} onClick={() => presets.mutate({ country, existing: types.data.map((x) => x.name) })}>
              <Sparkles aria-hidden="true" />
              {t(`documents.types.preset.${country}`)}
            </Button>
            <Button size="sm" onClick={() => setTypeDialog({})}>
              <Plus aria-hidden="true" />
              {t('documents.types.add')}
            </Button>
          </div>
        }
        bodyClassName="p-0"
      >
        {presets.isSuccess && <p className="border-b border-border px-4 py-2 text-xs font-semibold text-success-fg">{t('documents.types.presetAdded', { count: presets.data })}</p>}
        <FormError error={removeType.error ?? removeJob.error} className="m-4" />
        {!types.data.length ? (
          <EmptyState compact icon={FileText} title={t('documents.types.empty')} body={t('documents.types.emptyBody')} />
        ) : (
          <ul className="divide-y divide-border">
            {types.data.map((type) => (
              <li key={type.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{name(type)}</span>
                  {!type.is_active && <Badge className="ms-2">{t('common.inactive')}</Badge>}
                </span>
                <span className="text-xs text-fg-3">
                  {type.has_expiry ? t('documents.types.remindsBefore', { count: type.remind_days }) : t('documents.types.noExpiry')}
                </span>
                <Button size="icon" variant="ghost" className="size-9" onClick={() => setTypeDialog({ type })} aria-label={`${t('common.edit')} ${name(type)}`}>
                  <Pencil aria-hidden="true" />
                </Button>
                <Button size="icon" variant="ghost" className="size-9 text-danger" onClick={() => removeType.mutate(type.id)} aria-label={`${t('common.remove')} ${name(type)}`}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <DocumentTypeDialog open={Boolean(typeDialog)} onOpenChange={(o) => !o && setTypeDialog(null)} type={typeDialog?.type} />
      <JobTitleDialog
        open={Boolean(jobDialog)}
        onOpenChange={(o) => !o && setJobDialog(null)}
        job={jobDialog?.job}
        required={jobDialog?.job ? requiredFor(jobDialog.job.id) : []}
        types={activeTypes}
      />
    </div>
  );
}
