import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '@/i18n/en.json';
import ar from '@/i18n/ar.json';

export const SUPPORTED_LANGUAGES = ['en', 'ar'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const LANG_STORAGE_KEY = 'masar.lang';

export function isLanguage(value: string | null | undefined): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language);
}

function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch {
    /* storage blocked */
  }
  const browser = navigator.language.split('-')[0];
  return isLanguage(browser) ? browser : 'en';
}

/** Keeps <html lang> / <html dir> in step with i18next. Arabic is RTL. */
export function applyLanguageToDocument(lang: Language) {
  const root = document.documentElement;
  root.lang = lang;
  root.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

export async function setLanguage(lang: Language) {
  await i18n.changeLanguage(lang);
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    /* storage blocked */
  }
  applyLanguageToDocument(lang);
}

const initialLanguage = readStoredLanguage();

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  supportedLngs: [...SUPPORTED_LANGUAGES],
  interpolation: { escapeValue: false },
  returnNull: false,
});

applyLanguageToDocument(initialLanguage);

export default i18n;
