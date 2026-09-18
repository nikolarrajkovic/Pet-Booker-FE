import React from 'react';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useAppNavigation } from '../../../hooks/useAppNavigation';
import { useResponsive } from '../../../hooks/useResponsive';
import ChatThread, { type ChatThreadParams } from './ChatThread';
import MessagesWorkspace, { WORKSPACE_MIN_WIDTH } from './MessagesWorkspace';

/**
 * Route params — the same three ways of naming a thread `ChatThread` takes: an existing one by
 * `conversationId` (inbox, deep link), the thread with a provider by `serviceProviderId` (the chat
 * buttons on ServiceDetail and the booking cards), or by `bookingId` (the provider's entry point,
 * where the booking names the customer).
 */
export type ChatRouteParams = ChatThreadParams;

/**
 * One conversation, in whichever of the app's two designs the window calls for.
 *
 * - **Phone** — the thread is the screen, with the inbox behind it in the stack.
 * - **Wide window** — chat is one place, so this renders the same `MessagesWorkspace` the Messages
 *   route does, with this thread already open in the pane and the inbox beside it. Arriving here
 *   from a service page or a notification therefore lands somewhere you can carry on from, rather
 *   than in a single thread with the rest of the window blank.
 *
 * Branching by component rather than inside one keeps the hook order of each design stable when a
 * window is dragged across the breakpoint.
 */
export default function ChatScreen() {
  const route = useRoute<RouteProp<{ params: ChatRouteParams }, 'params'>>();
  const { goUp } = useAppNavigation();
  const { isWebLayout, width } = useResponsive();
  const params = route.params ?? {};

  if (isWebLayout && width >= WORKSPACE_MIN_WIDTH)
    return <MessagesWorkspace initialThread={params} />;

  return (
    <ChatThread
      params={params}
      // `Home` is a tab inside MainTabs, not a root screen, so navigating to it by bare name is
      // unhandled — which is exactly what happens on the no-history path this fallback exists for
      // (a deep link straight into a thread, or a reload on one). goUp() is the shared helper that
      // addresses the nested route correctly. Wrapped, not passed by reference: goUp's first
      // parameter is the fallback tab, and handing it the press event would send the navigator an
      // event object as a route name.
      onBack={() => goUp()}
    />
  );
}
