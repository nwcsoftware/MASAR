import { z } from 'zod';

const text = z.string().trim().optional();

/**
 * A staff member (people table, 0004). Name and grade are what the trip
 * rules need; the rest helps dispatchers find the right person.
 */
export const personSchema = z.object({
  full_name: z.string().trim().min(2, 'people.errors.name'),
  full_name_ar: text,
  employee_no: text,
  grade: z.number({ message: 'people.errors.grade' }).int('people.errors.grade').min(1, 'people.errors.grade').max(99, 'people.errors.grade'),
  job_title: text,
  department: text,
  site_id: z.string().optional(),
  phone: text,
  email: z.string().trim().toLowerCase().email('auth.errors.emailInvalid').or(z.literal('')).optional(),
  is_active: z.boolean(),
});
export type PersonValues = z.infer<typeof personSchema>;

export const PERSON_DEFAULTS: PersonValues = {
  full_name: '',
  full_name_ar: '',
  employee_no: '',
  grade: Number.NaN,
  job_title: '',
  department: '',
  site_id: '',
  phone: '',
  email: '',
  is_active: true,
};

/** One spreadsheet row after column mapping (rpc_import_people item). */
export const importRowSchema = z.object({
  employee_no: text,
  full_name: z.string().trim().min(1, 'people.errors.name'),
  full_name_ar: text,
  grade: z.number({ message: 'people.errors.grade' }).int('people.errors.grade').min(1, 'people.errors.grade').max(99, 'people.errors.grade').optional(),
  job_title: text,
  department: text,
  /** site code or name; resolved by the RPC */
  site: text,
  phone: text,
  email: z.string().trim().toLowerCase().email('auth.errors.emailInvalid').or(z.literal('')).optional(),
});
export type ImportRow = z.infer<typeof importRowSchema>;
