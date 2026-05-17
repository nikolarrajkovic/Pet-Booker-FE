import { apiFetch } from './http';

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

// Environment variable usage commented out for development
function getApiBaseUrl() {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not set. Add it to your environment to enable API calls.');
  }

  return baseUrl.replace(/\/$/, '');
}

function extractAccessToken(response: LoginApiResponse) {
  return response.accessToken ?? response.token ?? response.data?.accessToken ?? response.data?.token;
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
  try { body = JSON.parse(raw); } catch { /* ignore */ }

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
  try { body = JSON.parse(raw); } catch { /* ignore */ }

  if (!response.ok) {
    throw new Error(body.message || body.detail || 'Email verification failed. Please try again.');
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
  try { body = JSON.parse(raw); } catch { /* ignore */ }

  if (!response.ok) {
    throw new Error(body.message || body.detail || 'Failed to resend confirmation code. Please try again.');
  }
}
