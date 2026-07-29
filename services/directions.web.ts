import type { GeoPoint } from './geocoding';
import { haversineKm, DistanceResult } from './distance';
import { loadGoogleMaps } from './google-maps';

const DIRECTIONS_TIMEOUT_MS = 8000;

/**
 * Route distance between two points (WEB) — real DRIVING distance via the Google
 * Maps Directions service (part of the Maps JavaScript API the app already
 * loads). Falls back to the straight-line (great-circle) distance if Directions
 * is unavailable — e.g. the dev key has no billing enabled, so Directions
 * returns REQUEST_DENIED. This is the "via Google Maps directions if possible"
 * behavior: use a real route when we can, degrade gracefully otherwise. The
 * server recomputes the authoritative surcharge from the sent distance anyway.
 */
export async function routeDistanceKm(from: GeoPoint, to: GeoPoint): Promise<DistanceResult> {
  try {
    const maps = await loadGoogleMaps();
    const service = new maps.DirectionsService();
    const meters = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('directions timeout')),
        DIRECTIONS_TIMEOUT_MS
      );
      service.route(
        {
          origin: { lat: from.latitude, lng: from.longitude },
          destination: { lat: to.latitude, lng: to.longitude },
          travelMode: maps.TravelMode.DRIVING,
        },
        (result: any, status: string) => {
          clearTimeout(timer);
          const route = result?.routes?.[0];
          if (status === 'OK' && route) {
            const total = (route.legs ?? []).reduce(
              (sum: number, leg: any) => sum + (leg.distance?.value ?? 0),
              0
            );
            resolve(total);
          } else {
            reject(new Error('directions status ' + status));
          }
        }
      );
    });
    if (meters > 0) return { km: meters / 1000, source: 'directions' };
  } catch {
    // Directions unavailable (no billing / denied / timeout) → straight-line.
  }
  return { km: haversineKm(from, to), source: 'straight-line' };
}
