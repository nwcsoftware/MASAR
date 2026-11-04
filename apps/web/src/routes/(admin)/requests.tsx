import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { CalendarPlus, Check, ClipboardList, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { FormError } from '@/components/form';
import { useOpenTask } from '@/components/layout/task-sheet-context';
import { useOpenWizard } from '@/components/layout/task-wizard-context';
import { Page } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { RequestStatusPill } from '@/components/requests/request-status';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { isAdmin } from '@/features/auth/guards';
import { useCurrentUser } from '@/features/auth/session';
import { useDecideRequest, useTripRequests } from '@/features/passenger/queries';
import { usePeople } from '@/features/people/queries';
import { useSites } from '@/features/sites/queries';
import { useTasks } from '@/features/tasks/queries';
import { companyDateKey, companyTimeKey, formatDateTime } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';
import { at, type TripRequest } from '@/mocks/fixtures';

export const Route = createFileRoute('/(admin)/requests')({
  validateSearch: (search: Record<string, unknown>): { all?: boolean } => ({ all: search.all === true || search.all === 'true' ? true : undefined }),
  component: RequestsPage,
});

/** §10 trip requests from passengers — approve / reject; a new trip is planned in the wizard. */
function RequestsPage() {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const navigate = useNavigate({ from: Route.fullPath });
  const { all } = Route.useSearch();
  const { profile } = useCurrentUser();
  const requests = useTripRequests();
  const people = usePeople();
  const sites = useSites();
  const tasks = useTasks({ from: at(-7, '00:00') });
  const openTask = useOpenTask();
  const [deciding, setDeciding] = useState<{ request: TripRequest; approve: boolean } | null>(null);
  const canDecide = profile.role === 'dispatcher' || isAdmin(profile.role);

  if (requests.isError) return <ErrorState error={requests.error} onRetry={() => void requests.refetch()} />;
  const list = (requests.data ?? []).filter((r) => all || r.status === 'pending');
  const personOf = (id: string) => people.data?.find((p) => p.id === id);
  const taskOf = (id: string | null) => tasks.data?.find((x) => x.id === id);
  const siteOf = (id: string | null) => sites.data?.find((s) => s.id === id);

  return (
    <Page>
      <PageHeader title={t('requests.inboxTitle')} description={t('requests.inboxSubtitle')} />
      <Tabs value={all ? 'all' : 'pending'} onValueChange={(v) => void navigate({ search: { all: v === 'all' ? true : undefined } })}>
        <TabsList>
          <TabsTrigger value="pending">{t('requests.status.pending')}</TabsTrigger>
          <TabsTrigger value="all">{t('requests.all')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {requests.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : !list.length ? (
        <EmptyState icon={ClipboardList} title={t(all ? 'requests.inboxEmptyAll' : 'requests.inboxEmpty')} body={t('requests.inboxEmptyBody')} />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {list.map((r) => {
            const person = personOf(r.person_id);
            const task = taskOf(r.task_id) ?? taskOf(r.created_task_id);
            const site = siteOf(r.site_id);
            return (
              <li key={r.id} className="space-y-2 rounded-lg border border-border bg-surface p-4" data-request={r.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{person ? name(person, 'full_name') : '—'}</span>
                  {person?.employee_no && <span className="text-xs text-fg-3 tabular">{person.employee_no}</span>}
                  <RequestStatusPill status={r.status} />
                  <span className="ms-auto text-xs text-fg-3 tabular">{formatDateTime(r.created_at)}</span>
                </div>
                <p className="text-sm font-semibold">
                  {t(`requests.kind.${r.kind}`)}
                  {site && <span className="font-normal text-fg-3"> · {name(site)}</span>}
                </p>
                {r.kind === 'new' ? (
                  <p className="text-sm text-fg-2">
                    {r.pickup} <span className="inline-block rtl:-scale-x-100">→</span> {r.dropoff} · {t('requests.seats', { count: r.passengers_count })}
                  </p>
                ) : (
                  task && (
                    <button type="button" className="text-start text-sm text-brand-500 hover:underline" onClick={() => openTask(task.id)}>
                      {task.title} · {formatDateTime(task.scheduled_start)}
                    </button>
                  )
                )}
                {r.requested_start && <p className="text-sm tabular">{t('requests.when', { time: formatDateTime(r.requested_start) })}</p>}
                {r.notes && <p className="rounded-md bg-surface-2 px-3 py-2 text-sm">{r.notes}</p>}
                {r.decision_note && <p className="text-xs text-fg-3">{t('requests.decisionNote', { note: r.decision_note })}</p>}
                {r.status === 'pending' && canDecide && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {r.kind === 'new' ? (
                      <PlanTripButton request={r} />
                    ) : (
                      <Button size="sm" onClick={() => setDeciding({ request: r, approve: true })}>
                        <Check aria-hidden="true" />
                        {t('requests.approve')}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setDeciding({ request: r, approve: false })}>
                      <X aria-hidden="true" />
                      {t('requests.reject')}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <DecideDialog state={deciding} onClose={() => setDeciding(null)} />
    </Page>
  );
}

/** "New trip" → the wizard, prefilled with the passenger, time and notes; saving approves the request. */
function PlanTripButton({ request }: { request: TripRequest }) {
  const { t } = useTranslation();
  const openWizard = useOpenWizard();
  const people = usePeople();
  const decide = useDecideRequest();
  const person = people.data?.find((p) => p.id === request.person_id);
  return (
    <>
      <Button
        size="sm"
        disabled={!person}
        onClick={() =>
          openWizard({
            prefill: {
              site_id: request.site_id ?? undefined,
              title: t('requests.tripTitle', { from: request.pickup ?? '', to: request.dropoff ?? '' }),
              description: [request.notes, `${request.pickup ?? ''} → ${request.dropoff ?? ''}`].filter(Boolean).join('\n'),
              passengers: person ? [{ person_id: person.id, name: person.full_name, phone: person.phone ?? '' }] : [],
              ...(request.requested_start ? { date: companyDateKey(request.requested_start), start_time: companyTimeKey(request.requested_start) } : {}),
            },
            onSaved: (taskId) => decide.mutate({ requestId: request.id, approve: true, createdTaskId: taskId }),
          })
        }
        data-plan-request
      >
        <CalendarPlus aria-hidden="true" />
        {t('requests.planTrip')}
      </Button>
      <FormError error={decide.error} />
    </>
  );
}

function DecideDialog({ state, onClose }: { state: { request: TripRequest; approve: boolean } | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { profile } = useCurrentUser();
  const decide = useDecideRequest();
  const [note, setNote] = useState('');
  const [override, setOverride] = useState('');
  const conflictBlocked = decide.error instanceof Error && /conflict/i.test(decide.error.message);

  const close = () => {
    setNote('');
    setOverride('');
    decide.reset();
    onClose();
  };
  const submit = () =>
    state &&
    decide.mutate(
      { requestId: state.request.id, approve: state.approve, note: note.trim() || undefined, overrideReason: override.trim() || undefined },
      { onSuccess: close },
    );

  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state?.approve ? t(`requests.approveTitle.${state.request.kind}`) : t('requests.rejectTitle')}</DialogTitle>
          <DialogDescription>{state?.approve ? t(`requests.approveHint.${state.request.kind}`) : t('requests.rejectHint')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="decide-note">{state?.approve ? t('requests.noteOptional') : t('requests.reasonRequired')}</Label>
          <Textarea id="decide-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {conflictBlocked && isAdmin(profile.role) && (
          <div className="space-y-2">
            <Label htmlFor="decide-override">{t('conflicts.overrideReason')}</Label>
            <Input id="decide-override" value={override} onChange={(e) => setOverride(e.target.value)} />
          </div>
        )}
        <FormError error={decide.error} />
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button variant={state?.approve ? 'default' : 'destructive'} onClick={submit} disabled={decide.isPending} data-decide-confirm>
            {state?.approve ? t('requests.approve') : t('requests.reject')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
