import { formatShortDate } from '../i18n/dates';
import { parseDateOnly } from './date-only';

type Translate = (key: any, params?: Record<string, string | number>) => string;

/**
 * "Issued 3 Oct 2024 · Expires 3 Oct 2027" for a certificate's admin view, or '' when neither date
 * is known. An expiry already past reads "Expired …". The expiry is optional (app review G12).
 */
export function certificateDates(
  t: Translate,
  cert: { issuedOn?: string | null; expiresOn?: string | null },
  today: Date = new Date()
): string {
  const issued = parseDateOnly(cert.issuedOn);
  const expires = parseDateOnly(cert.expiresOn);
  const parts: string[] = [];
  if (issued) parts.push(t('admin.certIssued', { date: formatShortDate(issued) }));
  if (expires) {
    const lapsed =
      expires.getTime() <
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    parts.push(
      t(lapsed ? 'admin.certExpired' : 'admin.certExpires', { date: formatShortDate(expires) })
    );
  }
  return parts.join(' · ');
}
