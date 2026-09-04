import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Mirrors services/locale-storage.ts: SecureStore on native, localStorage on web.
const webStore = {
  setItemAsync: async (key: string, value: string) => {
    localStorage.setItem(key, value);
  },
  getItemAsync: async (key: string) => localStorage.getItem(key),
};

const store = Platform.OS === 'web' ? webStore : SecureStore;

const KEY = 'app_theme';

export type ThemePreference = 'light' | 'dark';

export async function saveTheme(theme: ThemePreference): Promise<void> {
  await store.setItemAsync(KEY, theme);
}

/** The stored preference, or null when the user has never chosen one. */
export async function getTheme(): Promise<ThemePreference | null> {
  const value = await store.getItemAsync(KEY);
  return value === 'light' || value === 'dark' ? value : null;
}
