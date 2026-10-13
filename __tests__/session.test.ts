/**
 * The session's token renewal (services/session.ts) and the 401 retry in apiAuthFetch.
 *
 * Every caller used to refresh on its own: with refresh tokens rotating, simultaneous refreshes had
 * all but the first refused and the user signed out at random (reproduced with 400 ms of network
 * jitter), a network error during a refresh signed people out too, and a token issued before a
 * partner's approval kept answering 401 until they signed in again.
 */
import { ApiError, apiAuthFetch, registerSessionExpiredHandler } from '../services/http';
import { getValidAccessToken, refreshSession, SessionEndedError } from '../services/session';
import { jwtClaim, tokenAgeMs } from '../services/jwt';

const mockStore = new Map<string, string>();

jest.mock('../services/token-storage', () => ({
  getAccessToken: jest.fn(async () => mockStore.get('access') ?? null),
  getRefreshToken: jest.fn(async () => mockStore.get('refresh') ?? null),
  saveTokens: jest.fn(async (access: string, refresh?: string) => {
    mockStore.set('access', access);
    if (refresh) mockStore.set('refresh', refresh);
  }),
  clearTokens: jest.fn(async () => mockStore.clear()),
}));

const mockRefreshAccessToken = jest.fn();
jest.mock('../services/auth', () => ({
  refreshAccessToken: (token: string) => mockRefreshAccessToken(token),
}));

/** A JWT whose payload carries `iat` (seconds ago) — the signature is never checked client-side. */
function jwt(issuedSecondsAgo: number, label = 'a'): string {
  const iat = Math.floor(Date.now() / 1000) - issuedSecondsAgo;
  const payload = Buffer.from(JSON.stringify({ iat, exp: iat + 1800, label })).toString(
    'base64url'
  );
  return `h.${payload}.s`;
}

const sessionEnded = jest.fn();

beforeEach(() => {
  mockStore.clear();
  mockRefreshAccessToken.mockReset();
  sessionEnded.mockReset();
  registerSessionExpiredHandler(sessionEnded);
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
});

describe('refreshSession', () => {
  it('shares one refresh between every caller that needs one at the same moment', async () => {
    mockStore.set('refresh', 'r1');
    let resolve!: (v: { accessToken: string; refreshToken: string }) => void;
    mockRefreshAccessToken.mockReturnValue(new Promise((r) => (resolve = r)));

    const callers = [getValidAccessToken(), getValidAccessToken(), getValidAccessToken()];
    resolve({ accessToken: 'new-access', refreshToken: 'r2' });

    await expect(Promise.all(callers)).resolves.toEqual(['new-access', 'new-access', 'new-access']);
    expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
    expect(mockStore.get('refresh')).toBe('r2');
  });

  it('keeps the session when the refresh never reached the server', async () => {
    mockStore.set('refresh', 'r1');
    mockRefreshAccessToken.mockRejectedValue(new ApiError('Cannot reach the server.', 0));

    await expect(getValidAccessToken()).rejects.toMatchObject({ status: 0 });
    expect(mockStore.get('refresh')).toBe('r1');
    expect(sessionEnded).not.toHaveBeenCalled();
  });

  it('keeps the session on a rate limit or a server error', async () => {
    mockStore.set('refresh', 'r1');
    mockRefreshAccessToken.mockRejectedValue(new ApiError('Too many requests', 429));
    await expect(getValidAccessToken()).rejects.toBeInstanceOf(ApiError);
    mockRefreshAccessToken.mockRejectedValue(new ApiError('Server error', 503));
    await expect(getValidAccessToken()).rejects.toBeInstanceOf(ApiError);

    expect(mockStore.get('refresh')).toBe('r1');
    expect(sessionEnded).not.toHaveBeenCalled();
  });

  it('ends the session when the server refuses the refresh token', async () => {
    mockStore.set('refresh', 'r1');
    mockRefreshAccessToken.mockRejectedValue(new ApiError('Invalid refresh token.', 401));

    await expect(getValidAccessToken()).rejects.toBeInstanceOf(SessionEndedError);
    expect(mockStore.size).toBe(0);
    expect(sessionEnded).toHaveBeenCalledTimes(1);
  });

  it('reuses a token another tab stored while this one waited, instead of refreshing again', async () => {
    mockStore.set('access', 'fresh-from-other-tab');
    mockStore.set('refresh', 'r2');

    await expect(refreshSession({ force: true, staleToken: 'old-access' })).resolves.toBe(
      'fresh-from-other-tab'
    );
    expect(mockRefreshAccessToken).not.toHaveBeenCalled();
  });
});

describe('apiAuthFetch', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('renews an old token once and retries when the server says 401', async () => {
    // e.g. a partner approved since this token was issued: its permissions are behind.
    mockStore.set('access', jwt(600, 'old'));
    mockStore.set('refresh', 'r1');
    const renewed = jwt(0, 'new');
    mockRefreshAccessToken.mockResolvedValue({ accessToken: renewed, refreshToken: 'r2' });
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const response = await apiAuthFetch('http://api.test/api/stats/provider/overview');

    expect(response.status).toBe(200);
    expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(`Bearer ${renewed}`);
  });

  it('does not renew a token issued moments ago — a 401 then is a plain refusal', async () => {
    mockStore.set('access', jwt(5));
    mockStore.set('refresh', 'r1');
    fetchMock.mockResolvedValue(new Response('', { status: 401 }));

    const response = await apiAuthFetch('http://api.test/api/pets/1');

    expect(response.status).toBe(401);
    expect(mockRefreshAccessToken).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('jwt claims', () => {
  it('reads exp and iat, and says how old a token is', () => {
    const token = jwt(120);
    expect(jwtClaim(token, 'exp')).toBe(jwtClaim(token, 'iat')! + 1800);
    expect(tokenAgeMs(token)).toBeGreaterThanOrEqual(119_000);
  });

  it('treats an unreadable token as infinitely old rather than throwing', () => {
    expect(jwtClaim('not-a-jwt', 'exp')).toBeNull();
    expect(tokenAgeMs('not-a-jwt')).toBe(Number.POSITIVE_INFINITY);
  });
});
