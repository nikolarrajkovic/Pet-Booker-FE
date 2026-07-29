import type { GeoPoint } from './geocoding';
import { haversineKm, DistanceResult } from './distance';

/**
 * Route distance between two points (NATIVE). react-native-maps exposes no
 * Directions API and the referrer-restricted web Maps key can't be used from a
 * plain REST call, so native falls back to the straight-line (great-circle)
 * distance. The web build (directions.web.ts) uses Google Directions when it
 * can. Either way the server recomputes the authoritative surcharge on create.
 */
export async function routeDistanceKm(from: GeoPoint, to: GeoPoint): Promise<DistanceResult> {
  return { km: haversineKm(from, to), source: 'straight-line' };
}
