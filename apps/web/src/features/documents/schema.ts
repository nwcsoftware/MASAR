import { z } from 'zod';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'documents.errors.date');

/** A document type in the company catalogue (0005). Messages are i18n keys. */
export const documentTypeSchema = z.object({
  name: z.string().trim().min(2, 'documents.errors.typeName'),
  name_ar: z.string().trim().optional(),
  has_expiry: z.boolean(),
  /** the driver card names the licence type from these (0006) */
  is_driving_licence: z.boolean(),
  remind_days: z.number({ message: 'documents.errors.remindDays' }).int('documents.errors.remindDays').min(0, 'documents.errors.remindDays').max(365, 'documents.errors.remindDays'),
  is_active: z.boolean(),
});
export type DocumentTypeValues = z.infer<typeof documentTypeSchema>;

/** A job title and the documents it requires (rpc_save_job_title). */
export const jobTitleSchema = z.object({
  name: z.string().trim().min(2, 'documents.errors.jobName'),
  name_ar: z.string().trim().optional(),
  description: z.string().trim().optional(),
  is_active: z.boolean(),
  document_type_ids: z.array(z.string()),
});
export type JobTitleValues = z.infer<typeof jobTitleSchema>;

export const MAX_FILE_MB = 10;
export const ACCEPTED_FILES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

/**
 * One driver document. Issue date always; expiry when the type expires
 * (checked against the type in the form, and by trg_driver_documents_check).
 */
export const driverDocumentSchema = z
  .object({
    document_no: z.string().trim().optional(),
    issued_on: date,
    expires_on: date.or(z.literal('')),
    notes: z.string().trim().optional(),
    has_expiry: z.boolean(),
  })
  .refine((v) => !v.has_expiry || v.expires_on, { path: ['expires_on'], message: 'documents.errors.expiryRequired' })
  .refine((v) => !v.expires_on || v.expires_on > v.issued_on, { path: ['expires_on'], message: 'documents.errors.expiryOrder' });
export type DriverDocumentValues = z.infer<typeof driverDocumentSchema>;

/** File check before upload: type and size. Returns an i18n key or null. */
export function fileProblem(file: File): string | null {
  if (!ACCEPTED_FILES.includes(file.type)) return 'documents.errors.fileType';
  if (file.size > MAX_FILE_MB * 1024 * 1024) return 'documents.errors.fileSize';
  return null;
}
