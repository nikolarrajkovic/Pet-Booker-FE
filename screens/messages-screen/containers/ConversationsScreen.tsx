import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import { useMessages } from '../../../context/MessagesContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import ListState from '../../../components/shared/ListState';
import { ConversationRow } from '../components';
import { getErrorMessage } from '../../../services/http';
import { resolveImageUrl } from '../../../services/service-providers';
import { getConversations, type ConversationDto } from '../../../services/messages';

/** Compact relative time for an inbox row ("now", "4m", "3h", "2d", then a date). */
function relativeTime(iso?: string | null): string {
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

/**
 * The message inbox — every thread the signed-in user is part of, newest first.
 *
 * No owner parameter is sent: the backend scopes the list to the session, and merges both sides
 * for a partner (who is a customer of other providers as well as a provider themselves). It also
 * resolves the counterpart per row, so a customer sees the provider and a provider sees the
 * customer off the same field without the client knowing which side it is on.
 */
export default function ConversationsScreen() {
  const navigation = useNavigation<any>();
  const { isDarkMode, bgColor } = useThemeColors();
  const { t } = useLocale();
  const { refreshUnreadCount, subscribeToInbox } = useMessages();

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

  // A message arriving in any thread reorders the inbox, so refresh rather than patch one row.
  useEffect(() => subscribeToInbox(() => load()), [subscribeToInbox, load]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

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
            onRefresh={onRefresh}
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
