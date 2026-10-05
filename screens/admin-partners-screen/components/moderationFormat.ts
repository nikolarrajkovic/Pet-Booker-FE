import { formatShortDate } from '../../../i18n/dates';

/** "Oct 12, 2026, 14:30" in the reader's time zone — when a timeout ends, when a ban began. */
export function formatModerationTime(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatShortDate(d)}, ${hh}:${mm}`;
}
