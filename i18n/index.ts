import en from './en';
import sr from './sr';
import ru from './ru';
import type { Language } from './types';

export type { Language } from './types';

// The English dictionary is the canonical shape every language must satisfy.
export type TranslationDict = typeof en;

type Dict = typeof en;
type NonEnumSection = Exclude<keyof Dict, 'enums'>;

// All valid `t()` keys, e.g. 'common.save' | 'login.signIn'. Two levels only —
// enum terms are resolved separately through `tEnum` / `tEnumLabel`.
export type TranslationKey = {
  [S in NonEnumSection]: `${S & string}.${Extract<keyof Dict[S], string>}`;
}[NonEnumSection];

export type EnumName = keyof Dict['enums'];

export const dictionaries: Record<Language, TranslationDict> = { en, sr, ru };

// Native language names + flags for the first-run chooser and Settings picker.
export const LANGUAGES: { code: Language; iso: string; label: string }[] = [
  { code: 'en', iso: 'GB', label: 'English' },
  { code: 'sr', iso: 'RS', label: 'Srpski' },
  { code: 'ru', iso: 'RU', label: 'Русский' },
];

// Day/month translation-key arrays indexed by JS getDay() (0=Sun) / getMonth()
// (0=Jan) — resolve with t(DAY_KEYS[d.getDay()]). Shared by calendar-style UIs.
export const DAY_KEYS: TranslationKey[] = [
  'days.sunday',
  'days.monday',
  'days.tuesday',
  'days.wednesday',
  'days.thursday',
  'days.friday',
  'days.saturday',
];
export const DAY_SHORT_KEYS: TranslationKey[] = [
  'daysShort.sun',
  'daysShort.mon',
  'daysShort.tue',
  'daysShort.wed',
  'daysShort.thu',
  'daysShort.fri',
  'daysShort.sat',
];
export const MONTH_KEYS: TranslationKey[] = [
  'months.january',
  'months.february',
  'months.march',
  'months.april',
  'months.may',
  'months.june',
  'months.july',
  'months.august',
  'months.september',
  'months.october',
  'months.november',
  'months.december',
];
export const MONTH_SHORT_KEYS: TranslationKey[] = [
  'monthsShort.jan',
  'monthsShort.feb',
  'monthsShort.mar',
  'monthsShort.apr',
  'monthsShort.may',
  'monthsShort.jun',
  'monthsShort.jul',
  'monthsShort.aug',
  'monthsShort.sep',
  'monthsShort.oct',
  'monthsShort.nov',
  'monthsShort.dec',
];

function lookup(dict: TranslationDict, key: string): string | undefined {
  const parts = key.split('.');
  let node: unknown = dict;
  for (const part of parts) {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(value: string, params?: Record<string, string | number>): string {
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (match, name) =>
    name in params ? String(params[name]) : match
  );
}

/** Resolve a dotted key in the given language, falling back to English then the key. */
export function translate(
  lang: Language,
  key: string,
  params?: Record<string, string | number>
): string {
  const value = lookup(dictionaries[lang], key) ?? lookup(dictionaries.en, key) ?? key;
  return interpolate(value, params);
}

/**
 * Localize an enum/lookup term by numeric value. Order: active language → English
 * → the backend-supplied `fallback` (e.g. the /enums `name`) → the raw value.
 */
export function tEnumLabel(
  lang: Language,
  enumName: EnumName,
  value: number | null | undefined,
  fallback?: string
): string {
  if (value == null) return fallback ?? '';
  const table = dictionaries[lang].enums[enumName] as Record<number, string> | undefined;
  const enTable = dictionaries.en.enums[enumName] as Record<number, string> | undefined;
  return table?.[value] ?? enTable?.[value] ?? fallback ?? String(value);
}
