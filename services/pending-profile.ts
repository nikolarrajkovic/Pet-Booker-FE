import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { AddressDto } from './service-providers';
import { uploadFile } from './files';
import { getUser, updateUser } from './users';

/** A photo picked on the sign-up form: a data URI on web, a file URI on a phone. */
export type PendingPhoto = { uri: string; fileName?: string; mimeType?: string };

/** What sign-up asks for that the new account cannot hold yet. */
export type PendingProfile = { address: AddressDto; photo?: PendingPhoto | null };

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
 * Sign-up's home address and profile photo, held until the account can take them.
 *
 * The profile row only exists once the email is confirmed, and only a signed-in account can
 * upload a photo, so the form keeps both here, keyed by the email, and the first sign-in of that
 * account saves them (`applyPendingProfile`, called from AuthContext). Storage rather than
 * navigation params, because the code may be typed in a later session: after the app restarted,
 * or from Verify Email reached by signing in to an account that was never confirmed.
 */
export async function savePendingProfile(email: string, profile: PendingProfile): Promise<void> {
  try {
    await store.setItemAsync(keyFor(email), JSON.stringify(profile));
  } catch {
    // A photo too large for the browser's storage: keep the address, which is what is required.
    try {
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

/**
 * Saves what sign-up collected to the profile of the account that just signed in, once. Returns
 * whether anything was saved. A failed photo upload does not hold up the address (the photo is
 * optional); a failed save keeps the entry, so the next sign-in tries again.
 */
export async function applyPendingProfile(userId: number, email: string): Promise<boolean> {
  const pending = await loadPendingProfile(email);
  if (!pending?.address) return false;

  let avatarUrl: string | undefined;
  if (pending.photo?.uri) {
    try {
      const { uri, fileName, mimeType } = pending.photo;
      avatarUrl = (await uploadFile(uri, fileName, mimeType)).src;
    } catch {
      // Optional — the address still goes in, and Account can add a photo later.
    }
  }

  const user = await getUser(userId);
  await updateUser({
    ...user,
    // A new address row for the profile (id 0 = new, as the Account screen sends it).
    addressId: null,
    address: { ...pending.address, id: 0 },
    ...(avatarUrl ? { avatarUrl } : {}),
  });
  try {
    await store.deleteItemAsync(keyFor(email));
  } catch {
    // Left behind, it would only be applied once more over the same values.
  }
  return true;
}
