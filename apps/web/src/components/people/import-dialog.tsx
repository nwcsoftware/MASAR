import { useMemo, useState } from 'react';
import { CircleCheck, Download, FileSpreadsheet, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Field, FormError, NativeSelect } from '@/components/form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useImportPeople } from '@/features/people/queries';
import { guessMapping, IMPORT_FIELDS, mapRows, readSheet, TEMPLATE_ROWS, type ImportField } from '@/features/people/import';
import { downloadCsv } from '@/lib/csv';
import { cn } from '@/lib/utils';

const PREVIEW_ROWS = 8;

/**
 * Staff import from Excel/CSV: pick a file → check which column feeds which
 * field (guessed from the headers, EN or AR) → preview with per-row errors →
 * import the valid rows (rpc_import_people, upsert by employee number).
 */
export function ImportPeopleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t, i18n } = useTranslation();
  const importPeople = useImportPeople();
  const [cells, setCells] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState('');
  const [readError, setReadError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<ImportField, number>>>({});

  const reset = () => {
    setCells(null);
    setFileName('');
    setReadError(null);
    setMapping({});
    importPeople.reset();
  };

  const mapped = useMemo(() => (cells ? mapRows(cells, mapping) : []), [cells, mapping]);
  const valid = mapped.filter((r) => r.row);
  const invalid = mapped.filter((r) => !r.row);
  const headers = cells?.[0] ?? [];
  const errorText = (key: string) => (i18n.exists(key) ? t(key) : key);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    reset();
    setFileName(file.name);
    try {
      const rows = await readSheet(file);
      if (rows.length < 2) throw new Error('people.import.emptyFile');
      setCells(rows);
      setMapping(guessMapping(rows[0]!));
    } catch (error) {
      setReadError(error instanceof Error && i18n.exists(error.message) ? error.message : 'people.import.unreadable');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('people.import.title')}</DialogTitle>
          <DialogDescription>{t('people.import.body')}</DialogDescription>
        </DialogHeader>

        {importPeople.isSuccess ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center" role="status">
            <CircleCheck className="size-10 text-success-fg" aria-hidden="true" />
            <p className="text-lg font-bold text-fg">{t('people.import.done')}</p>
            <p className="text-sm text-fg-2">
              {t('people.import.result', { inserted: importPeople.data.inserted, updated: importPeople.data.updated })}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <Field id="import-file" label={t('people.import.file')} className="min-w-64 flex-1" error={readError ?? undefined}>
                <Input id="import-file" type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={(e) => void pick(e.target.files?.[0])} />
              </Field>
              <Button type="button" variant="outline" onClick={() => downloadCsv('masar-staff-template.csv', TEMPLATE_ROWS)}>
                <Download aria-hidden="true" />
                {t('people.import.template')}
              </Button>
            </div>

            {cells && (
              <>
                <fieldset className="space-y-2">
                  <legend className="flex items-center gap-2 text-sm font-semibold text-fg">
                    <FileSpreadsheet className="size-4 text-fg-3" aria-hidden="true" />
                    {t('people.import.columns', { file: fileName })}
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {IMPORT_FIELDS.map((field) => (
                      <Field key={field} id={`map-${field}`} label={t(`people.fields.${field}`)}>
                        <NativeSelect
                          id={`map-${field}`}
                          value={mapping[field] ?? ''}
                          onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value === '' ? undefined : Number(e.target.value) }))}
                        >
                          <option value="">{t('people.import.skip')}</option>
                          {headers.map((h, i) => (
                            <option key={i} value={i}>
                              {h || t('people.import.column', { n: i + 1 })}
                            </option>
                          ))}
                        </NativeSelect>
                      </Field>
                    ))}
                  </div>
                </fieldset>

                <div className="flex flex-wrap gap-3 text-sm" aria-live="polite">
                  <span className="font-semibold text-success-fg">{t('people.import.ready', { count: valid.length })}</span>
                  {invalid.length > 0 && <span className="font-semibold text-danger">{t('people.import.invalid', { count: invalid.length })}</span>}
                </div>

                <div className="max-h-64 overflow-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-surface-2 text-xs text-fg-3">
                      <tr>
                        <th className="px-2 py-1.5 text-start">#</th>
                        <th className="px-2 py-1.5 text-start">{t('people.fields.employee_no')}</th>
                        <th className="px-2 py-1.5 text-start">{t('people.fields.full_name')}</th>
                        <th className="px-2 py-1.5 text-start">{t('people.fields.grade')}</th>
                        <th className="px-2 py-1.5 text-start">{t('people.import.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...invalid, ...valid].slice(0, PREVIEW_ROWS + invalid.length).map((r) => (
                        <tr key={r.line} className={cn('border-t border-border', !r.row && 'bg-[color-mix(in_srgb,var(--danger)_6%,transparent)]')}>
                          <td className="tabular px-2 py-1.5 text-fg-3">{r.line}</td>
                          <td className="px-2 py-1.5" dir="ltr">
                            {r.row?.employee_no ?? cells[r.line - 1]?.[mapping.employee_no ?? -1] ?? ''}
                          </td>
                          <td className="px-2 py-1.5" dir="auto">
                            {r.row?.full_name ?? cells[r.line - 1]?.[mapping.full_name ?? -1] ?? ''}
                          </td>
                          <td className="tabular px-2 py-1.5">{r.row?.grade ?? cells[r.line - 1]?.[mapping.grade ?? -1] ?? ''}</td>
                          <td className="px-2 py-1.5">
                            {r.row ? (
                              <CircleCheck className="size-4 text-success-fg" aria-label={t('people.import.ok')} />
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-danger">
                                <TriangleAlert className="size-3.5" aria-hidden="true" />
                                {r.errors.map(errorText).join(' · ')}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {mapping.grade === undefined && <p className="text-xs font-semibold text-warning-fg">{t('people.import.noGrade')}</p>}
              </>
            )}
            <FormError error={importPeople.error} />
          </div>
        )}

        <DialogFooter>
          {importPeople.isSuccess ? (
            <Button type="button" onClick={() => onOpenChange(false)}>
              {t('common.close')}
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                disabled={!valid.length || importPeople.isPending}
                onClick={() => importPeople.mutate(valid.map((r) => r.row!))}
              >
                {importPeople.isPending ? t('people.import.importing') : t('people.import.action', { count: valid.length })}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
