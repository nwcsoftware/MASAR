import { useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { FileScan, TriangleAlert, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ParseTicketOutput } from '@shared/schemas';
import { FormError } from '@/components/form';
import { GradeBadge, GroupSelect } from '@/components/grade-badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useGradeGroups } from '@/features/grades/queries';
import { groupForGrade } from '@/features/grades/rules';
import { usePeople } from '@/features/people/queries';
import type { SiteWithAirports } from '@/features/sites/queries';
import { useParseTicket, type ReadTicket } from '@/features/tasks/queries';
import type { PassengerValues, TaskFormValues } from '@/features/tasks/schema';
import { applyTicketOption, matchPerson, ticketOptions, type FlightField, type TicketOption } from '@/features/tasks/ticket';
import { formatDate, isolate } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';
import { cn } from '@/lib/utils';
import type { Airport } from '@/mocks/fixtures';

export interface TicketImportResult {
  flightNo: string;
  uncertain: FlightField[];
  /** the driver's airport on the ticket isn't set up in Masar */
  missingAirport: string | null;
  /** ticket passengers left out (not in Staff, not added as visitors) */
  skipped: string[];
  sample: boolean;
}

const ACCEPT = '.pdf,application/pdf,image/jpeg,image/png,image/webp';

function CheckTag() {
  const { t } = useTranslation();
  return (
    <span className="tint-12 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold text-warning-fg [--tint-color:var(--warning)]">
      <TriangleAlert className="size-3" aria-hidden="true" />
      {t('ticketImport.check')}
    </span>
  );
}

const when = (date: string | null, time: string | null) => [date && formatDate(`${date}T12:00:00Z`), time].filter(Boolean).join(' · ');

/** "JED Jeddah King Abdulaziz Intl · 5 Nov 2026 · 13:10 · Terminal 1" */
function End({ label, iata, name, date, time, terminal }: { label: string; iata: string | null; name: string | null; date: string | null; time: string | null; terminal: string | null }) {
  const { t } = useTranslation();
  const at = when(date, time);
  return (
    <span className="tabular block text-xs text-fg-2">
      <span className="font-semibold text-fg">{label}</span>
      <span dir="ltr" className="ms-1">
        {iata ?? '—'}
      </span>
      {name && (
        <span dir="auto" className="ms-1">
          {name}
        </span>
      )}
      {at && ` · ${at}`}
      {terminal && ` · ${t('wizard.flight.terminal')} ${terminal}`}
    </span>
  );
}

function OptionRow({ option, checked, onSelect }: { option: TicketOption; checked: boolean; onSelect: () => void }) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const s = option.segment;
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-surface-2',
        checked && 'border-brand-400 bg-surface-2',
      )}
    >
      <input type="radio" name="ticket-option" className="mt-1 accent-[var(--brand-500)]" checked={checked} onChange={onSelect} />
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="flex flex-wrap items-center gap-2 text-sm font-bold">
          {t(`flight.${option.direction}`)} · {option.iata ?? '—'} · <span dir="ltr">{s.flight_no}</span>
          {option.uncertain.length > 0 && <CheckTag />}
        </span>
        <span className="block text-xs text-fg-2">{option.airport ? name(option.airport) : option.printedName}</span>
        <End label={t('ticketImport.from')} iata={s.from_iata} name={s.from_name} date={s.departure_date} time={s.departure_time} terminal={s.departure_terminal} />
        <End label={t('ticketImport.to')} iata={s.to_iata} name={s.to_name} date={s.arrival_date} time={s.arrival_time} terminal={s.arrival_terminal} />
        {s.airline && <span className="block text-xs text-fg-3">{s.airline}</span>}
        {!option.airport ? (
          <span className="block text-xs font-semibold text-warning-fg">{t('ticketImport.airportNotSetUp', { iata: option.iata ?? option.printedName ?? '—' })}</span>
        ) : (
          !option.siteAirport && <span className="block text-xs text-fg-3">{t('ticketImport.otherAirport')}</span>
        )}
      </span>
    </label>
  );
}

