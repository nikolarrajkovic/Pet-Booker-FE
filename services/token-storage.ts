import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

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

const KEYS = {
  accessToken: 'auth_access_token',
  accessTokenExpiry: 'auth_access_token_expiry',
  refreshToken: 'auth_refresh_token',
  refreshTokenExpiry: 'auth_refresh_token_expiry',
};

const ACCESS_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function saveTokens(accessToken: string, refreshToken?: string) {
  const now = Date.now();

  await store.setItemAsync(KEYS.accessToken, accessToken);
  await store.setItemAsync(KEYS.accessTokenExpiry, String(now + ACCESS_TOKEN_TTL_MS));

  if (refreshToken) {
    await store.setItemAsync(KEYS.refreshToken, refreshToken);
    await store.setItemAsync(KEYS.refreshTokenExpiry, String(now + REFRESH_TOKEN_TTL_MS));
  }
}

export async function getAccessToken(): Promise<string | null> {
  const token = await store.getItemAsync(KEYS.accessToken);
  const expiry = await store.getItemAsync(KEYS.accessTokenExpiry);

  if (!token || !expiry || Date.now() > Number(expiry)) {
    return null;
  }

  return token;
}

export async function getRefreshToken(): Promise<string | null> {
  const token = await store.getItemAsync(KEYS.refreshToken);
  const expiry = await store.getItemAsync(KEYS.refreshTokenExpiry);

  if (!token || !expiry || Date.now() > Number(expiry)) {
    return null;
  }

  return token;
}

export async function clearTokens() {
  await store.deleteItemAsync(KEYS.accessToken);
  await store.deleteItemAsync(KEYS.accessTokenExpiry);
  await store.deleteItemAsync(KEYS.refreshToken);
  await store.deleteItemAsync(KEYS.refreshTokenExpiry);
}
