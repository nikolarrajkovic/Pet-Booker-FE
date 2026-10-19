import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Mirrors services/theme-storage.ts: SecureStore on native, localStorage on web.
const webStore = {
  setItemAsync: async (key: string, value: string) => {
    localStorage.setItem(key, value);
  },
  getItemAsync: async (key: string) => localStorage.getItem(key),
};

const store = Platform.OS === 'web' ? webStore : SecureStore;

// Per account, so a second person signing in on the same phone still gets the welcome card.
const keyFor = (userId: number) => `pet_prompt_dismissed_${userId}`;

/**
 * Whether this account said "Not now" to the Home "add your pet" card on this device.
 *
 * Kept on the device on purpose: the card is a gentle, dismissible suggestion (unlike the partner
 * tour, which takes over the screen), and having a pet is the server-side fact that retires it for
 * good. A dismissal that has to be repeated once on a new phone is the cheaper mistake.
 */
export async function isPetPromptDismissed(userId: number): Promise<boolean> {
  try {
    return (await store.getItemAsync(keyFor(userId))) === '1';
  } catch {
    return false;
  }
}

export async function dismissPetPrompt(userId: number): Promise<void> {
  try {
    await store.setItemAsync(keyFor(userId), '1');
  } catch {
    // Storage unavailable (private window): the card simply comes back next time.
  }
}
