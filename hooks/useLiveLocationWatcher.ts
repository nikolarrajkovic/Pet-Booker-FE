import { useEffect, useRef, useState } from 'react';
import { HubConnection, HubConnectionState } from '@microsoft/signalr';
import {
  getLiveLocation,
  LocationPingDto,
  TrackingSessionEvent,
  TrackingSessionStatus,
} from '../services/live-location';
import {
  createLocationHubConnection,
  LOCATION_HUB_EVENTS,
  LOCATION_HUB_METHODS,
} from '../services/location-hub';
import { GeoPoint } from '../services/geocoding';

/** Cap the in-memory polyline so an hours-long walk doesn't grow unbounded. */
const MAX_TRAIL_POINTS = 500;

export type LiveWatchStatus =
  | 'idle' // no booking to watch
  | 'connecting' // hub connection being established
  | 'waiting' // subscribed, but the provider hasn't started sharing yet
  | 'live' // session active — pings flowing (or backfilled)
  | 'ended' // session closed — trail is the final route
  | 'error'; // could not connect/subscribe

export type LiveWatchState = {
  status: LiveWatchStatus;
  /** Most recent fix (marker position + heading). */
  latest: LocationPingDto | null;
  /** Chronological route so far, capped to the last MAX_TRAIL_POINTS fixes. */
  trail: GeoPoint[];
  sessionId: number | null;
};

const IDLE: LiveWatchState = { status: 'idle', latest: null, trail: [], sessionId: null };

/**
 * Owner-side live tracking: subscribes to the booking's location group on the
 * SignalR hub and mirrors the provider's position/trail into React state.
 *
 * - Initial position + missed pings come from GET /api/bookings/{id}/live-location
 *   (also re-fetched after every reconnect, replacing the trail to heal gaps).
 * - `TrackingStarted` / `TrackingEnded` flip the status without polling; subscribing
 *   is allowed before the session opens, so mounting early lands in 'waiting'.
 *
 * Pass null to disable (non-tracking service, partner mode, no booking yet).
 */
export function useLiveLocationWatcher(bookingId: number | null): LiveWatchState {
  const [state, setState] = useState<LiveWatchState>(IDLE);
  // The TrackingStarted handler re-fetches; keep one in-flight guard per mount.
  const backfillSeq = useRef(0);

  useEffect(() => {
    if (!bookingId) {
      setState(IDLE);
      return;
    }

    let cancelled = false;
    const connection: HubConnection = createLocationHubConnection();
    const safeSet = (updater: (prev: LiveWatchState) => LiveWatchState) => {
      if (!cancelled) setState(updater);
    };

    const backfill = async (fallback: LiveWatchStatus) => {
      const seq = ++backfillSeq.current;
      try {
        const snapshot = await getLiveLocation(bookingId);
        if (cancelled || seq !== backfillSeq.current) return;
        const trail = snapshot.trail
          .slice(-MAX_TRAIL_POINTS)
          .map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
        const status: LiveWatchStatus = snapshot.isActive
          ? 'live'
          : snapshot.sessionStatus === TrackingSessionStatus.Ended
            ? 'ended'
            : fallback;
        safeSet(() => ({
          status,
          latest: snapshot.latest ?? null,
          trail,
          sessionId: snapshot.sessionId ?? null,
        }));
      } catch (error) {
        if (__DEV__) console.warn('[useLiveLocationWatcher] backfill failed', error);
        // Keep whatever the hub events said; REST is only the recovery path.
        safeSet((prev) => (prev.status === 'connecting' ? { ...prev, status: fallback } : prev));
      }
    };

    connection.on(LOCATION_HUB_EVENTS.locationUpdated, (ping: LocationPingDto) => {
      if (ping.bookingId !== bookingId) return;
      safeSet((prev) => ({
        status: 'live',
        latest: ping,
        trail: [...prev.trail, { latitude: ping.latitude, longitude: ping.longitude }].slice(
          -MAX_TRAIL_POINTS,
        ),
        sessionId: ping.sessionId,
      }));
    });

    connection.on(LOCATION_HUB_EVENTS.trackingStarted, (evt: TrackingSessionEvent) => {
      if (evt.bookingId !== bookingId) return;
      safeSet((prev) => ({ ...prev, status: 'live', sessionId: evt.sessionId, trail: [] }));
      void backfill('live');
    });

    connection.on(LOCATION_HUB_EVENTS.trackingEnded, (evt: TrackingSessionEvent) => {
      if (evt.bookingId !== bookingId) return;
      safeSet((prev) => ({ ...prev, status: 'ended' }));
    });

    connection.onreconnected(async () => {
      try {
        await connection.invoke(LOCATION_HUB_METHODS.subscribe, bookingId);
        await backfill('waiting');
      } catch (error) {
        if (__DEV__) console.warn('[useLiveLocationWatcher] resubscribe failed', error);
        safeSet((prev) => ({ ...prev, status: 'error' }));
      }
    });

    (async () => {
      setState({ ...IDLE, status: 'connecting' });
      try {
        await connection.start();
        await connection.invoke(LOCATION_HUB_METHODS.subscribe, bookingId);
        await backfill('waiting');
      } catch (error) {
        if (__DEV__) console.warn('[useLiveLocationWatcher] connect/subscribe failed', error);
        safeSet((prev) => ({ ...prev, status: 'error' }));
      }
    })();

    return () => {
      cancelled = true;
      const teardown = async () => {
        try {
          if (connection.state === HubConnectionState.Connected) {
            await connection.invoke(LOCATION_HUB_METHODS.unsubscribe, bookingId);
          }
        } catch {
          // Best effort — stopping the connection drops the group membership anyway.
        }
        await connection.stop().catch(() => {});
      };
      void teardown();
    };
  }, [bookingId]);

  return state;
}
