/**
 * Changing the password keeps this device signed in (2026-11-05). The server ends every sign-in,
 * this device's refresh token included, and answers with a new session; the app used to discard
 * that reply and was signed out at its next refresh.
 */
import { changePassword } from '../services/auth';

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

const fetchMock = jest.fn();

beforeEach(() => {
  mockStore.clear();
  mockStore.set('access', 'old-access');
  mockStore.set('refresh', 'old-refresh');
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
});

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

it('stores the session the server returns for this device', async () => {
  fetchMock.mockResolvedValue(
    reply(200, {
      message: 'Password changed successfully.',
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    })
  );

  await changePassword({ currentPassword: 'a', newPassword: 'b', confirmPassword: 'b' });

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('http://api.test/auth/change-password');
  expect((init.headers as Record<string, string>).Authorization).toBe('Bearer old-access');
  expect(mockStore.get('access')).toBe('new-access');
  expect(mockStore.get('refresh')).toBe('new-refresh');
});

it('leaves the stored session alone when the change is refused', async () => {
  fetchMock.mockResolvedValue(reply(400, { error: 'Current password is incorrect.' }));

  await expect(
    changePassword({ currentPassword: 'x', newPassword: 'b', confirmPassword: 'b' })
  ).rejects.toMatchObject({ status: 400 });
  expect(mockStore.get('access')).toBe('old-access');
  expect(mockStore.get('refresh')).toBe('old-refresh');
});
