// Money formatting — one place, so a price is never rendered with a guessed symbol.
//
// The backend is fully multi-currency at the API edge: every amount is STORED in RSD, converted to
// the caller's `UserNotificationSettings.PreferredCurrency` on read, and each response stamps what
// its amounts are actually in (`currency` on service/stats/discount DTOs, `priceCurrency` on
// bookings). So the currency is always carried alongside the number — always pass it.
//
// Never hardcode a currency symbol. A hardcoded `$` renders 100 dinars as "$100", and a converted
// EUR amount as dollars.

/** Currencies with a well-known symbol render as "€52"; anything else falls back to "52 RSD". */
const CURRENCY_SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', RUB: '₽' };

/**
 * Currencies a user may pick as their display preference — mirrors the backend's
 * `Application.Abstractions.PaymentCurrency.Supported`.
 */
export const SUPPORTED_CURRENCIES = ['RSD', 'EUR', 'USD'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/** The currency amounts are stored and charged in — the backend's `PaymentCurrency.Code`. */
export const BASE_CURRENCY: SupportedCurrency = 'RSD';

/**
 * Formats an amount in the currency the API said it was in.
 *
 * `currency` should come from the response that carried the amount. It falls back to
 * {@link BASE_CURRENCY} rather than a display default: an amount with no stated currency is a raw
 * stored value, and stored values are RSD. (This used to default to EUR, from back when the server
 * stamped a booking's currency from its provider — so an unlabelled RSD amount rendered as euros.)
 */
export function formatMoney(amount: number, currency?: string | null): string {
  const code = (currency ?? BASE_CURRENCY).toUpperCase();
  const symbol = CURRENCY_SYMBOLS[code];
  // Cap at 2 decimals (trailing zeros trimmed): 35.41666 → 35.42, 30 → 30.
  const value = Number.isFinite(amount) ? Math.round(amount * 100) / 100 : amount;
  return symbol ? `${symbol}${value}` : `${value} ${code}`;
}

/** Rounds to 2 decimals without formatting — for arithmetic, not display. */
export function roundMoney(amount: number): number {
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : amount;
}

export function asSupportedCurrency(code?: string | null): SupportedCurrency {
  const upper = (code ?? '').toUpperCase();
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(upper)
    ? (upper as SupportedCurrency)
    : BASE_CURRENCY;
}
