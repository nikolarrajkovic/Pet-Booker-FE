import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { LANGUAGE_CODES, type Language } from '../i18n/types';

// Mirrors services/token-storage.ts: SecureStore on native, localStorage on web.
const webStore = {
  setItemAsync: async (key: string, value: string) => {
    localStorage.setItem(key, value);
  },
  getItemAsync: async (key: string) => localStorage.getItem(key),
  deleteItemAsync: async (key: string) => {
    localStorage.removeItem(key);
  },
};

const store = Platform.OS === 'web' ? webStore : SecureStore;

const KEY = 'app_language';

export async function saveLanguage(lang: Language): Promise<void> {
  await store.setItemAsync(KEY, lang);
}

export async function getLanguage(): Promise<Language | null> {
  const value = await store.getItemAsync(KEY);
  return value && (LANGUAGE_CODES as string[]).includes(value) ? (value as Language) : null;
}
