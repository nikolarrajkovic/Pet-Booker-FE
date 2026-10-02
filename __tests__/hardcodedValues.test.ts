import fs from 'fs';
import path from 'path';

import { locationLabel, DEFAULT_LOCATION } from '../hooks/useLocation';
import { formatOfferAmount } from '../screens/promotions-screen/components/PromotionCard';

/**
 * The fake data that used to ship to users, and the helpers that replaced it.
 *
 * Every string in `FABRICATED` was on a real screen: a service preview that always said
 * "San Francisco, CA", a support card with a (555) number under an old product name, a saved Visa
 * ending 4242 nobody had added, promotion analytics for "Golden Gate Park" with invented views and
 * ROI, a tour dated "JUNE 2025", a cancellation fee the backend never charges. None of it failed a
 * test, because none of it was wrong in a way a component test looks for. This one looks.
 */
const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIRS = ['screens', 'components', 'hooks', 'services', 'context', 'navigation', 'i18n'];

const FABRICATED = [
  'San Francisco',
  'Golden Gate',
  'Central Park',
  'pawcare',
  '(555)',
  '4242',
  'Spring Boost',
  'JUNE 2025',
  '586%',
  '50% charge',
  'Background Check',
  // Social sign-in ran on these until it was removed (no backend endpoint behind it).
  'YOUR_WEB_CLIENT_ID',
  'YOUR_ANDROID_CLIENT_ID',
];

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe('fabricated data', () => {
  const files = SOURCE_DIRS.flatMap((d) => sourceFiles(path.join(ROOT, d)));

  it.each(FABRICATED)('"%s" is not in the app', (needle) => {
    const hits = files
      .filter((file) => {
        // Comments may name what was removed; only code and copy count.
        const code = fs
          .readFileSync(file, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/(^|[^:])\/\/.*$/gm, '$1');
        return code.toLowerCase().includes(needle.toLowerCase());
      })
      .map((file) => path.relative(ROOT, file));
    expect(hits).toEqual([]);
  });
});

describe('locationLabel', () => {
  const t = (key: string) => `[${key}]`;

  it('shows the resolved address when there is one', () => {
    expect(locationLabel({ address: 'Knez Mihailova 12, Beograd', error: null }, t)).toBe(
      'Knez Mihailova 12, Beograd'
    );
  });

  it('says "current location" for a fix with no address, translated', () => {
    expect(locationLabel({ address: null, error: null }, t)).toBe('[home.currentLocation]');
  });

  it('names the default area when the device position failed, translated', () => {
    expect(locationLabel({ address: null, error: 'denied' }, t)).toBe('[home.defaultArea]');
  });

  it('keeps the default position in one place', () => {
    expect(DEFAULT_LOCATION).toEqual({ latitude: 44.8176, longitude: 20.457 });
  });
});

describe('formatOfferAmount', () => {
  const t = (_key: 'shared.amountOff', params: { amount: string }) => `-${params.amount}`;

  it('hands the amount to the translation instead of appending English "OFF"', () => {
    expect(formatOfferAmount(0, 20, 'RSD', null, t)).toBe('-20%');
  });

  it('prefers percentAmount over a mislabelled type', () => {
    expect(formatOfferAmount(1, 500, 'RSD', 15, t)).toBe('-15%');
  });
});
