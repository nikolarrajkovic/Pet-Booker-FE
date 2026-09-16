import { ApiError, apiFetch, apiJson, apiRequest, apiVoid, getApiBaseUrl } from './http';

export type CurrentUser = {
  id: number;
  email: string;
  emailConfirmed: boolean;
  roles: string[];
  groups: string[];
  userName: string;
  firstName: string;
  lastName: string;
  // The user's own provider profile, when they're a partner (0 = none).
  // Lets partner screens resolve their provider without fetching the list.
  serviceProviderId?: number | null;
  providerProfileId?: number | null;
  // Display preferences resolved by the gateway from UserNotificationSettings
  // (ProviderProfile.PreferredLanguage for managed profile sessions). Currency is a
  // display preference only — payments are always in RSD for now.
  preferredLanguage?: string | null;
  preferredCurrency?: string | null;
};

type LoginPayload = {
  identifier: string;
  password: string;
};

type LoginApiResponse = {
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  message?: string;
  detail?: string;
  data?: {
    token?: string;
    accessToken?: string;
    refreshToken?: string;
  };
};

function parseResponseBody(raw: string): LoginApiResponse {
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as LoginApiResponse;
  } catch {
    return {};
  }
}

function extractAccessToken(response: LoginApiResponse) {
  return (
    response.accessToken ?? response.token ?? response.data?.accessToken ?? response.data?.token
  );
}

function extractRefreshToken(response: LoginApiResponse) {
  return response.refreshToken ?? response.data?.refreshToken;
}

export async function loginWithEmailPassword(payload: LoginPayload) {
  const url = `${getApiBaseUrl()}/auth/login`;

  const response = await apiFetch(url, {
    method: 'POST',
    headers: {
      Accept: '*/*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  const body = parseResponseBody(raw);

  if (!response.ok) {
    // Keep the status on the error: only a 400/401 actually means the credentials were rejected.
    // A 500, a 429 or a gateway error are different problems and must not be reported to the user
    // as a bad password.
    //
    // No hardcoded fallback here. The old default ("Login failed. Please verify your
    // credentials.") was returned for EVERY body-less response, and because it is always truthy
    // it short-circuited the status-aware mapping in LoginScreen's resolveLoginError — so a 429
    // read as a typo and sent people off to reset a password that was fine. Leaving the message
    // empty lets that mapper see the status and choose the right words.
    throw new ApiError(body.message || body.detail || '', response.status);
  }

  const accessToken = extractAccessToken(body);
  const refreshToken = extractRefreshToken(body);

  if (!accessToken) {
    // A 200 with no token is a server contract break, not a credentials problem.
    throw new ApiError('Login response did not include an auth token.', response.status);
  }

  return { accessToken, refreshToken };
}

export type RegisterPayload = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  userName: string;
  phone: string;
  dateOfBirth: string; // ISO 8601, e.g. "1995-06-15T00:00:00.000Z"
};

export function getMe(): Promise<CurrentUser> {
  return apiJson<CurrentUser>('/auth/me', {
    fallback: 'Failed to load user profile.',
    context: 'getMe',
  });
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken?: string }> {
  const url = `${getApiBaseUrl()}/auth/refresh`;

  const response = await apiFetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  const raw = await response.text();
  const body = parseResponseBody(raw);

  if (!response.ok) {
    throw new Error(body.message || body.detail || 'Session expired. Please log in again.');
  }

  const accessToken = extractAccessToken(body);
  if (!accessToken) {
    throw new Error('Refresh response did not include an access token.');
  }

  return { accessToken, refreshToken: extractRefreshToken(body) ?? undefined };
}

// These three public endpoints previously hand-parsed the error body as
// `message || detail || fallback`, which silently swallowed ASP.NET's
// `{ errors: { Field: [...] } }` validation shape — so a rejected registration
// only ever said "Registration failed. Please try again." `parseApiError`
// (inside the helper) resolves that shape first, surfacing the actual field
// message the user needs to act on.
export function registerUser(payload: RegisterPayload): Promise<void> {
  return apiVoid('/auth/register', {
    method: 'POST',
    body: payload,
    isPublic: true,
    fallback: 'Registration failed. Please try again.',
    context: 'registerUser',
  });
}

/**
 * Confirms the emailed code and returns the token pair the API issues with it.
 *
 * `/auth/confirm-email` deliberately answers with an access + refresh token and the profile, so
 * the client is signed in straight after confirming without a second `/auth/login` round trip.
 * This used to go through `apiVoid`, which never reads the body — so that pair was thrown away
 * and a freshly-verified user was bounced back to the login screen to type their password again.
 *
 * The tokens are optional in the return type on purpose: an older API build (or a gateway that
 * strips the body) simply yields nothing, and the caller falls back to sending them to Login.
 */
export async function confirmEmail(
  email: string,
  code: string
): Promise<{ accessToken?: string; refreshToken?: string }> {
  const response = await apiRequest('/auth/confirm-email', {
    method: 'POST',
    body: { email, code },
    isPublic: true,
    fallback: 'Email verification failed. Please try again.',
    context: 'confirmEmail',
  });

  const body = parseResponseBody(await response.text());
  return {
    accessToken: extractAccessToken(body),
    refreshToken: extractRefreshToken(body),
  };
}

export type UpdateProfilePayload = {
  userName: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
};

/** Updates the signed-in user's profile. */
export function updateProfile(payload: UpdateProfilePayload): Promise<void> {
  return apiVoid('/auth/profile', {
    method: 'PUT',
    body: payload,
    fallback: 'Failed to update profile.',
    context: 'updateProfile',
  });
}

/** Changes the signed-in user's password. */
export function changePassword(payload: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<void> {
  return apiVoid('/auth/change-password', {
    method: 'POST',
    body: payload,
    fallback: 'Failed to change password.',
    context: 'changePassword',
  });
}

/** Requests a password-reset email/code for the given address (public). */
export function forgotPassword(email: string): Promise<void> {
  return apiVoid('/auth/forgot-password', {
    method: 'POST',
    body: { email },
    isPublic: true,
    fallback: 'Failed to send reset email.',
    context: 'forgotPassword',
  });
}

/** Resets a password using the token from the reset email (public). */
export function resetPassword(payload: {
  resetToken: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<void> {
  return apiVoid('/auth/reset-password', {
    method: 'POST',
    body: payload,
    isPublic: true,
    fallback: 'Failed to reset password.',
    context: 'resetPassword',
  });
}

/** Server-side logout (best-effort; the client clears tokens regardless). */
export function logout(): Promise<void> {
  return apiVoid('/auth/logout', {
    method: 'POST',
    fallback: 'Failed to log out.',
    context: 'logout',
  });
}

export function resendConfirmation(email: string): Promise<void> {
  return apiVoid('/auth/resend-confirmation', {
    method: 'POST',
    body: { email },
    isPublic: true,
    fallback: 'Failed to resend confirmation code. Please try again.',
    context: 'resendConfirmation',
  });
}
