import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { savePetPromptDismissed } from './notifications';

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
 * The account's own answer arrives with the session (`currentUser.petPromptDismissed`, from the
 * server); this copy on the device is what answers at once after the tap, before any request.
 */
export async function isPetPromptDismissed(userId: number): Promise<boolean> {
  try {
    return (await store.getItemAsync(keyFor(userId))) === '1';
  } catch {
    return false;
  }
}

/**
 * "Not now": remembered on this device at once and on the account (feedback 2026-10-21), so the
 * card stays away on every device. It used to be the device alone, and a second phone showed the
 * card again. Either save failing is harmless: the card comes back once, which is the cheap mistake.
 */
export async function dismissPetPrompt(userId: number): Promise<void> {
  try {
    await store.setItemAsync(keyFor(userId), '1');
  } catch {
    // Storage unavailable (private window): the account still remembers.
  }
  try {
    await savePetPromptDismissed(userId);
  } catch {
    // Offline: this device still remembers; the account learns next time it is dismissed.
  }
}
