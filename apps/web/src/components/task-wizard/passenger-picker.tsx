import { useId, useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { CircleAlert, Search, Trash2, UserPlus, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useConflictText } from '@/components/conflict-alert';
import { Field } from '@/components/form';
import { GradeBadge, GroupSelect } from '@/components/grade-badge';
import { PersonFormDialog } from '@/components/people/person-form-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useGradeGroups } from '@/features/grades/queries';
import { gradeConflicts, groupForGrade } from '@/features/grades/rules';
import { usePeople } from '@/features/people/queries';
import type { PassengerValues, TaskFormValues } from '@/features/tasks/schema';
import { useLocalizedName } from '@/lib/i18n-data';
import type { GradeGroup, Person } from '@/mocks/fixtures';

const MAX_RESULTS = 8;

/** One-time visitor: not registered, but given a group so the car rule still holds. */
function VisitorDialog({
  open,
  onOpenChange,
  initialName,
  groups,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  groups: GradeGroup[];
  onAdd: (p: PassengerValues) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState('');
  const [groupId, setGroupId] = useState('');
  const [tried, setTried] = useState(false);
  const needsGroup = groups.length > 0;
  const nameError = tried && !name.trim() ? 'tasks.errors.passengerName' : undefined;
  const groupError = tried && needsGroup && !groupId ? 'people.errors.visitorGroup' : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) return;
        setTried(false);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('people.visitorTitle')}</DialogTitle>
          <DialogDescription>{t('people.visitorBody')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field id="visitor-name" label={t('people.name')} error={nameError}>
            <Input id="visitor-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </Field>
          <Field id="visitor-phone" label={t('people.phone')}>
            <Input id="visitor-phone" type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          {needsGroup && (
            <Field id="visitor-group" label={t('people.visitorGroup')} hint={t('people.visitorGroupHint')} error={groupError}>
              <GroupSelect id="visitor-group" groups={groups} emptyLabel={t('people.chooseGroup')} value={groupId} onChange={(e) => setGroupId(e.target.value)} />
            </Field>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => {
              setTried(true);
              if (!name.trim() || (needsGroup && !groupId)) return;
              const group = groups.find((g) => g.id === groupId);
              onAdd({ name: name.trim(), phone: phone.trim(), visitor: true, group_id: group?.id ?? null, group_code: group?.code ?? null });
              onOpenChange(false);
            }}
          >
            {t('people.addVisitor')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Passengers come from the staff directory. Someone not found is either
 * registered on the spot (popup, then the task continues) or added as a
 * one-time visitor (no registration).
 */
export function PassengerPicker() {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const text = useConflictText();
  const listId = useId();
  const form = useFormContext<TaskFormValues>();
  const passengers = useFieldArray({ control: form.control, name: 'passengers' });
  const values = form.watch('passengers');
  const people = usePeople();
  const groups = useGradeGroups().data ?? [];
  const [query, setQuery] = useState('');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [visitorOpen, setVisitorOpen] = useState(false);

  const q = query.trim().toLowerCase();
  const added = new Set(values.map((p) => p.person_id).filter(Boolean));
  const results = q
    ? (people.data ?? [])
        .filter((p) => p.is_active && !added.has(p.id))
        .filter((p) => [p.full_name, p.full_name_ar, p.employee_no].filter(Boolean).some((v) => v!.toLowerCase().includes(q)))
        .slice(0, MAX_RESULTS)
    : [];

  const addPerson = (person: Person) => {
    const group = groupForGrade(groups, person.grade);
    passengers.append({
      person_id: person.id,
      name: person.full_name,
      phone: person.phone ?? '',
      grade: person.grade,
      group_id: group?.id ?? null,
      group_code: group?.code ?? null,
    });
    setQuery('');
  };

  const mixed = gradeConflicts({ passengers: values.map((p) => ({ ...p, group_id: p.group_id ?? undefined })), groups }).find((c) => c.type === 'grade_mixed');
  const error = form.formState.errors.passengers;

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-fg">{t('taskDetail.passengers')}</div>

      {values.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border">
          {passengers.fields.map((field, i) => {
            const p = values[i];
            if (!p) return null;
            return (
              <li key={field.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <UserRound className="size-4 shrink-0 text-fg-3" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-semibold" dir="auto">
                  {p.name}
                </span>
                <GradeBadge code={p.group_code} grade={p.grade} visitor={p.visitor} />
                {p.phone && (
                  <span className="tabular hidden text-xs text-fg-3 sm:inline" dir="ltr">
                    {p.phone}
                  </span>
                )}
                <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => passengers.remove(i)} aria-label={`${t('common.remove')} ${p.name}`}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {mixed && (
        <p role="alert" className="flex items-center gap-2 text-xs font-semibold text-danger">
          <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
          {text(mixed)}
        </p>
      )}
      {error?.message && (
        <p role="alert" className="text-xs font-semibold text-danger">
          {t(error.message)}
        </p>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-fg-3" aria-hidden="true" />
        <Input
          id="task-passenger-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (results[0]) addPerson(results[0]);
            }
          }}
          placeholder={t('people.searchPassenger')}
          aria-label={t('people.searchPassenger')}
          aria-controls={listId}
          autoComplete="off"
          className="ps-9"
        />
      </div>

      {q && (
        <div id={listId} className="rounded-md border border-border bg-surface shadow-sm">
          {results.length > 0 && (
            <ul role="listbox" aria-label={t('people.results')}>
              {results.map((person) => {
                const group = groupForGrade(groups, person.grade);
                return (
                  <li key={person.id} role="option" aria-selected={false}>
                    <button
                      type="button"
                      onClick={() => addPerson(person)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-start text-sm hover:bg-surface-2"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{name(person, 'full_name')}</span>
                        <span className="block truncate text-xs text-fg-3">
                          {[person.employee_no, person.job_title].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <GradeBadge code={group?.code} grade={person.grade} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="space-y-2 border-t border-border p-3 first:border-t-0">
            {!results.length && <p className="text-xs text-fg-3">{t('people.notFound', { query: query.trim() })}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setRegisterOpen(true)}>
                <UserPlus aria-hidden="true" />
                {t('people.registerNew')}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setVisitorOpen(true)}>
                {t('people.oneTimeVisitor')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <PersonFormDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        initialName={query.trim()}
        submitLabel={t('people.saveAndAdd')}
        onSaved={addPerson}
      />
      {visitorOpen && (
        <VisitorDialog
          open={visitorOpen}
          onOpenChange={setVisitorOpen}
          initialName={query.trim()}
          groups={groups}
          onAdd={(p) => {
            passengers.append(p);
            setQuery('');
          }}
        />
      )}
    </div>
  );
}
