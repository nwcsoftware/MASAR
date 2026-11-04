/**
 * send-push (passenger module §7, FR-25)
 *
 * POST {} → {sent, skipped, removed}
 *
 * Delivers queued notifications as Web Push: rows with 'push' in `channels`
 * and no `sent_at` yet (the triggers in 0007 and earlier only write
 * notifications). Called every minute by pg_cron + pg_net with the
 * `x-cron-secret` header (DATABASE.md §9f) — never by browsers. Texts are
 * short and localised by the recipient's language; the app shows the rest.
 * Gone subscriptions (404 / 410) are deleted.
 */
import webpush from 'web-push';
import { adminClient } from '../_shared/auth.ts';
import { handle, HttpError, json, requireEnv } from '../_shared/http.ts';

const BATCH = 200;

type Lang = 'en' | 'ar';
const TEXT: Record<string, Record<Lang, string>> = {
  task_assigned: { en: 'New trip assigned', ar: 'رحلة جديدة مسندة إليك' },
  task_reminder: { en: 'Trip reminder', ar: 'تذكير بالرحلة' },
  task_cancelled: { en: 'Trip cancelled', ar: 'أُلغيت الرحلة' },
  task_delayed: { en: 'Your trip is delayed', ar: 'رحلتك متأخرة' },
  task_completed: { en: 'Trip completed — rate your ride', ar: 'انتهت الرحلة — قيّم رحلتك' },
  passenger_trip_assigned: { en: 'You have a new trip', ar: 'لديك رحلة جديدة' },
  driver_changed: { en: 'Your driver has changed', ar: 'تغيّر سائقك' },
  driver_on_the_way: { en: 'Your driver is on the way', ar: 'سائقك في الطريق' },
  driver_arrived: { en: 'Your driver has arrived', ar: 'وصل سائقك' },
  trip_document_added: { en: 'New trip document', ar: 'مستند جديد للرحلة' },
  registration_approved: { en: 'Your Masar account is approved', ar: 'تمت الموافقة على حسابك في مسار' },
  registration_rejected: { en: 'Your sign-up was declined', ar: 'تم رفض طلب التسجيل' },
  trip_request_decided: { en: 'Your trip request was answered', ar: 'تم الرد على طلب الرحلة' },
  trip_request: { en: 'New trip request', ar: 'طلب رحلة جديد' },
  sos_alert: { en: 'SOS from a passenger', ar: 'نداء استغاثة من راكب' },
  low_rating: { en: 'Low trip rating', ar: 'تقييم منخفض لرحلة' },
  passenger_registered: { en: 'New passenger sign-up', ar: 'تسجيل راكب جديد' },
};

interface Row {
  id: string;
  user_id: string;
  type: string;
  task_id: string | null;
  title: string;
  body: string | null;
  data: { audience?: string } | null;
}

/** Where a tap on the notification lands in the app. */
function urlFor(n: Row): string {
  if (n.data?.audience === 'passenger') return n.task_id ? `/passenger/trips/${n.task_id}` : '/passenger';
  if (n.type === 'trip_request') return '/requests';
  if (n.type === 'low_rating') return '/ratings?low=true';
  if (n.type === 'passenger_registered') return '/staff';
  if (n.type.startsWith('registration_')) return '/passenger';
  return n.task_id ? `/tasks?task=${n.task_id}` : '/';
}

Deno.serve(
  handle(async (req) => {
    if (req.headers.get('x-cron-secret') !== requireEnv('PUSH_CRON_SECRET')) throw new HttpError(401, 'errors.unauthorized');
    webpush.setVapidDetails(requireEnv('VAPID_SUBJECT'), requireEnv('VAPID_PUBLIC_KEY'), requireEnv('VAPID_PRIVATE_KEY'));
    const admin = adminClient();

    const { data: queued, error } = await admin
      .from('notifications')
      .select('id, user_id, type, task_id, title, body, data')
      .is('sent_at', null)
      .contains('channels', ['push'])
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for')
      .limit(BATCH);
    if (error) throw error;
    const rows = (queued ?? []) as Row[];
    if (!rows.length) return json({ sent: 0, skipped: 0, removed: 0 });

    const userIds = [...new Set(rows.map((n) => n.user_id))];
    const [{ data: profiles }, { data: subs }] = await Promise.all([
      admin.from('profiles').select('id, language, notif_push, is_active').in('id', userIds),
      admin.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').in('user_id', userIds),
    ]);

    let sent = 0;
    let skipped = 0;
    const gone = new Set<string>();
    for (const n of rows) {
      const profile = profiles?.find((p) => p.id === n.user_id);
      const targets = (subs ?? []).filter((s) => s.user_id === n.user_id && !gone.has(s.id));
      if (!profile?.is_active || !profile.notif_push || !targets.length) {
        skipped++;
        continue;
      }
      const lang: Lang = profile.language === 'ar' ? 'ar' : 'en';
      const payload = JSON.stringify({
        title: TEXT[n.type]?.[lang] ?? 'Masar',
        body: n.body ? `${n.title} · ${n.body}` : n.title,
        url: urlFor(n),
        tag: n.task_id ?? n.id,
      });
      for (const s of targets) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
          sent++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) gone.add(s.id);
          else console.error('push failed', status, (e as Error).message);
        }
      }
    }

    // processed either way: no subscription / push off means in-app only
    const now = new Date().toISOString();
    const { error: markError } = await admin.from('notifications').update({ sent_at: now }).in('id', rows.map((n) => n.id));
    if (markError) throw markError;
    if (gone.size) await admin.from('push_subscriptions').delete().in('id', [...gone]);
    if (sent) {
      await admin.from('push_subscriptions').update({ last_used_at: now }).in('user_id', userIds);
    }
    return json({ sent, skipped, removed: gone.size });
  }),
);
