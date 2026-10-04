import { DAY_SHORT_KEYS, MONTH_KEYS, MONTH_SHORT_KEYS, translate, type Language } from './index';

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
 */
let current: Language = 'en';

export function registerDateLanguage(lang: Language): void {
  current = lang;
}

const monthShort = (d: Date, lang: Language) => translate(lang, MONTH_SHORT_KEYS[d.getMonth()]);
const monthLong = (d: Date, lang: Language) => translate(lang, MONTH_KEYS[d.getMonth()]);
const weekdayShort = (d: Date, lang: Language) => translate(lang, DAY_SHORT_KEYS[d.getDay()]);

/** "Oct 3, 2026" */
export function formatShortDate(d: Date, lang: Language = current): string {
  return `${monthShort(d, lang)} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "Oct 3" */
export function formatDayMonth(d: Date, lang: Language = current): string {
  return `${monthShort(d, lang)} ${d.getDate()}`;
}

/** "Sat, Oct 3" */
export function formatWeekdayDayMonth(d: Date, lang: Language = current): string {
  return `${weekdayShort(d, lang)}, ${monthShort(d, lang)} ${d.getDate()}`;
}

/** "Oct 2026" */
export function formatMonthYear(d: Date, lang: Language = current): string {
  return `${monthShort(d, lang)} ${d.getFullYear()}`;
}

/** "October 3, 2026" */
export function formatLongDate(d: Date, lang: Language = current): string {
  return `${monthLong(d, lang)} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "03 October 2026" — a birth date. */
export function formatBirthDate(d: Date, lang: Language = current): string {
  return `${String(d.getDate()).padStart(2, '0')} ${monthLong(d, lang)} ${d.getFullYear()}`;
}
