import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { HubConnectionState, type HubConnection } from '@microsoft/signalr';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { getUnreadMessageCount, type ConversationDto, type MessageDto } from '../services/messages';
import {
  createMessageHubConnection,
  CONVERSATION_READ,
  INBOX_UPDATED,
  MESSAGE_RECEIVED,
  TYPING_CHANGED,
  sendTyping,
  subscribeToConversation,
  unsubscribeFromConversation,
  type ConversationReadEvent,
  type TypingEvent,
} from '../services/message-hub';
import { followNotificationRoute } from '../navigation/notificationRoute';

type MessageListener = (message: MessageDto) => void;
type ReadListener = (event: ConversationReadEvent) => void;
type TypingListener = (event: TypingEvent) => void;
type InboxListener = (conversation: ConversationDto) => void;

type MessagesContextValue = {
  /** Total unread across every thread — the badge number. */
  unreadCount: number;
  /** Re-reads the count from the API (after opening a thread, on focus). */
  refreshUnreadCount: () => void;
  /** Live incoming messages for subscribed threads; returns an unsubscribe fn. */
  subscribe: (listener: MessageListener) => () => void;
  /** The other party read a thread — flips outgoing ticks to "read". */
  subscribeToReads: (listener: ReadListener) => () => void;
  /** The other party is typing. */
  subscribeToTyping: (listener: TypingListener) => () => void;
  /** Any thread of the caller's got a new message — the inbox list refreshes off this. */
  subscribeToInbox: (listener: InboxListener) => () => void;
  /**
   * Joins a thread's live group for as long as the screen is mounted. Messages only arrive on
   * `subscribe` for threads joined this way — the identity channel carries the badge, not the
   * message bodies.
   */
  joinThread: (conversationId: number) => () => void;
  /** Fire-and-forget typing indicator. */
  notifyTyping: (conversationId: number, isTyping: boolean) => void;
  /**
   * Marks a thread as the one on screen for as long as the caller holds it, so an arriving
   * message doesn't toast the conversation the user is already reading. Returns a release fn.
   */
  claimActiveConversation: (conversationId: number) => () => void;
};

const MessagesContext = createContext<MessagesContextValue | undefined>(undefined);

/**
 * Real-time direct messages over the backend's SignalR chat hub (/hubs/chat).
 *
 * Deliberately a near-copy of NotificationsContext: one app-wide connection for the session, an
 * unread count seeded from REST (so a push missed while offline self-heals on reconnect), and a
 * listener set so an open thread appends live instead of refetching. Keeping the two providers
 * structurally identical means the hub plumbing has one shape to reason about, not two.
 *
 * The chat screen deliberately does NOT open its own connection — a thread is just another
 * subscriber here, so switching threads costs nothing and background threads still bump the
 * badge. It does have to *join* the thread's group (`joinThread`), because message bodies go to
 * the conversation group while only the badge ping goes to the identity channel.
 */
