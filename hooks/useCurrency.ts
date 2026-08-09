import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  currencyAffix,
  currencyFormat,
  formatMoney,
  formatMoneyPerUnit,
  normalizeCurrency,
  withCurrency,
  type CurrencyFormat,
} from '../services/currency';

export type UseCurrency = {
  /** The resolved ISO code these helpers format in. */
  code: string;
  /** Symbol + placement rules for `code`. */
  format: CurrencyFormat;
  /** Just the symbol — for chart axes and other bare labels. */
  symbol: string;
  /** Amount → display string with the symbol on its conventional side. */
  money: (amount: number) => string;
  /** Amount → rate string, e.g. "2 €/km". */
  perUnit: (amount: number, unit: string) => string;
  /** Attach the symbol to an already-rendered figure ("2K", "1.2M") on the right side. */
  wrap: (value: string) => string;
  /** For price INPUTS: exactly one of these is non-null; render it beside the TextInput. */
  prefix: string | null;
  suffix: string | null;
};

/**
 * The currency to render an amount in, and the helpers to render it.
 *
 * Pass the currency that came with the data — `booking.priceCurrency`, `service.currency`,
 * a stats block's `currency` — and it wins. Omit it (mock figures, a price the partner is
 * still typing, a range filter) and it falls back to the user's display preference.
 *
 * Screens should never build a money string by hand: `${price}` with a literal symbol is
 * how the app ended up showing "$35" to providers charging in RSD.
 */
export function useCurrency(dataCurrency?: string | null): UseCurrency {
  const { currentUser } = useAuth();
  const preferred = currentUser?.preferredCurrency;

  return useMemo(() => {
    const code = normalizeCurrency(dataCurrency || preferred);
    const format = currencyFormat(code);
    const { prefix, suffix } = currencyAffix(code);
    return {
      code,
      format,
      symbol: format.symbol,
      money: (amount: number) => formatMoney(amount, code),
      perUnit: (amount: number, unit: string) => formatMoneyPerUnit(amount, unit, code),
      wrap: (value: string) => withCurrency(value, code),
      prefix,
      suffix,
    };
  }, [dataCurrency, preferred]);
}
