import { importRowSchema, type ImportRow } from './schema';

/**
 * Staff import from Excel (.xlsx) or CSV. The sheet's first row is the
 * header; columns are matched to fields by name in English or Arabic and can
 * be re-mapped by hand in the import dialog.
 */
export const IMPORT_FIELDS = ['employee_no', 'full_name', 'full_name_ar', 'grade', 'job_title', 'department', 'site', 'phone', 'email'] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

const ALIASES: Record<ImportField, string[]> = {
  employee_no: ['employee no', 'employee number', 'emp no', 'employee id', 'staff no', 'id', 'الرقم الوظيفي', 'رقم الموظف'],
  full_name: ['name', 'full name', 'name (english)', 'english name', 'employee name', 'الاسم', 'الاسم بالانجليزي', 'الاسم بالإنجليزية'],
  full_name_ar: ['name (arabic)', 'arabic name', 'name ar', 'الاسم بالعربي', 'الاسم بالعربية', 'الاسم العربي'],
  grade: ['grade', 'level', 'الدرجة', 'المرتبة', 'الدرجة الوظيفية'],
  job_title: ['job title', 'title', 'position', 'المسمى الوظيفي', 'الوظيفة'],
  department: ['department', 'dept', 'القسم', 'الإدارة'],
  site: ['site', 'location', 'project', 'الموقع', 'المشروع'],
  phone: ['phone', 'mobile', 'phone number', 'mobile number', 'الجوال', 'الهاتف', 'رقم الجوال'],
  email: ['email', 'e-mail', 'البريد', 'البريد الإلكتروني'],
};

const normalise = (h: string) => h.toLowerCase().replace(/[_\-.:]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Header index → field, by name (unmatched columns are ignored). */
export function guessMapping(headers: string[]): Partial<Record<ImportField, number>> {
  const mapping: Partial<Record<ImportField, number>> = {};
  headers.forEach((header, index) => {
    const h = normalise(header);
    const field = IMPORT_FIELDS.find((f) => mapping[f] === undefined && ALIASES[f].some((alias) => normalise(alias) === h));
    if (field) mapping[field] = index;
  });
  return mapping;
}

/** RFC 4180-ish CSV (quotes, commas, CRLF), tolerating a UTF-8 BOM and `;` separators. */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i]!;
    if (quoted) {
      if (c === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && source[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim()));
}

/** Read a picked file into rows of cells (header first). */
export async function readSheet(file: File): Promise<string[][]> {
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') return parseCsv(await file.text());
  const { default: readXlsxFile } = await import('read-excel-file');
  const rows = await readXlsxFile(file);
  return rows
    .map((r) => r.map((v) => (v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v))))
    .filter((r) => r.some((v) => v.trim()));
}

export interface MappedRow {
  /** 1-based spreadsheet row number (header = 1) */
  line: number;
  row: ImportRow | null;
  errors: string[];
}

/** Apply the column mapping and validate each data row. */
export function mapRows(cells: string[][], mapping: Partial<Record<ImportField, number>>): MappedRow[] {
  return cells.slice(1).map((r, i) => {
    const get = (f: ImportField) => (mapping[f] === undefined ? undefined : (r[mapping[f]!] ?? '').trim() || undefined);
    const rawGrade = get('grade');
    const grade = rawGrade === undefined ? undefined : Number(rawGrade.replace(/[^\d.]/g, ''));
    const candidate = {
      employee_no: get('employee_no'),
      full_name: get('full_name') ?? '',
      full_name_ar: get('full_name_ar'),
      grade: rawGrade === undefined ? undefined : grade,
      job_title: get('job_title'),
      department: get('department'),
      site: get('site'),
      phone: get('phone'),
      email: get('email'),
    };
    const parsed = importRowSchema.safeParse(candidate);
    return parsed.success
      ? { line: i + 2, row: parsed.data, errors: [] }
      : { line: i + 2, row: null, errors: [...new Set(parsed.error.issues.map((issue) => issue.message))] };
  });
}

/** Header + one example row for the downloadable template. */
export const TEMPLATE_ROWS: string[][] = [
  ['Employee No', 'Name', 'Name (Arabic)', 'Grade', 'Job title', 'Department', 'Site', 'Phone', 'Email'],
  ['E-2001', 'Eng. Laila Hassan', 'م. ليلى حسن', '14', 'Project Engineer', 'Engineering', 'RHQ', '+966 55 000 0000', 'laila@example.com'],
];
