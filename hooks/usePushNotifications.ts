import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../context/AuthContext';
import {
  configureForegroundNotifications,
  registerPushDevice,
  unregisterPushDevice,
} from '../services/push-registration';
import { followNotificationRoute, routeForNotificationData } from '../navigation/notificationRoute';

/**
 * Device push, end to end: registers this device while signed in, retires it on sign-out, and
 * routes a tapped notification to the screen it is about.
 *
 * Mounted once from App, next to the navigation container — routing a tap needs the navigator,
 * and a cold start from a notification arrives before any screen exists, so the ref has to be
 * the app-level one rather than a screen's own hook.
 */
export function usePushNotifications(navReady: boolean): void {
  const { currentUser } = useAuth();
  // A ProviderProfile session has no Domain.User, so it has no devices to register — the
  // backend only pushes to users. Keyed off the same id the registration writes.
  const userId = currentUser?.id ?? null;
  const registeredForRef = useRef<number | null>(null);

  useEffect(() => {
    configureForegroundNotifications();
  }, []);

  // Register on sign-in, retire on sign-out. Runs on every launch while signed in, which is
  // deliberate: Expo reissues tokens, and an upsert on deviceId makes a repeat call cheap.
  useEffect(() => {
    if (userId == null) return;
    if (registeredForRef.current === userId) return;
    registeredForRef.current = userId;
    registerPushDevice(userId);
  }, [userId]);

  useEffect(() => {
    // Capture the id that was registered; by the time the cleanup runs, currentUser is already
    // null and the row could not be found.
    const previous = registeredForRef.current;
    if (userId != null || previous == null) return;
    registeredForRef.current = null;
    unregisterPushDevice(previous);
  }, [userId]);

  // A tap is the only interaction worth routing. Foreground arrivals are left alone: the badge
  // and the live SignalR push already update the UI, and yanking someone out of what they are
  // doing because a message landed would be hostile.
  useEffect(() => {
    if (!navReady) return;

    // Where a tap leads is defined once, in navigation/notificationRoute, and shared with the
    // in-app toast — so the same notification lands in the same place whether the app was open.
    const navigate = (data: Record<string, unknown> | undefined) => {
      if (!data) return;
      followNotificationRoute(routeForNotificationData(data));
    };

    // A notification that launched the app from cold is not delivered as an event — it is
    // waiting in the "last response" slot, and is missed entirely without this read.
    let cancelled = false;
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (cancelled || !response) return;
        navigate(response.notification.request.content.data as Record<string, unknown>);
      })
      .catch(() => {});

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      navigate(response.notification.request.content.data as Record<string, unknown>);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [navReady]);
}
