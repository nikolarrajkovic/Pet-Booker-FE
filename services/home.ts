import { apiList, QueryValue } from './http';
import { ServiceDto } from './services';

// Home-page sections come from dedicated backend endpoints (one per row) rather than slicing a
// single getServices list.
//
// Each returns the SAME read shape as GET /api/services (verified live 2026-08-10): the card
// fields — `price` (post-discount), `appliedDiscountType`/`appliedDiscountAmount`, `rating`,
// `totalRatingNumber`, `imageUrl`, `photos`, `currency` — plus `pricing`, `details`, `schedules`,
// `pricingOptions`, `additionalServices`, `discounts` and `address`, and `distanceFromMyLocationKm`
// on near-me. So a rail card renders from the rail alone, and BookService can be entered with the
// rail's DTO without re-fetching the service.
//
// Until 2026-08-07 the rails serialized the WRITE-shaped DTO instead, so every one of those card
// fields came back missing — a discounted service rendered its pre-discount price beside its
// "-25% OFF" badge. The consumers already read the read-shape fields; nothing here works around it.
//
// Not included (populated only on the find/search paths): `reviews`/`reviewCount` and
// `upcomingBookings`.
const DEFAULT_TAKE = 8;

function getHomeSection(path: string, query: Record<string, QueryValue>): Promise<ServiceDto[]> {
  return apiList<ServiceDto>(`/api/home/${path}`, {
    query,
    fallback: `Failed to load ${path}.`,
    context: `home/${path}`,
  });
}

/** GET /api/home/most-popular */
export const getMostPopular = (take: number = DEFAULT_TAKE) =>
  getHomeSection('most-popular', { take });

/** GET /api/home/on-sale */
export const getOnSale = (take: number = DEFAULT_TAKE) => getHomeSection('on-sale', { take });

/** GET /api/home/recently-booked (user-specific) */
export const getRecentlyBooked = (take: number = DEFAULT_TAKE) =>
  getHomeSection('recently-booked', { take });

/** GET /api/home/near-me — requires the user's coordinates. */
export const getNearMe = (params: { lat: number; lng: number; radiusKm?: number; take?: number }) =>
  getHomeSection('near-me', {
    lat: params.lat,
    lng: params.lng,
    radiusKm: params.radiusKm ?? 50,
    take: params.take ?? DEFAULT_TAKE,
  });
