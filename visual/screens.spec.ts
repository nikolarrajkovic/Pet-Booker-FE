import { test, expect } from '@playwright/test';
import { signIn, mockApi, open } from './mock-api';

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
    // A partner session that has not seen the celebration is redirected to PartnerWelcome the
    // moment it signs in, so without this the baseline photographs "You're Approved!" instead of
    // the screen under test — a golden that passes forever while covering nothing.
    // Key shape from services/onboarding.ts, for the id the /auth/me override below returns.
    await page.addInitScript(() => localStorage.setItem('partner_welcome_seen_12', '1'));
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
