import type { Page } from '@playwright/test';

const API = 'http://localhost:5161';

/**
 * A signed-in session with no backend behind it.
 *
 * The app reads its tokens straight out of storage (`services/token-storage.ts`), so seeding them
 * is enough to render the signed-in shell — no login round trip, and nothing that can rate-limit
 * a test run. The token is never validated by anything in these tests because every API call is
 * fulfilled here.
 *
 * `app_language` and `app_theme` are seeded too: without them the first-run language dialog opens
 * over whatever is being photographed, and the theme would follow the machine's own preference.
 */
export async function signIn(page: Page, theme: 'light' | 'dark' = 'light') {
  await page.addInitScript((t) => {
    const now = Date.now();
    localStorage.setItem('app_language', 'en');
    localStorage.setItem('app_theme', t as string);
    localStorage.setItem('auth_access_token', 'visual-test-token');
    localStorage.setItem('auth_access_token_expiry', String(now + 30 * 60 * 1000));
    localStorage.setItem('auth_refresh_token', 'visual-test-refresh');
    localStorage.setItem('auth_refresh_token_expiry', String(now + 7 * 24 * 60 * 60 * 1000));
  }, theme);
}

/**
 * The signed-in user every fixture below belongs to.
 *
 * Shaped after a real `GET /auth/me` body, field for field — including `roles` and `groups`, which
 * `AuthProvider` reads to decide admin/partner. A fixture missing them is not a smaller version of
 * the real thing; it is a response the app never receives, and testing against it photographs a
 * state that cannot happen.
 */
const ME = {
  id: 1,
  userName: 'test_user',
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  emailConfirmed: true,
  roles: ['User'],
  groups: [],
  phone: '+381641234567',
  serviceProviderId: null,
  providerProfileId: 0,
  preferredLanguage: 'en',
  preferredCurrency: 'RSD',
};

/**
 * The `/enums` payload, shared by the specs that need real filter chips.
 *
 * Only the two the browse filters render. Values are the backend's, not sequential: `petSpeciesType`
 * is a FLAGS enum, so a made-up 1..6 would be wrong for everything past Cat.
 */
export const ENUMS = {
  serviceProviderType: [
    { value: 0, name: 'Sitter' },
    { value: 1, name: 'Walker' },
    { value: 2, name: 'Boarder' },
    { value: 3, name: 'PetHotel' },
    { value: 4, name: 'Groomer' },
    { value: 5, name: 'Transporter' },
  ],
  petSpeciesType: [
    { value: 1, name: 'Dog' },
    { value: 2, name: 'Cat' },
    { value: 4, name: 'Parrot' },
    { value: 8, name: 'Turtle' },
    { value: 16, name: 'Fish' },
    { value: 32, name: 'Snake' },
  ],
};

/**
 * `route.fulfill` writes exactly the headers it is given, and the app calls the API cross-origin
 * (8081 → 5161). Without these the browser rejects every mocked response before the app sees it,
 * and a screen that fetches anything renders blank — which is a screenshot of nothing, taken
 * without failing.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

/**
 * Fulfils every API call from fixed data.
 *
 * Deliberately exhaustive rather than per-test: an unmatched call would otherwise reach a backend
 * that may or may not be running, and the screenshot would differ depending on which. Anything
 * not named here returns an empty collection, which every screen already has to handle.
 */
export async function mockApi(page: Page, overrides: Record<string, unknown> = {}) {
  const routes: Record<string, unknown> = {
    '/auth/me': ME,
    '/api/users/1': ME,
    '/api/pets': { items: [], totalItems: 0 },
    '/api/user-pets': { items: [], totalItems: 0 },
    '/api/bookings': { items: [], totalItems: 0 },
    '/api/app-notifications': { items: [], totalItems: 0 },
    '/api/user-notification-settings': { items: [], totalItems: 0 },
    '/api/chat/conversations': { items: [], totalItems: 0 },
    '/api/services': { items: [], totalItems: 0 },
    '/enums': {},
    ...overrides,
  };

  await page.route(`${API}/**`, async (route) => {
    // The preflight carries no body and must answer before the real request is even sent.
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    const path = new URL(route.request().url()).pathname;
    const match = Object.keys(routes).find((k) => path === k || path.startsWith(k + '/'));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS,
      body: JSON.stringify(match ? routes[match] : { items: [], totalItems: 0 }),
    });
  });
}

/**
 * Loads a route and waits for it to stop moving.
 *
 * `networkidle` is not enough on its own: the shell paints, then the screen's own fetches resolve
 * and swap a spinner for content. Photographing between the two is the main source of a visual
 * suite that fails at random.
 */
export async function open(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
}
