import React from 'react';
import { ScrollView, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useResponsive } from '../../../hooks/useResponsive';
import { useLocale } from '../../../context/LocaleContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import ListState from '../../../components/shared/ListState';
import { ConversationRow, MessagesSplitView } from '../components';
import { resolveImageUrl } from '../../../services/service-providers';
import { useConversationsInbox, relativeTime } from '../useConversationsInbox';

/**
 * The message inbox — every thread the signed-in user is part of, newest first.
 *
 * Two designs, and here they are genuinely different screens rather than the same one relaid:
 *
 * - **Phone** — the list, and tapping a row pushes the thread over it. The only option at 390px.
 * - **Web** — the list is the left column of a two-pane messenger with a thread open beside it
 *   (`MessagesSplitView`). Pushing a thread over the inbox on a 1440px window throws away the
 *   list the user is choosing from and makes switching threads a Back plus a click.
 *
 * The load itself is shared: `useConversationsInbox` holds the fetch, the focus refresh and the
 * live splice, so the two designs cannot drift into refetching the inbox differently.
 */
export default function ConversationsScreen() {
  const navigation = useNavigation<any>();
  const { isDarkMode, bgColor } = useThemeColors();
  const { isWebLayout } = useResponsive();
  const { t } = useLocale();
  const { conversations, isLoading, isRefreshing, loadError, refresh } = useConversationsInbox();

  if (isWebLayout) {
    return (
      // `webBare`: the split view is a full-height messenger, not a column of page content, so
      // it wants the viewport rather than the page header and the scrolling content column.
      <ScreenLayout headerTitle={t('messages.title')} webBare>
        <MessagesSplitView />
      </ScreenLayout>
    );
  }

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
        <ListState
          isLoading={isLoading}
          error={loadError}
          isEmpty={conversations.length === 0}
          emptyIcon="chatbubbles-outline"
          emptyMessage={t('messages.emptyInbox')}>
          {conversations.map((c) => (
            <ConversationRow
              key={c.id}
              name={c.counterpartName || t('messages.conversation')}
              subtitle={c.serviceName ?? undefined}
              avatarUrl={resolveImageUrl(c.counterpartAvatarUrl) || null}
              lastMessage={c.lastMessagePreview}
              timeLabel={relativeTime(c.lastMessageAt)}
              unreadCount={c.unreadCount ?? 0}
              isDarkMode={isDarkMode}
              onPress={() => navigation.navigate('Chat', { conversationId: c.id })}
            />
          ))}
        </ListState>
      </ScrollView>
    </ScreenLayout>
  );
}
