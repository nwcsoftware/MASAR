import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Field, FormError, NativeSelect } from '@/components/form';
import { GradeBadge } from '@/components/grade-badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useGradeGroups } from '@/features/grades/queries';
import { groupForGrade } from '@/features/grades/rules';
import { useSavePerson } from '@/features/people/queries';
import { PERSON_DEFAULTS, personSchema, type PersonValues } from '@/features/people/schema';
import { useSites } from '@/features/sites/queries';
import { useLocalizedName } from '@/lib/i18n-data';
import type { Person } from '@/mocks/fixtures';

function toValues(p: Person): PersonValues {
  return {
    full_name: p.full_name,
    full_name_ar: p.full_name_ar ?? '',
    employee_no: p.employee_no ?? '',
    grade: p.grade ?? Number.NaN,
    job_title: p.job_title ?? '',
    department: p.department ?? '',
    site_id: p.site_id ?? '',
    phone: p.phone ?? '',
    email: p.email ?? '',
    is_active: p.is_active,
  };
}

/**
 * Add / edit a staff member. Opened from the Staff page and from the task
 * wizard when a passenger isn't in the directory yet ("register and
 * continue"); name and grade are required because the trip rules need them.
 */
export function PersonFormDialog({
  open,
  onOpenChange,
  person,
  initialName,
  submitLabel,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person?: Person;
  initialName?: string;
  /** e.g. "Save and add to trip" when opened from the wizard */
  submitLabel?: string;
  onSaved?: (person: Person) => void;
}) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const sites = useSites();
  const groups = useGradeGroups();
  const save = useSavePerson();
  const form = useForm<PersonValues>({ resolver: zodResolver(personSchema), defaultValues: PERSON_DEFAULTS });
  const errors = form.formState.errors;
  const grade = form.watch('grade');
  const group = groupForGrade(groups.data ?? [], Number.isFinite(grade) ? grade : null);

  useEffect(() => {
    if (!open) return;
    form.reset(person ? toValues(person) : { ...PERSON_DEFAULTS, full_name: initialName ?? '' });
    save.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, person?.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{person ? t('people.edit') : t('people.add')}</DialogTitle>
          <DialogDescription>{person ? t('people.editHint') : t('people.addHint')}</DialogDescription>
        </DialogHeader>
        <form
          id="person-form"
          noValidate
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            // the wizard's own form wraps this dialog in the React tree
            event.stopPropagation();
            void form.handleSubmit((values) =>
              save.mutate(
                { id: person?.id, values },
                {
                  onSuccess: (saved) => {
                    onSaved?.(saved);
                    onOpenChange(false);
                  },
                },
              ),
            )(event);
          }}
        >
          <Field id="person-name" label={t('people.name')} error={errors.full_name?.message}>
            <Input id="person-name" autoComplete="off" aria-invalid={Boolean(errors.full_name)} {...form.register('full_name')} />
          </Field>
          <Field id="person-name-ar" label={t('people.nameAr')}>
            <Input id="person-name-ar" dir="rtl" {...form.register('full_name_ar')} />
          </Field>
          <Field id="person-emp" label={t('people.employeeNo')}>
            <Input id="person-emp" dir="ltr" {...form.register('employee_no')} />
          </Field>
          <Field
            id="person-grade"
            label={t('people.grade')}
            error={errors.grade?.message}
            hint={group ? <GradeBadge code={group.code} /> : (groups.data ?? []).length ? t('people.gradeNoGroup') : undefined}
          >
            <Input id="person-grade" type="number" inputMode="numeric" min={1} max={99} className="tabular" aria-invalid={Boolean(errors.grade)} {...form.register('grade', { valueAsNumber: true })} />
          </Field>
          <Field id="person-title" label={t('people.jobTitle')}>
            <Input id="person-title" {...form.register('job_title')} />
          </Field>
          <Field id="person-dept" label={t('people.department')}>
            <Input id="person-dept" {...form.register('department')} />
          </Field>
          <Field id="person-site" label={t('people.site')}>
            <NativeSelect id="person-site" {...form.register('site_id')}>
              <option value="">—</option>
              {(sites.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {name(s)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="person-phone" label={t('people.phone')}>
            <Input id="person-phone" type="tel" dir="ltr" {...form.register('phone')} />
          </Field>
          <Field id="person-email" label={t('people.email')} error={errors.email?.message} className="sm:col-span-2">
            <Input id="person-email" type="email" dir="ltr" {...form.register('email')} />
          </Field>
          {person && (
            <label className="flex items-center gap-3 text-sm font-semibold sm:col-span-2">
              <Switch checked={form.watch('is_active')} onCheckedChange={(v) => form.setValue('is_active', v, { shouldDirty: true })} />
              {t('common.active')}
            </label>
          )}
          <FormError error={save.error} className="sm:col-span-2" />
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="person-form" disabled={save.isPending}>
            {save.isPending ? t('common.saving') : (submitLabel ?? t('common.save'))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
