import React from 'react';
import { ScrollView, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import { useResponsive } from '../../../hooks/useResponsive';
import { useConversationInbox } from '../../../hooks/useConversationInbox';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { ConversationList } from '../components';
import MessagesWorkspace, { WORKSPACE_MIN_WIDTH } from './MessagesWorkspace';

/**
 * Messages, in whichever of the app's two designs the window calls for.
 *
 * - **Phone** — the inbox is the page, and a row pushes the thread onto the stack (`InboxPage`).
 * - **Wide window** — the inbox is the left column of `MessagesWorkspace`, with the open thread
 *   beside it; see that file for why switching threads there is not a navigation.
 *
 * The two are separate components rather than branches inside one, because they hold different
 * state: dragging a window across the breakpoint has to mount the other design cleanly instead of
 * changing how many hooks this component calls.
 */
export default function ConversationsScreen() {
  const { isWebLayout, width } = useResponsive();

  return isWebLayout && width >= WORKSPACE_MIN_WIDTH ? <MessagesWorkspace /> : <InboxPage />;
}

/**
 * The phone design's inbox: every thread the signed-in user is part of, newest first, with the
 * thread itself a screen away.
 */
function InboxPage() {
  const navigation = useNavigation<any>();
  const { bgColor } = useThemeColors();
  const { t } = useLocale();
  const { conversations, isLoading, isRefreshing, loadError, refresh } = useConversationInbox();

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle={t('messages.title')}
      contentBg={bgColor}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={BRAND_GREEN}
            colors={[BRAND_GREEN]}
          />
        }>
        <ConversationList
          conversations={conversations}
          isLoading={isLoading}
          error={loadError}
          onSelect={(c) => navigation.navigate('Chat', { conversationId: c.id })}
        />
      </ScrollView>
    </ScreenLayout>
  );
}
