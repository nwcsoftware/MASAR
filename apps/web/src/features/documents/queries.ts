import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/features/auth/session';
import { AppError, db, unwrap, useDualMutation, useLiveData } from '@/lib/data-source';
import { mockDb, mockQuery } from '@/mocks/db';
import type { DocumentType, DriverDocument, JobTitle, JobTitleDocument } from '@/mocks/fixtures';
import { DOCUMENT_PRESETS, isLicence, type PresetCountry } from './presets';
import type { DocumentTypeValues, DriverDocumentValues, JobTitleValues } from './schema';

export const BUCKET = 'driver-documents';

export const documentKeys = {
  types: (companyId: string) => ['documents', companyId, 'types'] as const,
  jobTitles: (companyId: string) => ['documents', companyId, 'jobTitles'] as const,
  driverDocs: (companyId: string) => ['documents', companyId, 'driverDocs'] as const,
};

function useCompanyId() {
  return useCurrentUser().profile.company_id ?? '';
}

// ---------------------------------------------------------------------------
// reads
// ---------------------------------------------------------------------------
export function useDocumentTypes() {
  const companyId = useCompanyId();
  const live = useLiveData();
  return useQuery({
    queryKey: documentKeys.types(companyId),
    queryFn: async () =>
      live
        ? (unwrap(await db().from('document_types').select('*').order('name')) ?? [])
        : mockQuery<DocumentType[]>(() => [...mockDb.documentTypes].sort((a, b) => a.name.localeCompare(b.name)), []),
  });
}

export interface JobTitlesData {
  titles: JobTitle[];
  requirements: JobTitleDocument[];
}

export function useJobTitles() {
  const companyId = useCompanyId();
  const live = useLiveData();
  return useQuery({
    queryKey: documentKeys.jobTitles(companyId),
    queryFn: async (): Promise<JobTitlesData> => {
      if (!live) {
        return mockQuery(
          () => ({ titles: [...mockDb.jobTitles].sort((a, b) => a.name.localeCompare(b.name)), requirements: mockDb.jobTitleDocuments }),
          { titles: [], requirements: [] },
        );
      }
      const [titles, requirements] = await Promise.all([
        db().from('job_titles').select('*').order('name'),
        db().from('job_title_documents').select('*'),
      ]);
      return { titles: unwrap(titles) ?? [], requirements: unwrap(requirements) ?? [] };
    },
  });
}

/** Every driver document the caller may see (RLS: staff/viewers all, a driver their own). */
export function useDriverDocuments() {
  const companyId = useCompanyId();
  const live = useLiveData();
  return useQuery({
    queryKey: documentKeys.driverDocs(companyId),
    queryFn: async () =>
      live
        ? (unwrap(await db().from('driver_documents').select('*')) ?? [])
        : mockQuery<DriverDocument[]>(() => mockDb.driverDocuments, []),
  });
}

// ---------------------------------------------------------------------------
// catalogue writes (admin)
// ---------------------------------------------------------------------------
const typeRow = (values: DocumentTypeValues, companyId: string) => ({
  company_id: companyId,
  name: values.name,
  name_ar: values.name_ar || null,
  has_expiry: values.has_expiry,
  is_driving_licence: values.is_driving_licence,
  remind_days: values.remind_days,
  is_active: values.is_active,
});

export function useSaveDocumentType() {
  const companyId = useCompanyId();
  return useDualMutation<{ id?: string; values: DocumentTypeValues }, void>({
    live: async ({ id, values }) => {
      const row = typeRow(values, companyId);
      const result = id ? await db().from('document_types').update(row).eq('id', id) : await db().from('document_types').insert(row);
      if (result.error?.code === '23505') throw new AppError(result.error.message, 'documents.errors.typeExists');
      unwrap(result);
    },
    mock: ({ id, values }) => {
      const row = typeRow(values, companyId);
      if (mockDb.documentTypes.some((t) => t.name.toLowerCase() === row.name.toLowerCase() && t.id !== id)) {
        throw new AppError('duplicate', 'documents.errors.typeExists');
      }
      const existing = id ? mockDb.documentTypes.find((t) => t.id === id) : undefined;
      if (existing) Object.assign(existing, row);
      else mockDb.documentTypes.push({ ...row, id: crypto.randomUUID(), description: null, created_at: new Date().toISOString() });
    },
    invalidate: () => [documentKeys.types(companyId)],
  });
}

