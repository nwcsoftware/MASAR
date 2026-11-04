import { useState } from 'react';
import { CheckCheck, ExternalLink, Hand, Siren } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FormError } from '@/components/form';
import { useOpenTask } from '@/components/layout/task-sheet-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/features/auth/session';
import { useSosEvents, useSosUpdate } from '@/features/passenger/queries';
import { mapsUrl } from '@/features/passenger/trip-utils';
import { usePeople } from '@/features/people/queries';
import { formatTime } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';
import type { SosEvent } from '@/mocks/fixtures';

/** §9: open passenger SOS events, pinned above every console page until resolved. */
export function SosAlerts() {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const { profile } = useCurrentUser();
  const events = useSosEvents();
  const people = usePeople();
  const update = useSosUpdate();
  const openTask = useOpenTask();
  const [resolving, setResolving] = useState<SosEvent | null>(null);
  const open = (events.data ?? []).filter((e) => e.status !== 'resolved');
  const canAct = profile.role !== 'viewer';
  if (!open.length) return null;

  return (
    <section aria-label={t('sos.staffTitle')} className="space-y-1 border-b border-border bg-danger px-4 py-2 text-fg-on-brand" data-sos-alerts>
      {open.map((e) => {
        const person = people.data?.find((p) => p.id === e.person_id);
        return (
          <div key={e.id} role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" data-sos-event={e.status}>
            <Siren className="size-4 shrink-0 animate-pulse" aria-hidden="true" />
            <span className="font-extrabold">
              {t('sos.staffLine', { name: person ? name(person, 'full_name') : '—', time: formatTime(e.created_at) })}
            </span>
            {e.message && <span className="truncate">“{e.message}”</span>}
            {e.status === 'acknowledged' && <span className="rounded-full bg-[color-mix(in_srgb,var(--text-on-brand)_20%,transparent)] px-2 text-xs font-bold">{t('sos.handling')}</span>}
            <span className="ms-auto flex flex-wrap gap-1">
              {e.lat != null && e.lng != null && (
                <Button asChild size="sm" variant="secondary">
                  <a href={mapsUrl(e.lat, e.lng)} target="_blank" rel="noreferrer">
                    <ExternalLink aria-hidden="true" />
                    {t('sos.location')}
                  </a>
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => openTask(e.task_id)}>
                {t('sos.openTrip')}
              </Button>
              {canAct && e.status === 'open' && (
                <Button size="sm" variant="secondary" onClick={() => update.mutate({ id: e.id, action: 'acknowledge' })} disabled={update.isPending}>
                  <Hand aria-hidden="true" />
                  {t('sos.acknowledge')}
                </Button>
              )}
              {canAct && (
                <Button size="sm" variant="secondary" onClick={() => setResolving(e)}>
                  <CheckCheck aria-hidden="true" />
                  {t('sos.resolve')}
                </Button>
              )}
            </span>
          </div>
        );
      })}
      <ResolveDialog event={resolving} onClose={() => setResolving(null)} />
    </section>
  );
}

function ResolveDialog({ event, onClose }: { event: SosEvent | null; onClose: () => void }) {
  const { t } = useTranslation();
  const update = useSosUpdate();
  const [note, setNote] = useState('');
  const close = () => {
    setNote('');
    update.reset();
    onClose();
  };
  return (
    <Dialog open={event !== null} onOpenChange={(next) => !next && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('sos.resolveTitle')}</DialogTitle>
          <DialogDescription>{t('sos.resolveHint')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="sos-note">{t('sos.resolveNote')}</Label>
          <Textarea id="sos-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <FormError error={update.error} />
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => event && update.mutate({ id: event.id, action: 'resolve', note }, { onSuccess: close })} disabled={update.isPending}>
            {t('sos.resolve')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
