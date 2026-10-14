/**
 * A partner re-prices a request before accepting it. The amount is typed in their display currency,
 * so it must be declared — undeclared, the server reads it as RSD and stores the wrong price.
 */
import { adjustBookingPrice } from '../services/bookings';

jest.mock('../services/token-storage', () => ({
  getAccessToken: jest.fn(async () => 'h.eyJpYXQiOjB9.s'),
  getRefreshToken: jest.fn(async () => 'r'),
  saveTokens: jest.fn(),
  clearTokens: jest.fn(),
}));

describe('adjustBookingPrice', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
  });

  it('posts the service price with its currency declared', async () => {
    const fetchMock = jest.fn(async () => new Response(JSON.stringify({ id: 7, totalPrice: 19 })));
    global.fetch = fetchMock as unknown as typeof fetch;

    const updated = await adjustBookingPrice(7, 15, 'EUR');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api.test/bookings/7/adjust-price');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ basePrice: 15, currency: 'EUR' });
    expect(updated.totalPrice).toBe(19);
  });
});
