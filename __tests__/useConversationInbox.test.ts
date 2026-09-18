import { renderHook, act, waitFor } from '@testing-library/react-native';

/**
 * The inbox list, as the web design uses it.
 *
 * On the phone the list and a thread are never on screen together, so the list could be a little
 * behind and nobody saw it: opening a thread left it, and coming back reloaded it on focus. The
 * two-pane workspace pins the list beside the open thread, which turned three pieces of staleness
 * into things a user watches happen. Each one is a case below, and each is invisible in a
 * screenshot — the row looks right either way until you compare it with what was just said.
 */

const mockGetConversations = jest.fn();
jest.mock('../services/messages', () => ({
  getConversations: (...args: unknown[]) => mockGetConversations(...args),
  ChatParticipant: { User: 0, Provider: 1 },
}));

const mockRefreshUnreadCount = jest.fn();
let inboxListener: ((c: unknown) => void) | null = null;
jest.mock('../context/MessagesContext', () => {
  const value = {
    refreshUnreadCount: (...args: unknown[]) => mockRefreshUnreadCount(...args),
    subscribeToInbox: (listener: (c: unknown) => void) => {
      inboxListener = listener;
      return () => {
        inboxListener = null;
      };
    },
  };
  return { useMessages: () => value };
});

// One object, not a fresh one per render: `t` is a dependency of the hook's load, and the real
// LocaleContext memoizes its value. A mock that re-creates it every render would make the loader
// re-run forever and every test below time out — an artefact of the mock, not of the hook.
jest.mock('../context/LocaleContext', () => {
  const value = { t: (key: string) => key };
  return { useLocale: () => value };
});

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react');
  return { useFocusEffect: (cb: () => void | (() => void)) => react.useEffect(cb, [cb]) };
});

import { useConversationInbox } from '../hooks/useConversationInbox';

const thread = (id: number, name: string, preview: string, unread = 0) => ({
  id,
  userId: 9,
  serviceProviderId: 70 + id,
  viewer: 0,
  counterpartName: name,
  counterpartAvatarUrl: null,
  serviceId: null,
  serviceName: null,
  lastMessageAt: '2026-09-18T08:00:00+00:00',
  lastMessagePreview: preview,
  lastMessageSender: 1,
  unreadCount: unread,
  access: { serviceProviderId: 70 + id, canSendMessage: true, reason: 1 },
  createdAt: '2026-09-01T08:00:00+00:00',
});

const message = (conversationId: number, body: string) => ({
  id: 501,
  conversationId,
  sender: 0,
  senderUserId: 9,
  body,
  sentAt: '2026-09-18T09:30:00+00:00',
  readAt: null,
});

const rowFor = (result: { current: ReturnType<typeof useConversationInbox> }, id: number) =>
  result.current.conversations.find((c) => c.id === id);

beforeEach(() => {
  jest.clearAllMocks();
  inboxListener = null;
  mockGetConversations.mockResolvedValue({
    items: [thread(1, 'Ana', 'see you then'), thread(2, 'Bojan', 'thanks!')],
    totalItems: 2,
    totalPages: 1,
    currentPage: 1,
    itemsPerPage: 50,
    hasMore: false,
  });
});

describe('a message arriving in the thread being read', () => {
  it('does not light an unread pill on the row the reader is looking at', async () => {
    // Thread 2 is open in the pane beside the list.
    const { result } = renderHook(() => useConversationInbox(2));
    await waitFor(() => expect(result.current.conversations).toHaveLength(2));

    // The hub pings the RECIPIENT's view of the row, so it carries an unread count — correct for
    // every thread except this one, which the pane is marking read as this arrives.
    await act(async () => inboxListener?.(thread(2, 'Bojan', 'one more thing', 3)));

    expect(rowFor(result, 2)?.unreadCount).toBe(0);
    expect(rowFor(result, 2)?.lastMessagePreview).toBe('one more thing');
  });

  it('still counts it for every other thread', async () => {
    const { result } = renderHook(() => useConversationInbox(2));
    await waitFor(() => expect(result.current.conversations).toHaveLength(2));

    await act(async () => inboxListener?.(thread(1, 'Ana', 'are you there?', 4)));

    expect(rowFor(result, 1)?.unreadCount).toBe(4);
  });
});

describe('a message the user sends from the pane', () => {
  /**
   * The hub's inbox ping is recipient-only — a user's own sends never come back — so without this
   * the row beside the composer keeps showing the other side's older line as the last thing said.
   */
  it('becomes that row’s last line, and moves the thread to the top', async () => {
    const { result } = renderHook(() => useConversationInbox(2));
    await waitFor(() => expect(result.current.conversations).toHaveLength(2));

    await act(async () => {
      result.current.noteSentMessage(2, message(2, 'on my way'));
    });

    expect(result.current.conversations[0].id).toBe(2);
    expect(result.current.conversations[0].lastMessagePreview).toBe('on my way');
    expect(result.current.conversations[0].lastMessageSender).toBe(0);
    // ...and it is not duplicated by the move.
    expect(result.current.conversations.filter((c) => c.id === 2)).toHaveLength(1);
  });
});

describe('a thread opened from outside the inbox', () => {
  /**
   * "Message provider" on a service page get-or-creates the conversation server-side, so the pane
   * can be showing a thread that did not exist when this list was fetched — listed nowhere, with
   * no row to highlight.
   */
  it('is added to the list', async () => {
    const { result } = renderHook(() => useConversationInbox(null));
    await waitFor(() => expect(result.current.conversations).toHaveLength(2));

    await act(async () => {
      result.current.noteOpenedThread(thread(99, 'Wally Walks', '', 0) as never);
    });

    expect(result.current.conversations[0].counterpartName).toBe('Wally Walks');
    expect(result.current.conversations).toHaveLength(3);
  });

  it('replaces the row it already had rather than duplicating it, and reads it', async () => {
    const { result } = renderHook(() => useConversationInbox(null));
    await waitFor(() => expect(result.current.conversations).toHaveLength(2));

    await act(async () => {
      result.current.noteOpenedThread(thread(1, 'Ana', 'see you then', 5) as never);
    });

    expect(result.current.conversations).toHaveLength(2);
    expect(rowFor(result, 1)?.unreadCount).toBe(0);
  });
});

describe('marking a row read', () => {
  it('returns the same list when there was nothing to clear', async () => {
    const { result } = renderHook(() => useConversationInbox(null));
    await waitFor(() => expect(result.current.conversations).toHaveLength(2));

    const before = result.current.conversations;
    await act(async () => result.current.markThreadRead(1)); // already at 0

    // Identity, not contents: a new array from a no-op re-renders every consumer, and loops any
    // caller that reacts to the list.
    expect(result.current.conversations).toBe(before);
  });
});
