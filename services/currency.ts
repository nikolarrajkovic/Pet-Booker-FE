// Single source of truth for rendering money.
//
// Two things were wrong before this module existed:
//  1. Most screens hardcoded a `$`, so a provider priced in RSD or EUR still read "$35".
//  2. The few places that did use the real code always put the symbol in front ("€52"),
//     which is only correct for a minority of currencies.
//
// So a currency here is not just a symbol — it carries where the symbol belongs relative
// to the number. Never write a currency symbol into JSX or a translation string; call
// `formatMoney` (display) or `currencyAffix` (input fields) instead.

/** How a currency's symbol attaches to its amount. */
export type CurrencyFormat = {
  /** Symbol or ISO code as displayed. */
  symbol: string;
  /** Conventional placement of `symbol` relative to the amount. */
  position: 'prefix' | 'suffix';
  /** Whether the convention separates symbol and amount with a space. */
  space: boolean;
};

// Placement follows each currency's own convention, not the UI language:
//   USD/GBP  prefix, tight     → $52, £52
//   EUR      suffix + space    → 52 € (EU style guide; the "€52" form is English-only)
//   RSD      suffix + space    → 52 RSD (Serbian convention puts the unit after)
//   RUB      suffix + space    → 52 ₽
// An unknown code falls through to `DEFAULT_FORMAT`: the code itself, after the amount.
const CURRENCY_FORMATS: Record<string, CurrencyFormat> = {
  USD: { symbol: '$', position: 'prefix', space: false },
  GBP: { symbol: '£', position: 'prefix', space: false },
  EUR: { symbol: '€', position: 'suffix', space: true },
  RSD: { symbol: 'RSD', position: 'suffix', space: true },
  RUB: { symbol: '₽', position: 'suffix', space: true },
};

/** Currencies a user may pick as their display preference (mirrors the backend's PaymentCurrency). */
export const SUPPORTED_CURRENCIES = ['RSD', 'EUR', 'USD'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/** Used when neither the data nor the user's preference names a currency. */
export const DEFAULT_CURRENCY = 'RSD';

// The user's display-currency preference, mirrored out of AuthContext so that pure
// (non-React) formatting code can reach it — the same pattern `registerApiLanguage`
// uses in http.ts. Amounts that carry their own currency always win over this.
let activeDisplayCurrency: string = DEFAULT_CURRENCY;

/** Called by AuthContext/Settings when the user's preferred display currency resolves or changes. */
export function registerDisplayCurrency(code?: string | null): void {
  activeDisplayCurrency = normalizeCurrency(code);
}

/** The currency to use for amounts that don't carry one of their own. */
export function getDisplayCurrency(): string {
  return activeDisplayCurrency;
}

/**
 * The currency to DECLARE on a write whose amounts the user typed.
 *
 * The API stores every amount in RSD but converts reads into the caller's preferred
 * currency, and converts writes FROM whatever `currency` the payload declares —
 * defaulting to RSD when it declares nothing. So a form that was filled from a read is
 * holding display-currency numbers, and sending them back undeclared tells the server
 * "these are RSD", which silently rescales them. (Verified live: opening a service
 * priced at 11,700 RSD as a EUR viewer and saving it unchanged stored 0.)
 *
 * Pass the currency the record itself came back in when you have it; otherwise this
 * falls back to the display preference, which is what the server converted that read
 * into — the two resolve from the same `preferredCurrency`, so they agree.
 */
export function declaredWriteCurrency(dataCurrency?: string | null): string {
  return normalizeCurrency(dataCurrency || activeDisplayCurrency);
}

/** Upper-cases a code and falls back to the default for blank input. */
export function normalizeCurrency(code?: string | null): string {
  const upper = (code ?? '').trim().toUpperCase();
  return upper || DEFAULT_CURRENCY;
}

/** Narrows an arbitrary code to one the settings picker can show. */
export function asSupportedCurrency(code?: string | null): SupportedCurrency {
  const upper = normalizeCurrency(code);
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(upper)
    ? (upper as SupportedCurrency)
    : (DEFAULT_CURRENCY as SupportedCurrency);
}

const DEFAULT_FORMAT = (code: string): CurrencyFormat => ({
  symbol: code,
  position: 'suffix',
  space: true,
});

/** The symbol + placement rules for a currency (falls back to "<amount> CODE"). */
export function currencyFormat(code?: string | null): CurrencyFormat {
  const normalized = normalizeCurrency(code);
  return CURRENCY_FORMATS[normalized] ?? DEFAULT_FORMAT(normalized);
}

/** Just the symbol, e.g. for a legend or a chart axis. */
export function currencySymbol(code?: string | null): string {
  return currencyFormat(code).symbol;
}

/**
 * The strings to render around a bare number — for price INPUTS, where the amount is a
 * TextInput and the symbol sits beside it. Exactly one side is non-null, so an input row
 * can render `{prefix && <Text>{prefix}</Text>}<TextInput/>{suffix && <Text>{suffix}</Text>}`
 * and automatically flip sides with the currency.
 */
export function currencyAffix(code?: string | null): {
  prefix: string | null;
  suffix: string | null;
} {
  const { symbol, position } = currencyFormat(code);
  return position === 'prefix'
    ? { prefix: symbol, suffix: null }
    : { prefix: null, suffix: symbol };
}

/** Rounds to at most 2 decimals and drops trailing zeros: 35.41666 → "35.42", 30 → "30". */
export function formatAmount(amount: number): string {
  if (!Number.isFinite(amount)) return String(amount);
  return String(Math.round(amount * 100) / 100);
}

/**
 * Renders an amount in its currency, with the symbol on the conventional side:
 * `formatMoney(52, 'USD')` → "$52", `formatMoney(52, 'EUR')` → "52 €",
 * `formatMoney(52, 'RSD')` → "52 RSD".
 *
 * Pass the currency that came with the amount (`booking.priceCurrency`,
 * `service.currency`, a stats block's `currency`). Omit it only for amounts the API
 * doesn't stamp — those fall back to the user's display preference.
 */
export function formatMoney(amount: number, currency?: string | null): string {
  return withCurrency(formatAmount(amount), currency);
}

/**
 * Attaches a currency's symbol to an ALREADY-rendered number — for abbreviated figures
 * like "2K" or "1.2M" that `formatMoney` can't produce. Same placement rules.
 */
export function withCurrency(value: string, currency?: string | null): string {
  const code = currency ? normalizeCurrency(currency) : getDisplayCurrency();
  const { symbol, position, space } = currencyFormat(code);
  const gap = space ? ' ' : '';
  return position === 'prefix' ? `${symbol}${gap}${value}` : `${value}${gap}${symbol}`;
}

/**
 * Same as `formatMoney` but for a rate — "2 €/km", "$2/km". The unit binds to the amount,
 * so a suffix symbol stays before the unit rather than after it.
 */
export function formatMoneyPerUnit(amount: number, unit: string, currency?: string | null): string {
  return `${formatMoney(amount, currency)}/${unit}`;
}
