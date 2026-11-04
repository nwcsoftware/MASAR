import { useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}

/** NFR-03 — shown while offline; driver actions queue and replay (offline queue: Phase 3). */
export function OfflineBanner({ className }: { className?: string }) {
  const { t } = useTranslation();
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('tint-12 flex items-center gap-2 px-4 py-2 text-xs font-semibold text-warning-fg [--tint-color:var(--warning)]', className)}
    >
      <WifiOff className="size-4 shrink-0" aria-hidden="true" />
      {t('errors.offline')}
    </div>
  );
}
