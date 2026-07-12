import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { AppNotificationDto, getUnreadNotificationCount } from '../services/app-notifications';
import {
  createNotificationHubConnection,
  NOTIFICATION_RECEIVED,
} from '../services/notification-hub';

type Listener = (notification: AppNotificationDto) => void;

type NotificationsContextValue = {
  /** Live unread badge count (REST-seeded, bumped by SignalR pushes). */
  unreadCount: number;
  /** Re-reads the unread count from the API (e.g. after marking rows read). */
  refreshUnreadCount: () => void;
  /** Subscribe to live NotificationReceived pushes; returns an unsubscribe fn. */
  subscribe: (listener: Listener) => () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

/**
 * Real-time user notifications over the backend's SignalR notification hub
 * (/hubs/notifications). One app-wide connection lives here for the whole
 * session: the server auto-joins the caller's `user:{id}` group on connect, and
 * every in-app notification it persists is also pushed as `NotificationReceived`
 * (same shape as the REST feed). The provider keeps the bell badge live, shows a
 * toast on arrival, and fans the payload out to subscribed screens (the inbox
 * prepends it without refetching). REST stays the source of truth — the count is
 * re-seeded from the API on login and reconnect, so a missed push self-heals.
 */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const { showInfo } = useToast();
  const [unreadCount, setUnreadCount] = useState(0);
  const listenersRef = useRef<Set<Listener>>(new Set());
  const userId = currentUser?.id ?? null;

  const refreshUnreadCount = useCallback(() => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }
    getUnreadNotificationCount(userId)
      .then(setUnreadCount)
      .catch(() => {});
  }, [userId]);

  const subscribe = useCallback((listener: Listener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    let cancelled = false;
    refreshUnreadCount();

    const connection = createNotificationHubConnection();
    connection.on(NOTIFICATION_RECEIVED, (notification: AppNotificationDto) => {
      if (cancelled) return;
      if (!notification.isRead) setUnreadCount((count) => count + 1);
      if (notification.title) showInfo(notification.title);
      listenersRef.current.forEach((listener) => listener(notification));
    });
    // Pushes sent while we were offline are lost — the REST count self-heals.
    connection.onreconnected(() => {
      if (!cancelled) refreshUnreadCount();
    });
    connection.start().catch((error) => {
      // Non-fatal: the app falls back to the polled REST feed.
      if (__DEV__) console.warn('[Notifications] hub connect failed', error);
    });

    return () => {
      cancelled = true;
      connection.stop().catch(() => {});
    };
  }, [userId, refreshUnreadCount, showInfo]);

  const value = useMemo(
    () => ({ unreadCount, refreshUnreadCount, subscribe }),
    [unreadCount, refreshUnreadCount, subscribe]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}
