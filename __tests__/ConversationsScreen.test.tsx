import React from 'react';
import { render, screen, act } from '@testing-library/react-native';
import { withProviders } from './test-utils';

/**
 * The inbox splice.
 *
 * A message arriving used to re-fetch fifty threads plus the unread badge — to learn what the
 * push had already handed over. The push payload IS the thread's row, shaped for the recipient
 * (verified live against the hub in the backend's e2e chat check), so the screen splices it in.
 * The test that matters is the call count: the row would look right either way.
 */

const mockGetConversations = jest.fn();
jest.mock('../services/messages', () => ({
  getConversations: (...args: unknown[]) => mockGetConversations(...args),
  ChatParticipant: { User: 0, Provider: 1 },
  ChatAccessReason: { ActiveBooking: 1 },
}));

const mockRefreshUnreadCount = jest.fn();
let inboxListener: ((c: unknown) => void) | null = null;
jest.mock('../context/MessagesContext', () => {
  const value = {
    unreadCount: 0,
    refreshUnreadCount: (...args: unknown[]) => mockRefreshUnreadCount(...args),
    subscribeToInbox: (listener: (c: unknown) => void) => {
      inboxListener = listener;
      return () => {
        inboxListener = null;
      };
    },
    subscribe: () => () => {},
    subscribeToReads: () => () => {},
    subscribeToTyping: () => () => {},
    joinThread: () => () => {},
    notifyTyping: () => {},
  };
  return { useMessages: () => value };
});

jest.mock('../context/LocaleContext', () => {
  const value = {
    t: (key: string) => key,
    tEnum: (_t: string, v: unknown) => String(v),
    language: 'en',
  };
  return { useLocale: () => value };
});

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react');
  return {
    useFocusEffect: (cb: () => void | (() => void)) => react.useEffect(cb, [cb]),
    useNavigation: () => ({ navigate: jest.fn() }),
    useRoute: () => ({ params: {} }),
  };
});

import ConversationsScreen from '../screens/messages-screen/containers/ConversationsScreen';

const thread = (id: number, name: string, preview: string, unread = 0) => ({
  id,
  userId: 9,
  serviceProviderId: 77,
  viewer: 0,
  counterpartName: name,
  counterpartAvatarUrl: null,
  serviceId: null,
  serviceName: null,
  lastMessageAt: '2026-08-13T08:00:00+00:00',
  lastMessagePreview: preview,
  lastMessageSender: 1,
  unreadCount: unread,
  access: { serviceProviderId: 77, canSendMessage: true, reason: 1 },
  createdAt: '2026-08-01T08:00:00+00:00',
});

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

describe('ConversationsScreen — a message arrives', () => {
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

  it('lists the caller’s threads on focus', async () => {
    render(withProviders(<ConversationsScreen />));
    expect(await screen.findByText('Ana')).toBeTruthy();
    expect(screen.getByText('Bojan')).toBeTruthy();
    expect(mockGetConversations).toHaveBeenCalledTimes(1);
  });

  it('splices the pushed thread in without re-listing the inbox', async () => {
    render(withProviders(<ConversationsScreen />));
    await screen.findByText('Ana');
    expect(mockGetConversations).toHaveBeenCalledTimes(1);

    // The hub pushes the recipient's view of the thread that just received a message.
    await act(async () => {
      inboxListener?.(thread(2, 'Bojan', 'one more thing', 3));
    });
    await flush();

    // The row updated from the payload — no second list call, no badge call from this screen
    // (MessagesContext re-seeds the badge off the same event).
    expect(mockGetConversations).toHaveBeenCalledTimes(1);
    expect(screen.getByText('one more thing')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy(); // the row's unread pill
  });

  it('moves the pushed thread to the top, since it is now the most recent', async () => {
    render(withProviders(<ConversationsScreen />));
    await screen.findByText('Ana');

    await act(async () => {
      inboxListener?.(thread(2, 'Bojan', 'one more thing', 1));
    });
    await flush();

    const names = screen.getAllByText(/^(Ana|Bojan)$/).map((n) => n.props.children);
    expect(names[0]).toBe('Bojan');
    // ...and it is not duplicated by the splice.
    expect(names.filter((n) => n === 'Bojan')).toHaveLength(1);
  });

  it('adds a brand-new thread the list has never seen', async () => {
    render(withProviders(<ConversationsScreen />));
    await screen.findByText('Ana');

    await act(async () => {
      inboxListener?.(thread(99, 'Nova', 'hello there', 1));
    });
    await flush();

    expect(screen.getByText('Nova')).toBeTruthy();
    expect(mockGetConversations).toHaveBeenCalledTimes(1);
  });
});
