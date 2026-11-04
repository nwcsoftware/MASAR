import { useCallback, useEffect, useState } from 'react';
import { useCurrentUser } from '@/features/auth/session';
import { db, useLiveData } from '@/lib/data-source';
import { env } from '@/lib/env';

export type PushState = 'unsupported' | 'demo' | 'not-configured' | 'denied' | 'off' | 'on';

const supported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const b64 = (buffer: ArrayBuffer | null) => (buffer ? btoa(String.fromCharCode(...new Uint8Array(buffer))) : '');

/**
 * §7 Web Push on this device: subscribe through the service worker and store
 * the endpoint in push_subscriptions (RLS: own rows); the send-push Edge
 * Function delivers queued notifications. Demo mode stays in-app only.
 */
export function usePushSubscription() {
  const live = useLiveData();
  const { id: userId } = useCurrentUser();
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const configured = Boolean(env.vapidPublicKey);

  useEffect(() => {
    if (!supported() || !live || !configured) return;
    let cancelled = false;
    void navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => !cancelled && setSubscribed(Boolean(sub)));
    return () => {
      cancelled = true;
    };
  }, [live, configured]);

  const state: PushState = !supported()
    ? 'unsupported'
    : !live
      ? 'demo'
      : !configured
        ? 'not-configured'
        : Notification.permission === 'denied'
          ? 'denied'
          : subscribed
            ? 'on'
            : 'off';

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if ((await Notification.requestPermission()) !== 'granted') return;
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(env.vapidPublicKey) }));
      const { error: saveError } = await db()
        .from('push_subscriptions')
        .upsert(
          { user_id: userId, endpoint: sub.endpoint, p256dh: b64(sub.getKey('p256dh')), auth: b64(sub.getKey('auth')), user_agent: navigator.userAgent.slice(0, 200), platform: 'web' },
          { onConflict: 'endpoint' },
        );
      if (saveError) throw saveError;
      setSubscribed(true);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }, [userId]);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (sub) {
        await db().from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, error, enable, disable };
}
