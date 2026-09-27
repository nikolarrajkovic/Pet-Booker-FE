import React from 'react';
import { Text } from 'react-native';
import { render, act } from '@testing-library/react-native';

/**
 * A message into the thread on screen must not toast over it.
 *
 * The backend files a `NewChatMessage` notification whenever a thread goes from nothing unread
 * to something unread, and a thread being read is marked read on every arrival — so every line
 * the other side sent into an open thread came back as a notification, and this provider toasted
 * each one on top of the bubble it was announcing. Only the chat hub's own toast knew which
 * thread was open; this provider sits outside that one and could not ask.
 */

const mockShowInfo = jest.fn();
const mockHandlers: Record<string, (payload: unknown) => void> = {};

jest.mock('../context/ToastContext', () => ({
  useToast: () => ({ showInfo: mockShowInfo, showError: jest.fn(), showSuccess: jest.fn() }),
}));

jest.mock('../context/AuthContext', () => {
  const value = { currentUser: { id: 9 } };
  return { useAuth: () => value };
});

jest.mock('../services/notification-hub', () => ({
  NOTIFICATION_RECEIVED: 'NotificationReceived',
  createNotificationHubConnection: () => ({
    on: (name: string, handler: (payload: unknown) => void) => {
      mockHandlers[name] = handler;
    },
    onreconnected: () => {},
    start: () => Promise.resolve(),
    stop: () => Promise.resolve(),
  }),
}));

jest.mock('../services/app-notifications', () => ({
  ...jest.requireActual('../services/app-notifications'),
  getUnreadNotificationCount: () => Promise.resolve(0),
}));

jest.mock('../navigation/notificationRoute', () => ({
  followNotificationRoute: jest.fn(),
  routeForNotification: () => [],
}));

import { NotificationsProvider } from '../context/NotificationsContext';
import { claimActiveConversation } from '../services/active-conversation';
import { NotificationType } from '../services/app-notifications';

const chatNotification = (conversationId: number, id = conversationId) => ({
  id,
  userId: 9,
  type: NotificationType.NewChatMessage,
  title: 'New message',
  message: `Ana: message in ${conversationId}`,
  isRead: false,
  dataJson: JSON.stringify({ conversationId, messageId: 100 + id }),
  createdAt: '2026-09-24T10:00:00Z',
});

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

beforeEach(() => {
  jest.clearAllMocks();
});

it('does not toast a message into the thread on screen, and still toasts every other', async () => {
  render(
    <NotificationsProvider>
      <Text>app</Text>
    </NotificationsProvider>
  );
  await flush();
  const release = claimActiveConversation(5);

  act(() => mockHandlers.NotificationReceived(chatNotification(5)));
  expect(mockShowInfo).not.toHaveBeenCalled();

  act(() => mockHandlers.NotificationReceived(chatNotification(6)));
  expect(mockShowInfo).toHaveBeenCalledWith('Ana: message in 6', expect.anything());

  // Once the thread is closed its messages announce themselves again.
  release();
  mockShowInfo.mockClear();
  act(() => mockHandlers.NotificationReceived(chatNotification(5, 7)));
  expect(mockShowInfo).toHaveBeenCalledWith('Ana: message in 5', expect.anything());
});
