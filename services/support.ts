import { Linking } from 'react-native';

/**
 * The platform's support contact, from build-time config — never typed into a screen.
 *
 * The partner "Need help?" card used to print `partners@pawcare.com` and `(555) 123-4567`: a
 * placeholder address under an old product name and a fictional US number, shown to every new
 * partner as the way to reach us. There is no real support contact in the system yet, so these
 * come from `EXPO_PUBLIC_SUPPORT_EMAIL` / `EXPO_PUBLIC_SUPPORT_PHONE` (inlined into the bundle at
 * build time, like the API base URL), and **every surface that offers them hides itself when they
 * are unset** — an app with no support line says nothing, rather than something invented.
 *
 * Read with direct `process.env.EXPO_PUBLIC_*` member access: that is the only form Expo inlines.
 */
export const SUPPORT_EMAIL: string | null = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || null;
export const SUPPORT_PHONE: string | null = process.env.EXPO_PUBLIC_SUPPORT_PHONE?.trim() || null;

/** Whether any support contact is configured at all. */
export const hasSupportContact = (): boolean => SUPPORT_EMAIL !== null || SUPPORT_PHONE !== null;

/** Opens the mail app addressed to support. A no-op when no address is configured. */
export function emailSupport(): void {
  if (SUPPORT_EMAIL) Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {});
}

/** Starts a call to support. A no-op when no number is configured. */
export function callSupport(): void {
  // `tel:` wants the digits; the configured value may carry spaces for display.
  if (SUPPORT_PHONE) Linking.openURL(`tel:${SUPPORT_PHONE.replace(/[^\d+]/g, '')}`).catch(() => {});
}
