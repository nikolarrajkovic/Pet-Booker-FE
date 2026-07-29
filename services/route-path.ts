import type { GeoPoint } from './geocoding';
import { haversineKm } from './distance';

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
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
      `?overview=full&geometries=geojson`;
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
