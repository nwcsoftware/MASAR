import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Download, LogOut } from 'lucide-react';
import { PushToggle } from '@/components/notifications/push-toggle';
import { useTranslation } from 'react-i18next';
import { DriverAvatar } from '@/components/driver-avatar';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useUpdateProfileLanguage } from '@/features/auth/queries';
import { useCurrentUser, useSessionApi } from '@/features/auth/session';
import { setLanguage, type Language } from '@/lib/i18n';
import { useLocalizedName } from '@/lib/i18n-data';
import { useInstallPrompt } from '@/lib/pwa';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/(driver)/driver/me')({
  component: DriverMe,
});

/** Screen 12e — profile, language (FR-36), theme, notification channels (FR-24), install, sign out. */
function DriverMe() {
  const { t, i18n } = useTranslation();
  const name = useLocalizedName();
  const user = useCurrentUser();
  const { signOut } = useSessionApi();
  const navigate = useNavigate();
  const persistLanguage = useUpdateProfileLanguage();
  const install = useInstallPrompt();
  const lang: Language = i18n.language.startsWith('ar') ? 'ar' : 'en';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
        <DriverAvatar name={user.profile.full_name} photoUrl={user.profile.avatar_url} className="size-12" />
        <div className="min-w-0">
          <p className="truncate font-bold">{name(user.profile, 'full_name')}</p>
          <p className="truncate text-sm text-fg-2" dir="ltr">
            {user.profile.phone ?? user.profile.email}
          </p>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="eyebrow">{t('common.language')}</h2>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label={t('common.language')}>
          {(['en', 'ar'] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={lang === l}
              onClick={() => {
                void setLanguage(l);
                persistLanguage.mutate(l);
              }}
              className={cn('min-h-touch rounded-md border text-sm font-bold', lang === l ? 'border-brand-500 bg-brand-500 text-fg-on-brand' : 'border-border-strong bg-surface')}
              lang={l}
            >
              {l === 'en' ? 'English' : 'العربية'}
            </button>
          ))}
        </div>
      </section>

      <section className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-2">
        <span className="text-sm font-semibold">{t('common.theme')}</span>
        <ThemeToggle />
      </section>

      <section className="space-y-2">
        <h2 className="eyebrow">{t('notifications.channels')}</h2>
        <div className="divide-y divide-border rounded-lg border border-border bg-surface">
          {(['notif_push', 'notif_in_app', 'notif_email'] as const).map((key) => (
            <label key={key} className="flex min-h-touch items-center justify-between px-4 py-2 text-sm font-semibold">
              {t(`notifications.channel.${key}`)}
              <Switch defaultChecked={user.profile[key]} disabled title={t('common.comingSoon')} />
            </label>
          ))}
        </div>
      </section>

      <PushToggle />

      {install.canInstall && !install.installed && (
        <Button variant="outline" size="lg" className="w-full" onClick={() => void install.install()}>
          <Download aria-hidden="true" />
          {t('driver.install')}
        </Button>
      )}

      <Button
        variant="ghost"
        size="lg"
        className="w-full text-danger"
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
