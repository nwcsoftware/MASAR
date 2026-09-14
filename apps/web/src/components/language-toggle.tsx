import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { setLanguage, type Language } from '@/lib/i18n';

/**
 * EN ⇄ AR. Sets i18next language, <html lang>, <html dir> and persists.
 * (Persisting to the user's profile lands with auth — Phase 0 item 7.)
 */
export function LanguageToggle() {
  const { i18n, t } = useTranslation();
  const next: Language = i18n.language.startsWith('ar') ? 'en' : 'ar';

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => void setLanguage(next)}
      aria-label={t('common.language')}
      title={t('common.language')}
    >
      <Languages aria-hidden="true" />
      <span className="font-semibold">{next === 'ar' ? 'العربية' : 'English'}</span>
    </Button>
  );
}
