import type { GeoPoint } from './geocoding';
import { haversineKm } from './distance';

/**
 * The public OSRM demo router. Defined once — it was typed into three files. It is a free,
 * rate-limited demo server with no uptime promise, fine for drawing a display polyline and never
 * a pricing input; swapping it for a hosted router is a change to this line.
 */
export const OSRM_ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving/';

/** OSRM request URL for a driving route with a GeoJSON polyline. */
export function osrmRouteUrl(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): string {
  return (
    `${OSRM_ROUTE_URL}${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
    `?overview=full&geometries=geojson`
  );
}

/**
 * Universal Google Maps turn-by-turn link: opens the maps app on a device, the site on web, with
 * the current position as the origin. Also typed out in three places before.
 */
export function googleDirectionsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
}

export type RoutePath = {
  coords: GeoPoint[];
  km: number;
  /** Estimated drive time in minutes; null on the straight-line fallback. */
  mins: number | null;
};

/**
 * Best-effort driving route between two points from the public OSRM demo server
 * (no API key required — fine for this app's scale). Returns the route polyline
 * plus its distance, or a straight-line fallback (`coords: [from, to]`) when OSRM
 * is unavailable. Never throws — callers just draw whatever `coords` come back.
 *
 * Shared by the live-session directions map (native + web) so the OSRM/fallback
 * logic lives in one place instead of being duplicated per platform.
 */
export async function fetchRoutePath(from: GeoPoint, to: GeoPoint): Promise<RoutePath> {
  try {
    const url = osrmRouteUrl(from, to);
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const r = data?.routes?.[0];
      if (r?.geometry?.coordinates?.length) {
        const coords: GeoPoint[] = r.geometry.coordinates.map(([lng, lat]: [number, number]) => ({
          latitude: lat,
          longitude: lng,
        }));
        return { coords, km: r.distance / 1000, mins: r.duration / 60 };
      }
    }
  } catch {
    // OSRM unreachable / rate-limited — fall through to the straight line.
  }
  // No route means no meaningful drive time — a great-circle ETA would be a lie.
  return { coords: [from, to], km: haversineKm(from, to), mins: null };
}
