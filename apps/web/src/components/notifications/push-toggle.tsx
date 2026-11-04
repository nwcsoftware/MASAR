import { BellRing } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FormError } from '@/components/form';
import { Switch } from '@/components/ui/switch';
import { usePushSubscription } from '@/features/notifications/push';

/** §7 "Notify me on this device" — Web Push via the service worker. */
export function PushToggle() {
  const { t } = useTranslation();
  const push = usePushSubscription();
  const on = push.state === 'on';
  const usable = push.state === 'on' || push.state === 'off';
  return (
    <div className="space-y-1 rounded-lg border border-border bg-surface p-4" data-push={push.state}>
      <div className="flex items-center gap-3">
        <BellRing className="size-5 text-brand-500" aria-hidden="true" />
        <label htmlFor="push-toggle" className="flex-1 text-sm font-semibold">
          {t('push.label')}
        </label>
        <Switch
          id="push-toggle"
          checked={on}
          disabled={!usable || push.busy}
          onCheckedChange={(next) => void (next ? push.enable() : push.disable())}
        />
      </div>
      <p className="text-xs text-fg-3">{t(`push.state.${push.state}`)}</p>
      <FormError error={push.error} />
    </div>
  );
}
