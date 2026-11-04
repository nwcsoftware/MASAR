import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck, Pencil, UserPlus, UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { INVITABLE_ROLES, inviteUserInput, type InviteUserInput } from '@shared/schemas';
import { DriverAvatar } from '@/components/driver-avatar';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Field, FormError, NativeSelect } from '@/components/form';
import { Panel } from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCurrentUser } from '@/features/auth/session';
import { useCompanyUsers, useInviteUser, useSetUserActive, useUpdateUserAccess, type CompanyUser } from '@/features/company/queries';
import { useDrivers } from '@/features/drivers/queries';
import { useSites } from '@/features/sites/queries';
import type { AppRole } from '@/lib/task-meta';
import { useLocalizedName } from '@/lib/i18n-data';

function SiteScopePicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const sites = useSites();
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{t('users.siteScope')}</legend>
      <p className="text-xs text-fg-3">{t('users.siteScopeHint')}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {(sites.data ?? []).map((s) => (
          <label key={s.id} className="flex items-center gap-2 text-sm">
            <Checkbox checked={value.includes(s.id)} onCheckedChange={(v) => onChange(v ? [...value, s.id] : value.filter((id) => id !== s.id))} />
            {name(s)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const INVITE_DEFAULTS: InviteUserInput = { email: '', full_name: '', full_name_ar: '', role: 'dispatcher', language: 'en', phone: '', site_ids: [] };

/** FR-04 — invite by email with role + site scope; drivers get (or link) a drivers record. */
function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const sites = useSites();
  const drivers = useDrivers();
  const invite = useInviteUser();
  const form = useForm<InviteUserInput>({ resolver: zodResolver(inviteUserInput), defaultValues: INVITE_DEFAULTS });
  const errors = form.formState.errors;
  const role = form.watch('role');
  const unlinkedDrivers = (drivers.data ?? []).filter((d) => !d.profile_id);

  useEffect(() => {
    if (open) {
      form.reset(INVITE_DEFAULTS);
      invite.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('settings.users.invite')}</DialogTitle>
          <DialogDescription>{t('users.inviteHint')}</DialogDescription>
        </DialogHeader>
        {invite.isSuccess ? (
          <div role="status" className="flex flex-col items-center gap-2 py-6 text-center">
            <MailCheck className="size-8 text-success-fg" aria-hidden="true" />
            <p className="font-bold">{t('users.invited', { email: form.getValues('email') })}</p>
            <Button className="mt-2" onClick={() => onOpenChange(false)}>
              {t('common.close')}
            </Button>
          </div>
        ) : (
          <>
            <form
              id="invite-form"
              noValidate
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={form.handleSubmit((values) => invite.mutate(values))}
            >
              <Field id="inv-email" label={t('auth.email')} error={errors.email?.message} className="sm:col-span-2">
                <Input id="inv-email" type="email" dir="ltr" autoComplete="off" aria-invalid={Boolean(errors.email)} {...form.register('email')} />
              </Field>
              <Field id="inv-name" label={t('invite.fullName')} error={errors.full_name?.message}>
                <Input id="inv-name" {...form.register('full_name')} />
              </Field>
              <Field id="inv-name-ar" label={t('drivers.nameAr')}>
                <Input id="inv-name-ar" dir="rtl" {...form.register('full_name_ar')} />
              </Field>
              <Field id="inv-role" label={t('settings.users.role')}>
                <NativeSelect id="inv-role" {...form.register('role')}>
                  {INVITABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {t(`roles.${r}`)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field id="inv-lang" label={t('settings.users.language')}>
                <NativeSelect id="inv-lang" {...form.register('language')}>
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                </NativeSelect>
              </Field>
              <Field id="inv-phone" label={t('drivers.phone')} className="sm:col-span-2">
                <Input id="inv-phone" type="tel" dir="ltr" {...form.register('phone')} />
              </Field>

              {role === 'driver' ? (
                <>
                  <Field id="inv-driver" label={t('users.linkDriver')} hint={t('users.linkDriverHint')}>
                    <NativeSelect id="inv-driver" {...form.register('driver_id', { setValueAs: (v: string) => v || undefined })}>
                      <option value="">{t('users.newDriverRecord')}</option>
                      {unlinkedDrivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {name(d, 'full_name')}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field id="inv-home" label={t('drivers.homeSite')}>
                    <NativeSelect id="inv-home" {...form.register('home_site_id', { setValueAs: (v: string) => v || undefined })}>
                      <option value="">—</option>
                      {(sites.data ?? []).map((s) => (
                        <option key={s.id} value={s.id}>
                          {name(s)}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                </>
              ) : role === 'dispatcher' || role === 'viewer' ? (
                <div className="sm:col-span-2">
                  <SiteScopePicker value={form.watch('site_ids') ?? []} onChange={(next) => form.setValue('site_ids', next)} />
                </div>
              ) : null}
              <FormError error={invite.error} className="sm:col-span-2" />
            </form>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" form="invite-form" disabled={invite.isPending}>
                {invite.isPending ? t('users.sending') : t('users.sendInvite')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Role + site scope for an existing user. The 0002 profile guard enforces the same rules server-side. */
function AccessDialog({ user, onOpenChange }: { user: CompanyUser | null; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  return (
    <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('users.editAccess')}</DialogTitle>
          <DialogDescription>{user ? name(user, 'full_name') : ''}</DialogDescription>
        </DialogHeader>
        {user && <AccessForm key={user.id} user={user} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function AccessForm({ user, onDone }: { user: CompanyUser; onDone: () => void }) {
  const { t } = useTranslation();
  const me = useCurrentUser();
  const update = useUpdateUserAccess();
  const [role, setRole] = useState<AppRole>(user.role);
  const [siteIds, setSiteIds] = useState<string[]>(user.siteIds);
  const roles: AppRole[] = me.profile.role === 'owner' ? ['owner', ...INVITABLE_ROLES] : [...INVITABLE_ROLES];
  return (
    <>
      <div className="space-y-4">
        <Field id="acc-role" label={t('settings.users.role')}>
          <NativeSelect id="acc-role" value={role} onChange={(e) => setRole(e.target.value as AppRole)}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {t(`roles.${r}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {(role === 'dispatcher' || role === 'viewer') && <SiteScopePicker value={siteIds} onChange={setSiteIds} />}
        <FormError error={update.error} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button disabled={update.isPending} onClick={() => update.mutate({ userId: user.id, values: { role: role as Exclude<AppRole, 'passenger'>, site_ids: siteIds } }, { onSuccess: onDone })}>
          {update.isPending ? t('common.saving') : t('common.save')}
        </Button>
      </DialogFooter>
    </>
  );
}

export function UsersTab() {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const me = useCurrentUser();
  const users = useCompanyUsers();
  const sites = useSites();
  const setActive = useSetUserActive();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyUser | null>(null);
  const siteName = (id: string) => {
    const site = sites.data?.find((s) => s.id === id);
    return site ? (site.code ?? name(site)) : '…';
  };
  const canEdit = (u: CompanyUser) => u.id !== me.id && (u.role !== 'owner' || me.profile.role === 'owner');

  return (
    <Panel
      title={t('settings.users.title')}
      action={
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <UserPlus aria-hidden="true" />
          {t('settings.users.invite')}
        </Button>
      }
    >
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <AccessDialog user={editing} onOpenChange={(open) => !open && setEditing(null)} />
      {users.isPending ? (
        <Skeleton className="m-4 h-40" />
      ) : users.isError ? (
        <ErrorState error={users.error} onRetry={() => void users.refetch()} />
      ) : !users.data.length ? (
        <EmptyState compact icon={UsersRound} title={t('settings.users.empty')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t('settings.users.name')}</TableHead>
              <TableHead>{t('settings.users.role')}</TableHead>
              <TableHead>{t('settings.users.scope')}</TableHead>
              <TableHead>{t('common.active')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.data.map((u) => (
              <TableRow key={u.id} className={u.is_active ? undefined : 'opacity-60'}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <DriverAvatar name={u.full_name} className="size-7" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {name(u, 'full_name')}
                        {u.id === me.id && <span className="ms-1.5 text-xs font-medium text-fg-3">({t('users.you')})</span>}
                      </p>
                      <p className="truncate text-xs text-fg-3" dir="ltr">
                        {u.email}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={u.role === 'owner' || u.role === 'admin' ? 'brand' : 'default'}>{t(`roles.${u.role}`)}</Badge>
                </TableCell>
                <TableCell className="text-xs text-fg-2">
                  {u.role === 'driver' ? (u.driverId ? t('users.linkedDriver') : '—') : u.siteIds.length ? u.siteIds.map(siteName).join(', ') : t('common.allSites')}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={u.is_active}
                    disabled={!canEdit(u) || setActive.isPending}
                    onCheckedChange={(active) => setActive.mutate({ userId: u.id, active })}
                    aria-label={`${t('common.active')} — ${u.full_name}`}
                  />
                </TableCell>
                <TableCell className="text-end">
                  {canEdit(u) && (
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(u)} aria-label={`${t('users.editAccess')} — ${u.full_name}`}>
                      <Pencil aria-hidden="true" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <FormError error={setActive.error} className="m-4" />
    </Panel>
  );
}
