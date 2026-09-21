import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useResponsive } from '../../../hooks/useResponsive';
import { useLocale } from '../../../context/LocaleContext';
import ListState, { MessageState } from '../../../components/shared/ListState';
import { TOPBAR_HEIGHT } from '../../../components/layout/topBarMetrics';
import { resolveImageUrl } from '../../../services/service-providers';
import { useConversationsInbox, relativeTime } from '../useConversationsInbox';
import ConversationRow from './ConversationRow';
import ChatThread, { type ChatThreadTarget } from './ChatThread';

/** How wide the inbox column is. Narrower on a tablet, where the page has ~250px less to spend. */
const LIST_WIDTH = { desktop: 340, tablet: 280 } as const;

export type MessagesSplitViewProps = {
  /**
   * The thread to open on arrival — the `Chat` route's params, or nothing when the user came to
   * the inbox itself. With nothing, the most recent thread is opened: a two-pane messenger whose
   * right half is empty on arrival wastes two thirds of the window asking the user to click
   * something before it will show them anything.
   */
  initial?: ChatThreadTarget | null;
  /**
   * Told which thread is now on screen. The `Chat` route uses it to keep the URL honest; the
   * inbox route has nothing to update and passes nothing.
   */
  onSelect?: (conversationId: number) => void;
};

/**
 * Messages on the web design: the inbox beside the open thread.
 *
 * The phone design pushes a thread over the inbox because there is no room for both. A 1440px
 * window has room for both twice over, and the push wastes it twice: the list the user picked
 * from disappears the moment they pick, and switching threads costs a Back and a second click
 * through a screen that was already on display. Two panes is what every messenger on a desktop
 * does, and it is the layout the inbox rows were already shaped for.
 *
 * Drawn by **both** message routes (`Messages` and `Chat`), so a deep link to a thread lands in
 * the same place as a click from the inbox. `ChatThread` is the same component the phone screen
 * renders; only the frame differs.
 */
export default function MessagesSplitView({ initial, onSelect }: MessagesSplitViewProps) {
  const { isDarkMode, textColor, subtextColor, hex } = useThemeColors();
  const { isTablet } = useResponsive();
  const { t } = useLocale();
  const { conversations, isLoading, loadError } = useConversationsInbox();

  const [target, setTarget] = useState<ChatThreadTarget | null>(initial ?? null);
  /**
   * The row to mark as selected.
   *
   * Tracked separately from `target` because a target is not always an address: opening a thread
   * by `serviceProviderId` or `bookingId` is a get-or-create instruction, and only the thread
   * itself finds out which row it landed on.
   */
  const [selectedId, setSelectedId] = useState<number | null>(initial?.conversationId ?? null);

  // A route param change (a notification tap landing on a thread while the inbox is already
  // open) moves the pane. Keyed on the values rather than the object, which the navigator
  // rebuilds on every render.
  const initialKey = initial
    ? [
        initial.conversationId,
        initial.serviceProviderId,
        initial.serviceId,
        initial.bookingId,
      ].join(':')
    : '';
  useEffect(() => {
    if (!initial) return;
    setTarget(initial);
    setSelectedId(initial.conversationId ?? null);
    // `initial` itself is deliberately not a dependency — see the key above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey]);

  // Preselect the most recent thread once the inbox arrives. Only while nothing is open, so a
  // live message reordering the list cannot yank the user onto a different conversation
  // mid-sentence.
  useEffect(() => {
    if (target || conversations.length === 0) return;
    setTarget({ conversationId: conversations[0].id });
    setSelectedId(conversations[0].id);
  }, [conversations, target]);

  const select = (conversationId: number) => {
    setTarget({ conversationId });
    setSelectedId(conversationId);
    onSelect?.(conversationId);
  };

  /**
   * Remounts the thread when the selection changes.
   *
   * A thread holds a page of history, a live subscription and a composer draft. Swapping the
   * props under all that and relying on every effect to tear itself down in the right order is
   * how a message ends up in the wrong conversation; a key makes the swap a mount.
   */
  const threadKey = useMemo(
    () =>
      target
        ? `c${target.conversationId ?? ''}-p${target.serviceProviderId ?? ''}-b${target.bookingId ?? ''}`
        : 'none',
    [target]
  );

  return (
    <View style={{ height: `calc(100vh - ${TOPBAR_HEIGHT}px)` as any, padding: 16 }}>
      <View
        style={{
          flex: 1,
          minHeight: 0,
          flexDirection: 'row',
          borderRadius: 24,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: hex.border,
          backgroundColor: hex.card,
        }}>
        {/* ── The inbox ───────────────────────────────────────────────────────────────────── */}
        <View
          style={{
            width: isTablet ? LIST_WIDTH.tablet : LIST_WIDTH.desktop,
            borderRightWidth: 1,
            borderRightColor: hex.border,
            minHeight: 0,
          }}>
          {/* The page title lives here rather than in a `PageHeader` above the panel: a title
              bar spanning both columns costs the thread a chunk of its height to repeat a word
              the sidebar already has selected. */}
          <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 }}>
            <Text className={`text-xl font-bold ${textColor}`}>{t('messages.title')}</Text>
            {conversations.length > 0 && (
              <Text className={`mt-0.5 text-xs ${subtextColor}`}>{t('messages.subtitle')}</Text>
            )}
          </View>

          <ScrollView
            style={{ flex: 1, minHeight: 0 }}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}>
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
                  isSelected={c.id === selectedId}
                  onPress={() => select(c.id)}
                />
              ))}
            </ListState>
          </ScrollView>
        </View>

        {/* ── The open thread ─────────────────────────────────────────────────────────────── */}
        <View style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          {target ? (
            <ChatThread
              key={threadKey}
              {...target}
              embedded
              onConversationResolved={(c) => setSelectedId(c.id)}
            />
          ) : (
            // Only reachable with an empty (or still-loading) inbox — with any thread at all,
            // one is preselected above.
            !isLoading && (
              <MessageState icon="chatbubble-ellipses-outline" message={t('messages.emptyInbox')} />
            )
          )}
        </View>
      </View>
    </View>
  );
}
