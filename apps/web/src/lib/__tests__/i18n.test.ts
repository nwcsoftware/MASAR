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
    expect(i18n.t('nav.dashboard')).toBe('لوحة المعلومات');
    expect(document.documentElement.dir).toBe('rtl');

    await setLanguage('en');
  });
});
