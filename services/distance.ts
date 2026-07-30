import type { GeoPoint } from './geocoding';

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Great-circle (straight-line) distance in km between two lat/lng points.
 *
 * Display / UI use only — "has the device moved far enough to re-route the map?", "roughly how
 * far is this?". It is **not** a pricing input: booking surcharges are computed server-side from
 * a real routed distance per trip leg (see services/booking-quote.ts). This module used to also
 * hold a copy of the server's surcharge formula plus a Google Directions call, so the app could
 * estimate a price before submitting. Both are gone: the estimate drifted from the actual charge
 * (Directions only worked on web, so native priced on straight lines) and a client-measured
 * distance can't be trusted for money anyway.
 */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
