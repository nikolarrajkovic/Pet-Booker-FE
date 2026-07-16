import { apiAuthFetch, getApiBaseUrl, parseApiError } from './http';

/**
 * Live GPS tracking wire types + REST fallback for a booking's location stream.
 *
 * Real-time updates arrive over the SignalR location hub (see location-hub.ts);
 * `getLiveLocation` is the reconnect/initial-position source of truth: call it on
 * mount and again after every hub reconnect to backfill missed pings.
 */

/** One GPS fix, as broadcast on `LocationUpdated` and returned in the REST trail. */
export type LocationPingDto = {
  bookingId: number;
  sessionId: number;
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  heading?: number | null;
  speedKph?: number | null;
  /**
   * ISO 8601 instant (device clock, UTC offset included). This is a *real* point in
   * time — never parse/format it with the naive wall-clock booking date helpers
   * (`parseBookingDate` etc.). The server drops out-of-order timestamps.
   */
  recordedAt: string;
};

/** Payload of the `TrackingStarted` / `TrackingEnded` hub events. */
export type TrackingSessionEvent = { bookingId: number; sessionId: number };

/** Mirrors Domain.TrackingSessionStatus. */
export const TrackingSessionStatus = { Active: 0, Ended: 1 } as const;

/** Response of GET /api/bookings/{id}/live-location. */
export type LiveLocationDto = {
  bookingId: number;
  sessionId?: number | null;
  sessionStatus?: number | null;
  isActive: boolean;
  latest?: LocationPingDto | null;
  /** Last 200 pings of the session, chronological (latest = last element). */
  trail: LocationPingDto[];
};

/** Client → `PushLocation` hub method input. */
export type LocationPingInput = {
  bookingId: number;
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  heading?: number | null;
  speedKph?: number | null;
  /** ISO instant of the fix: `new Date(position.timestamp).toISOString()`. */
  recordedAt: string;
};

/**
 * Latest position + trail for a booking's tracking session (active session if one
 * is open, else the most recent ended one). Owner / provider / admin only.
 */
export async function getLiveLocation(bookingId: number): Promise<LiveLocationDto> {
  const response = await apiAuthFetch(`${getApiBaseUrl()}/api/bookings/${bookingId}/live-location`);
  if (!response.ok) {
    throw new Error(
      await parseApiError(response, 'Could not load the live location.', 'getLiveLocation')
    );
  }
  return (await response.json()) as LiveLocationDto;
}
