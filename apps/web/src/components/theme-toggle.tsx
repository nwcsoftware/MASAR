import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { applyThemeToDocument, readStoredTheme, storeTheme, type Theme } from '@/lib/theme';

const ORDER: Theme[] = ['light', 'dark', 'system'];
const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

export function ThemeToggle({ compact }: { compact?: boolean }) {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());

  // Follow the OS while the user is on "system".
  useEffect(() => {
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyThemeToDocument('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  const Icon = ICONS[theme];
  const label = t(
    theme === 'light' ? 'common.themeLight' : theme === 'dark' ? 'common.themeDark' : 'common.themeSystem',
  );

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length] as Theme;
        setTheme(next);
        storeTheme(next);
      }}
      aria-label={`${t('common.theme')}: ${label}`}
      title={`${t('common.theme')}: ${label}`}
    >
      <Icon aria-hidden="true" />
      {!compact && <span>{label}</span>}
    </Button>
  );
}
