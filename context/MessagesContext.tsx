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
import { getUnreadMessageCount, type MessageDto } from '../services/messages';
import {
  createMessageHubConnection,
  CONVERSATION_READ,
  MESSAGE_RECEIVED,
  type ConversationReadEvent,
} from '../services/message-hub';

type MessageListener = (message: MessageDto) => void;
type ReadListener = (event: ConversationReadEvent) => void;

type MessagesContextValue = {
  /** Total unread across every thread — the badge number. */
  unreadCount: number;
  /** Re-reads the count from the API (after opening a thread, on focus). */
  refreshUnreadCount: () => void;
  /** Live incoming messages; returns an unsubscribe fn. */
  subscribe: (listener: MessageListener) => () => void;
  /** The other party read a thread — flips outgoing ticks to "read". */
  subscribeToReads: (listener: ReadListener) => () => void;
};

const MessagesContext = createContext<MessagesContextValue | undefined>(undefined);

/**
 * Real-time direct messages over the backend's SignalR message hub (/hubs/messages).
 *
 * Deliberately a near-copy of NotificationsContext: one app-wide connection for the session, an
 * unread count seeded from REST (so a push missed while offline self-heals on reconnect), and a
 * listener set so an open thread appends live instead of refetching. Keeping the two providers
 * structurally identical means the hub plumbing has one shape to reason about, not two.
 *
 * The chat screen deliberately does NOT open its own connection — a thread is just another
 * subscriber here, so switching threads costs nothing and background threads still bump the badge.
 */
export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const messageListenersRef = useRef<Set<MessageListener>>(new Set());
  const readListenersRef = useRef<Set<ReadListener>>(new Set());
  const fetchingCountRef = useRef(false);

  const userId = currentUser?.id ?? null;
  const providerId = currentUser?.serviceProviderId || null;

  const refreshUnreadCount = useCallback(() => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }
    // Collapse the burst that happens when the provider seeds and a screen focuses at once.
    if (fetchingCountRef.current) return;
    fetchingCountRef.current = true;
    // A partner is both a customer and a provider, so their badge covers both inboxes.
    getUnreadMessageCount(providerId ? { serviceProviderId: providerId } : { userId })
      .then(setUnreadCount)
      .catch(() => {})
      .finally(() => {
        fetchingCountRef.current = false;
      });
  }, [userId, providerId]);

  const subscribe = useCallback((listener: MessageListener) => {
    messageListenersRef.current.add(listener);
    return () => {
      messageListenersRef.current.delete(listener);
    };
  }, []);

  const subscribeToReads = useCallback((listener: ReadListener) => {
    readListenersRef.current.add(listener);
    return () => {
      readListenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    let cancelled = false;
    refreshUnreadCount();

    const connection = createMessageHubConnection();

    connection.on(MESSAGE_RECEIVED, (message: MessageDto) => {
      if (cancelled) return;
      // The hub echoes a user's own messages back so their other devices stay in sync — those
      // must not bump the badge, and the open thread de-dupes them by id.
      if (message.senderUserId !== userId) setUnreadCount((count) => count + 1);
      messageListenersRef.current.forEach((listener) => listener(message));
    });

    connection.on(CONVERSATION_READ, (event: ConversationReadEvent) => {
      if (cancelled) return;
      readListenersRef.current.forEach((listener) => listener(event));
    });

    // Anything pushed while disconnected is lost — the REST count is the source of truth.
    connection.onreconnected(() => {
      if (!cancelled) refreshUnreadCount();
    });

    connection.start().catch((error) => {
      // Non-fatal: messages still send and load over REST, they just don't arrive live.
      if (__DEV__) console.warn('[Messages] hub connect failed', error);
    });

    return () => {
      cancelled = true;
      connection.stop().catch(() => {});
    };
  }, [userId, refreshUnreadCount]);

  const value = useMemo(
    () => ({ unreadCount, refreshUnreadCount, subscribe, subscribeToReads }),
    [unreadCount, refreshUnreadCount, subscribe, subscribeToReads]
  );

  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>;
}

export function useMessages(): MessagesContextValue {
  const context = useContext(MessagesContext);
  if (!context) {
    throw new Error('useMessages must be used within a MessagesProvider');
  }
  return context;
}
