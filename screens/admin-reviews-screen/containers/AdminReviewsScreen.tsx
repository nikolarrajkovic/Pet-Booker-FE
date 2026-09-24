import React, { useState, useCallback, useMemo } from 'react';
import { ScrollView, BackHandler } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAppNavigation } from '../../../hooks/useAppNavigation';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useToast } from '../../../context/ToastContext';
import { useLocale } from '../../../context/LocaleContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import ListState from '../../../components/shared/ListState';
import FilterTabs, { moderationTabs } from '../../../components/shared/FilterTabs';
import { ReviewModerationCard } from '../components';
import type { ReviewStatus } from '../components';
import { DeclineReviewDialog } from '../components/DeclineReviewDialog';
import { getReviews, ReviewDto } from '../../../services/reviews';
import { approveReview, declineReview } from '../../../services/admin';
import { getErrorMessage } from '../../../services/http';
import ResponsiveGrid from '../../../components/shared/ResponsiveGrid';
import { useResponsive } from '../../../hooks/useResponsive';
import { reviewToItem } from '../reviewToItem';
import AdminReviewsWeb from './AdminReviewsWeb';

type FilterTab = ReviewStatus;

// A declined review reads "Declined" rather than the applications queue's "Rejected".
const TABS = moderationTabs('admin.statusDeclined');

/**
 * Review moderation, in whichever of the app's two designs the window calls for: the web design
 * pages a table-like list from the server (`AdminReviewsWeb`), the phone keeps its card queue.
 * Separate components rather than branches, so dragging a window across the breakpoint mounts the
 * other design cleanly instead of changing how many hooks one component calls.
 */
export default function AdminReviewsScreen() {
  const { isWebLayout } = useResponsive();
  return isWebLayout ? <AdminReviewsWeb /> : <AdminReviewsMobile />;
}

/** The phone design's queue — unchanged: the first 200 reviews read up front, split into tabs. */
function AdminReviewsMobile() {
  const navigation = useNavigation<any>();
  const { goUp } = useAppNavigation();
  const { isDarkMode, hex } = useThemeColors();
  const { showError } = useToast();
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');
  const [reviews, setReviews] = useState<ReviewDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  // Decline-reason modal: the review being declined + the admin's reason text.
  const [declineTargetId, setDeclineTargetId] = useState<number | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // No approvalStatus filter — fetch all so every tab has its data in one call.
      setReviews(await getReviews({ perPage: 200 }));
    } catch (e) {
      setLoadError(getErrorMessage(e, t('admin.reviewsLoadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  // Android hardware back → AdminDashboard
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        // Same rule as the header's back button: pop real history when there is some, so a
        // notification that opened this screen leads back to the feed, and fall back to the
        // admin home only when there is nothing to pop.
        if (navigation.canGoBack()) navigation.goBack();
        else navigation.navigate('MainTabs', { screen: 'AdminDashboard' });
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [navigation])
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!cancelled) await load();
      })();
      return () => {
        cancelled = true;
      };
    }, [load])
  );

  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-[#F5F7FA]';
  const cardBg = hex.card;
  const textColor = hex.text;
  const subTextColor = hex.subtext;
  const borderColor = hex.border;

  const items = useMemo(() => reviews.map((r) => reviewToItem(t, r)), [reviews, t]);

  const counts = {
    pending: items.filter((r) => r.status === 'pending').length,
    approved: items.filter((r) => r.status === 'approved').length,
    rejected: items.filter((r) => r.status === 'rejected').length,
  };

  const filtered = items.filter((r) => r.status === activeTab);

  const handleApprove = async (id: number) => {
    if (busyId !== null) return;
    setBusyId(id);
    try {
      await approveReview(id);
      await load();
    } catch (e) {
      showError(getErrorMessage(e, t('admin.approveReviewFailed')));
    } finally {
      setBusyId(null);
    }
  };

  // Open the decline-reason modal (reason collected, then sent).
  const handleDecline = (id: number) => {
    if (busyId !== null) return;
    setDeclineReason('');
    setDeclineTargetId(id);
  };

  const confirmDecline = async () => {
    if (declineTargetId === null) return;
    const id = declineTargetId;
    const trimmed = declineReason.trim();
    // Server requires a reason of ≥10 chars when one is given; blank is allowed
    // and uses a generic fallback. Guard the 1–9 char range.
    if (trimmed.length > 0 && trimmed.length < 10) return;
    const reason = trimmed || t('admin.declinedByAdminReason');
    setDeclineTargetId(null);
    setBusyId(id);
    try {
      await declineReview(id, reason);
      await load();
    } catch (e) {
      showError(getErrorMessage(e, t('admin.declineReviewFailed')));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      // Pops real history when there is any, so arriving here from the notification feed and
      // pressing Back returns to the feed; the admin home is only the FALLBACK, for when this
      // screen was opened directly (tab to tab) and there is nothing to pop. Hardcoding the
      // destination made every arrival behave like the second case.
      onBackPress={() => goUp('AdminDashboard')}
      headerTitle={t('admin.reviewsTitle')}
      headerSubtitle={t('admin.reviewsSubtitle')}
      contentBg={contentBg}
      width="wide">
      <FilterTabs tabs={TABS} activeKey={activeTab} onChange={setActiveTab} counts={counts} />

      {/* ── List ── */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 4 }}
        showsVerticalScrollIndicator={false}>
        <ListState
          isLoading={isLoading}
          error={loadError}
          isEmpty={filtered.length === 0}
          emptyIcon="star-outline"
          emptyMessage={
            activeTab === 'pending'
              ? t('admin.noPendingReviews')
              : activeTab === 'approved'
                ? t('admin.noApprovedReviews')
                : t('admin.noDeclinedReviews')
          }>
          {/*
            Moderation cards are full-width rows built for a phone queue. On a wide page they
            become 1120px bars with an avatar at one end, so the reviewer scrolls past three
            screenfuls to see what fits in one. `rowGap={0}` lets each card keep the bottom margin
            it already has rather than making a presentational component width-aware.
          */}
          <ResponsiveGrid columns={{ mobile: 1, tablet: 1, desktop: 2 }} gap={12} rowGap={0}>
            {filtered.map((review) => (
              <ReviewModerationCard
                key={review.id}
                review={review}
                isDarkMode={isDarkMode}
                cardBg={cardBg}
                textColor={textColor}
                subTextColor={subTextColor}
                borderColor={borderColor}
                busy={busyId === review.id}
                onApprove={busyId !== null ? undefined : handleApprove}
                onDecline={busyId !== null ? undefined : handleDecline}
              />
            ))}
          </ResponsiveGrid>
        </ListState>
      </ScrollView>

      {/* ── Decline-reason modal ── */}
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
