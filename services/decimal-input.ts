/**
 * Keeps a measurement field (a pet's weight or height) to a plain number while it is typed.
 *
 * `keyboardType` only chooses which keyboard a phone shows: in a browser, or with a hardware
 * keyboard, any character could be typed into these fields, and the save turned whatever it was
 * into `parseFloat(...) || 0` without a word. So the text itself is filtered:
 *
 * - digits and one decimal separator; a comma counts as the separator (Serbian writes 4,5 kg) and
 *   is shown as a point, which is what is saved;
 * - at most `maxDecimals` digits after it and `maxWhole` before it — 999.99 is far past any pet the
 *   app takes, so a slipped key can't record a 2332 kg dog;
 * - a leading separator gets its zero ("." → "0.").
 */
export function decimalInput(text: string, maxWhole = 3, maxDecimals = 2): string {
  const cleaned = text.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const dot = cleaned.indexOf('.');
  const whole = (dot === -1 ? cleaned : cleaned.slice(0, dot)).slice(0, maxWhole);
  if (dot === -1 || maxDecimals <= 0) return whole;
  const decimals = cleaned
    .slice(dot + 1)
    .replace(/\./g, '')
    .slice(0, maxDecimals);
  return `${whole || '0'}.${decimals}`;
}
