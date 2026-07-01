import React, { useState, useCallback, useRef } from 'react';
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
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import ReviewModal from '../../../components/shared/ReviewModal';
import { useReviewModal } from '../../../hooks/useReviewModal';
import { NotificationItem } from '../components';
import {
  getAppNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  notificationBookingId,
  AppNotificationDto,
  NotificationType,
} from '../../../services/app-notifications';
import { getBooking } from '../../../services/bookings';

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const { currentUser } = useAuth();
  const { isDarkMode, cardBg, textColor, subtextColor, borderColor } = useThemeColors();

  const [notifications, setNotifications] = useState<AppNotificationDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The "leave a review" modal (shared hook owns the createReview submit).
  const review = useReviewModal();
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

  // Mark a notification read once (optimistic UI + best-effort persist).
  const markRead = useCallback((n: AppNotificationDto) => {
    if (n.isRead) return;
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    markNotificationRead(n.id).catch(() => {});
  }, []);

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
          serviceName: booking.service?.name ?? 'your service',
        });
        return true;
      } catch {
        return false;
      }
    },
    [openReview]
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
    async (silent = false) => {
      const userId = currentUser?.id;
      if (!userId) {
        setIsLoading(false);
        return;
      }
      if (!silent) setIsLoading(true);
      setError(null);
      try {
        const items = await getAppNotifications({ userId, perPage: 100 });
        setNotifications(items);
        void maybeAutoOpenReview(items);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load notifications.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentUser?.id, maybeAutoOpenReview]
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
    markAllNotificationsRead(unreadIds).catch(() => {});
  };

  return (
    <>
      <ScreenLayout
        headerVariant="standard"
        showBackButton
        headerTitle="Notifications"
        contentBg={bgColor}
        rightAction={
          unreadCount > 0 ? (
            <TouchableOpacity
              onPress={handleMarkAll}
              className="h-10 items-center justify-center rounded-full bg-brand-600 px-3">
              <Text className="text-xs font-semibold text-white">Mark all read</Text>
            </TouchableOpacity>
          ) : undefined
        }>
        {isLoading ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color="#00C870" />
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: 40, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                tintColor="#00C870"
                colors={['#00C870']}
              />
            }>
            {error ? (
              <View className="flex-1 items-center justify-center px-6 py-20">
                <Ionicons name="cloud-offline-outline" size={48} color="#9CA3AF" />
                <Text className={`text-base font-semibold ${textColor} mt-4 text-center`}>
                  Couldn’t load notifications
                </Text>
                <Text className={`text-sm ${subtextColor} mt-2 text-center`}>{error}</Text>
                <TouchableOpacity
                  onPress={() => load()}
                  className="mt-4 rounded-full bg-brand-500 px-5 py-2.5">
                  <Text className="font-semibold text-white">Try again</Text>
                </TouchableOpacity>
              </View>
            ) : notifications.length === 0 ? (
              <View className="flex-1 items-center justify-center px-6 py-20">
                <View
                  className={`mb-4 h-20 w-20 items-center justify-center rounded-full ${isDarkMode ? 'bg-[#1a2332]' : 'bg-brand-50'}`}>
                  <Ionicons name="notifications-off-outline" size={36} color="#00C870" />
                </View>
                <Text className={`text-lg font-semibold ${textColor} text-center`}>
                  No notifications yet
                </Text>
                <Text className={`text-sm ${subtextColor} mt-2 text-center`}>
                  Updates about your bookings and account will show up here.
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