export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const { showInfo } = useToast();
  const [unreadCount, setUnreadCount] = useState(0);
  const messageListenersRef = useRef<Set<MessageListener>>(new Set());
  const readListenersRef = useRef<Set<ReadListener>>(new Set());
  const typingListenersRef = useRef<Set<TypingListener>>(new Set());
  const inboxListenersRef = useRef<Set<InboxListener>>(new Set());
  const connectionRef = useRef<HubConnection | null>(null);
  const fetchingCountRef = useRef(false);
  const activeConversationRef = useRef<number | null>(null);
  /** Threads currently open on screen, by id → how many screens hold them. */
  const joinedThreadsRef = useRef<Map<number, number>>(new Map());

  // A ProviderProfile account has no Domain.User, so `id` can be absent while the session is
  // perfectly valid — key the connection off either identity.
  const userId = currentUser?.id ?? null;
  const providerId = currentUser?.serviceProviderId ?? null;
  const sessionKey = userId ?? (providerId ? `sp:${providerId}` : null);

  const refreshUnreadCount = useCallback(() => {
    if (!sessionKey) {
      setUnreadCount(0);
      return;
    }
    // Collapse the burst that happens when the provider seeds and a screen focuses at once.
    if (fetchingCountRef.current) return;
    fetchingCountRef.current = true;
    // One indexed call, self-scoped server-side — a partner's badge already covers both the
    // threads they hold as a provider and the ones they hold as a customer.
    getUnreadMessageCount()
      .then(setUnreadCount)
      .catch(() => {})
      .finally(() => {
        fetchingCountRef.current = false;
      });
  }, [sessionKey]);

  /**
   * The in-app announcement of a new message: a toast that opens the thread when tapped.
   *
   * It is raised HERE, off the chat hub, rather than from the notification feed — verified
   * against the live backend, which does not file an app-notification for a message while the
   * recipient is connected to the chat hub (sensibly: they are already being told). Driving the
   * toast off the notification push therefore meant it only ever appeared for the first message
   * of a thread received while the app was closed — i.e. almost never, and never in the case the
   * user actually cares about. The inbox ping is the one event that reliably fires for the
   * recipient of every message.
   *
   * The text matches the notification feed's wording, so on the rare occasion both arrive, the
   * toast host's identical-message de-duplication collapses them into one.
   */
  const showMessageToast = useCallback(
    (conversation: ConversationDto) => {
      // No unread means this ping was a read-receipt or a send of the user's own, not an arrival.
      if (!conversation?.id || conversation.unreadCount < 1) return;
      // Don't announce the conversation the user is already reading.
      if (activeConversationRef.current === conversation.id) return;

      const preview = conversation.lastMessagePreview?.trim();
      if (!preview) return;
      const sender = conversation.counterpartName?.trim();
      showInfo(sender ? `${sender}: ${preview}` : preview, {
        onPress: () =>
          followNotificationRoute([
            { name: 'Messages' },
            { name: 'Chat', params: { conversationId: conversation.id } },
          ]),
      });
    },
    [showInfo]
  );

  const claimActiveConversation = useCallback((conversationId: number) => {
    activeConversationRef.current = conversationId;
    return () => {
      // Release only if we still hold the claim. Two chat screens overlap more often than it
      // looks — a params change remounts the screen, and React re-runs effects in development —
      // and a plain `= null` let the OUTGOING screen's cleanup, which runs after the incoming
      // one's setup, wipe the claim that had just been made. The thread then toasted itself
      // while the user sat reading it, which is precisely what this exists to prevent.
      if (activeConversationRef.current === conversationId) activeConversationRef.current = null;
    };
  }, []);

  // Four near-identical subscribe fns, written out rather than generated by a helper: a
  // factory-produced callback has dependencies the exhaustive-deps rule cannot see, and these
  // are the identities every consumer's effect keys on — they must stay stable.
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

  const subscribeToTyping = useCallback((listener: TypingListener) => {
    typingListenersRef.current.add(listener);
    return () => {
      typingListenersRef.current.delete(listener);
    };
  }, []);

  const subscribeToInbox = useCallback((listener: InboxListener) => {
    inboxListenersRef.current.add(listener);
    return () => {
      inboxListenersRef.current.delete(listener);
    };
  }, []);

  /**
   * Joins the thread's group if the socket is up. Silent when it isn't — `rejoinOpenThreads`
   * below covers that case once the connection reports Connected.
   */
  const joinIfConnected = useCallback((conversationId: number) => {
    const connection = connectionRef.current;
    // The state check is the point: `invoke` on a connection that is still negotiating throws,
    // and the old code called it anyway and swallowed the rejection.
    if (!connection || connection.state !== HubConnectionState.Connected) return;
    // Rejected for a non-participant — non-fatal: REST still loads and sends.
    subscribeToConversation(connection, conversationId).catch(() => {});
  }, []);

  /**
   * Opens a thread's live group, and REMEMBERS that it is open.
   *
   * The membership has to outlive the moment it was asked for. A screen mounts before the hub
   * has finished negotiating — always, on a cold start or a deep link — so the join fired into
   * a connection that wasn't up yet and was dropped with nothing to retry it. The thread then
   * never received `ChatMessageReceived` at all: an open chat sat there showing nothing while
   * new messages arrived, visible only as a badge and a toast. The same gap reopens on every
   * reconnect, which is why the connect path replays this map rather than joining once.
   *
   * Counted rather than a plain set: the screen remounts on a params change, so the outgoing
   * instance's release runs after the incoming one's join and would otherwise leave the group
   * that is still being watched.
   */
  const joinThread = useCallback(
    (conversationId: number) => {
      const held = joinedThreadsRef.current.get(conversationId) ?? 0;
      joinedThreadsRef.current.set(conversationId, held + 1);
      if (held === 0) joinIfConnected(conversationId);

      return () => {
        const remaining = (joinedThreadsRef.current.get(conversationId) ?? 1) - 1;
        if (remaining > 0) {
          joinedThreadsRef.current.set(conversationId, remaining);
          return;
        }
        joinedThreadsRef.current.delete(conversationId);
        const connection = connectionRef.current;
        if (connection?.state === HubConnectionState.Connected) {
          unsubscribeFromConversation(connection, conversationId).catch(() => {});
        }
      };
    },
    [joinIfConnected]
  );

  const notifyTyping = useCallback((conversationId: number, isTyping: boolean) => {
    const connection = connectionRef.current;
    if (connection) sendTyping(connection, conversationId, isTyping).catch(() => {});
  }, []);

  useEffect(() => {
    if (!sessionKey) {
      setUnreadCount(0);
      return;
    }

    let cancelled = false;
    refreshUnreadCount();

    const connection = createMessageHubConnection();
    connectionRef.current = connection;

    connection.on(MESSAGE_RECEIVED, (message: MessageDto) => {
      if (cancelled) return;
      // Not used for the badge: this fires for everyone in the thread group, the sender
      // included. The recipient-only INBOX_UPDATED below is what counts.
      messageListenersRef.current.forEach((listener) => listener(message));
    });

    connection.on(INBOX_UPDATED, (conversation: ConversationDto) => {
      if (cancelled) return;
      // Recipient-only by construction (the server pings the other party's identity group), so
      // this cannot double-count a user's own sends the way a message echo would. Re-read
      // rather than increment: one indexed call, and it self-heals any drift.
      refreshUnreadCount();
      inboxListenersRef.current.forEach((listener) => listener(conversation));
      showMessageToast(conversation);
    });

    connection.on(CONVERSATION_READ, (event: ConversationReadEvent) => {
      if (cancelled) return;
      readListenersRef.current.forEach((listener) => listener(event));
    });

    connection.on(TYPING_CHANGED, (event: TypingEvent) => {
      if (cancelled) return;
      typingListenersRef.current.forEach((listener) => listener(event));
    });

    // Group membership does not survive a new socket, so every thread a screen is holding has
    // to be re-joined — both when this connection first comes up (screens mount long before
    // it does) and after any reconnect. Without the replay an open chat receives nothing.
    const rejoinOpenThreads = () => {
      joinedThreadsRef.current.forEach((_held, conversationId) => joinIfConnected(conversationId));
    };

    // Anything pushed while disconnected is lost — the REST count is the source of truth.
    connection.onreconnected(() => {
      if (cancelled) return;
      refreshUnreadCount();
      rejoinOpenThreads();
    });

    connection
      .start()
      .then(() => {
        if (!cancelled) rejoinOpenThreads();
      })
      .catch((error) => {
        // Non-fatal: messages still send and load over REST, they just don't arrive live.
        if (__DEV__) console.warn('[Messages] hub connect failed', error);
      });

    return () => {
      cancelled = true;
      connectionRef.current = null;
      connection.stop().catch(() => {});
    };
  }, [sessionKey, refreshUnreadCount, showMessageToast, joinIfConnected]);

  const value = useMemo(
    () => ({
      unreadCount,
      refreshUnreadCount,
      subscribe,
      subscribeToReads,
      subscribeToTyping,
      subscribeToInbox,
      joinThread,
      notifyTyping,
      claimActiveConversation,
    }),
    [
      unreadCount,
      refreshUnreadCount,
      subscribe,
      subscribeToReads,
      subscribeToTyping,
      subscribeToInbox,
      joinThread,
      notifyTyping,
      claimActiveConversation,
    ]
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
