import { useEffect, useMemo, useRef, useState } from 'react';
import { FormProvider, useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronLeft, ChevronRight, FileText, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { FormError } from '@/components/form';
import type { WizardRequest } from '@/components/layout/task-wizard-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { isAdmin } from '@/features/auth/guards';
import { useCurrentUser } from '@/features/auth/session';
import { useVehicles } from '@/features/company/queries';
import { useDrivers } from '@/features/drivers/queries';
import { useGradeGroups } from '@/features/grades/queries';
import { gradeConflicts, snapshotPassengers } from '@/features/grades/rules';
import { usePeople } from '@/features/people/queries';
import { useAirports, useSites } from '@/features/sites/queries';
import { useSiteScope } from '@/features/sites/site-scope';
import { useConflictPreview, useSaveTask, useTask } from '@/features/tasks/queries';
import { STEP_FIELDS, taskFormSchema, WIZARD_STEPS, type TaskFormValues, type WizardStep } from '@/features/tasks/schema';
import { EDITABLE_STATUSES, sharedHostId, type PreviewConflict } from '@/features/tasks/types';
import { companyDateKey, companyTimeKey } from '@/lib/format';
import { CATEGORY_ICON, categoryColorVar, TASK_CATEGORIES, type TaskCategory } from '@/lib/task-meta';
import { cn, tone } from '@/lib/utils';
import { AssignStep } from './assign-step';
import { DetailsStep } from './details-step';
import { ReviewStep } from './review-step';
import { ScheduleStep } from './schedule-step';
import { StopsStep } from './stops-step';
import { useWizardPlan } from './use-plan';
import { newTaskValues, seedKey, seedStops, taskToValues, valuesToPayload } from './values';

/** First step holding an invalid field — where a failed save sends the user. */
function stepOf(errors: FieldErrors<TaskFormValues>): WizardStep {
  const failed = Object.keys(errors);
  return WIZARD_STEPS.find((step) => (STEP_FIELDS[step] as readonly string[]).some((field) => failed.includes(field))) ?? 'review';
}

/**
 * docs/DESIGN.md §5 TaskWizard (FR-10 … FR-16): category → details → stops
 * → schedule → driver → review, one react-hook-form across the steps, saved
 * in one rpc_save_task call. Editing reuses it from the details step.
 */
export function TaskWizard({ request, onClose, onSaved }: { request: WizardRequest | null; onClose: () => void; onSaved: (taskId: string) => void }) {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const scope = useSiteScope();
  const open = request !== null;
  const editingId = request?.taskId;
  const task = useTask(editingId);
  const sites = useSites();
  const airports = useAirports();
  const drivers = useDrivers();
  const vehicles = useVehicles();
  const save = useSaveTask();
  const admin = isAdmin(user.profile.role);

  const allowedSites = useMemo(
    () => (sites.data ?? []).filter((s) => s.is_active && (admin || !user.siteIds.length || user.siteIds.includes(s.id))),
    [sites.data, admin, user.siteIds],
  );
  const defaultSite = allowedSites.find((s) => s.id === scope.siteId) ?? allowedSites[0];

  const form = useForm<TaskFormValues>({ resolver: zodResolver(taskFormSchema), defaultValues: newTaskValues('escort', undefined) });
  const [step, setStep] = useState<WizardStep>('category');
  const [chosen, setChosen] = useState<TaskCategory | null>(null);
  const [reached, setReached] = useState(0);
  const [durationAuto, setDurationAuto] = useState(true);
  const [startAuto, setStartAuto] = useState(true);
  const seeded = useRef<string | null>(null);

  // (re)initialise whenever the wizard opens — or the task to edit arrives
  useEffect(() => {
    if (!request) return;
    save.reset();
    if (request.taskId) {
      if (!task.data) return;
      const values = taskToValues(task.data);
      form.reset(values);
      seeded.current = seedKey(values);
      setChosen(values.category);
      setDurationAuto(false);
      setStartAuto(false);
      setStep(request.step ?? 'details');
      setReached(WIZARD_STEPS.length - 1);
    } else {
      form.reset({ ...newTaskValues('escort', undefined), ...request.prefill });
      seeded.current = null;
      setChosen(null);
      setDurationAuto(true);
      setStartAuto(true);
      setStep('category');
      setReached(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, task.data?.id]);

  const values = form.watch();
  const plan = useWizardPlan(values);

  // FR-13: follow the suggested airport start until the dispatcher sets their own
  const suggestedStart = plan.suggested?.start;
  useEffect(() => {
    if (!startAuto || !suggestedStart || plan.start === suggestedStart) return;
    form.setValue('date', companyDateKey(suggestedStart));
    form.setValue('start_time', companyTimeKey(suggestedStart));
  }, [startAuto, suggestedStart, plan.start, form]);

  // duration follows the stops (driving + waits) unless typed
  const plannedMin = plan.timeline.durationMin;
  useEffect(() => {
    if (durationAuto && plannedMin >= 5 && form.getValues('duration_min') !== plannedMin) form.setValue('duration_min', plannedMin);
  }, [durationAuto, plannedMin, form]);

  const end = plan.start ? new Date(new Date(plan.start).getTime() + (values.duration_min || 0) * 60_000).toISOString() : null;
  const activeDrivers = useMemo(() => (drivers.data ?? []).filter((d) => d.is_active), [drivers.data]);
  const first = values.stops[0];
  const preview = useConflictPreview(
    plan.start && end && (step === 'assign' || step === 'review')
      ? {
          driverIds: activeDrivers.map((d) => d.id),
          vehicleId: values.vehicle_id,
          start: plan.start,
          end,
          firstLat: first?.lat ?? null,
          firstLng: first?.lng ?? null,
          excludeTaskId: editingId ?? null,
        }
      : null,
  );
  // 0004 grade rules, checked client-side for the preview (the server re-checks on save)
  const groups = useGradeGroups();
  const people = usePeople();
  const onBoard = useMemo(() => {
    try {
      return snapshotPassengers(values.passengers, people.data ?? [], groups.data ?? []);
    } catch {
      return [];
    }
  }, [values.passengers, people.data, groups.data]);
  const vehicleGroupId = (vehicles.data ?? []).find((v) => v.id === values.vehicle_id)?.grade_group_id ?? null;
  /** grade conflicts with this driver (null = none chosen); driver_id null = car / passengers */
  const gradeFor = (driverId: string | null): PreviewConflict[] =>
    gradeConflicts({
      passengers: onBoard,
      groups: groups.data ?? [],
      vehicleGroupId,
      serveGroupId: activeDrivers.find((d) => d.id === driverId)?.serve_group_id,
    }).map((c) => ({ ...c, driver_id: c.type === 'driver_grade_not_allowed' ? driverId : null }));

  const chosenConflicts = values.share_with_task_id
    ? []
    : [
        ...(preview.data ?? []).filter((c) => (values.driver_id && c.driver_id === values.driver_id) || c.driver_id === null),
        ...gradeFor(values.driver_id),
      ];
  const blocking = chosenConflicts.some((c) => c.severity === 'blocking');

  const siteFor = (id: string) => (sites.data ?? []).find((s) => s.id === id);

  /** Stops follow category/site/airport until the user edits them. */
  const seedIfNeeded = () => {
    const current = form.getValues();
    const key = seedKey(current);
    const edited = Boolean(form.formState.dirtyFields.stops);
    if (seeded.current === key && current.stops.length) return;
    if (seeded.current !== null && edited) return;
    form.setValue('stops', seedStops(current, siteFor(current.site_id), airports.data ?? []), { shouldDirty: false });
    seeded.current = key;
  };

  const go = (next: WizardStep) => {
    const index = WIZARD_STEPS.indexOf(next);
    if (index >= WIZARD_STEPS.indexOf('stops')) seedIfNeeded();
    setReached((r) => Math.max(r, index));
    setStep(next);
  };

  const index = WIZARD_STEPS.indexOf(step);
  const next = async () => {
    if (step === 'category') {
      if (!chosen) return;
      if (form.getValues('category') !== chosen || !form.getValues('site_id')) {
        form.reset({ ...newTaskValues(chosen, defaultSite), ...request?.prefill, category: chosen });
        seeded.current = null;
      }
      return go('details');
    }
    if (await form.trigger(STEP_FIELDS[step] as unknown as (keyof TaskFormValues)[])) go(WIZARD_STEPS[index + 1]!);
  };

  const submit = form.handleSubmit(
    (v) => {
      if (blocking && admin && !v.override_reason?.trim()) {
        form.setError('override_reason', { message: 'conflicts.errors.reason' });
        return;
      }
      save.mutate(valuesToPayload(v, plan.timeline, plan.legs, editingId), {
        onSuccess: (id) => {
          request?.onSaved?.(id);
          onClose();
          onSaved(id);
        },
      });
    },
    (errors) => setStep(stepOf(errors)),
  );

  const riderOf = task.data ? sharedHostId(task.data) : null;
  const notEditable = editingId && task.data && !EDITABLE_STATUSES.includes(task.data.status);
  const firstStep = editingId ? 1 : 0;

  let body: React.ReactNode;
  if (editingId && task.isPending) {
    body = (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  } else if (editingId && task.isError) {
    body = <ErrorState error={task.error} onRetry={() => void task.refetch()} />;
  } else if (editingId && !task.data) {
    body = <EmptyState icon={FileText} title={t('taskDetail.notFound')} />;
  } else if (notEditable) {
    body = <EmptyState icon={Lock} title={t('tasks.errors.notEditable')} body={t('wizard.notEditableBody')} />;
  } else if (step === 'category') {
    body = (
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t('wizard.step.category')}>
        {TASK_CATEGORIES.map((c) => {
          const Icon = CATEGORY_ICON[c];
          const selected = chosen === c;
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setChosen(c)}
              className={cn('tone-block flex items-start gap-3 rounded-lg p-4 text-start transition-shadow hover:shadow-md', selected && 'ring-2 ring-brand-500')}
              style={tone(categoryColorVar(c))}
            >
              <span className="tone-text mt-0.5">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-bold text-fg">{t(`tasks.category.${c}`)}</span>
                <span className="block text-xs text-fg-2">{t(`wizard.categoryHint.${c}`)}</span>
              </span>
            </button>
          );
        })}
      </div>
    );
  } else if (step === 'details') {
    body = <DetailsStep sites={allowedSites} airports={airports.data ?? []} />;
  } else if (step === 'stops') {
    body = <StopsStep sites={sites.data ?? []} airports={airports.data ?? []} plan={plan} />;
  } else if (step === 'schedule') {
    body = <ScheduleStep plan={plan} durationAuto={durationAuto} onDurationAuto={setDurationAuto} onStartEdited={() => setStartAuto(false)} />;
  } else if (step === 'assign') {
    body = (
      <AssignStep
        plan={plan}
        drivers={activeDrivers}
        vehicles={vehicles.data ?? []}
        airports={airports.data ?? []}
        preview={preview.data ?? []}
        previewLoading={preview.isFetching || drivers.isPending}
        gradeFor={gradeFor}
        riderGroups={[...new Set(onBoard.flatMap((p) => (p.group_code ? [p.group_code] : [])))]}
        groups={groups.data ?? []}
        taskId={editingId}
        riderOf={riderOf}
      />
    );
  } else {
    body = (
      <ReviewStep
        plan={plan}
        sites={sites.data ?? []}
        airports={airports.data ?? []}
        drivers={activeDrivers}
        vehicles={vehicles.data ?? []}
        conflicts={chosenConflicts}
        canOverride={admin}
      />
    );
  }

  const ready = !(editingId && (!task.data || notEditable));

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-3 border-b border-border p-6 pb-4">
          <div>
            <DialogTitle>{editingId ? t('wizard.editTitle') : t('wizard.title')}</DialogTitle>
            <DialogDescription>{t(`wizard.hint.${step}`)}</DialogDescription>
          </div>
          {ready && (
            <ol className="flex flex-wrap gap-1.5 text-xs font-semibold" aria-label={t('wizard.steps')}>
              {WIZARD_STEPS.slice(firstStep).map((s) => {
                const i = WIZARD_STEPS.indexOf(s);
                const current = s === step;
                return (
                  <li key={s}>
                    <button
                      type="button"
                      disabled={i > reached || current}
                      onClick={() => go(s)}
                      aria-current={current ? 'step' : undefined}
                      className={cn(
                        'rounded-full px-2.5 py-1',
                        current ? 'bg-brand-500 text-fg-on-brand' : i <= reached ? 'bg-surface-2 text-fg hover:bg-surface-3' : 'bg-surface-2 text-fg-3',
                      )}
                    >
                      {i + 1 - firstStep}. {t(`wizard.step.${s}`)}
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </DialogHeader>

        <FormProvider {...form}>
          <form
            id="task-wizard"
            noValidate
            className="min-h-0 flex-1 overflow-y-auto p-6"
            onSubmit={(event) => {
              event.preventDefault();
              if (step === 'review') void submit(event);
              else void next();
            }}
          >
            {body}
          </form>
        </FormProvider>

        <div className="space-y-3 border-t border-border p-4">
          <FormError error={save.error} />
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" onClick={() => go(WIZARD_STEPS[index - 1]!)} disabled={!ready || index <= firstStep}>
              <ChevronLeft className="rtl:-scale-x-100" aria-hidden="true" />
              {t('common.back')}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              {step === 'review' ? (
                <Button type="submit" form="task-wizard" disabled={!ready || save.isPending || (blocking && !admin)}>
                  {save.isPending ? t('common.saving') : editingId ? t('wizard.saveChanges') : t('wizard.create')}
                </Button>
              ) : (
                <Button type="submit" form="task-wizard" disabled={!ready || (step === 'category' && !chosen)}>
                  {t('common.next')}
                  <ChevronRight className="rtl:-scale-x-100" aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
