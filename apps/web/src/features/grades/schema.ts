import { z } from 'zod';

const grade = z.number({ message: 'grades.errors.range' }).int('grades.errors.range').min(1, 'grades.errors.range').max(99, 'grades.errors.range');

/** One grade group row; the list order is the rank (first = A = most senior). */
export const gradeGroupSchema = z
  .object({
    code: z.string().trim().toUpperCase().min(1, 'grades.errors.code').max(3, 'grades.errors.code'),
    name: z.string().trim().optional(),
    name_ar: z.string().trim().optional(),
    min_grade: grade,
    max_grade: grade,
  })
  .refine((g) => g.min_grade <= g.max_grade, { path: ['max_grade'], message: 'grades.errors.range' });

/** rpc_set_grade_groups payload — same checks as the RPC (unique codes, no overlaps). */
export const gradeGroupsSchema = z
  .object({ groups: z.array(gradeGroupSchema) })
  .superRefine(({ groups }, ctx) => {
    const codes = groups.map((g) => g.code.trim().toUpperCase());
    codes.forEach((code, i) => {
      if (code && codes.indexOf(code) !== i) ctx.addIssue({ code: 'custom', path: ['groups', i, 'code'], message: 'grades.errors.duplicateCode' });
    });
    groups.forEach((a, i) =>
      groups.forEach((b, j) => {
        if (j > i && a.min_grade <= b.max_grade && b.min_grade <= a.max_grade) {
          ctx.addIssue({ code: 'custom', path: ['groups', j, 'min_grade'], message: 'grades.errors.overlap' });
        }
      }),
    );
  });
export type GradeGroupsValues = z.infer<typeof gradeGroupsSchema>;
