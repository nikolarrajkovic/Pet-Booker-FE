import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { AddressDto } from './service-providers';
import { uploadFile } from './files';
import { getUser, updateUser } from './users';

/** A photo picked on the sign-up form: a data URI on web, a file URI on a phone. */
export type PendingPhoto = { uri: string; fileName?: string; mimeType?: string };

/**
 * What sign-up collected that the new account cannot hold yet: the photo, and — only when an
 * earlier sign-up is being finished — the address entered this time, used if the profile has none.
 */
export type PendingProfile = { address?: AddressDto | null; photo?: PendingPhoto | null };

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
 * reaches the profile on any device.
 */
export async function savePendingProfile(email: string, profile: PendingProfile): Promise<void> {
  try {
    await store.setItemAsync(keyFor(email), JSON.stringify(profile));
  } catch {
    // A photo too large for the browser's storage: keep the address, if there is one.
    try {
      if (profile.address)
        await store.setItemAsync(keyFor(email), JSON.stringify({ address: profile.address }));
    } catch {
      // Storage unavailable (a private window): the profile can still be completed in Account.
    }
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
 * Saves what sign-up collected to the profile of the account that just signed in, once. Returns
 * whether anything was saved. The address is used only when the profile has none (the server's
 * copy wins); a failed photo upload is dropped (the photo is optional, and Account can add one);
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

  const user = await getUser(userId);
  const address = !user.addressId && pending.address ? pending.address : null;
  if (!avatarUrl && !address) {
    await forget(email);
    return false;
  }
  await updateUser({
    ...user,
    // A new address row for the profile (id 0 = new, as the Account screen sends it).
    ...(address ? { addressId: null, address: { ...address, id: 0 } } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
  });
  await forget(email);
  return true;
}
