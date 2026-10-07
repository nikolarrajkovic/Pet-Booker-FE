/**
 * The Terms of Service and Privacy Policy the app shows and asks people to agree to.
 *
 * The text is a placeholder draft (i18n `legal.*`, en/sr/ru) until the real documents exist. Bump
 * `LEGAL_VERSION` when the text changes: sign-up records the version agreed to
 * (`AcceptedTermsVersion` on the account), so a later change can tell who has seen which.
 */
export const LEGAL_VERSION = '2026-10-draft';

/** When the current text was last changed (ISO date). */
export const LEGAL_UPDATED = '2026-10-06';

export type LegalDoc = 'terms' | 'privacy';

/** How many numbered sections each document has (`legal.termsS{n}Title` / `Body`). */
export const LEGAL_SECTION_COUNT = 9;
