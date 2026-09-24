import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View, BackHandler } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAppNavigation } from '../../../hooks/useAppNavigation';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useResponsive } from '../../../hooks/useResponsive';
import { useToast } from '../../../context/ToastContext';
import { useLocale } from '../../../context/LocaleContext';
import { getErrorMessage } from '../../../services/http';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import ListState from '../../../components/shared/ListState';
import FilterTabs, { moderationTabs } from '../../../components/shared/FilterTabs';
import SortMenu from '../../../components/shared/SortMenu';
import LoadMoreFooter, { isNearBottom } from '../../../components/shared/LoadMoreFooter';
import { useNearBottomLoader } from '../../../hooks/useNearBottomLoader';
import {
  useModerationQueue,
  SUBMISSION_ORDER_OPTIONS,
  type ModerationPageQuery,
} from '../../../hooks/useModerationQueue';
import { countReviews, getReviewsPage, type ReviewDto } from '../../../services/reviews';
import { approveReview, declineReview } from '../../../services/admin';
import { ReviewModerationCard } from '../components';
import { ReviewModerationListHeader, ReviewModerationRow } from '../components/ReviewModerationRow';
import { DeclineReviewDialog, isDeclineReasonTooShort } from '../components/DeclineReviewDialog';
import { reviewToItem } from '../reviewToItem';

// A declined review reads "Declined" rather than the applications queue's "Rejected".
const TABS = moderationTabs('admin.statusDeclined');

// Module functions, so their identity is stable for the paging hook.
const fetchReviewsPage = (query: ModerationPageQuery) => getReviewsPage(query);
const countByStatus = (approvalStatus: number) => countReviews({ approvalStatus });

/**
 * Review moderation: one tab per status, each paging itself from the server as the moderator
 * scrolls, in its own order — pending oldest first, decisions newest first, both re-orderable.
 *
 * Both designs share the list; only the item differs. The web design draws a full-width row per
 * review under a column header (`ReviewModerationRow`), the phone keeps its card queue
 * (`ReviewModerationCard`).
 *
 * Both used to read the first 200 reviews and split them into tabs on the client, so the 201st
 * review — pending or not — never appeared anywhere a moderator could act on it.
 */