/** Refused while any driver holds the type (on delete restrict). */
export function useDeleteDocumentType() {
  const companyId = useCompanyId();
  return useDualMutation<string, void>({
    live: async (id) => {
      const result = await db().from('document_types').delete().eq('id', id);
      if (result.error?.code === '23503') throw new AppError(result.error.message, 'documents.errors.typeInUse');
      unwrap(result);
    },
    mock: (id) => {
      if (mockDb.driverDocuments.some((d) => d.document_type_id === id)) throw new AppError('in use', 'documents.errors.typeInUse');
      mockDb.documentTypes = mockDb.documentTypes.filter((t) => t.id !== id);
      mockDb.jobTitleDocuments = mockDb.jobTitleDocuments.filter((r) => r.document_type_id !== id);
    },
    invalidate: () => [documentKeys.types(companyId), documentKeys.jobTitles(companyId)],
  });
}

/** Add a country's starter set, skipping names the company already has. Resolves how many were added. */
export function useAddDocumentPresets() {
  const companyId = useCompanyId();
  return useDualMutation<{ country: PresetCountry; existing: string[] }, number>({
    live: async ({ country, existing }) => {
      const have = new Set(existing.map((n) => n.toLowerCase()));
      const rows = DOCUMENT_PRESETS[country]
        .filter((p) => !have.has(p.name.toLowerCase()))
        .map((p) => typeRow({ ...p, is_active: true, is_driving_licence: isLicence(p.name) }, companyId));
      if (rows.length) unwrap(await db().from('document_types').insert(rows));
      return rows.length;
    },
    mock: ({ country }) => {
      const have = new Set(mockDb.documentTypes.map((t) => t.name.toLowerCase()));
      const rows = DOCUMENT_PRESETS[country].filter((p) => !have.has(p.name.toLowerCase()));
      const now = new Date().toISOString();
      for (const p of rows) {
        mockDb.documentTypes.push({ ...typeRow({ ...p, is_active: true, is_driving_licence: isLicence(p.name) }, companyId), id: crypto.randomUUID(), description: null, created_at: now });
      }
      return rows.length;
    },
    invalidate: () => [documentKeys.types(companyId)],
  });
}

export function useSaveJobTitle() {
  const companyId = useCompanyId();
  return useDualMutation<{ id?: string; values: JobTitleValues }, string>({
    live: async ({ id, values }) => unwrap(await db().rpc('rpc_save_job_title', { p_title: { id, ...values } }))!,
    mock: ({ id, values }) => {
      if (mockDb.jobTitles.some((j) => j.name.toLowerCase() === values.name.toLowerCase() && j.id !== id)) {
        throw new AppError('duplicate', 'documents.errors.jobExists');
      }
      const row = { name: values.name, name_ar: values.name_ar || null, description: values.description || null, is_active: values.is_active };
      let jobId = id;
      const existing = id ? mockDb.jobTitles.find((j) => j.id === id) : undefined;
      if (existing) Object.assign(existing, row);
      else {
        jobId = crypto.randomUUID();
        mockDb.jobTitles.push({ ...row, id: jobId, company_id: companyId, created_at: new Date().toISOString() });
      }
      mockDb.jobTitleDocuments = [
        ...mockDb.jobTitleDocuments.filter((r) => r.job_title_id !== jobId),
        ...values.document_type_ids.map((document_type_id) => ({ job_title_id: jobId!, document_type_id })),
      ];
      return jobId!;
    },
    invalidate: () => [documentKeys.jobTitles(companyId)],
  });
}

export function useDeleteJobTitle() {
  const companyId = useCompanyId();
  return useDualMutation<string, void>({
    live: async (id) => {
      unwrap(await db().from('job_titles').delete().eq('id', id));
    },
    mock: (id) => {
      mockDb.jobTitles = mockDb.jobTitles.filter((j) => j.id !== id);
      mockDb.jobTitleDocuments = mockDb.jobTitleDocuments.filter((r) => r.job_title_id !== id);
      for (const d of mockDb.drivers) if (d.job_title_id === id) d.job_title_id = null;
    },
    invalidate: () => [documentKeys.jobTitles(companyId), ['drivers', companyId]],
  });
}

