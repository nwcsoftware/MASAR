import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, CircleCheck, Layers, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Field, FormError } from '@/components/form';
import { Panel } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useGradeGroups, useSetGradeGroups } from '@/features/grades/queries';
import { presetGroups } from '@/features/grades/rules';
import { gradeGroupsSchema, type GradeGroupsValues } from '@/features/grades/schema';
import type { GradeGroup } from '@/mocks/fixtures';

const toValues = (groups: GradeGroup[]): GradeGroupsValues => ({
  groups: groups.map((g) => ({ code: g.code, name: g.name ?? '', name_ar: g.name_ar ?? '', min_grade: g.min_grade, max_grade: g.max_grade })),
});

/**
 * Grade groups (0004). The order is the seniority: the first row is A, the
 * most senior. Only one group may travel in a car, and it must be the car's.
 */
export function GradesTab() {
  const { t } = useTranslation();
  const groups = useGradeGroups();
  const save = useSetGradeGroups();
  const form = useForm<GradeGroupsValues>({ resolver: zodResolver(gradeGroupsSchema), defaultValues: { groups: [] } });
  const rows = useFieldArray({ control: form.control, name: 'groups' });
  const errors = form.formState.errors.groups;

  useEffect(() => {
    if (groups.data) form.reset(toValues(groups.data));
  }, [groups.data, form]);

  if (groups.isPending) return <Skeleton className="h-48 w-full" />;
  if (groups.isError) return <ErrorState error={groups.error} onRetry={() => void groups.refetch()} />;

  const applyPreset = (end: 'high' | 'low') => form.reset({ groups: presetGroups(end) }, { keepDefaultValues: true });

  return (
    <Panel title={t('grades.title')} bodyClassName="space-y-5 p-5">
      <p className="text-sm text-fg-2">{t('grades.explain')}</p>

      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 p-3">
        <span className="text-sm font-semibold text-fg">{t('grades.preset')}</span>
        <Button type="button" size="sm" variant="outline" onClick={() => applyPreset('high')}>
          {t('grades.presetHigh')}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => applyPreset('low')}>
          {t('grades.presetLow')}
        </Button>
      </div>

      <form
        noValidate
        className="space-y-3"
        onSubmit={form.handleSubmit((values) => save.mutate(values, { onSuccess: () => form.reset(values) }))}
      >
        {rows.fields.length === 0 ? (
          <EmptyState compact icon={Layers} title={t('grades.empty')} body={t('grades.emptyBody')} />
        ) : (
          <ol className="space-y-2">
            {rows.fields.map((field, i) => (
              <li key={field.id} className="grid items-start gap-3 rounded-lg border border-border p-3 sm:grid-cols-[4.5rem_1fr_1fr_5.5rem_5.5rem_auto]">
                <Field id={`grp-${i}-code`} label={t('grades.code')} error={errors?.[i]?.code?.message}>
                  <Input id={`grp-${i}-code`} dir="ltr" className="font-bold uppercase" maxLength={3} {...form.register(`groups.${i}.code`)} />
                </Field>
                <Field id={`grp-${i}-name`} label={t('grades.name')}>
                  <Input id={`grp-${i}-name`} {...form.register(`groups.${i}.name`)} />
                </Field>
                <Field id={`grp-${i}-name-ar`} label={t('grades.nameAr')}>
                  <Input id={`grp-${i}-name-ar`} dir="rtl" {...form.register(`groups.${i}.name_ar`)} />
                </Field>
                <Field id={`grp-${i}-min`} label={t('grades.from')} error={errors?.[i]?.min_grade?.message}>
                  <Input id={`grp-${i}-min`} type="number" min={1} max={99} className="tabular" {...form.register(`groups.${i}.min_grade`, { valueAsNumber: true })} />
                </Field>
                <Field id={`grp-${i}-max`} label={t('grades.to')} error={errors?.[i]?.max_grade?.message}>
                  <Input id={`grp-${i}-max`} type="number" min={1} max={99} className="tabular" {...form.register(`groups.${i}.max_grade`, { valueAsNumber: true })} />
                </Field>
                <div className="flex gap-1 sm:pt-6">
                  <Button type="button" variant="ghost" size="icon" className="size-9" disabled={i === 0} onClick={() => rows.move(i, i - 1)} aria-label={t('grades.moreSenior')}>
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9"
                    disabled={i === rows.fields.length - 1}
                    onClick={() => rows.move(i, i + 1)}
                    aria-label={t('grades.lessSenior')}
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="size-9 text-danger" onClick={() => rows.remove(i)} aria-label={t('common.remove')}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
        <p className="text-xs text-fg-3">{t('grades.orderHint')}</p>

        <FormError error={save.error} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => rows.append({ code: String.fromCharCode(65 + rows.fields.length), name: '', name_ar: '', min_grade: Number.NaN, max_grade: Number.NaN })}
          >
            <Plus aria-hidden="true" />
            {t('grades.add')}
          </Button>
          <div className="flex items-center gap-3">
            {save.isSuccess && !form.formState.isDirty && (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-success-fg">
                <CircleCheck className="size-4" aria-hidden="true" />
                {t('common.saved')}
              </span>
            )}
            <Button type="submit" disabled={save.isPending || !form.formState.isDirty}>
              {save.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </div>
      </form>
    </Panel>
  );
}
