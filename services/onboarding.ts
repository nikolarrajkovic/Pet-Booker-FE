import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Tiny persisted key/value for one-time onboarding moments (no TTL).
 *
 * Mirrors the web/native split used by `token-storage.ts` so we don't pull in a
 * new storage dependency just for a couple of boolean flags. SecureStore keys
 * allow alphanumerics, '.', '-' and '_'; user ids are GUID-like (hyphens only),
 * so they stay within the allowed charset.
 */
const webStore = {
  setItemAsync: async (key: string, value: string) => {
    localStorage.setItem(key, value);
  },
  getItemAsync: async (key: string) => localStorage.getItem(key),
};

const store = Platform.OS === 'web' ? webStore : SecureStore;

const partnerWelcomeKey = (userId: string | number) => `partner_welcome_seen_${userId}`;

/** Whether this user has already seen the "you're an approved partner" celebration. */
export async function hasSeenPartnerWelcome(userId: string | number): Promise<boolean> {
  try {
    return (await store.getItemAsync(partnerWelcomeKey(userId))) === '1';
  } catch {
    // If storage is unavailable, fail "seen" so we never loop the celebration.
    return true;
  }
}

/** Record that this user has seen the partner-welcome celebration. */
export async function markPartnerWelcomeSeen(userId: string | number): Promise<void> {
  try {
    await store.setItemAsync(partnerWelcomeKey(userId), '1');
  } catch {
    /* best-effort — a failed write just means it may show again next launch */
  }
}
