import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useLocale } from '../context/LocaleContext';
import { useMessages } from '../context/MessagesContext';
import { getErrorMessage } from '../services/http';
import { getConversations, type ConversationDto, type MessageDto } from '../services/messages';

export type ConversationInbox = {
  conversations: ConversationDto[];
  isLoading: boolean;
  isRefreshing: boolean;
  loadError: string | null;
  /** Pull-to-refresh / manual reload — sets `isRefreshing` rather than the first-load spinner. */
  refresh: () => Promise<void>;
  /**
   * Clear a row's unread pill because its thread is open on screen.
   *
   * The thread itself is what tells the server (`markConversationRead`); this only keeps the list
   * beside it honest, since on the web design the row stays visible while it is being read.
   */
  markThreadRead: (conversationId: number) => void;
  /**
   * Reflect a message the app itself just sent into that thread's row.
   *
   * The hub's inbox ping is **recipient-only** — a user's own sends never come back — so nothing
   * else moves the row. On the phone that was invisible (the list is a screen away and reloads on
   * focus); with the list pinned beside the thread, the row you are typing in otherwise keeps
   * showing the other side's older line as the last thing said. Moving it to the front is what a
   * reload would do too: it is now the most recent thread.
   */
  noteSentMessage: (conversationId: number, message: MessageDto) => void;
  /**
   * A thread that has just been opened and read beside the list.
   *
   * It may be one the list has never seen: "Message provider" on a service page get-or-creates
   * the conversation server-side, so on the web design the pane can be showing a thread that did
   * not exist when the inbox was fetched — listed nowhere, and with no row to highlight.
   */
  noteOpenedThread: (conversation: ConversationDto) => void;
};

/**
 * The message inbox as data: every thread the signed-in user is part of, newest first.
 *
 * `openThreadId` is the thread being read beside the list, on the web design's two-pane
 * workspace — see `markThreadRead` and the splice below for what it is for. The phone inbox
 * passes nothing: there the list is never on screen at the same time as a thread.
 *
 * Lives here rather than in a screen because both designs need it — the phone's inbox screen, and
 * the web workspace's conversation column beside the open thread.
 *
 * No owner parameter is sent: the backend scopes the list to the session, and merges both sides
 * for a partner (who is a customer of other providers as well as a provider themselves). It also
 * resolves the counterpart per row, so a customer sees the provider and a provider sees the
 * customer off the same field without the client knowing which side it is on.
 */
export function useConversationInbox(openThreadId?: number | null): ConversationInbox {
  const { t } = useLocale();
  const { refreshUnreadCount, subscribeToInbox } = useMessages();

  // A ref, so a change of open thread does not tear down and rebuild the hub subscription below.
  const openThreadIdRef = useRef(openThreadId);
  openThreadIdRef.current = openThreadId;

  const [conversations, setConversations] = useState<ConversationDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      // Already ordered by activity server-side (on message id, which is monotonic), so no
      // client-side re-sort — one less place for the two to disagree.
      const page = await getConversations({ perPage: 50 });
      setConversations(page.items);
      refreshUnreadCount();
    } catch (e) {
      setConversations([]);
      setLoadError(getErrorMessage(e, t('messages.inboxLoadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [t, refreshUnreadCount]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsLoading(true);
      (async () => {
        if (!cancelled) await load();
      })();
      return () => {
        cancelled = true;
      };
    }, [load])
  );

  // A message arriving in any thread reorders the inbox — but the push carries that thread's
  // own row (the recipient's view of it, unread count included), so splice it to the front
  // instead of refetching fifty threads plus the badge to learn what we were just handed. A new
  // message always makes its thread the most recent, which is exactly where a reload would put
  // it; the badge is re-seeded by MessagesContext off the same event.
  useEffect(
    () =>
      subscribeToInbox((updated) =>
        setConversations((prev) => [
          // The push is the RECIPIENT's row, so it carries an unread count — correct for every
          // thread except the one being read this second. On the web design that thread is open
          // beside the list and the pane has already marked it read server-side, so splicing the
          // count in would light an unread pill on the row you are looking at, and leave it lit
          // until the next reload.
          updated.id === openThreadIdRef.current ? { ...updated, unreadCount: 0 } : updated,
          ...prev.filter((c) => c.id !== updated.id),
        ])
      ),
    [subscribeToInbox]
  );

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  const markThreadRead = useCallback((conversationId: number) => {
    setConversations((prev) =>
      // `prev` back unchanged when there was nothing to clear: `map` always builds a new array,
      // and a new array identity from a no-op is a re-render for every consumer — and a loop for
      // any caller that reacts to the list.
      prev.some((c) => c.id === conversationId && c.unreadCount)
        ? prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
        : prev
    );
  }, []);

  const noteSentMessage = useCallback((conversationId: number, message: MessageDto) => {
    setConversations((prev) => {
      const row = prev.find((c) => c.id === conversationId);
      if (!row) return prev;
      return [
        {
          ...row,
          lastMessagePreview: message.body,
          lastMessageAt: message.sentAt,
          lastMessageSender: message.sender,
          unreadCount: 0,
        },
        ...prev.filter((c) => c.id !== conversationId),
      ];
    });
  }, []);

  const noteOpenedThread = useCallback((conversation: ConversationDto) => {
    setConversations((prev) => {
      // Read by definition — the pane marks it read as it opens.
      const row = { ...conversation, unreadCount: 0 };
      return prev.some((c) => c.id === conversation.id)
        ? prev.map((c) => (c.id === conversation.id ? row : c))
        : [row, ...prev];
    });
  }, []);

  return {
    conversations,
    isLoading,
    isRefreshing,
    loadError,
    refresh,
    markThreadRead,
    noteSentMessage,
    noteOpenedThread,
  };
}
