import { useTranslation } from 'react-i18next';

/**
 * FR-71 bilingual data: reference rows carry `name` / `name_ar` (or
 * `full_name` / `full_name_ar`). Arabic UI prefers the `_ar` column and
 * falls back to the English value; free text stays as typed.
 */
type Bilingual<K extends string> = { [P in K]: string | null } & { [P in `${K}_ar`]?: string | null };

export function pickLocalized<K extends string>(row: Bilingual<K>, lang: string, key: K): string {
  if (lang.startsWith('ar')) {
    const ar = (row as Record<string, string | null | undefined>)[`${key}_ar`];
    if (ar) return ar;
  }
  return row[key] ?? '';
}

export function useLocalizedName() {
  const { i18n } = useTranslation();
  // NoInfer: the key comes from the second argument (default 'name'), never from the row's shape.
  return function name<K extends string = 'name'>(row: Bilingual<NoInfer<K>>, key: K = 'name' as K): string {
    return pickLocalized(row, i18n.language, key);
  };
}
