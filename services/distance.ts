import type { GeoPoint } from './geocoding';

// Where a computed distance came from — a real driving route (Google Directions)
// or a great-circle fallback when Directions isn't available.
export type DistanceResult = { km: number; source: 'directions' | 'straight-line' };

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Great-circle (straight-line) distance in km between two lat/lng points. Used
 * as the fallback when the Google Directions route distance isn't available
 * (native, or a dev key without billing) — see services/directions(.web).ts.
 */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The distance-priced surcharge config an add-on carries (baseFee + per-km). */
export type LocationSurchargeConfig = {
  baseFee: number;
  perKmFee: number;
  freeDistanceKm?: number | null;
  maxDistanceKm?: number | null;
};

/** The itemized components behind a location-based surcharge — for a UI that
 *  explains a pickup/drop-off price (start fee + per-km charge − free-km credit). */
export type LocationSurchargeBreakdown = {
  baseFee: number; // flat "start" fee, charged regardless of distance
  perKmFee: number; // rate per billable km
  distanceKm: number; // the measured distance actually used (clamped to >= 0)
  cappedKm: number; // distance after the max-distance cap
  freeKm: number; // free distance actually applied (never more than cappedKm)
  billableKm: number; // km billed per-km = max(0, cappedKm - freeDistanceKm)
  distanceCharge: number; // perKmFee * cappedKm — the gross per-km charge before the free credit
  freeDiscount: number; // perKmFee * freeKm — the amount removed by the free distance
  total: number; // baseFee + perKmFee * billableKm (== locationSurcharge)
  capped: boolean; // true when the measured distance exceeded maxDistanceKm
};

/**
 * Itemized location-based surcharge for a given distance. Same math as
 * `locationSurcharge` (which delegates here), but returns each component so the
 * Review price breakdown can show start fee / per-km charge / free-km credit.
 *
 *   total = baseFee + perKmFee * max(0, min(distanceKm, maxDistanceKm) - freeDistanceKm)
 *         = baseFee + distanceCharge - freeDiscount
 */
export function locationSurchargeBreakdown(
  distanceKm: number | null | undefined,
  config: LocationSurchargeConfig
): LocationSurchargeBreakdown {
  const d = distanceKm != null && distanceKm > 0 ? distanceKm : 0;
  const maxKm = config.maxDistanceKm ?? null;
  const cappedKm = maxKm != null ? Math.min(d, maxKm) : d;
  const freeDistanceKm = config.freeDistanceKm ?? 0;
  const freeKm = Math.min(freeDistanceKm, cappedKm);
  const billableKm = Math.max(0, cappedKm - freeDistanceKm);
  return {
    baseFee: config.baseFee,
    perKmFee: config.perKmFee,
    distanceKm: d,
    cappedKm,
    freeKm,
    billableKm,
    distanceCharge: config.perKmFee * cappedKm,
    freeDiscount: config.perKmFee * freeKm,
    total: config.baseFee + config.perKmFee * billableKm,
    capped: maxKm != null && d > maxKm,
  };
}

/**
 * Location-based add-on surcharge for a given distance. Mirrors the server
 * formula exactly (verified live 2026-07-20):
 *
 *   baseFee + perKmFee * max(0, min(distanceKm, maxDistanceKm) - freeDistanceKm)
 *
 * - `maxDistanceKm` CAPS the billable distance (it does NOT reject the booking).
 * - a null / non-positive distance bills 0 extra km → just the base fee.
 *
 * The server recomputes this authoritatively at booking time from the single
 * `distanceKm` the client sends (applied to both pickup and drop-off); this is
 * the client-side estimate shown in the booking flow so the price matches.
 */
export function locationSurcharge(
  distanceKm: number | null | undefined,
  config: LocationSurchargeConfig
): number {
  return locationSurchargeBreakdown(distanceKm, config).total;
}
