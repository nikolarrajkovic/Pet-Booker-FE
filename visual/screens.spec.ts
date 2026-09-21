import { test, expect } from '@playwright/test';
import { signIn, mockApi, open, ENUMS } from './mock-api';

/**
 * One baseline per screen, per design.
 *
 * The set is chosen for the things that went wrong this week rather than for coverage: a form
 * (surface and field layout), a list with rows, an empty state, the settings list (section
 * headers on the page ground), and the signed-out screens — which share the
 * `KeyboardAvoidingView` that was silently dropping its layout class.
 */

test.describe('signed out', () => {
  // No session and no API: these render before either exists, which is also why they are the
  // cheapest thing here to keep honest.
  for (const [name, path] of [
    ['login', '/login'],
    ['register', '/register'],
    ['forgot-password', '/forgot-password'],
  ] as const) {
    test(name, async ({ page }, testInfo) => {
      await page.addInitScript(() => localStorage.setItem('app_language', 'en'));
      await mockApi(page);
      await open(page, path);
      await expect(page).toHaveScreenshot(`${name}-${testInfo.project.name}.png`, {
        fullPage: true,
      });
    });
  }
});

test.describe('signed in', () => {
  for (const [name, path] of [
    ['settings', '/settings'],
    ['pets-empty', '/pets'],
    ['account', '/account'],
    ['notifications-empty', '/notifications'],
    // The notification preferences themselves, which had no baseline at all while being the
    // screen that changes most often — it has now been through a nine-toggle version, a
    // duplicate set of dead switches on /settings, and the two-channel trim.
    ['notification-settings', '/notifications/settings'],
  ] as const) {
    test(name, async ({ page }, testInfo) => {
      await signIn(page);
      await mockApi(page);
      await open(page, path);
      await expect(page).toHaveScreenshot(`${name}-${testInfo.project.name}.png`, {
        fullPage: true,
      });
    });
  }

  /**
   * The same screen as a managed ProviderProfile, which is a different screen entirely.
   *
   * Those accounts have no Domain.User, so the ServiceProvider group carries none of the
   * UserNotificationSettings permissions and every call is a 401. The app used to render the
   * toggles anyway and swallow the failure, leaving switches that looked applied and changed
   * nothing; it now renders an explanation instead. A baseline is what stops that quietly
   * becoming a row of dead switches again.
   */
  test('notification settings as a provider', async ({ page }, testInfo) => {
    await signIn(page);
    await mockApi(page, {
      '/auth/me': {
        id: 12,
        userName: 'test_partner',
        firstName: 'Test',
        lastName: 'Partner',
        email: 'partner@example.com',
        emailConfirmed: true,
        roles: ['ServiceProvider'],
        groups: ['ServiceProvider'],
        phone: '+381641234567',
        serviceProviderId: 7,
        // Non-zero is the whole point: it is how the app knows there is no user behind this
        // session, and therefore no personal settings to manage.
        providerProfileId: 12,
        preferredLanguage: 'en',
        preferredCurrency: 'RSD',
      },
    });
    await open(page, '/notifications/settings');
    await expect(page).toHaveScreenshot(
      `notification-settings-provider-${testInfo.project.name}.png`,
      {
        fullPage: true,
      }
    );
  });

  // Dark mode had never been looked at once until it was checked by hand. A baseline is the only
  // thing that keeps it from drifting again unnoticed.
  test('settings dark', async ({ page }, testInfo) => {
    await signIn(page, 'dark');
    await mockApi(page);
    await open(page, '/settings');
    await expect(page).toHaveScreenshot(`settings-dark-${testInfo.project.name}.png`, {
      fullPage: true,
    });
  });
});

/**
 * The browse results list, in both designs.
 *
 * This is the screen the one-per-line redesign is about, and the one where the two designs
 * genuinely differ in what a result looks like: the wide window gets the full-width
 * `ServiceResultRow` (description, species, extras, the struck-through pre-promotion price, the
 * deposit), the phone keeps its compact card. Everything around that — one per line, the sort
 * control, the server-driven filters — is shared, so a baseline per design is what keeps the
 * split deliberate instead of accidental.
 *
 * The fixture is shaped after a real `/api/services` page: the pagination wrapper, the read-only
 * fields the server computes (`price` after discount, `rating`, `basicServiceName`), and one
 * discounted service so the "was" price and the promotion ribbon are actually exercised.
 */
