/**
 * The query string a filtered catalogue search actually sends.
 *
 * This is pinned rather than trusted because **a wrong filter name does not fail** — the API binds
 * unknown query parameters to nothing and returns the unfiltered list with a 200, which is exactly
 * how the fixed-add-on filters (`IsProvidingPickup` and friends) went on being sent for months
 * after the backend dropped them, silently returning everything. A test on the wire format is the
 * only thing that catches it, since neither the type checker nor the response says a word.
 *
 * It drives the **real** `getServicesPage` with the transport stubbed, rather than restating the
 * mapping: a copy of the parameter table would keep passing after the table it copies changed,
 * which is the one failure this test exists to prevent.
 *
 * The names asserted below must match `ServiceSearch` on the backend
 * (`PetBooker.Implementation/DataTransfer/Search/Service/ServiceSearch.cs`).
 */

jest.mock('../services/http', () => {
  const actual = jest.requireActual('../services/http');
  return {
    ...actual,
    // Only the transport is stubbed; `buildQuery` stays real, since how it encodes a list is
    // half of what is under test.
    apiPage: jest.fn(() => Promise.resolve({ items: [] })),
    apiList: jest.fn(() => Promise.resolve([])),
    apiJson: jest.fn(() => Promise.resolve({})),
    apiVoid: jest.fn(() => Promise.resolve()),
  };
});

import { apiPage, buildQuery } from '../services/http';
import { getServicesPage, ServiceSortBy, type GetServicesParams } from '../services/services';

/** Runs the real service call and returns the query it would have put on the wire. */
async function sentQuery(params: GetServicesParams): Promise<URLSearchParams> {
  (apiPage as jest.Mock).mockClear();
  await getServicesPage(params);
  const [path, options] = (apiPage as jest.Mock).mock.calls[0];
  expect(path).toBe('/api/services');
  return new URLSearchParams(buildQuery(options.query));
}

describe('buildQuery — multi-value filters', () => {
  it('repeats the key per item, which is how ASP.NET binds a List<T>', () => {
    // Joining them (`Types=1,2`) binds to nothing and returns the unfiltered list.
    expect(buildQuery({ Types: [1, 2, 5] })).toBe('Types=1&Types=2&Types=5');
  });

  it('omits an empty array entirely rather than sending a bare key', () => {
    expect(buildQuery({ Types: [], Page: 1 })).toBe('Page=1');
  });

  it('still keeps false and 0, which are real filter values', () => {
    expect(buildQuery({ IsActive: false, Page: 0 })).toBe('IsActive=false&Page=0');
  });

  it('encodes list items that need it', () => {
    expect(buildQuery({ AdditionalServiceNames: ['Pet taxi', 'Pick up'] })).toBe(
      'AdditionalServiceNames=Pet+taxi&AdditionalServiceNames=Pick+up'
    );
  });
});

describe('the catalogue browse filters', () => {
  it('sends every filter under the name ServiceSearch binds', async () => {
    const params = await sentQuery({
      isActive: true,
      types: [1, 2],
      acceptedSpecies: 3,
      additionalServiceNames: ['Pickup'],
      minPrice: 500,
      maxPrice: 4000,
      priceCurrency: 'EUR',
      minRating: 4,
      onSaleOnly: true,
      sortBy: ServiceSortBy.PriceAsc,
      page: 2,
      perPage: 25,
    });

    expect(params.getAll('Types')).toEqual(['1', '2']);
    expect(params.get('AcceptedSpecies')).toBe('3');
    expect(params.getAll('AdditionalServiceNames')).toEqual(['Pickup']);
    expect(params.get('MinPrice')).toBe('500');
    expect(params.get('MaxPrice')).toBe('4000');
    expect(params.get('MinRating')).toBe('4');
    expect(params.get('OnSaleOnly')).toBe('true');
    expect(params.get('SortBy')).toBe(String(ServiceSortBy.PriceAsc));
    expect(params.get('Page')).toBe('2');
    expect(params.get('PerPage')).toBe('25');
  });

  it('declares the currency whenever a price bound is sent', async () => {
    // Reads are converted to the viewer's currency at the API edge, so a bound typed against
    // those numbers is in that currency. Without the declaration the server compares a EUR
    // figure against stored RSD and the search comes back all but empty.
    const params = await sentQuery({ maxPrice: 40, priceCurrency: 'EUR' });
    expect(params.get('MaxPrice')).toBe('40');
    expect(params.get('PriceCurrency')).toBe('EUR');
  });

  it('sends no filter parameters at all when nothing is narrowed', async () => {
    // An unfiltered search must not carry empty bounds — MinPrice=0 is a real filter, not "any".
    const params = await sentQuery({ isActive: true });
    for (const name of [
      'Types',
      'MinPrice',
      'MaxPrice',
      'PriceCurrency',
      'MinRating',
      'AcceptedSpecies',
      'AdditionalServiceNames',
      'OnSaleOnly',
      'SortBy',
    ]) {
      expect(params.has(name)).toBe(false);
    }
    expect(params.get('IsActive')).toBe('true');
  });

  it('drops an empty multi-select rather than sending an empty filter', async () => {
    const params = await sentQuery({ types: [], additionalServiceNames: [] });
    expect(params.has('Types')).toBe(false);
    expect(params.has('AdditionalServiceNames')).toBe(false);
  });
});
