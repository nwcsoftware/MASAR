import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Menu, Plus, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from '@/components/language-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import { NotificationBell } from '@/components/layout/notification-bell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { isStaff } from '@/features/auth/guards';
import { useCurrentUser } from '@/features/auth/session';

/** docs/DESIGN.md §4.1 — search ⌘K · lang · theme · 🔔 · primary action. */
export function Topbar({
  onMenu,
  onNewTask,
  onOpenTask,
}: {
  onMenu: () => void;
  onNewTask: () => void;
  onOpenTask: (taskId: string) => void;
}) {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  // ⌘K / Ctrl+K focuses search
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="flex h-topbar shrink-0 items-center gap-3 border-b border-border bg-surface px-4 lg:px-5" data-tauri-drag-region>
      <Button variant="ghost" size="icon" className="size-9 lg:hidden" onClick={onMenu} aria-label={t('nav.open')}>
        <Menu aria-hidden="true" />
      </Button>

      <form
        role="search"
        className="flex h-9 max-w-sm flex-1 items-center gap-2 rounded-md border border-border bg-surface-2 px-3 text-sm text-fg-3 focus-within:border-brand-400"
        onSubmit={(event) => {
          event.preventDefault();
          void navigate({ to: '/tasks', search: { q: query.trim() || undefined } });
        }}
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('common.searchHint')}
          aria-label={t('common.search')}
          className="min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-fg-3 focus-visible:outline-none"
        />
        <kbd className="hidden rounded border border-border-strong px-1.5 text-[11px] font-medium sm:inline" dir="ltr">
          ⌘K
        </kbd>
      </form>

      <div className="ms-auto flex items-center gap-1.5">
        {user.mode === 'demo' && (
          <Badge variant="warning" className="hidden md:inline-flex" title={t('demo.sampleDataHint')}>
            {t('demo.badge')}
          </Badge>
        )}
        <LanguageToggle compact />
        <ThemeToggle compact />
        <NotificationBell onOpenTask={onOpenTask} />
        {isStaff(user.profile.role) && (
          <Button size="sm" className="ms-1.5" onClick={onNewTask}>
            <Plus aria-hidden="true" />
            <span className="hidden sm:inline">{t('tasks.new')}</span>
          </Button>
        )}
      </div>
    </header>
  );
}
