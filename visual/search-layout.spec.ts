import { test, expect } from '@playwright/test';
import { signIn, mockApi, open, ENUMS } from './mock-api';

/**
 * Browse-page layout facts that a screenshot cannot pin down.
 *
 * Both failures below shipped past a full golden suite, for the same reason: a screenshot proves
 * what one viewport looked like, not what the layout *does*. A gutter that only diverges above a
 * certain width is invisible at the width the goldens are shot at, and paint order is not
 * something a correct-looking image can distinguish from an incorrect one — the overlap has to be
 * interrogated, not photographed. So these measure and hit-test instead.
 */

const service = (i: number) => ({
  id: 100 + i,
  serviceProviderId: 7,
  currency: 'RSD',
  isActive: true,
  type: 1,
  name: `Layout Probe ${i}`,
  description: 'Seeded so there are rows beneath the controls to overlap with.',
  about: 'Seeded so there are rows beneath the controls to overlap with.',
  basicServiceName: 'Walker',
  price: 100 + i,
  rating: 0,
  totalRatingNumber: 0,
  photos: [],
  pricing: { basePrice: 100 + i, isEscrowPercentEnabled: false, escrowAmount: 0 },
  details: { supportsLiveTracking: false, acceptedSpecies: 1, maxConcurrentBookings: 1 },
  additionalServices: [],
  pricingOptions: [],
  discounts: [],
  address: null,
});

const SERVICES = {
  totalItems: 4,
  totalPages: 1,
  currentPage: 1,
  itemsPerPage: 25,
  items: [0, 1, 2, 3].map(service),
};

async function openSearch(page: import('@playwright/test').Page) {
  await signIn(page);
  await mockApi(page, { '/api/services': SERVICES, '/enums': ENUMS });
  await open(page, '/search');
}

test.describe('gutters stay equal as the window grows', () => {
  /** Left gutter, results-to-rail gap, and right gutter, in CSS pixels. */
  async function gutters(page: import('@playwright/test').Page) {
    return page.evaluate(() => {
      const card = [...document.querySelectorAll<HTMLElement>('*')].find((e) =>
        (e.className || '').toString().includes('rounded-3xl')
      );
      const heading = [...document.querySelectorAll<HTMLElement>('*')].find(
        (e) => e.textContent?.trim() === 'Filter by'
      );
      let rail: HTMLElement | null = heading ?? null;
      while (rail && !(rail.className || '').toString().includes('rounded-2xl')) {
        rail = rail.parentElement;
      }
      const pane = document.querySelector<HTMLElement>('[data-page-scroll]');
      if (!card || !rail || !pane) return null;

      const p = pane.getBoundingClientRect();
      const c = card.getBoundingClientRect();
      const r = rail.getBoundingClientRect();
      return {
        left: Math.round(c.left - p.left),
        gap: Math.round(r.left - c.right),
        right: Math.round(p.right - r.right),
      };
    });
  }

  // 1440 sat inside the old 1600 cap, 1800 just past it, 2200 well past — where the old layout
  // put 243px outside the results and 32 between them, because a capped ContentContainer CENTRES
  // its column and that margin stacks on top of the gutter.
  for (const width of [1440, 1800, 2200]) {
    test(`at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 950 });
      await openSearch(page);

      const measured = await gutters(page);
      expect(
        measured,
        'card, filter rail and scroll pane should all be on the page'
      ).not.toBeNull();
      // Compared against each other rather than against 32, so a deliberate change to the gutter
      // keeps passing and only a disagreement between the three fails.
      expect(measured!.left).toBe(measured!.gap);
      expect(measured!.right).toBe(measured!.gap);
    });
  }
});

test.describe('controls that overlap the results paint above them', () => {
  test('the sort menu is on top of the first result row', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await openSearch(page);

    await page.getByText('Our top picks').click();
    const option = page.getByText('Price (lowest first)');
    await expect(option).toBeVisible();

    // Hit-testing, not screenshotting: `elementFromPoint` returns whatever is painted on TOP at
    // that coordinate, which is exactly the question. The menu opens downwards over the first
    // card, and a z-index only competes inside its own stacking context — the cards are later
    // siblings of the row the menu lives in, so it rendered *underneath* them and the options
    // could not be read or clicked.
    const onTop = await option.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        isTheOption: !!hit && (hit === el || el.contains(hit) || hit.contains(el)),
        hitText: hit?.textContent?.trim().slice(0, 60) ?? null,
      };
    });

    expect(
      onTop.isTheOption,
      `a result row is painted over the sort menu — topmost element was "${onTop.hitText}"`
    ).toBe(true);
  });
});
