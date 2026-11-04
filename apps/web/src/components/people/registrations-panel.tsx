import { useState } from 'react';
import { Check, UserRoundPlus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FormError } from '@/components/form';
import { GradeBadge } from '@/components/grade-badge';
import { Panel } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGradeGroups } from '@/features/grades/queries';
import { groupForGrade } from '@/features/grades/rules';
import { useReviewRegistration } from '@/features/passenger/queries';
import { formatDateTime } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';
import type { Person } from '@/mocks/fixtures';

/**
 * §1 — passenger sign-ups waiting for an owner/admin. Approving gives the
 * passenger their trips; rejecting (with an optional reason) keeps them out.
 */
export function RegistrationsPanel({ people }: { people: Person[] }) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const review = useReviewRegistration();
  const groups = useGradeGroups().data ?? [];
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const pending = people.filter((p) => p.registration_status === 'pending');
  if (!pending.length) return null;

  return (
    <Panel
      title={
        <span className="inline-flex items-center gap-2">
          <UserRoundPlus className="size-4 text-brand-500" aria-hidden="true" />
          {t('passenger.approvals.title', { count: pending.length })}
        </span>
      }
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-border">
        {pending.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3" data-registration={p.email ?? p.full_name}>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-fg">
                {name(p, 'full_name')}
                <GradeBadge code={groupForGrade(groups, p.grade)?.code} grade={p.grade} />
              </p>
              <p className="text-xs text-fg-2">
                <span dir="ltr">{p.email}</span>
                {p.employee_no && <> · {p.employee_no}</>}
                {' · '}
                {p.source === 'self' ? t('passenger.approvals.newPerson') : t('passenger.approvals.matched')}
                {' · '}
                {formatDateTime(p.updated_at)}
              </p>
            </div>
            {rejecting === p.id ? (
              <form
                className="flex w-full flex-wrap gap-2 sm:w-auto"
                onSubmit={(e) => {
                  e.preventDefault();
                  review.mutate({ personId: p.id, approve: false, note: reason }, { onSuccess: () => setRejecting(null) });
                }}
              >
                <Input aria-label={t('passenger.approvals.reason')} placeholder={t('passenger.approvals.reason')} value={reason} onChange={(e) => setReason(e.target.value)} className="h-9 sm:w-56" />
                <Button type="submit" size="sm" variant="destructive" disabled={review.isPending}>
                  {t('passenger.approvals.reject')}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setRejecting(null)}>
                  {t('common.cancel')}
                </Button>
              </form>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" disabled={review.isPending} onClick={() => review.mutate({ personId: p.id, approve: true })} aria-label={`${t('passenger.approvals.approve')} ${p.full_name}`}>
                  <Check aria-hidden="true" />
                  {t('passenger.approvals.approve')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setReason('');
                    setRejecting(p.id);
                  }}
                  aria-label={`${t('passenger.approvals.reject')} ${p.full_name}`}
                >
                  <X aria-hidden="true" />
                  {t('passenger.approvals.reject')}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <FormError error={review.error} className="m-4" />
    </Panel>
  );
}
