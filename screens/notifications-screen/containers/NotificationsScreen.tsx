import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import { useLocale } from '../../../context/LocaleContext';
import { useNotifications } from '../../../context/NotificationsContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import ReviewModal from '../../../components/shared/ReviewModal';
import { useReviewModal } from '../../../hooks/useReviewModal';
import { usePagedList } from '../../../hooks/usePagedList';
import LoadMoreFooter, { isNearBottom } from '../../../components/shared/LoadMoreFooter';
import { NotificationItem } from '../components';
import {
  getInboxNotificationsPage,
  isInboxNotification,
  markNotificationRead,
  markAllNotificationsRead,
  notificationBookingId,
  AppNotificationDto,
  NotificationType,
} from '../../../services/app-notifications';
import { getBooking } from '../../../services/bookings';

// One screenful plus headroom. Small enough that the first page is fast on a phone, large enough
// that most users never need a second.
const PAGE_SIZE = 25;

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const { currentUser } = useAuth();
  const { subscribe, refreshUnreadCount } = useNotifications();
  const { isDarkMode, cardBg, textColor, subtextColor, borderColor } = useThemeColors();
  const { t } = useLocale();

  const [isRefreshing, setIsRefreshing] = useState(false);

  // The inbox grows without limit, so it pages: PAGE_SIZE rows at a time, appended as you scroll.
  const userId = currentUser?.id;
  // Message notifications are left out — chat keeps its own inbox and unread count, and filing
  // every message here buries the booking events this feed exists for.
  const fetchPage = useCallback(
    (page: number) => getInboxNotificationsPage({ userId, page, perPage: PAGE_SIZE }),
    [userId]
  );
  const {
    items: notifications,
    setItems: setNotifications,
    isLoading,
    isLoadingMore,
    error,
    totalItems,
    hasMore,
    loadMore,
    reload,
  } = usePagedList<AppNotificationDto>(fetchPage, {
    enabled: userId != null,
    errorFallback: t('notifications.loadFailed'),
  });
  // The "leave a review" modal (shared hook owns the createReview submit).
  const review = useReviewModal();
  // Guards the auto-open review to one run per load cycle (not per appended page).
  const autoReviewRunRef = useRef(false);
  // `useReviewModal` returns a fresh object every render, but its `open` fn is
  // memoized/stable. Pin it to a local so callbacks can depend on the stable fn
  // instead of the whole object — depending on `review` would churn the
  // load()/useFocusEffect chain and spam the notifications fetch (blinking).
  const openReview = review.open;
  // Mirror of the open state so the auto-pop pass can see "a modal is open"
  // without a stale closure (load() is created once and captures the old value).
  const reviewOpenRef = useRef(false);
  reviewOpenRef.current = review.target !== null;

  const bgColor = isDarkMode ? 'bg-[#0f1621]' : 'bg-gray-50';
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Mark a notification read once (optimistic UI + best-effort persist), then
  // re-seed the live bell badge so it drops immediately.
  const markRead = useCallback(
    (n: AppNotificationDto) => {
      if (n.isRead) return;
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      markNotificationRead(n.id)
        .catch(() => {})
        .finally(refreshUnreadCount);
    },
    // setNotifications is usePagedList's state setter — stable, but ESLint can't see through the
    // hook boundary, so it's declared.
    [refreshUnreadCount, setNotifications]
  );

  // Live inbox: prepend NotificationReceived pushes while this screen is mounted
  // (no refetch needed — the push payload is the same shape as the REST feed).
  useEffect(
    () =>
      subscribe((n) => {
        if (!isInboxNotification(n)) return; // hidden types never enter the feed, live or fetched
        setNotifications((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]));
      }),
    [subscribe, setNotifications]
  );

  // Resolve the booking behind a "Service completed" notification and open the
  // review modal — UNLESS that booking has already been reviewed (then the review
  // never opens again, per spec). Returns whether the modal was opened.
  const openReviewForNotification = useCallback(
    async (n: AppNotificationDto): Promise<boolean> => {
      const bookingId = notificationBookingId(n);
      if (bookingId == null) return false;
      try {
        const booking = await getBooking(bookingId);
        if (booking.review) return false; // already reviewed
        openReview({
          bookingId,
          serviceProviderId: booking.serviceProviderId,
          serviceId: booking.serviceId,
          serviceName: booking.service?.name ?? t('notifications.yourService'),
        });
        return true;
      } catch {
        return false;
      }
    },
    [openReview, t]
  );

  // Auto-pop the review modal for the newest unread "Service completed"
  // notification that hasn't been reviewed yet. Runs on each load (focus/refresh).
  const maybeAutoOpenReview = useCallback(
    async (items: AppNotificationDto[]) => {
      if (reviewOpenRef.current) return; // a modal is already open
      const candidates = items.filter(
        (n) =>
          !n.isRead &&
          n.type === NotificationType.ServiceCompleted &&
          notificationBookingId(n) != null
      );
      for (const n of candidates) {
        const opened = await openReviewForNotification(n);
        if (opened) {
          markRead(n); // opening it (clicked or not) marks it read
          break;
        }
      }
    },
    [openReviewForNotification, markRead]
  );

  const load = useCallback(
    (silent = false) => {
      if (!silent) autoReviewRunRef.current = false;
      reload();
    },
    [reload]
  );

  // Auto-open the review modal only for the FIRST page of a load — never for a page appended by
  // scrolling, or an old "Service completed" would pop a modal mid-scroll.
  useEffect(() => {
    if (isLoading || error || autoReviewRunRef.current) return;
    autoReviewRunRef.current = true;
    setIsRefreshing(false);
    void maybeAutoOpenReview(notifications);
  }, [isLoading, error, notifications, maybeAutoOpenReview]);

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

  const onRefresh = () => {
    setIsRefreshing(true);
    load(true);
  };

  const handlePress = async (n: AppNotificationDto) => {
    // Mark read optimistically; persist best-effort.
    markRead(n);
    // TESTING ONLY: tapping a "Provider profile approved" (type 3) notification
    // re-opens the partner celebration screen every time, bypassing the
    // once-per-user flag. Remove this block when done testing.
    if (n.type === NotificationType.ProviderProfileApproved) {
      (navigation as any).navigate('PartnerWelcome');
      return;
    }
    // "Live tracking started" → straight to the live map (user-mode LiveSession).
    if (n.type === NotificationType.LiveTrackingStarted) {
      (navigation as any).navigate('LiveSession', { mode: 'user' });
      return;
    }
    const bookingId = notificationBookingId(n);
    // "Service completed" → offer the review modal (unless already reviewed).
    if (n.type === NotificationType.ServiceCompleted && bookingId != null) {
      const opened = await openReviewForNotification(n);
      if (opened) return; // modal is showing; don't also navigate
    }
    // Otherwise deep-link to the related booking when the payload carries one.
    if (bookingId != null) {
      (navigation as any).navigate('BookingDetails', { bookingId });
    }
  };

  const handleMarkAll = () => {
    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setNotifications((prev) => prev.map((x) => ({ ...x, isRead: true })));
    markAllNotificationsRead(unreadIds)
      .catch(() => {})
      .finally(refreshUnreadCount);
  };

  return (
    <>
      <ScreenLayout
        headerVariant="standard"
        showBackButton
        headerTitle={t('notifications.title')}
        contentBg={bgColor}
        rightAction={
          unreadCount > 0 ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={handleMarkAll}
              className="h-10 items-center justify-center rounded-full bg-brand-600 px-3">
              <Text className="text-xs font-semibold text-white">
                {t('notifications.markAllRead')}
              </Text>
            </TouchableOpacity>
          ) : undefined
        }>
        {isLoading ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color={BRAND_GREEN} />
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: 40, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            // Phone-first: the next page loads as you approach the bottom. loadMore() is a no-op
            // while a page is in flight, so the repeated scroll events are harmless.
            scrollEventThrottle={16}
            onScroll={(e) => {
              if (isNearBottom(e)) loadMore();
            }}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                tintColor={BRAND_GREEN}
                colors={[BRAND_GREEN]}
              />
            }>
            {error ? (
              <View className="flex-1 items-center justify-center px-6 py-20">
                <Ionicons name="cloud-offline-outline" size={48} color="#9CA3AF" />
                <Text className={`text-base font-semibold ${textColor} mt-4 text-center`}>
                  {t('notifications.couldNotLoad')}
                </Text>
                <Text className={`text-sm ${subtextColor} mt-2 text-center`}>{error}</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => load()}
                  className="mt-4 rounded-full bg-brand-500 px-5 py-2.5">
                  <Text className="font-semibold text-white">{t('notifications.tryAgain')}</Text>
                </TouchableOpacity>
              </View>
            ) : notifications.length === 0 ? (
              <View className="flex-1 items-center justify-center px-6 py-20">
                <View
                  className={`mb-4 h-20 w-20 items-center justify-center rounded-full ${isDarkMode ? 'bg-[#1a2332]' : 'bg-brand-50'}`}>
                  <Ionicons name="notifications-off-outline" size={36} color={BRAND_GREEN} />
                </View>
                <Text className={`text-lg font-semibold ${textColor} text-center`}>
                  {t('notifications.emptyTitle')}
                </Text>
                <Text className={`text-sm ${subtextColor} mt-2 text-center`}>
                  {t('notifications.emptyText')}
                </Text>
              </View>
            ) : (
              notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  isDarkMode={isDarkMode}
                  cardBg={cardBg}
                  textColor={textColor}
                  subtextColor={subtextColor}
                  borderColor={borderColor}
                  onPress={() => handlePress(n)}
                />
              ))
            )}
            {!error && notifications.length > 0 && (
              <LoadMoreFooter
                loaded={notifications.length}
                total={totalItems}
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                onLoadMore={loadMore}
              />
            )}
          </ScrollView>
        )}
      </ScreenLayout>

      <ReviewModal
        visible={review.target !== null}
        serviceName={review.target?.serviceName}
        submitting={review.submitting}
        onClose={review.close}
        onSubmit={review.submit}
      />
    </>
  );
}
