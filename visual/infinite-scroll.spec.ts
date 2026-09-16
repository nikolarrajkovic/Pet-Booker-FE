import { test, expect } from '@playwright/test';
import { signIn, ENUMS } from './mock-api';

/**
 * The browse list keeps loading as you scroll.
 *
 * This is a behaviour test, not a screenshot one, and it lives here because it needs a **real
 * browser**: which element owns the scroll differs between the two designs (`ScreenLayout` owns a
 * single page-level scroll pane on web, while the phone scrolls the screen's own `ScrollView`),
 * and that is precisely what decides whether the next page ever loads. Jest renders to a virtual
 * tree with no scrolling at all, so it cannot see any of it — the web design shipped an
 * "infinite" scroll that silently stopped at page one, and nothing in the unit suite noticed.
 *
 * The fixture pages for real: the route reads `Page` off the query string and answers with that
 * slice plus honest `totalItems`/`currentPage`, so "did it ask for page 2 and append it?" is
 * actually being measured rather than assumed.
 */

const API = 'http://localhost:5161';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

const TOTAL = 40;
const PER_PAGE = 25;

function service(i: number) {
  return {
    id: 1000 + i,
    serviceProviderId: 7,
    currency: 'RSD',
    isActive: true,
    type: 1,
    name: `Paged Service ${i}`,
    description: 'A service seeded purely so the list is longer than one page.',
    about: 'A service seeded purely so the list is longer than one page.',
    basicServiceName: 'Walker',
    price: 1000 + i,
    rating: 0,
    totalRatingNumber: 0,
    photos: [],
    pricing: { basePrice: 1000 + i, isEscrowPercentEnabled: false, escrowAmount: 0 },
    details: { supportsLiveTracking: false, acceptedSpecies: 1, maxConcurrentBookings: 1 },
    additionalServices: [],
    pricingOptions: [],
    discounts: [],
    address: { line1: '1 Main St', city: 'Belgrade', country: 'Serbia', location: null },
  };
}

const ALL = Array.from({ length: TOTAL }, (_, i) => service(i));

async function mockPagedServices(
  page: import('@playwright/test').Page,
  pagesRequested: number[] = []
) {
  await page.route(`${API}/**`, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    const url = new URL(route.request().url());
    const json = (body: unknown) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: CORS,
        body: JSON.stringify(body),
      });

    if (url.pathname === '/auth/me') {
      return json({
        id: 1,
        userName: 'test_user',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        emailConfirmed: true,
        roles: ['User'],
        groups: [],
        serviceProviderId: null,
        providerProfileId: 0,
        preferredLanguage: 'en',
        preferredCurrency: 'RSD',
      });
    }
    if (url.pathname === '/enums') return json(ENUMS);

    if (url.pathname === '/api/services') {
      const pageNo = Number(url.searchParams.get('Page') ?? '1');
      const perPage = Number(url.searchParams.get('PerPage') ?? String(PER_PAGE));
      // The facets sample (one row, most expensive first) is a different query, not a page of
      // the list — recording it would make the paging assertion meaningless.
      if (perPage === PER_PAGE) pagesRequested.push(pageNo);
      const items = ALL.slice((pageNo - 1) * perPage, pageNo * perPage);
      return json({
        totalItems: TOTAL,
        totalPages: Math.ceil(TOTAL / perPage),
        currentPage: pageNo,
        itemsPerPage: perPage,
        items,
      });
    }
    return json({ items: [], totalItems: 0 });
  });
}

/** Scrolls whatever element actually owns the vertical scroll to its bottom. */
async function scrollToBottom(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const scrollers = [...document.querySelectorAll<HTMLElement>('*')].filter((el) => {
      const overflowY = getComputedStyle(el).overflowY;
      return (
        (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 20
      );
    });
    if (scrollers.length === 0) {
      window.scrollTo(0, document.documentElement.scrollHeight);
      return;
    }
    const deepest = scrollers.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    deepest.scrollTop = deepest.scrollHeight;
  });
}

test.describe('browse list paging', () => {
  test('loads the next page as the reader reaches the bottom', async ({ page }) => {
    await signIn(page);
    const pagesRequested: number[] = [];
    await mockPagedServices(page, pagesRequested);
    await page.goto('/search', { waitUntil: 'networkidle' });

    // Page one, and a footer that states what is on screen out of what matched.
    await expect(page.getByText(`Showing ${PER_PAGE} of ${TOTAL}`)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Paged Service 0')).toBeVisible();

    await scrollToBottom(page);

    // The whole point: no button was pressed. The last row of the SECOND page is on screen.
    await expect(page.getByText(`Paged Service ${TOTAL - 1}`)).toBeVisible({ timeout: 20_000 });

    // And the list says it has ended rather than just stopping — `LoadMoreFooter` deliberately
    // renders nothing once everything is loaded, so "Showing 40 of 40" never exists; a list that
    // simply stopped would be indistinguishable from one that failed to fetch the next page.
    await expect(page.getByText(`You've seen all ${TOTAL} results`)).toBeVisible();

    // Exactly one extra page was fetched — not the same page over and over, which is the classic
    // failure of a scroll handler that does not gate re-entry.
    expect(pagesRequested.filter((p) => p === 2)).toHaveLength(1);
    expect(pagesRequested).toEqual([1, 2]);
  });

  test('states the search count, not the page count', async ({ page }) => {
    // The count describes the result set the SERVER matched. While filtering was done in the
    // client it described the rows that happened to be loaded, so a narrow filter reported its
    // own page size back as the number of matches.
    await signIn(page);
    await mockPagedServices(page);
    await page.goto('/search', { waitUntil: 'networkidle' });

    await expect(page.getByText(`${TOTAL} services found`)).toBeVisible({ timeout: 20_000 });
  });
});
