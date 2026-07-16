import { apiAuthFetch, getApiBaseUrl, parseApiError, extractPageItems } from './http';
import { ServiceDto } from './services';

// Home-page sections come from dedicated backend endpoints (one per row) rather
// than slicing a single getServices list. Each returns a (leaner) ServiceDto[]:
// `serviceProviderId`/`name`/`type`/`pricing`/`details`/`photos`/`id` +
// `distanceFromMyLocationKm` (no precomputed rating/price/imageUrl/discount).
const DEFAULT_TAKE = 8;

async function getHomeSection(
  path: string,
  params: Record<string, string | number | undefined>
): Promise<ServiceDto[]> {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) query.set(k, String(v));
  }
  const url = `${getApiBaseUrl()}/api/home/${path}?${query.toString()}`;
  const response = await apiAuthFetch(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(await parseApiError(response, `Failed to load ${path}.`, `home/${path}`));
  }
  return extractPageItems<ServiceDto>(await response.json());
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