test.describe('search results', () => {
  const service = (over: Record<string, unknown>) => ({
    serviceProviderId: 7,
    currency: 'RSD',
    isActive: true,
    type: 1,
    basicServiceName: 'Walker',
    imageUrl: null,
    photos: [],
    rating: 4.6,
    totalRatingNumber: 24,
    pricing: { basePrice: 2500, isEscrowPercentEnabled: false, escrowAmount: 500 },
    details: { supportsLiveTracking: false, acceptedSpecies: 3, maxConcurrentBookings: 2 },
    additionalServices: [],
    pricingOptions: [],
    discounts: [],
    address: { line1: '12 Market St', city: 'Belgrade', country: 'Serbia', location: null },
    ...over,
  });

  const SERVICES = {
    totalItems: 3,
    totalPages: 1,
    currentPage: 1,
    itemsPerPage: 25,
    items: [
      service({
        id: 101,
        name: 'Happy Paws Dog Walking',
        description:
          'Daily neighbourhood walks with GPS tracking, photo updates after every outing, and flexible pick-up windows.',
        about:
          'Daily neighbourhood walks with GPS tracking, photo updates after every outing, and flexible pick-up windows.',
        price: 2500,
        details: { supportsLiveTracking: true, acceptedSpecies: 1, maxConcurrentBookings: 3 },
        additionalServices: [
          { id: 1, name: 'Pickup', chargeType: 0, price: 300, isActive: true },
          { id: 2, name: 'Pet taxi', chargeType: 0, price: 600, isActive: true },
        ],
        pricingOptions: [
          { id: 1, serviceId: 101, name: '30 min', durationMinutes: 30, price: 2500 },
          { id: 2, serviceId: 101, name: '60 min', durationMinutes: 60, price: 4000 },
        ],
      }),
      service({
        id: 102,
        name: 'Belgrade Pet Boarding',
        description: 'Overnight boarding in a home setting, with a garden and 24/7 supervision.',
        about: 'Overnight boarding in a home setting, with a garden and 24/7 supervision.',
        type: 2,
        basicServiceName: 'Boarder',
        // A live promotion: 4000 down to 3000, so the row shows the struck-through price.
        price: 3000,
        appliedDiscountType: 0,
        appliedDiscountAmount: 25,
        pricing: { basePrice: 4000, isEscrowPercentEnabled: false, escrowAmount: 800 },
        rating: 4.9,
        totalRatingNumber: 112,
      }),
      service({
        id: 103,
        name: 'Quiet Street Cat Sitting',
        // A photo URL that exists but never loads — the shape the seeded catalogue actually has
        // (`cdn.example.com` resolves nowhere). The `resolveImageUrl(src) || FALLBACK` a card
        // computes does NOT cover this: a broken string is still truthy, so the stock fallback is
        // skipped and the card used to render a blank rectangle. This row must show the
        // placeholder instead — see ServicePhoto.
        imageUrl: 'https://cdn.example.com/does-not-resolve.jpg',
        description: 'In-home visits for cats — feeding, litter, play and a daily photo.',
        about: 'In-home visits for cats — feeding, litter, play and a daily photo.',
        type: 0,
        basicServiceName: 'Sitter',
        price: 1200,
        rating: 0,
        totalRatingNumber: 0,
        details: { supportsLiveTracking: false, acceptedSpecies: 2, maxConcurrentBookings: 1 },
        pricing: { basePrice: 1200, isEscrowPercentEnabled: false, escrowAmount: 0 },
      }),
    ],
  };

  test('search results', async ({ page }, testInfo) => {
    await signIn(page);
    await mockApi(page, {
      '/api/services': SERVICES,
      '/enums': ENUMS,
    });
    await open(page, '/search');
    await expect(page).toHaveScreenshot(`search-results-${testInfo.project.name}.png`, {
      fullPage: true,
    });
  });
});
