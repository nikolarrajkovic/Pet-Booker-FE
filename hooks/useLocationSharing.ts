import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { HubConnection, HubConnectionState } from '@microsoft/signalr';
import { LocationPingInput } from '../services/live-location';
import { createLocationHubConnection, LOCATION_HUB_METHODS } from '../services/location-hub';

export type SharingState = {
  /** True while the GPS watcher is running and the hub connection is up. */
  isSharing: boolean;
  error: string | null;
  /** Epoch ms of the last successfully pushed ping (null before the first). */
  lastSentAt: number | null;
};

const IDLE: SharingState = { isSharing: false, error: null, lastSentAt: null };

type PositionFix = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  /** m/s, negative = unknown (both expo-location and the web API). */
  speed: number | null;
  timestamp: number;
};

/**
 * Partner-side live tracking: watches the device GPS and streams each fix to the
 * SignalR hub's PushLocation while the booking's tracking session is active.
 *
 * Foreground-only — no background-location permission is configured, so sharing
 * pauses when the app is backgrounded (owners recover via the REST trail).
 * The server throttles stationary bursts (<2 s AND <10 m dropped), so pushing
 * every fix is fine. Pass null to disable (stops the watcher + connection).
 */
export function useLocationSharing(bookingId: number | null): SharingState {
  const [state, setState] = useState<SharingState>(IDLE);

  useEffect(() => {
    if (!bookingId) {
      setState(IDLE);
      return;
    }

    let cancelled = false;
    let connection: HubConnection | null = null;
    let removeWatcher: (() => void) | null = null;

    const safeSet = (updater: (prev: SharingState) => SharingState) => {
      if (!cancelled) setState(updater);
    };

    const push = async (fix: PositionFix) => {
      if (!connection || connection.state !== HubConnectionState.Connected) return;
      const input: LocationPingInput = {
        bookingId,
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracyMeters: fix.accuracy ?? null,
        heading: fix.heading != null && fix.heading >= 0 ? fix.heading : null,
        speedKph: fix.speed != null && fix.speed >= 0 ? fix.speed * 3.6 : null,
        // A true instant — the server drops out-of-order timestamps.
        recordedAt: new Date(fix.timestamp).toISOString(),
      };
      try {
        await connection.invoke(LOCATION_HUB_METHODS.pushLocation, input);
        safeSet((prev) => ({ ...prev, error: null, lastSentAt: Date.now() }));
      } catch (error) {
        // "No active tracking session" right after start-service just means the
        // session hasn't opened yet — surface it but keep watching; the next fix
        // usually lands. Server-side throttling resolves normally (no throw).
        if (__DEV__) console.warn('[useLocationSharing] push failed', error);
        safeSet((prev) => ({ ...prev, error: 'Location update not delivered.' }));
      }
    };

    // Returns the watcher's cleanup fn, or null when watching couldn't start
    // (missing capability / permission denied — the error state is already set).
    const startWatching = async (): Promise<(() => void) | null> => {
      if (Platform.OS === 'web') {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          safeSet(() => ({ ...IDLE, error: 'Location is not available on this device.' }));
          return null;
        }
        const watchId = navigator.geolocation.watchPosition(
          (p) =>
            void push({
              latitude: p.coords.latitude,
              longitude: p.coords.longitude,
              accuracy: p.coords.accuracy ?? null,
              heading: p.coords.heading,
              speed: p.coords.speed,
              timestamp: p.timestamp,
            }),
          () => safeSet((prev) => ({ ...prev, error: 'Location permission was denied.' })),
          { enableHighAccuracy: true, maximumAge: 0 }
        );
        return () => navigator.geolocation.clearWatch(watchId);
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        safeSet(() => ({ ...IDLE, error: 'Location permission was denied.' }));
        return null;
      }
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        (p) =>
          void push({
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
            accuracy: p.coords.accuracy ?? null,
            heading: p.coords.heading,
            speed: p.coords.speed,
            timestamp: p.timestamp,
          })
      );
      return () => subscription.remove();
    };

    (async () => {
      try {
        connection = createLocationHubConnection();
        await connection.start();
        if (cancelled) return;
        const stopWatching = await startWatching();
        removeWatcher = stopWatching;
        if (cancelled) {
          // Unmounted while the watcher was being set up — don't leak it.
          stopWatching?.();
          return;
        }
        if (stopWatching) safeSet((prev) => ({ ...prev, isSharing: true }));
      } catch (error) {
        if (__DEV__) console.warn('[useLocationSharing] start failed', error);
        safeSet(() => ({ ...IDLE, error: 'Could not start live location sharing.' }));
      }
    })();

    return () => {
      cancelled = true;
      removeWatcher?.();
      connection?.stop().catch(() => {});
      setState(IDLE);
    };
  }, [bookingId]);

  return state;
}
