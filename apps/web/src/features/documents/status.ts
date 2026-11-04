import type { DocumentType, Driver, DriverDocument, JobTitleDocument } from '@/mocks/fixtures';

/**
 * Document status (0005), shared by the driver profile, the Documents page
 * and the drivers list. Same thresholds as fn_document_reminders: expired
 * after the expiry date, "expiring" inside the type's reminder window.
 */
export type DocStatus = 'missing' | 'expired' | 'expiring' | 'valid';

export const STATUS_RANK: Record<DocStatus, number> = { expired: 0, missing: 1, expiring: 2, valid: 3 };

/** Whole days from `today` (YYYY-MM-DD, company time) to `date`. */
export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

export function documentStatus(doc: Pick<DriverDocument, 'expires_on'> | null, type: Pick<DocumentType, 'has_expiry' | 'remind_days'>, today: string) {
  if (!doc) return { status: 'missing' as DocStatus, daysLeft: null };
  if (!type.has_expiry || !doc.expires_on) return { status: 'valid' as DocStatus, daysLeft: null };
  const daysLeft = daysUntil(doc.expires_on, today);
  const status: DocStatus = daysLeft < 0 ? 'expired' : daysLeft <= type.remind_days ? 'expiring' : 'valid';
  return { status, daysLeft };
}

export interface DocumentItem {
  driverId: string;
  type: DocumentType;
  /** required by the driver's job title (else an extra document on file) */
  required: boolean;
  doc: DriverDocument | null;
  status: DocStatus;
  daysLeft: number | null;
}

/** A driver's papers: everything their job title requires, plus anything else on file. Most urgent first. */
export function driverDocumentItems(
  driver: Pick<Driver, 'id' | 'job_title_id'>,
  types: DocumentType[],
  requirements: JobTitleDocument[],
  docs: DriverDocument[],
  today: string,
): DocumentItem[] {
  const required = new Set(requirements.filter((r) => r.job_title_id === driver.job_title_id).map((r) => r.document_type_id));
  const mine = docs.filter((d) => d.driver_id === driver.id);
  return types
    .filter((type) => required.has(type.id) || mine.some((d) => d.document_type_id === type.id))
    .map((type) => {
      const doc = mine.find((d) => d.document_type_id === type.id) ?? null;
      return { driverId: driver.id, type, required: required.has(type.id), doc, ...documentStatus(doc, type, today) };
    })
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity) || a.type.name.localeCompare(b.type.name));
}

/** Count per status (for badges and KPI tiles). */
export function countByStatus(items: Pick<DocumentItem, 'status'>[]): Record<DocStatus, number> {
  const out: Record<DocStatus, number> = { missing: 0, expired: 0, expiring: 0, valid: 0 };
  for (const item of items) out[item.status]++;
  return out;
}
