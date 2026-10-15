/**
 * A calendar date as the API's date-only fields take it: "YYYY-MM-DD", read from the LOCAL
 * calendar fields.
 *
 * Never `toISOString()` for a date the user picked: a picker returns local midnight, which is the
 * previous day in UTC anywhere east of Greenwich. Sign-up sent it that way, and every birthday
 * entered in Serbia was stored a day early.
 */
export function formatDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * "YYYY-MM-DD" → that calendar day at LOCAL midnight, or null. `new Date("2026-10-15")` reads the
 * string as UTC midnight, which is the previous day anywhere west of Greenwich.
 */
export function parseDateOnly(value?: string | null): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}
