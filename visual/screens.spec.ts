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