export default function AdminReviewsScreen() {
  const navigation = useNavigation<any>();
  const { goUp } = useAppNavigation();
  const { isDarkMode, hex, subtextColor } = useThemeColors();
  const { isWebLayout } = useResponsive();
  const { showError } = useToast();
  const { t } = useLocale();
  const [busyId, setBusyId] = useState<number | null>(null);
  // Decline-reason prompt: the review being declined + the moderator's reason.
  const [declineTargetId, setDeclineTargetId] = useState<number | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const queue = useModerationQueue<ReviewDto>({
    fetchPage: fetchReviewsPage,
    count: countByStatus,
    resource: 'reviews',
    errorFallback: t('admin.reviewsLoadFailed'),
  });
  const items = useMemo(() => queue.items.map((r) => reviewToItem(t, r)), [queue.items, t]);
  const listRef = useNearBottomLoader(true, queue.loadMore);

  // Android hardware back → the header's rule.
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        // Pop real history when there is some, so a notification that opened this screen leads
        // back to the feed; fall back to the admin home only when there is nothing to pop.
        if (navigation.canGoBack()) navigation.goBack();
        else navigation.navigate('MainTabs', { screen: 'AdminDashboard' });
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [navigation])
  );

  // A decided review leaves the tab it was in at once; the write's invalidation re-reads the
  // loaded pages and the counts behind it.
  const dropRow = (id: number) => queue.setItems((rows) => rows.filter((r) => r.id !== id));

  const approve = async (id: number) => {
    if (busyId !== null) return;
    setBusyId(id);
    try {
      await approveReview(id);
      dropRow(id);
    } catch (e) {
      showError(getErrorMessage(e, t('admin.approveReviewFailed')));
    } finally {
      setBusyId(null);
    }
  };

  const openDecline = (id: number) => {
    if (busyId !== null) return;
    setDeclineReason('');
    setDeclineTargetId(id);
  };

  const confirmDecline = async () => {
    if (declineTargetId === null || isDeclineReasonTooShort(declineReason)) return;
    const id = declineTargetId;
    // Blank is allowed and sends a generic reason; a typed one must meet the server's minimum.
    const reason = declineReason.trim() || t('admin.declinedByAdminReason');
    setDeclineTargetId(null);
    setBusyId(id);
    try {
      await declineReview(id, reason);
      dropRow(id);
    } catch (e) {
      showError(getErrorMessage(e, t('admin.declineReviewFailed')));
    } finally {
      setBusyId(null);
    }
  };

  const emptyMessage =
    queue.activeTab === 'pending'
      ? t('admin.noPendingReviews')
      : queue.activeTab === 'approved'
        ? t('admin.noApprovedReviews')
        : t('admin.noDeclinedReviews');

  const tabs = (
    <FilterTabs
      tabs={TABS}
      activeKey={queue.activeTab}
      onChange={queue.setActiveTab}
      counts={queue.counts}
    />
  );
  const sort = (
    <SortMenu value={queue.order} options={SUBMISSION_ORDER_OPTIONS} onChange={queue.setOrder} />
  );

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      // Pops real history when there is any, so arriving here from the notification feed and
      // pressing Back returns to the feed; the admin home is only the FALLBACK, for when this
      // screen was opened directly (tab to tab) and there is nothing to pop.
      onBackPress={() => goUp('AdminDashboard')}
      headerTitle={t('admin.reviewsTitle')}
      headerSubtitle={t('admin.reviewsSubtitle')}
      contentBg={isWebLayout ? undefined : isDarkMode ? 'bg-[#0f1621]' : 'bg-[#F5F7FA]'}
      width="wide">
      {/* On the phone the tabs stay put above the scrolling queue, as they always have. */}
      {!isWebLayout && tabs}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={isWebLayout}
        scrollEventThrottle={16}
        onScroll={(e) => (isNearBottom(e) ? queue.loadMore() : undefined)}>
        {/* The order control out-ranks the rows in paint order, so its panel opens over them
            rather than under. Web: tabs on the left, order on the right. Phone: the tab row is
            already full, so the order sits alone above the cards, as it does on Search. */}
        {isWebLayout ? (
          <View
            style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 16, zIndex: 20 }}>
            <View style={{ flex: 1 }}>{tabs}</View>
            {sort}
          </View>
        ) : (
          <View style={{ alignItems: 'flex-end', paddingHorizontal: 16, zIndex: 20 }}>{sort}</View>
        )}

        <View ref={listRef} style={{ paddingHorizontal: 16, paddingTop: isWebLayout ? 4 : 12 }}>
          <ListState
            isLoading={queue.isLoading}
            error={queue.error}
            isEmpty={items.length === 0}
            emptyIcon="star-outline"
            emptyMessage={emptyMessage}>
            {isWebLayout ? (
              <>
                <ReviewModerationListHeader withActions={queue.activeTab === 'pending'} />
                {items.map((review) => (
                  <ReviewModerationRow
                    key={review.id}
                    review={review}
                    busy={busyId === review.id}
                    onApprove={() => approve(review.id)}
                    onDecline={() => openDecline(review.id)}
                  />
                ))}
              </>
            ) : (
              items.map((review) => (
                <ReviewModerationCard
                  key={review.id}
                  review={review}
                  isDarkMode={isDarkMode}
                  cardBg={hex.card}
                  textColor={hex.text}
                  subTextColor={hex.subtext}
                  borderColor={hex.border}
                  busy={busyId === review.id}
                  onApprove={busyId !== null ? undefined : approve}
                  onDecline={busyId !== null ? undefined : openDecline}
                />
              ))
            )}
          </ListState>

          {items.length > 0 && (
            <LoadMoreFooter
              loaded={items.length}
              total={queue.totalItems}
              hasMore={queue.hasMore}
              isLoadingMore={queue.isLoadingMore}
              onLoadMore={queue.loadMore}
            />
          )}
          {items.length > 0 && !queue.hasMore && !queue.isLoadingMore && (
            <Text className={`pt-4 text-center text-xs ${subtextColor}`}>
              {t('admin.endOfList', { count: queue.totalItems })}
            </Text>
          )}
        </View>
      </ScrollView>

      <DeclineReviewDialog
        visible={declineTargetId !== null}
        reason={declineReason}
        onChangeReason={setDeclineReason}
        onCancel={() => setDeclineTargetId(null)}
        onConfirm={confirmDecline}
      />
    </ScreenLayout>
  );
}
