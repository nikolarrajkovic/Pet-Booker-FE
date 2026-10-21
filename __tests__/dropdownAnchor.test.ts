import fs from 'fs';
import path from 'path';

/**
 * "The dropdown is covered by text from the background" (feedback 2026-10-18) happens on Android
 * only: a parent paints its children in elevation order before it looks at zIndex, so result cards
 * (which carry elevation) drew over the open sort menu. No Android device or emulator was available
 * to watch the fix, so these pin what it rests on.
 */
describe('DROPDOWN_ANCHOR', () => {
  // DROPDOWN_ANCHOR is decided when the module loads, so each platform gets a fresh copy of both
  // react-native (whose Platform it reads) and the module.
  const load = (os: 'android' | 'ios') => {
    let anchor: Record<string, unknown> = {};
    jest.isolateModules(() => {
      const { Platform: IsolatedPlatform } = require('react-native');
      Object.defineProperty(IsolatedPlatform, 'OS', { value: os, configurable: true });
      anchor = require('../components/shared/SortMenu').DROPDOWN_ANCHOR;
    });
    return anchor;
  };

  it('outranks the result cards on Android, whose elevation is what painted over the menu', () => {
    const anchor = load('android');
    // ServiceResultRow's card elevation; shadow-sm compiles to 1–2.
    const rowSource = fs.readFileSync(
      path.join(__dirname, '../components/shared/ServiceResultRow.tsx'),
      'utf8'
    );
    const cardElevations = [...rowSource.matchAll(/elevation:\s*(\d+)/g)].map((m) => Number(m[1]));
    expect(anchor.elevation).toBeGreaterThan(Math.max(2, ...cardElevations));
    expect(anchor.zIndex).toBeGreaterThan(0);
  });

  it('adds no elevation where zIndex is enough', () => {
    expect(load('ios').elevation).toBeUndefined();
  });

  it('is on the row of every screen that opens a sort menu over a list', () => {
    const screens = [
      'screens/search-screen/components/ListView.tsx',
      'screens/admin-new-requests-screen/containers/AdminNewRequestsScreen.tsx',
      'screens/admin-partners-screen/containers/AdminPartnersScreen.tsx',
      'screens/admin-reviews-screen/containers/AdminReviewsScreen.tsx',
    ];
    for (const file of screens) {
      const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
      expect(source).toMatch(/style=\{[^}]*DROPDOWN_ANCHOR|DROPDOWN_ANCHOR,/);
    }
  });
});
