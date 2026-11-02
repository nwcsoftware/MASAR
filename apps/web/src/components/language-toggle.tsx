import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useUpdateProfileLanguage } from '@/features/auth/queries';
import { setLanguage, type Language } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * EN ⇄ AR. Sets i18next language, <html lang>, <html dir>, persists locally
 * and — when signed in through Supabase — to profiles.language (FR-25).
 */
export function LanguageToggle({ compact, className }: { compact?: boolean; className?: string }) {
  const { i18n, t } = useTranslation();
  const next: Language = i18n.language.startsWith('ar') ? 'en' : 'ar';
  const persist = useUpdateProfileLanguage();

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(compact && 'px-2.5', className)}
      onClick={() => {
        void setLanguage(next);
        persist.mutate(next);
      }}
      aria-label={t('common.language')}
      title={t('common.language')}
    >
      {compact ? (
        <span className="text-xs font-extrabold" lang={next}>
          {next === 'ar' ? 'ع' : 'EN'}
        </span>
      ) : (
        <>
          <Languages aria-hidden="true" />
          <span className="font-semibold" lang={next}>
            {next === 'ar' ? 'العربية' : 'English'}
          </span>
        </>
      )}
    </Button>
  );
}
