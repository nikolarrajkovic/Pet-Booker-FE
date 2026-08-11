import { apiJson } from './http';
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
export function getUser(id: number): Promise<UserDto> {
  return apiJson<UserDto>(`/api/users/${id}`, {
    fallback: 'Failed to load profile.',
    context: 'getUser',
  });
}

/**
 * Updates a user via PUT /api/users/{id}. The API has **no PATCH** (405) — PUT
 * replaces the full record (including passwordHash/passwordSalt), so pass the
 * full `UserDto` from {@link getUser} with your edits merged in; that preserves
 * the sensitive fields untouched.
 */
export function updateUser(user: UserDto): Promise<UserDto> {
  if (user.id == null) throw new Error('Cannot update a user without an id.');
  return apiJson<UserDto>(`/api/users/${user.id}`, {
    method: 'PUT',
    body: user,
    fallback: 'Failed to save profile.',
    context: 'updateUser',
  });
}
