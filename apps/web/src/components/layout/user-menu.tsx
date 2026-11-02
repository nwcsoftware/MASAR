import { useNavigate } from '@tanstack/react-router';
import { LogOut, Settings, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DriverAvatar } from '@/components/driver-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrentUser, useSessionApi } from '@/features/auth/session';
import { useLocalizedName } from '@/lib/i18n-data';
import { cn } from '@/lib/utils';

export function UserMenu({ collapsed }: { collapsed?: boolean }) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const user = useCurrentUser();
  const { signOut } = useSessionApi();
  const navigate = useNavigate();
  const displayName = name(user.profile, 'full_name');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn('flex w-full items-center gap-2.5 rounded-md p-2 text-start transition-colors hover:bg-surface-3', collapsed && 'justify-center')}
        aria-label={t('user.menu')}
      >
        <DriverAvatar name={user.profile.full_name} photoUrl={user.profile.avatar_url} />
        {!collapsed && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-fg">{displayName}</span>
            <span className="block truncate text-xs text-fg-3">{t(`roles.${user.profile.role}`)}</span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuLabel className="normal-case tracking-normal">
          <span className="block text-sm font-bold text-fg">{displayName}</span>
          <span className="block truncate text-xs font-medium text-fg-3">{user.profile.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <UserRound aria-hidden="true" />
          {t('user.profile')}
        </DropdownMenuItem>
        {user.profile.role !== 'driver' && (
          <DropdownMenuItem onSelect={() => void navigate({ to: '/settings' })}>
            <Settings aria-hidden="true" />
            {t('nav.settings')}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void signOut().then(() => navigate({ to: '/login' }));
          }}
        >
          <LogOut className="rtl:-scale-x-100" aria-hidden="true" />
          {t('auth.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
