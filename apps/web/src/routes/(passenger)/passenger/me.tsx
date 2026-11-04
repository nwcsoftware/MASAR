import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { LogOut, Phone, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PushToggle } from '@/components/notifications/push-toggle';
import { DriverAvatar } from '@/components/driver-avatar';
import { ErrorState } from '@/components/error-state';
import { Field, FormError, NativeSelect } from '@/components/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser, useSessionApi } from '@/features/auth/session';
import { useAddEmergencyContact, useDeleteEmergencyContact, useEmergencyContacts, useMyPerson, useUpdateMyProfile } from '@/features/passenger/queries';
import { RIDE_PREFERENCES } from '@/features/passenger/types';
import { setLanguage } from '@/lib/i18n';
import { useLocalizedName } from '@/lib/i18n-data';
import type { Person } from '@/mocks/fixtures';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/(passenger)/passenger/me')({
  component: PassengerProfilePage,
});

/** Phone, language, accessibility, preferences — starts from the saved profile. */
function PreferencesForm({ me }: { me: Person | null }) {
  const { t } = useTranslation();
  const update = useUpdateMyProfile();
  const [phone, setPhone] = useState(me?.phone ?? '');
  const [needs, setNeeds] = useState(me?.accessibility_needs ?? '');
  const [prefs, setPrefs] = useState<string[]>(me?.ride_preferences ?? []);
  return (
      <form
        noValidate
        className="space-y-4 rounded-lg border border-border p-4"
        onSubmit={(event) => {
          event.preventDefault();
          update.mutate({ phone, accessibility_needs: needs, ride_preferences: prefs });
        }}
      >
        <Field id="me-photo" label={t('passenger.photo')}>
          <Input id="me-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => e.target.files?.[0] && update.mutate({ photo: e.target.files[0] })} />
        </Field>
        <Field id="me-phone" label={t('people.phone')}>
          <Input id="me-phone" type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field id="me-language" label={t('common.language')}>
          <NativeSelect
            id="me-language"
            value={me?.language ?? 'en'}
            onChange={(e) => {
              const language = e.target.value as 'en' | 'ar';
              void setLanguage(language);
              update.mutate({ language });
            }}
          >
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </NativeSelect>
        </Field>
        <Field id="me-needs" label={t('passenger.accessibility')} hint={t('passenger.accessibilityHint')}>
          <Textarea id="me-needs" rows={2} value={needs} onChange={(e) => setNeeds(e.target.value)} />
        </Field>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">{t('passenger.preferences')}</legend>
          <div className="flex flex-wrap gap-2">
            {RIDE_PREFERENCES.map((p) => {
              const on = prefs.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => setPrefs((current) => (on ? current.filter((x) => x !== p) : [...current, p]))}
                  className={cn('rounded-full border px-3 py-1.5 text-sm font-semibold', on ? 'border-brand-500 bg-brand-500 text-fg-on-brand' : 'border-border bg-surface text-fg-2')}
                >
                  {t(`passenger.prefs.${p}`)}
                </button>
              );
            })}
          </div>
        </fieldset>
        <FormError error={update.error} />
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? t('common.saving') : update.isSuccess ? t('common.saved') : t('common.save')}
        </Button>
      </form>
  );
}

/** §1 passenger profile: photo, phone, language, accessibility, ride preferences, emergency contacts. */
function PassengerProfilePage() {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const user = useCurrentUser();
  const { signOut } = useSessionApi();
  const navigate = useNavigate();
  const person = useMyPerson();
  const contacts = useEmergencyContacts(person.data?.id);
  const addContact = useAddEmergencyContact();
  const removeContact = useDeleteEmergencyContact();

  const [contact, setContact] = useState({ name: '', relation: '', phone: '' });

  if (person.isPending) return <Skeleton className="h-96 w-full" />;
  if (person.isError) return <ErrorState error={person.error} onRetry={() => void person.refetch()} />;
  const me = person.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <DriverAvatar name={user.profile.full_name} photoUrl={me?.photo_url} className="size-16 text-lg" />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold">{name(user.profile, 'full_name')}</h1>
          <p className="truncate text-sm text-fg-2">{user.email ?? user.profile.email}</p>
          {me?.employee_no && <p className="text-xs text-fg-3">{t('people.employeeNo')}: {me.employee_no}</p>}
        </div>
      </div>

      <PreferencesForm key={me?.id ?? 'none'} me={me} />

      <PushToggle />

      <section className="space-y-3 rounded-lg border border-border p-4" aria-labelledby="contacts-title">
        <h2 id="contacts-title" className="text-base font-bold">
          {t('passenger.emergencyContacts')}
        </h2>
        <ul className="space-y-2">
          {(contacts.data ?? []).map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-sm">
              <Phone className="size-4 text-fg-3" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{c.name}</span>
                {c.relation && <span className="text-fg-3"> · {c.relation}</span>}
                <span className="tabular block text-xs text-fg-2" dir="ltr">
                  {c.phone}
                </span>
              </span>
              <Button type="button" size="icon" variant="ghost" className="size-9" onClick={() => removeContact.mutate(c.id)} aria-label={`${t('common.remove')} ${c.name}`}>
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
          {!contacts.data?.length && <li className="text-sm text-fg-3">{t('passenger.noContacts')}</li>}
        </ul>
        <form
          noValidate
          className="grid gap-2 sm:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!me || !contact.name.trim() || !contact.phone.trim()) return;
            addContact.mutate({ personId: me.id, ...contact }, { onSuccess: () => setContact({ name: '', relation: '', phone: '' }) });
          }}
        >
          <Input aria-label={t('people.name')} placeholder={t('people.name')} value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
          <Input aria-label={t('passenger.relation')} placeholder={t('passenger.relation')} value={contact.relation} onChange={(e) => setContact({ ...contact, relation: e.target.value })} />
          <Input aria-label={t('people.phone')} placeholder={t('people.phone')} type="tel" dir="ltr" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
          <Button type="submit" variant="outline" size="sm" className="sm:col-span-3" disabled={!contact.name.trim() || !contact.phone.trim()}>
            <Plus aria-hidden="true" />
            {t('passenger.addContact')}
          </Button>
        </form>
        <FormError error={addContact.error ?? removeContact.error} />
      </section>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          void signOut().then(() => navigate({ to: '/login' }));
        }}
      >
        <LogOut className="rtl:-scale-x-100" aria-hidden="true" />
        {t('auth.signOut')}
      </Button>
    </div>
  );
}
