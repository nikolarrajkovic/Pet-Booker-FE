import {
  DAY_KEYS,
  DAY_SHORT_KEYS,
  MONTH_KEYS,
  MONTH_SHORT_KEYS,
  translate,
  type Language,
} from './index';
import { intlLocale } from './intl';

/**
 * Dates in the APP's language, not the device's.
 *
 * Screens used to format with `toLocaleDateString(undefined, …)`, which follows the browser or
 * phone locale — so a Serbian session on an English-locale device read "Oct 3, 2026" and
 * "Sat, Oct 3" while every label around them was Serbian, and the screens that did use the
 * month keys ("Sub, Okt 10") disagreed with the ones beside them. Every date that prints a month
 * or a weekday name goes through here, built from the same `monthsShort.*` / `daysShort.*` keys
 * the calendars use. Times stay numeric (`HH:mm`), which reads the same in every language.
 *
 * View-model builders run outside React, so the current language is registered here by
 * `LocaleProvider` (alongside the API's Accept-Language); components may pass `lang` explicitly.
 *
 * **Word order and grammar are the language's own.** Serbian and Russian used to get the English
 * pattern with translated words — "Okt 3, 2026", "Sreda, Oktobar 14, 2026" — where a Serbian
 * reader writes "3. okt 2026." and a Russian one "3 окт. 2026 г." (with the month inflected:
 * "3 октября"). Those languages now go through `Intl` (ICU), falling back to the key-built English
 * pattern on a runtime that can't format in them. English keeps the key-built output.
 */
let current: Language = 'en';

export function registerDateLanguage(lang: Language): void {
  current = lang;
}

/** The app language dates and numbers are written in (registered by LocaleProvider). */
export function formatLanguage(): Language {
  return current;
}

/** `d` through `Intl` in `lang`, or null for English / a runtime without that locale. */
function intlDate(d: Date, lang: Language, options: Intl.DateTimeFormatOptions): string | null {
  if (lang === 'en') return null;
  const locale = intlLocale(lang);
  if (!locale) return null;
  try {
    return new Intl.DateTimeFormat(locale, options).format(d);
  } catch {
    return null;
  }
}

const monthShort = (d: Date, lang: Language) => translate(lang, MONTH_SHORT_KEYS[d.getMonth()]);
const monthLong = (d: Date, lang: Language) => translate(lang, MONTH_KEYS[d.getMonth()]);
const weekdayShort = (d: Date, lang: Language) => translate(lang, DAY_SHORT_KEYS[d.getDay()]);
const weekdayLong = (d: Date, lang: Language) => translate(lang, DAY_KEYS[d.getDay()]);

/** "Oct 3, 2026" */
export function formatShortDate(d: Date, lang: Language = current): string {
  return (
    intlDate(d, lang, { day: 'numeric', month: 'short', year: 'numeric' }) ??
    `${monthShort(d, lang)} ${d.getDate()}, ${d.getFullYear()}`
  );
}

/** "Oct 3" */
export function formatDayMonth(d: Date, lang: Language = current): string {
  return (
    intlDate(d, lang, { day: 'numeric', month: 'short' }) ?? `${monthShort(d, lang)} ${d.getDate()}`
  );
}

/** "Sat, Oct 3" — or "Saturday, Oct 3" with `weekday: 'long'`. */
export function formatWeekdayDayMonth(
  d: Date,
  lang: Language = current,
  weekday: 'short' | 'long' = 'short'
): string {
  const day = weekday === 'long' ? weekdayLong(d, lang) : weekdayShort(d, lang);
  return (
    intlDate(d, lang, { weekday, day: 'numeric', month: 'short' }) ??
    `${day}, ${monthShort(d, lang)} ${d.getDate()}`
  );
}

/** "Saturday, October 3, 2026" — or "Sat, October 3, 2026" with `weekday: 'short'`. */
export function formatFullDate(
  d: Date,
  lang: Language = current,
  weekday: 'short' | 'long' = 'long'
): string {
  const day = weekday === 'long' ? weekdayLong(d, lang) : weekdayShort(d, lang);
  return (
    intlDate(d, lang, { weekday, day: 'numeric', month: 'long', year: 'numeric' }) ??
    `${day}, ${monthLong(d, lang)} ${d.getDate()}, ${d.getFullYear()}`
  );
}

/** "Oct 2026" */
export function formatMonthYear(d: Date, lang: Language = current): string {
  return (
    intlDate(d, lang, { month: 'short', year: 'numeric' }) ??
    `${monthShort(d, lang)} ${d.getFullYear()}`
  );
}

/** "October 3, 2026" */
export function formatLongDate(d: Date, lang: Language = current): string {
  return (
    intlDate(d, lang, { day: 'numeric', month: 'long', year: 'numeric' }) ??
    `${monthLong(d, lang)} ${d.getDate()}, ${d.getFullYear()}`
  );
}

/** "03 October 2026" — a birth date. */
export function formatBirthDate(d: Date, lang: Language = current): string {
  return (
    intlDate(d, lang, { day: '2-digit', month: 'long', year: 'numeric' }) ??
    `${String(d.getDate()).padStart(2, '0')} ${monthLong(d, lang)} ${d.getFullYear()}`
  );
}
