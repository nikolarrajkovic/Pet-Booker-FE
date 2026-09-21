import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { withProviders, setViewport } from '../test-utils';

/**
 * Messages is the one screen whose two designs are structurally different: a list that pushes a
 * thread on a phone, a list *beside* the thread on a wide window.
 *
 * What is worth pinning is not the geometry but the two decisions that make the wide layout
 * usable, both of which fail silently:
 *
 *  - the thread is **preselected** — a two-pane messenger that opens with an empty right half
 *    spends two thirds of the window asking the user to click before it will show them anything;
 *  - clicking a row **loads that thread in place** rather than navigating, which is the whole
 *    reason the list is still on screen.
 *
 * And the phone must keep pushing: the inbox row navigating in place at 390px would leave the
 * thread with nowhere to be.
 */

const mockGetConversations = jest.fn();
const mockGetConversation = jest.fn();
const mockGetMessagesPage = jest.fn();

jest.mock('../../services/messages', () => ({
  getConversations: (...a: unknown[]) => mockGetConversations(...a),
  getConversation: (...a: unknown[]) => mockGetConversation(...a),
  getMessagesPage: (...a: unknown[]) => mockGetMessagesPage(...a),
  markConversationRead: () => Promise.resolve(),
  openConversation: () => Promise.resolve(null),
  openBookingConversation: () => Promise.resolve(null),
  sendMessage: () => Promise.resolve(null),
  ChatParticipant: { User: 0, Provider: 1 },
  ChatAccessReason: { ActiveBooking: 1 },
}));

jest.mock('../../context/MessagesContext', () => {
  const value = {
    unreadCount: 0,
    refreshUnreadCount: jest.fn(),
    subscribeToInbox: () => () => {},
    subscribe: () => () => {},
    subscribeToReads: () => () => {},
    subscribeToTyping: () => () => {},
    joinThread: () => () => {},
    notifyTyping: jest.fn(),
    claimActiveConversation: () => () => {},
  };
  return { useMessages: () => value };
});

// The thread shows send failures as a toast, and `useToast` throws without its provider.
jest.mock('../../context/ToastContext', () => {
  const value = { showError: jest.fn(), showSuccess: jest.fn(), showInfo: jest.fn() };
  return { useToast: () => value };
});

jest.mock('../../context/LocaleContext', () => {
  const { translate } = jest.requireActual('../../i18n');
  const value = {
    t: (key: string, params?: Record<string, unknown>) => translate('en', key, params),
    tEnum: (_n: string, v: unknown) => String(v),
    language: 'en',
  };
  return { useLocale: () => value };
});

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react');
  return {
    useFocusEffect: (cb: () => void | (() => void)) => react.useEffect(cb, [cb]),
    useNavigation: () => ({ navigate: mockNavigate, canGoBack: () => false, goBack: jest.fn() }),
    useRoute: () => ({ name: 'Messages', key: 'k', params: {} }),
  };
});

import ConversationsScreen from '../../screens/messages-screen/containers/ConversationsScreen';

const thread = (id: number, name: string, preview: string) => ({
  id,
  userId: 9,
  serviceProviderId: 70 + id,
  viewer: 0,
  counterpartName: name,
  counterpartAvatarUrl: null,
  serviceId: null,
  serviceName: null,
  lastMessageAt: '2026-08-13T08:00:00+00:00',
  lastMessagePreview: preview,
  lastMessageSender: 1,
  unreadCount: 0,
  access: { serviceProviderId: 70 + id, canSendMessage: true, reason: 1 },
  createdAt: '2026-08-01T08:00:00+00:00',
});

const message = (id: number, conversationId: number, body: string) => ({
  id,
  conversationId,
  sender: 1,
  senderUserId: null,
  body,
  sentAt: '2026-08-13T08:00:00.000Z',
  readAt: null,
});

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockGetConversations.mockResolvedValue({
    items: [thread(1, 'Ana', 'see you then'), thread(2, 'Bojan', 'thanks!')],
    totalItems: 2,
    totalPages: 1,
    currentPage: 1,
    itemsPerPage: 50,
    hasMore: false,
  });
  mockGetConversation.mockImplementation((id: number) =>
    Promise.resolve(id === 1 ? thread(1, 'Ana', 'see you then') : thread(2, 'Bojan', 'thanks!'))
  );
  mockGetMessagesPage.mockImplementation((conversationId: number) =>
    Promise.resolve({
      items: [
        message(
          conversationId * 10,
          conversationId,
          conversationId === 1 ? 'morning walk?' : 'grooming on Friday?'
        ),
      ],
      nextBefore: null,
      hasMore: false,
    })
  );
});

describe('Messages on the web design', () => {
  it('opens the most recent thread beside the list, without being asked', async () => {
    setViewport('desktop');
    render(withProviders(<ConversationsScreen />));
    await screen.findByText('Ana');
    await flush();

    // The server orders the inbox by activity, so row one is the most recent conversation.
    expect(mockGetConversation).toHaveBeenCalledWith(1);
    expect(await screen.findByText('morning walk?')).toBeTruthy();
  });

  it('swaps the thread in place when another row is clicked', async () => {
    setViewport('desktop');
    render(withProviders(<ConversationsScreen />));
    await screen.findByText('morning walk?');

    fireEvent.press(screen.getByLabelText('Bojan'));
    await flush();

    expect(await screen.findByText('grooming on Friday?')).toBeTruthy();
    // The point of the layout: the list is still there to pick from.
    expect(screen.getByLabelText('Ana')).toBeTruthy();
    // ...and picking from it is not a navigation.
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('Messages on the phone design', () => {
  it('pushes the thread instead of opening one beside the list', async () => {
    setViewport('mobile');
    render(withProviders(<ConversationsScreen />));
    await screen.findByText('Ana');
    await flush();

    // Nothing is preselected: there is no second pane to put it in.
    expect(mockGetConversation).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText('Ana'));
    expect(mockNavigate).toHaveBeenCalledWith('Chat', { conversationId: 1 });
  });
});
