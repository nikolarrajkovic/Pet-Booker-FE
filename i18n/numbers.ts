import { formatLanguage } from './dates';
import { intlLocale } from './intl';
import type { Language } from './types';

/**
 * A number in the app language's style: "1,250" in English, "1.250" in Serbian, "1 250" in
 * Russian, with the language's decimal comma. Money went out as `String(n)` ("8511 RSD",
 * "12.5 €") and counts were pinned to en-US. Falls back to plain digits on a runtime without the
 * locale rather than printing another language's separators.
 */
export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions = {},
  lang: Language = formatLanguage()
): string {
  if (!Number.isFinite(value)) return String(value);
  const locale = intlLocale(lang);
  if (locale) {
    try {
      return new Intl.NumberFormat(locale, options).format(value);
    } catch {
      // fall through to the plain form
    }
  }
  const max = options.maximumFractionDigits;
  return max === undefined ? String(value) : String(Number(value.toFixed(max)));
}
