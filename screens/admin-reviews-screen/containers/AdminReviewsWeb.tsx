import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useAppNavigation } from '../../../hooks/useAppNavigation';
import { useThemeColors } from '../../../hooks/useThemeColors';
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
import { ReviewModerationListHeader, ReviewModerationRow } from '../components/ReviewModerationRow';
import { DeclineReviewDialog, isDeclineReasonTooShort } from '../components/DeclineReviewDialog';
import { reviewToItem } from '../reviewToItem';

// A declined review reads "Declined" rather than the applications queue's "Rejected".
const TABS = moderationTabs('admin.statusDeclined');

// Module functions, so their identity is stable for the paging hook.
const fetchReviewsPage = (query: ModerationPageQuery) => getReviewsPage(query);
const countByStatus = (approvalStatus: number) => countReviews({ approvalStatus });

/**
 * Review moderation on the web design: a full-width list that pages from the server as the
 * moderator scrolls, one tab per status, each in its own order (pending oldest first, decisions
 * newest first — both re-orderable).
 *
 * The phone design's screen reads the first 200 reviews and splits them into tabs on the client;
 * anything past 200 never appears there. Here each tab asks for its own page of its own status.
 */
export default function AdminReviewsWeb() {
  const { goUp } = useAppNavigation();
  const { subtextColor } = useThemeColors();
  const { showError } = useToast();
  const { t } = useLocale();
  const [busyId, setBusyId] = useState<number | null>(null);
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

  return (
    <ScreenLayout
      showBackButton
      onBackPress={() => goUp('AdminDashboard')}
      headerTitle={t('admin.reviewsTitle')}
      headerSubtitle={t('admin.reviewsSubtitle')}
      width="wide">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        scrollEventThrottle={16}
        onScroll={(e) => (isNearBottom(e) ? queue.loadMore() : undefined)}>
        {/* Tabs on the left, the order on the right. Out-ranks the rows in paint order so the
            sort panel opens over them rather than under. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 16, zIndex: 20 }}>
          <View style={{ flex: 1 }}>
            <FilterTabs
              tabs={TABS}
              activeKey={queue.activeTab}
              onChange={queue.setActiveTab}
              counts={queue.counts}
            />
          </View>
          <SortMenu
            value={queue.order}
            options={SUBMISSION_ORDER_OPTIONS}
            onChange={queue.setOrder}
          />
        </View>

        <View ref={listRef} style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <ListState
            isLoading={queue.isLoading}
            error={queue.error}
            isEmpty={items.length === 0}
            emptyIcon="star-outline"
            emptyMessage={emptyMessage}>
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
