import type { Language } from './types';

export type PluralForm = 'one' | 'few' | 'many';

/**
 * Which form of a counted word a whole number takes (CLDR's integer rules).
 *
 * English has two forms. Serbian and Russian have three: 1, 21, 31… take the "one" form ("21
 * recenzija", "21 отзыв"), 2–4, 22–24… the "few" form ("2 recenzije", "2 отзыва"), and the rest,
 * 11–14 included, the "many" form ("5 recenzija", "12 отзывов"). The app used a singular for 1 and
 * one plural for everything else, which printed "2 отзывов" and "1 aktivnih".
 *
 * Plain arithmetic rather than Intl.PluralRules, which Hermes does not ship.
 */
export function pluralForm(lang: Language, n: number): PluralForm {
  const i = Math.abs(Math.trunc(n));
  if (lang === 'en') return i === 1 ? 'one' : 'many';
  const mod10 = i % 10;
  const mod100 = i % 100;
  if (mod10 === 1 && mod100 !== 11) return 'one';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few';
  return 'many';
}

/** "5 years of experience" in its counted form — the provider card on two screens. */
export const YEARS_OF_EXPERIENCE = {
  one: 'shared.yearsOfExperienceOne',
  few: 'shared.yearsOfExperienceFew',
  many: 'shared.yearsOfExperience',
} as const;
