import { describe, expect, it } from 'vitest';
import { DOCUMENT_PRESETS, presetFor } from '@/features/documents/presets';
import { documentTypeSchema, driverDocumentSchema, fileProblem } from '@/features/documents/schema';
import { countByStatus, daysUntil, documentStatus, driverDocumentItems } from '@/features/documents/status';
import { companyDateKey } from '@/lib/format';
import { mockDb } from '@/mocks/db';
import { IDS } from '@/mocks/fixtures';

const T = IDS.docTypes;
const items = (driverId: string) => {
  const driver = mockDb.drivers.find((d) => d.id === driverId)!;
  return driverDocumentItems(driver, mockDb.documentTypes, mockDb.jobTitleDocuments, mockDb.driverDocuments, companyDateKey());
};

describe('document status (0005, same windows as fn_document_reminders)', () => {
  const type = { has_expiry: true, remind_days: 30 };
  it('expired / expiring / valid / missing', () => {
    expect(daysUntil('2026-11-13', '2026-11-03')).toBe(10);
    expect(documentStatus({ expires_on: '2026-11-02' }, type, '2026-11-03')).toEqual({ status: 'expired', daysLeft: -1 });
    expect(documentStatus({ expires_on: '2026-11-03' }, type, '2026-11-03')).toEqual({ status: 'expiring', daysLeft: 0 });
    expect(documentStatus({ expires_on: '2026-12-03' }, type, '2026-11-03')).toEqual({ status: 'expiring', daysLeft: 30 });
    expect(documentStatus({ expires_on: '2026-12-04' }, type, '2026-11-03')).toEqual({ status: 'valid', daysLeft: 31 });
    expect(documentStatus(null, type, '2026-11-03').status).toBe('missing');
    expect(documentStatus({ expires_on: null }, { has_expiry: false, remind_days: 30 }, '2026-11-03').status).toBe('valid');
  });

  it('the job title puts its requirements on the driver; urgent first', () => {
    const khalid = items(IDS.drivers.khalid);
    expect(khalid.map((i) => [i.type.id, i.status])).toEqual([
      [T.authorisation, 'expired'],
      [T.insurance, 'missing'],
      [T.lightLicence, 'expiring'],
      [T.iqama, 'valid'],
      [T.passport, 'valid'],
    ]);
    // Yousef is heavy duty: heavy licence required, light licence not listed
    const yousef = items(IDS.drivers.yousef).map((i) => i.type.id);
    expect(yousef).toContain(T.heavyLicence);
    expect(yousef).not.toContain(T.lightLicence);
    expect(countByStatus(items(IDS.drivers.fahad))).toEqual({ missing: 0, expired: 0, expiring: 0, valid: 5 });
  });

  it('a document outside the job title shows as extra; no job title → only what is on file', () => {
    const fahad = mockDb.drivers.find((d) => d.id === IDS.drivers.fahad)!;
    const none = driverDocumentItems({ ...fahad, job_title_id: null }, mockDb.documentTypes, mockDb.jobTitleDocuments, mockDb.driverDocuments, companyDateKey());
    expect(none.every((i) => !i.required)).toBe(true);
    expect(none).toHaveLength(5);
  });
});

describe('document forms', () => {
  it('expiry required when the type expires, and after the issue date', () => {
    const msg = (v: object) => driverDocumentSchema.safeParse({ document_no: '', notes: '', ...v }).error?.issues.map((i) => i.message) ?? [];
    expect(msg({ issued_on: '2025-01-01', expires_on: '', has_expiry: true })).toEqual(['documents.errors.expiryRequired']);
    expect(msg({ issued_on: '2025-01-01', expires_on: '2024-12-31', has_expiry: true })).toEqual(['documents.errors.expiryOrder']);
    expect(msg({ issued_on: '2025-01-01', expires_on: '', has_expiry: false })).toEqual([]);
    expect(msg({ issued_on: '', expires_on: '2026-01-01', has_expiry: true })).toEqual(['documents.errors.date']);
  });

  it('accepts PDFs and photos up to 10 MB', () => {
    expect(fileProblem(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).toBeNull();
    expect(fileProblem(new File(['x'], 'a.docx', { type: 'application/msword' }))).toBe('documents.errors.fileType');
    const big = new File([new Uint8Array(11 * 1024 * 1024)], 'b.jpg', { type: 'image/jpeg' });
    expect(fileProblem(big)).toBe('documents.errors.fileSize');
  });

  it('document types and presets', () => {
    expect(documentTypeSchema.safeParse({ name: 'Visa', has_expiry: true, is_driving_licence: false, remind_days: 400, is_active: true }).error?.issues[0]?.message).toBe('documents.errors.remindDays');
    expect(presetFor('SA')).toBe('SA');
    expect(presetFor('EG')).toBe('generic');
    for (const set of Object.values(DOCUMENT_PRESETS)) for (const p of set) expect(documentTypeSchema.safeParse({ ...p, is_active: true, is_driving_licence: false }).success).toBe(true);
  });
});
