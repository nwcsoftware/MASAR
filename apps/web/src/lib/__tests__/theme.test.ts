import { describe, expect, it } from 'vitest';
import { applyThemeToDocument, isTheme, readStoredTheme, resolveTheme, storeTheme } from '@/lib/theme';

describe('theme', () => {
  it('defaults to system when nothing is stored', () => {
    expect(readStoredTheme()).toBe('system');
  });

  it('validates theme values', () => {
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('sepia')).toBe(false);
    expect(isTheme(null)).toBe(false);
  });

  it('resolves system against the media query (light in jsdom)', () => {
    expect(resolveTheme('system')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('sets data-theme="dark" only for the dark theme', () => {
    applyThemeToDocument('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    applyThemeToDocument('light');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('persists the choice', () => {
    storeTheme('dark');
    expect(readStoredTheme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
