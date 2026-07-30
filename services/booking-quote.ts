import { apiAuthFetch, getApiBaseUrl, parseApiError } from './http';
import type { BookingAdditionalServiceReadDto, BookingDto } from './bookings';

/**
 * What a prospective booking would cost, straight from the server.
 *
 * This replaces the client-side price estimate the booking flow used to compute. That estimate
 * had to (a) geocode the service address, (b) measure a route, and (c) reimplement the
 * surcharge formula — and it drifted from the real charge, because Google Directions was only
 * reachable from the web bundle, so native silently priced on straight-line distance instead.
 * The distance decides the price, so the server owns both the measuring and the maths now.
 */
export type BookingQuote = {
  serviceId: number;
  pricingOptionId?: number | null;
  /** Echoed back: a pricing option derives `bookingTo` server-side, so trust these. */
  bookingFrom: string;
  bookingTo: string;
  basePrice: number;
  discountAmount: number;
  /**
   * The measured road distance of each journey, in km — what the per-distance extras below
   * were priced on. Null means that leg couldn't be measured (no address, or no resolvable
   * coordinates), which is why such an extra shows only its base fee.
   */
  pickupDistanceKm?: number | null;
  leaveOverDistanceKm?: number | null;
  /** One line per selected extra, each explaining its own charge. */
  additionalServices: BookingAdditionalServiceReadDto[];
  addOnsTotal: number;
  totalPrice: number;
  depositAmount: number;
  priceCurrency: string;
};

/**
 * Prices a booking without creating it. Takes the same body as `createBooking`, so the flow can
 * quote the exact payload it is about to submit.
 *
 * Deliberately permissive on the server side: an extra the service doesn't offer is skipped
 * rather than rejected, and schedule/capacity rules don't run — the user is still choosing.
 * Submitting the booking is what enforces those, so a successful quote is not a promise that
 * the create will succeed; it only promises the *price* will match.
 */
export async function getBookingQuote(booking: BookingDto): Promise<BookingQuote> {
  const url = `${getApiBaseUrl()}/api/bookings/quote`;
  const response = await apiAuthFetch(url, {
    method: 'POST',
    body: JSON.stringify(booking),
  });

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, 'Failed to price this booking.', 'getBookingQuote')
    );
  }

  return (await response.json()) as BookingQuote;
}
