import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useLocale } from '../../context/LocaleContext';
import { useMessages } from '../../context/MessagesContext';
import { getErrorMessage } from '../../services/http';
import { getConversations, type ConversationDto } from '../../services/messages';

/** Compact relative time for an inbox row ("now", "4m", "3h", "2d", then a date). */
export function relativeTime(iso?: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** The row as the open thread sees it: nothing unread, since the thread has just read it. */
function seenIfOpen(c: ConversationDto, openId: number | null): ConversationDto {
  return c.id === openId && c.unreadCount > 0 ? { ...c, unreadCount: 0 } : c;
}

export type ConversationsInbox = {
  conversations: ConversationDto[];
  isLoading: boolean;
  isRefreshing: boolean;
  loadError: string | null;
  /** Pull-to-refresh / the web refresh affordance. Keeps the rows on screen while it runs. */
  refresh: () => Promise<void>;
};

/**
 * The inbox itself — every thread the signed-in user is part of, newest first, kept live.
 *
 * A hook rather than screen state because the inbox is now drawn in two places: the phone's list
 * screen, and the right-hand column of the web design's split view (see `MessagesSplitView`). Two
 * copies of the load-plus-splice would be two chances for one of them to start refetching fifty
 * threads on a push.
 *
 * No owner parameter is sent: the backend scopes the list to the session, and merges both sides
 * for a partner (who is a customer of other providers as well as a provider themselves). It also
 * resolves the counterpart per row, so a customer sees the provider and a provider sees the
 * customer off the same field without the client knowing which side it is on.
 *
 * `openConversationId` is the thread drawn beside the list (the web split view; the phone passes
 * nothing, since its list and thread are never on screen together). That row never shows unread:
 * the open thread marks itself read on arrival and on every incoming line, but the server's
 * rows cannot know that yet — a live push carries the unread count from the moment of sending,
 * and a load can land before the thread's mark-read does — so a pill used to sit on the row the
 * user was reading, and stayed after clicking an unread row, until the next reload.
 */
export function useConversationsInbox(openConversationId?: number | null): ConversationsInbox {
  const { t } = useLocale();
  const { refreshUnreadCount, subscribeToInbox, subscribeToReconnect } = useMessages();

  const [conversations, setConversations] = useState<ConversationDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // A ref, so the load and the live splice read the thread open *now* without re-subscribing
  // (and refetching) every time the selection moves. Kept current by the effect further down.
  const openIdRef = useRef(openConversationId ?? null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      // Already ordered by activity server-side (on message id, which is monotonic), so no
      // client-side re-sort — one less place for the two to disagree.
      const page = await getConversations({ perPage: 50 });
      setConversations(page.items.map((c) => seenIfOpen(c, openIdRef.current)));
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
          seenIfOpen(updated, openIdRef.current),
          ...prev.filter((c) => c.id !== updated.id),
        ])
      ),
    [subscribeToInbox]
  );

  // The pushes that keep this list current are not replayed after the live channel was down, so
  // a row that changed in the gap would keep its old preview and pill until the next focus.
  // Rare enough that a reload is the right tool, rather than trying to patch rows.
  useEffect(() => subscribeToReconnect(() => void load()), [subscribeToReconnect, load]);

  // Opening a thread reads it, so its row stops counting the moment it is selected.
  useEffect(() => {
    openIdRef.current = openConversationId ?? null;
    if (openConversationId == null) return;
    setConversations((prev) =>
      prev.some((c) => c.id === openConversationId && c.unreadCount > 0)
        ? prev.map((c) => seenIfOpen(c, openConversationId))
        : prev
    );
  }, [openConversationId]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  return { conversations, isLoading, isRefreshing, loadError, refresh };
}
