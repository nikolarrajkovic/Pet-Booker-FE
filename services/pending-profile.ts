import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { uploadFile } from './files';
import { getUser, updateUser } from './users';

/** A photo picked on the sign-up form: a data URI on web, a file URI on a phone. */
export type PendingPhoto = { uri: string; fileName?: string; mimeType?: string };

/**
 * What sign-up collected that the new account cannot hold yet: the photo. (The home address goes
 * with the registration, and a sign-up over an unfinished one replaces it on the server.)
 */
export type PendingProfile = { photo?: PendingPhoto | null };

// Mirrors services/theme-storage.ts: SecureStore on native, localStorage on web.
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

// SecureStore keys allow only letters, digits, ".", "-" and "_"; an email has an "@".
const keyFor = (email: string) =>
  `pending_profile_${email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')}`;

/**
 * Sign-up's profile photo, held until the account can take it.
 *
 * Only a signed-in account can upload a photo, so the form keeps it here, keyed by the email, and
 * the first sign-in of that account saves it (`applyPendingProfile`, called from AuthContext).
 * Storage rather than navigation params, because the code may be typed in a later session: after
 * the app restarted, or from Verify Email reached by signing in to an account that was never
 * confirmed. The home address goes with the registration instead and the server holds it, so it
 * reaches the profile on any device. Only the photo is kept here.
 */
export async function savePendingProfile(email: string, profile: PendingProfile): Promise<void> {
  try {
    await store.setItemAsync(keyFor(email), JSON.stringify(profile));
  } catch {
    // A photo too large for the browser's storage, or no storage (a private window): Account can
    // still add one.
  }
}

async function loadPendingProfile(email: string): Promise<PendingProfile | null> {
  try {
    const raw = await store.getItemAsync(keyFor(email));
    return raw ? (JSON.parse(raw) as PendingProfile) : null;
  } catch {
    return null;
  }
}

async function forget(email: string): Promise<void> {
  try {
    await store.deleteItemAsync(keyFor(email));
  } catch {
    // Left behind, it would only be applied once more over the same values.
  }
}

/**
 * Saves sign-up's photo to the profile of the account that just signed in, once. Returns whether
 * anything was saved. A failed upload is dropped (the photo is optional, and Account can add one);
 * a failed save keeps the entry, so the next sign-in tries again.
 */
export async function applyPendingProfile(userId: number, email: string): Promise<boolean> {
  const pending = await loadPendingProfile(email);
  if (!pending) return false;

  let avatarUrl: string | undefined;
  if (pending.photo?.uri) {
    try {
      const { uri, fileName, mimeType } = pending.photo;
      avatarUrl = (await uploadFile(uri, fileName, mimeType)).src;
    } catch {
      // Optional — Account can add a photo later.
    }
  }

  if (!avatarUrl) {
    await forget(email);
    return false;
  }
  const user = await getUser(userId);
  await updateUser({ ...user, avatarUrl });
  await forget(email);
  return true;
}
