import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage } from '@/lib/i18n';
import {
  companyDateKey,
  companyMinutesOfDay,
  configureFormatting,
  formatHours,
  formatTime,
  formatTimeRange,
  initials,
} from '@/lib/format';

describe('format', () => {
  afterEach(async () => {
    configureFormatting({ timeZone: 'Asia/Riyadh', easternArabicDigits: false });
    await setLanguage('en');
  });

  it('shows times in the company timezone, not the viewer’s', () => {
    // 09:45 UTC is 12:45 in Riyadh (UTC+3, no DST)
    expect(formatTime('2026-11-02T09:45:00Z')).toBe('12:45');
    configureFormatting({ timeZone: 'UTC' });
    expect(formatTime('2026-11-02T09:45:00Z')).toBe('09:45');
  });

  it('formats a range with an en dash', () => {
    expect(formatTimeRange('2026-11-02T09:45:00Z', '2026-11-02T13:10:00Z')).toBe('12:45–16:10');
    expect(formatTimeRange('2026-11-02T09:45:00Z', null)).toBe('12:45');
  });

  it('uses Western digits in Arabic by default and Eastern digits when the company opts in', async () => {
    await setLanguage('ar');
    expect(formatTime('2026-11-02T09:45:00Z')).toBe('12:45');
    configureFormatting({ easternArabicDigits: true });
    expect(formatTime('2026-11-02T09:45:00Z')).toBe('١٢:٤٥');
  });

  it('computes company-local date keys and minutes of day', () => {
    // 22:30 UTC on the 1st is 01:30 on the 2nd in Riyadh
    expect(companyDateKey('2026-11-01T22:30:00Z')).toBe('2026-11-02');
    expect(companyMinutesOfDay('2026-11-01T22:30:00Z')).toBe(90);
  });

  it('formats minutes as hours with one decimal', () => {
    expect(formatHours(390)).toBe('6.5');
    expect(formatHours(480)).toBe('8');
  });

  it('builds initials and skips honorifics', () => {
    expect(initials('Ahmed Saleh')).toBe('AS');
    expect(initials('Eng. Sara Al-Otaibi')).toBe('SA');
    expect(initials('Fahad')).toBe('F');
  });
});
