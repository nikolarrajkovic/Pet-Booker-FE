import React, { useCallback } from 'react';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useResponsive } from '../../../hooks/useResponsive';
import { ChatThread, MessagesSplitView } from '../components';
import type { ChatThreadTarget } from '../components/ChatThread';

/**
 * Route params — the thread to open. See `ChatThreadTarget`: an existing conversation id (inbox,
 * deep link), a provider id (the chat buttons on ServiceDetail and the booking cards), or a
 * booking id (the provider's entry point). All three are get-or-create.
 */
export type ChatRouteParams = ChatThreadTarget;

/**
 * One conversation, as a route.
 *
 * - **Phone** — the thread fills the screen, with the inbox behind it in the stack.
 * - **Web** — the same two-pane messenger the inbox route draws, with this thread open in it.
 *   A thread reached from a notification or a shared URL should look like a thread reached by
 *   clicking one; rendering the bare thread here instead would make the inbox appear and
 *   disappear depending on how the user got to the same conversation.
 *
 * The thread itself is `components/ChatThread` in both cases — this screen only picks the frame.
 */
export default function ChatScreen() {
  const route = useRoute<RouteProp<{ params: ChatRouteParams }, 'params'>>();
  const navigation = useNavigation<any>();
  const params = route.params ?? {};
  const { isWebLayout } = useResponsive();

  /**
   * Keep the URL on the thread actually open.
   *
   * `setParams` rather than `navigate`: the screen is already mounted, so this rewrites the
   * address (and the history entry) without a push — browser Back then still leaves Messages
   * rather than walking back through every thread the user glanced at.
   */
  const syncUrl = useCallback(
    (conversationId: number) => {
      navigation.setParams({
        conversationId,
        // Cleared deliberately: both are get-or-create instructions for a *different* thread,
        // and leaving one behind would reopen that one on the next remount.
        serviceProviderId: undefined,
        bookingId: undefined,
      });
    },
    [navigation]
  );

  if (isWebLayout) return <MessagesSplitView initial={params} onSelect={syncUrl} />;

  return <ChatThread {...params} />;
}
