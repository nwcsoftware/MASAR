import { describe, expect, it } from 'vitest';
import i18n, { applyLanguageToDocument, isLanguage, setLanguage } from '@/lib/i18n';

describe('i18n', () => {
  it('accepts only supported languages', () => {
    expect(isLanguage('ar')).toBe(true);
    expect(isLanguage('fr')).toBe(false);
  });

  it('sets dir="rtl" for Arabic and back to ltr for English', () => {
    applyLanguageToDocument('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');

    applyLanguageToDocument('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('translates the same key in both languages', async () => {
    await setLanguage('en');
    expect(i18n.t('nav.dashboard')).toBe('Dashboard');

    await setLanguage('ar');
    // design/preview.html labels the dashboard «الرئيسية»
    expect(i18n.t('nav.dashboard')).toBe('الرئيسية');
    expect(document.documentElement.dir).toBe('rtl');

    await setLanguage('en');
  });

  it('uses all six Arabic plural forms', async () => {
    await setLanguage('ar');
    expect(i18n.t('conflicts.count', { count: 0 })).toBe('لا تعارضات');
    expect(i18n.t('conflicts.count', { count: 1 })).toBe('تعارض واحد');
    expect(i18n.t('conflicts.count', { count: 2 })).toBe('تعارضان');
    expect(i18n.t('conflicts.count', { count: 5 })).toBe('5 تعارضات');
    expect(i18n.t('conflicts.count', { count: 11 })).toBe('11 تعارضاً');
    expect(i18n.t('conflicts.count', { count: 100 })).toBe('100 تعارض');

    await setLanguage('en');
    expect(i18n.t('conflicts.count', { count: 1 })).toBe('1 conflict');
    expect(i18n.t('conflicts.count', { count: 3 })).toBe('3 conflicts');
  });
});
