import { CircleAlert, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ErrorState({ error, onRetry, className }: { error?: unknown; onRetry?: () => void; className?: string }) {
  const { t } = useTranslation();
  const detail = error instanceof Error ? error.message : null;
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 px-6 py-12 text-center', className)}>
      <span className="tint-12 grid size-11 place-items-center rounded-full text-danger [--tint-color:var(--danger)]">
        <CircleAlert className="size-5" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-base font-bold text-fg">{t('errors.generic')}</p>
        {detail && <p className="font-mono text-xs text-fg-3">{detail}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw aria-hidden="true" />
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}