// ---------------------------------------------------------------------------
// driver documents (admin): copy in the private bucket + one row per type
// ---------------------------------------------------------------------------
export interface SaveDriverDocumentInput {
  driverId: string;
  typeId: string;
  existing: DriverDocument | null;
  values: DriverDocumentValues;
  /** a new copy; omitted when only the dates/number change */
  file?: File | null;
}

const safeName = (name: string) => name.normalize('NFKD').replace(/[^\w.-]+/g, '_').slice(-80);

export function useSaveDriverDocument() {
  const user = useCurrentUser();
  const companyId = useCompanyId();
  return useDualMutation<SaveDriverDocumentInput, void>({
    live: async ({ driverId, typeId, existing, values, file }) => {
      let upload: { storage_path: string; file_name: string; file_type: string; file_size: number } | null = null;
      if (file) {
        const path = `${companyId}/${driverId}/${crypto.randomUUID()}-${safeName(file.name)}`;
        unwrap(await db().storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false }));
        upload = { storage_path: path, file_name: file.name, file_type: file.type, file_size: file.size };
      }
      const row = {
        company_id: companyId,
        driver_id: driverId,
        document_type_id: typeId,
        document_no: values.document_no || null,
        issued_on: values.issued_on,
        expires_on: values.expires_on || null,
        notes: values.notes || null,
        uploaded_by: user.id,
        ...upload,
      };
      const result = await db().from('driver_documents').upsert(row, { onConflict: 'driver_id,document_type_id' });
      if (result.error) {
        if (upload) await db().storage.from(BUCKET).remove([upload.storage_path]);
        unwrap(result);
      }
      // the replaced copy is no longer referenced
      if (upload && existing?.storage_path) await db().storage.from(BUCKET).remove([existing.storage_path]);
    },
    mock: ({ driverId, typeId, existing, values, file }) => {
      const now = new Date().toISOString();
      const fields = {
        document_no: values.document_no || null,
        issued_on: values.issued_on,
        expires_on: values.expires_on || null,
        notes: values.notes || null,
        uploaded_by: user.id,
        updated_at: now,
        ...(file ? { storage_path: URL.createObjectURL(file), file_name: file.name, file_type: file.type, file_size: file.size } : {}),
      };
      const current = existing ? mockDb.driverDocuments.find((d) => d.id === existing.id) : undefined;
      if (current) Object.assign(current, fields);
      else {
        mockDb.driverDocuments.push({
          id: crypto.randomUUID(),
          company_id: companyId,
          driver_id: driverId,
          document_type_id: typeId,
          storage_path: null,
          file_name: null,
          file_type: null,
          file_size: null,
          created_at: now,
          ...fields,
        });
      }
    },
    invalidate: () => [documentKeys.driverDocs(companyId)],
  });
}

export function useDeleteDriverDocument() {
  const companyId = useCompanyId();
  return useDualMutation<DriverDocument, void>({
    live: async (doc) => {
      unwrap(await db().from('driver_documents').delete().eq('id', doc.id));
      if (doc.storage_path) await db().storage.from(BUCKET).remove([doc.storage_path]);
    },
    mock: (doc) => {
      mockDb.driverDocuments = mockDb.driverDocuments.filter((d) => d.id !== doc.id);
    },
    invalidate: () => [documentKeys.driverDocs(companyId)],
  });
}

/** A short-lived link to a copy (private bucket); demo copies render a placeholder. */
export async function documentFileUrl(path: string, live: boolean, label: string): Promise<string> {
  return storageFileUrl(BUCKET, path, live, label);
}

/** Signed link to a private file in any bucket (trip documents, rating photos …). */
export async function storageFileUrl(bucket: string, path: string, live: boolean, label: string): Promise<string> {
  if (live) return unwrap(await db().storage.from(bucket).createSignedUrl(path, 300))!.signedUrl;
  if (path.startsWith('blob:') || path.startsWith('data:')) return path;
  const safe = label.replace(/[<>&"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><rect width="100%" height="100%" fill="whitesmoke"/><rect x="20" y="20" width="600" height="380" rx="18" fill="white" stroke="lightsteelblue" stroke-width="2"/><text x="50%" y="45%" text-anchor="middle" font-family="sans-serif" font-size="26" fill="royalblue">${safe}</text><text x="50%" y="58%" text-anchor="middle" font-family="sans-serif" font-size="16" fill="dimgray">Sample copy · Masar demo</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
