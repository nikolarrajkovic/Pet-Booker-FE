import type { Language } from './types';

/**
 * The `Intl` locale for each app language, used for dates and numbers.
 *
 * Serbian is the Latin script (the app's Serbian is Latin; bare `sr` is Cyrillic in ICU).
 */
const INTL_LOCALES: Record<Language, string> = {
  en: 'en-US',
  sr: 'sr-Latn-RS',
  ru: 'ru-RU',
};

const supported = new Map<string, boolean>();

/**
 * The `Intl` locale for `lang`, or null when this runtime can't format in it. Checked rather than
 * assumed: `Intl` silently falls back to its default locale for one it doesn't have, which would
 * print English in a Serbian session — callers then keep their own formatting instead.
 */
export function intlLocale(lang: Language): string | null {
  const locale = INTL_LOCALES[lang];
  if (!locale) return null;
  let ok = supported.get(locale);
  if (ok === undefined) {
    try {
      ok =
        typeof Intl !== 'undefined' &&
        Intl.DateTimeFormat.supportedLocalesOf([locale]).length > 0 &&
        Intl.NumberFormat.supportedLocalesOf([locale]).length > 0;
    } catch {
      ok = false;
    }
    supported.set(locale, ok);
  }
  return ok ? locale : null;
}