interface PassengerRow {
  key: string;
  printed: string;
  ticketNo: string | null;
  person: ReturnType<typeof matchPerson>;
}

function ReviewDialog({
  read,
  site,
  airports,
  onClose,
  onApplied,
}: {
  read: ReadTicket;
  site: SiteWithAirports | undefined;
  airports: Airport[];
  onClose: () => void;
  onApplied: (result: TicketImportResult) => void;
}) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const form = useFormContext<TaskFormValues>();
  const people = usePeople().data ?? [];
  const groups = useGradeGroups().data ?? [];
  const ticket: ParseTicketOutput = read.ticket;
  const options = ticketOptions(ticket, airports, site);
  const [optionKey, setOptionKey] = useState(options[0]?.key ?? '');
  const option = options.find((o) => o.key === optionKey);

  const already = new Set(form.getValues('passengers').map((p) => p.person_id).filter(Boolean));
  const rows: PassengerRow[] = ticket.passengers.map((p, i) => ({ key: `${i}`, printed: p.name, ticketNo: p.ticket_no, person: matchPerson(p.name, people) }));
  // staff are ticked; strangers can come along as one-time visitors in the staff's group (same car rule)
  const staffGroup = rows.map((r) => r.person && groupForGrade(groups, r.person.grade)).find(Boolean);
  const [picked, setPicked] = useState(() => new Set(rows.filter((r) => !r.person || !already.has(r.person.id)).map((r) => r.key)));
  const [visitorGroups, setVisitorGroups] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.filter((r) => !r.person).map((r) => [r.key, staffGroup?.id ?? ''])),
  );
  const needsGroup = groups.length > 0;
  const missingGroup = rows.some((r) => !r.person && picked.has(r.key) && needsGroup && !visitorGroups[r.key]);

  const toggle = (key: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const apply = () => {
    if (!option || missingGroup) return;
    const current = form.getValues('flight');
    if (current) {
      const { flight, details } = applyTicketOption(option, ticket, current, site);
      form.setValue('flight', flight, { shouldDirty: true, shouldValidate: true });
      form.setValue('ticket', details, { shouldDirty: true, shouldValidate: true });
    }

    const add: PassengerValues[] = [];
    for (const r of rows) {
      if (!picked.has(r.key)) continue;
      if (r.person) {
        if (already.has(r.person.id)) continue;
        const group = groupForGrade(groups, r.person.grade);
        add.push({ person_id: r.person.id, name: r.person.full_name, phone: r.person.phone ?? '', grade: r.person.grade, group_id: group?.id ?? null, group_code: group?.code ?? null });
      } else {
        const group = groups.find((g) => g.id === visitorGroups[r.key]);
        add.push({ name: r.printed, phone: '', visitor: true, group_id: group?.id ?? null, group_code: group?.code ?? null });
      }
    }
    if (add.length) form.setValue('passengers', [...form.getValues('passengers'), ...add], { shouldDirty: true, shouldValidate: true });

    if (!form.getValues('title').trim()) {
      form.setValue('title', `${option.iata ?? ''} ${t(`flight.${option.direction}`)} · ${option.segment.flight_no}`.trim(), { shouldValidate: true });
    }
    onApplied({
      flightNo: option.segment.flight_no,
      uncertain: option.uncertain,
      missingAirport: option.airport ? null : (option.iata ?? option.printedName),
      skipped: rows.filter((r) => !picked.has(r.key) && !(r.person && already.has(r.person.id))).map((r) => r.printed),
      sample: read.sample,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('ticketImport.reviewTitle')}</DialogTitle>
          <DialogDescription>{t('ticketImport.reviewBody')}</DialogDescription>
        </DialogHeader>

        {read.sample && (
          <p role="alert" className="tint-12 flex gap-2 rounded-md px-3 py-2 text-sm font-semibold text-warning-fg [--tint-color:var(--warning)]">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {t('ticketImport.sample')}
          </p>
        )}

        {(ticket.issuer || ticket.booking_ref) && (
          <p className="text-xs text-fg-2">
            {[ticket.issuer, ticket.booking_ref && t('ticketImport.bookingRef', { ref: isolate(ticket.booking_ref) })].filter(Boolean).join(' · ')}
          </p>
        )}

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-fg">{t('ticketImport.whichFlight')}</h3>
          {options.length ? (
            <div className="space-y-2" role="radiogroup" aria-label={t('ticketImport.whichFlight')}>
              {options.map((o) => (
                <OptionRow key={o.key} option={o} checked={o.key === optionKey} onSelect={() => setOptionKey(o.key)} />
              ))}
            </div>
          ) : (
            <p role="alert" className="text-sm font-semibold text-danger">
              {t('ticketImport.errors.noFlights')}
            </p>
          )}
        </section>

        {rows.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-fg">{t('taskDetail.passengers')}</h3>
            <ul className="divide-y divide-border rounded-md border border-border">
              {rows.map((r) => {
                const id = `ticket-pax-${r.key}`;
                const added = Boolean(r.person && already.has(r.person.id));
                const group = r.person ? groupForGrade(groups, r.person.grade) : undefined;
                return (
                  <li key={r.key} className="space-y-2 px-3 py-2 text-sm">
                    <div className="flex items-center gap-3">
                      {added ? (
                        <UserRound className="size-4 shrink-0 text-fg-3" aria-hidden="true" />
                      ) : (
                        <Checkbox id={id} checked={picked.has(r.key)} onCheckedChange={(v) => toggle(r.key, v === true)} />
                      )}
                      <label htmlFor={added ? undefined : id} className="min-w-0 flex-1">
                        <span className="block truncate font-semibold" dir="auto">
                          {r.person ? name(r.person, 'full_name') : r.printed}
                        </span>
                        <span className="block truncate text-xs text-fg-3">
                          {added ? t('ticketImport.alreadyAdded') : r.person ? <span dir="ltr">{r.printed}</span> : t('ticketImport.notInStaff')}
                          {r.ticketNo && (
                            <>
                              {' · '}
                              {t('ticketImport.ticketNo', { no: isolate(r.ticketNo) })}
                            </>
                          )}
                        </span>
                      </label>
                      {r.person && <GradeBadge code={group?.code} grade={r.person.grade} />}
                    </div>
                    {!r.person && picked.has(r.key) && needsGroup && (
                      <GroupSelect
                        id={`${id}-group`}
                        aria-label={t('people.visitorGroup')}
                        groups={groups}
                        emptyLabel={t('people.chooseGroup')}
                        value={visitorGroups[r.key] ?? ''}
                        onChange={(e) => setVisitorGroups((prev) => ({ ...prev, [r.key]: e.target.value }))}
                        aria-invalid={!visitorGroups[r.key]}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
            {missingGroup && <p className="text-xs font-semibold text-danger">{t('people.errors.visitorGroup')}</p>}
          </section>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={apply} disabled={!option || missingGroup}>
            {t('ticketImport.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** FR-18 — "Import from ticket": AI reads the PDF / photo, the user reviews, then the flight card is filled. */
export function TicketImport({
  site,
  airports,
  onApplied,
}: {
  site: SiteWithAirports | undefined;
  airports: Airport[];
  onApplied: (result: TicketImportResult) => void;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const parse = useParseTicket();
  const [read, setRead] = useState<ReadTicket | null>(null);

  return (
    <div className="space-y-2">
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) parse.mutate(file, { onSuccess: setRead });
        }}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={parse.isPending}>
        <FileScan aria-hidden="true" />
        {parse.isPending ? t('ticketImport.reading') : t('ticketImport.button')}
      </Button>
      <FormError error={parse.error} />
      {read && <ReviewDialog read={read} site={site} airports={airports} onClose={() => setRead(null)} onApplied={onApplied} />}
    </div>
  );
}
