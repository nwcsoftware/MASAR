import i18n from '@/lib/i18n';

/**
 * Locale-aware formatting (docs/DESIGN.md §7). Times are always shown in the
 * company timezone, not the viewer's, so a dispatcher abroad still sees the
 * site's 12:45. Western digits by default; `eastern_arabic_digits` switches
 * Arabic to ar-SA-u-nu-arab (company setting, wired in Phase 1).
 */
export const DEFAULT_TIMEZONE = 'Asia/Riyadh';

let timeZone = DEFAULT_TIMEZONE;
let easternDigits = false;

export function configureFormatting(options: { timeZone?: string; easternArabicDigits?: boolean }) {
  if (options.timeZone) timeZone = options.timeZone;
  if (options.easternArabicDigits !== undefined) easternDigits = options.easternArabicDigits;
}

function locale(): string {
  const lang = i18n.language?.startsWith('ar') ? 'ar' : 'en';
  if (lang === 'ar') return easternDigits ? 'ar-SA-u-nu-arab' : 'ar-SA-u-nu-latn-ca-gregory';
  return 'en-GB';
}

const toDate = (value: string | Date) => (typeof value === 'string' ? new Date(value) : value);

export function formatTime(value: string | Date): string {
  return new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(
    toDate(value),
  );
}

export function formatTimeRange(start: string | Date, end: string | Date | null | undefined): string {
  return end ? `${formatTime(start)}–${formatTime(end)}` : formatTime(start);
}

export function formatDate(value: string | Date, style: 'short' | 'medium' | 'long' = 'medium'): string {
  const options: Intl.DateTimeFormatOptions =
    style === 'short'
      ? { day: 'numeric', month: 'short' }
      : style === 'medium'
        ? { day: 'numeric', month: 'short', year: 'numeric' }
        : { weekday: 'long', day: 'numeric', month: 'long' };
  return new Intl.DateTimeFormat(locale(), { ...options, timeZone }).format(toDate(value));
}

export function formatWeekday(value: string | Date, style: 'short' | 'long' = 'short'): string {
  return new Intl.DateTimeFormat(locale(), { weekday: style, timeZone }).format(toDate(value));
}

export function formatDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat(locale(), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(toDate(value));
}

export function formatNumber(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(locale(), { maximumFractionDigits }).format(value);
}

/** 390 → "6.5" — hours with one decimal, for KPI tiles and tables. */
export function formatHours(minutes: number): string {
  return formatNumber(minutes / 60, 1);
}

export function formatRelative(value: string | Date, now: Date = new Date()): string {
  const diffSec = Math.round((toDate(value).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto', style: 'short' });
  if (abs < 60) return rtf.format(diffSec, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  return rtf.format(Math.round(diffSec / 86_400), 'day');
}

/** YYYY-MM-DD of `value` in the company timezone. */
export function companyDateKey(value: string | Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    toDate(value),
  );
}

/** Minutes since local midnight in the company timezone (for calendar positioning). */
export function companyMinutesOfDay(value: string | Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(toDate(value));
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

/**
 * Wrap free text (task titles, names typed in English) in Unicode isolates
 * (FSI…PDI) before interpolating it into a translated sentence, so Latin
 * text inside Arabic keeps its own direction instead of reordering the line.
 */
export function isolate(text: string): string {
  return text ? `⁨${text}⁩` : text;
}

export function initials(name: string): string {
  const words = name.replace(/^(Eng\.|Mr\.|Mrs\.|Ms\.|Dr\.)\s*/i, '').trim().split(/\s+/);
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '')).toUpperCase();
}
