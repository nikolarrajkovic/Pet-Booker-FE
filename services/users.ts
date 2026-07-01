import { apiAuthFetch, getApiBaseUrl, parseApiError } from './http';
import { AddressDto } from './service-providers';

export type UserDto = {
  id?: number | null;
  firstName?: string | null;
  lastName?: string | null;
  userName?: string | null;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  // Password fields exist on the WRITE DTO only. The GET (UserReadDto) no longer
  // returns them (removed in the API update), and the server now preserves the
  // stored password when they're omitted on PUT — so the profile round-trip
  // ({ ...original, ...edits }) is safe even though `original` carries no hash.
  // Kept optional here for callers that explicitly set a password.
  passwordHash?: string | null;
  passwordSalt?: string | null;
  passwordHashAlgorithm?: string | null;
  dateOfBirth?: string | null;
  addressId?: number | null;
  address?: AddressDto | null;
  photos?: { id?: number | null; src?: string | null; isSelected?: boolean }[] | null;
};

/** GET /api/users/{id} — full user record (incl. avatarUrl + address). */
export async function getUser(id: number): Promise<UserDto> {
  const url = `${getApiBaseUrl()}/api/users/${id}`;
  const response = await apiAuthFetch(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to load profile.', 'getUser'));
  }
  return response.json();
}

/**
 * Updates a user via PUT /api/users/{id}. The API has **no PATCH** (405) — PUT
 * replaces the full record (including passwordHash/passwordSalt), so pass the
 * full `UserDto` from {@link getUser} with your edits merged in; that preserves
 * the sensitive fields untouched.
 */
export async function updateUser(user: UserDto): Promise<UserDto> {
  if (user.id == null) throw new Error('Cannot update a user without an id.');
  const url = `${getApiBaseUrl()}/api/users/${user.id}`;
  const response = await apiAuthFetch(url, { method: 'PUT', body: JSON.stringify(user) });
  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to save profile.', 'updateUser'));
  }
  return response.json();
}
