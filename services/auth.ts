import { apiFetch, apiAuthFetch, getApiBaseUrl, parseApiError } from './http';

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
    throw new Error(body.message || body.detail || 'Login failed. Please verify your credentials.');
  }

  const accessToken = extractAccessToken(body);
  const refreshToken = extractRefreshToken(body);

  if (!accessToken) {
    throw new Error('Login response did not include an auth token.');
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

type RegisterApiResponse = {
  message?: string;
  detail?: string;
  [key: string]: unknown;
};

export async function getMe(): Promise<CurrentUser> {
  const response = await apiAuthFetch(`${getApiBaseUrl()}/auth/me`);

  if (!response.ok) {
    throw new Error('Failed to load user profile.');
  }

  return response.json() as Promise<CurrentUser>;
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

export async function registerUser(payload: RegisterPayload): Promise<void> {
  const url = `${getApiBaseUrl()}/auth/register`;

  const response = await apiFetch(url, {
    method: 'POST',
    headers: {
      Accept: '*/*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  let body: RegisterApiResponse = {};
  try {
    body = JSON.parse(raw);
  } catch {
    /* ignore */
  }

  if (!response.ok) {
    throw new Error(body.message || body.detail || 'Registration failed. Please try again.');
  }
}

export async function confirmEmail(email: string, code: string): Promise<void> {
  const url = `${getApiBaseUrl()}/auth/confirm-email`;

  const response = await apiFetch(url, {
    method: 'POST',
    headers: {
      Accept: '*/*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, code }),
  });

  const raw = await response.text();
  let body: { message?: string; detail?: string } = {};
  try {
    body = JSON.parse(raw);
  } catch {
    /* ignore */
  }

  if (!response.ok) {
    throw new Error(body.message || body.detail || 'Email verification failed. Please try again.');
  }
}

export type UpdateProfilePayload = {
  userName: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
};

/** Updates the signed-in user's profile. */
export async function updateProfile(payload: UpdateProfilePayload): Promise<void> {
  const response = await apiAuthFetch(`${getApiBaseUrl()}/auth/profile`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to update profile.', 'updateProfile'));
  }
}

/** Changes the signed-in user's password. */
export async function changePassword(payload: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<void> {
  const response = await apiAuthFetch(`${getApiBaseUrl()}/auth/change-password`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to change password.', 'changePassword'));
  }
}

/** Requests a password-reset email/code for the given address (public). */
export async function forgotPassword(email: string): Promise<void> {
  const response = await apiFetch(`${getApiBaseUrl()}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to send reset email.', 'forgotPassword'));
  }
}

/** Resets a password using the token from the reset email (public). */
export async function resetPassword(payload: {
  resetToken: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<void> {
  const response = await apiFetch(`${getApiBaseUrl()}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to reset password.', 'resetPassword'));
  }
}

/** Server-side logout (best-effort; the client clears tokens regardless). */
export async function logout(): Promise<void> {
  const response = await apiAuthFetch(`${getApiBaseUrl()}/auth/logout`, { method: 'POST' });
  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to log out.', 'logout'));
  }
}

export async function resendConfirmation(email: string): Promise<void> {
  const url = `${getApiBaseUrl()}/auth/resend-confirmation`;

  const response = await apiFetch(url, {
    method: 'POST',
    headers: {
      Accept: '*/*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  const raw = await response.text();
  let body: { message?: string; detail?: string } = {};
  try {
    body = JSON.parse(raw);
  } catch {
    /* ignore */
  }

  if (!response.ok) {
    throw new Error(
      body.message || body.detail || 'Failed to resend confirmation code. Please try again.'
    );
  }
}
