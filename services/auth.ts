import { ApiError, apiFetch, apiJson, apiVoid, getApiBaseUrl } from './http';

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
    // Keep the status on the error: only a 401 actually means the credentials were rejected.
    // A 500, a 429 lockout or a gateway error are different problems and must not be reported
    // to the user as a bad password.
    throw new ApiError(
      body.message || body.detail || 'Login failed. Please verify your credentials.',
      response.status
    );
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

export function confirmEmail(email: string, code: string): Promise<void> {
  return apiVoid('/auth/confirm-email', {
    method: 'POST',
    body: { email, code },
    isPublic: true,
    fallback: 'Email verification failed. Please try again.',
    context: 'confirmEmail',
  });
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
