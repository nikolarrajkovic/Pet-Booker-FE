import React, { useState, useCallback, useMemo } from 'react';
import { ScrollView, Text, View, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import { useLocale } from '../../../context/LocaleContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import ResponsiveGrid from '../../../components/shared/ResponsiveGrid';
import ListState from '../../../components/shared/ListState';
import LoadMoreFooter, { isNearBottom } from '../../../components/shared/LoadMoreFooter';
import ReviewModal from '../../../components/shared/ReviewModal';
import { useReviewModal } from '../../../hooks/useReviewModal';
import { usePagedList } from '../../../hooks/usePagedList';
import { BookingCard } from '../components';
import {
  getBookingsPage,
  bookingToViewModel,
  BookingState,
  BookingSortBy,
} from '../../../services/bookings';
import { usePageGutter } from '../../../hooks/usePageGutter';

/**
 * The two tabs are two server queries, each paged as the list scrolls.
 *
 * They used to be one 50-row page filtered and sorted on the device — so once an account had more
 * than 50 bookings, the newest ones (the ones that matter) were never fetched, and Upcoming read
 * "No upcoming bookings" over an appointment booked for next week. The server now owns both the
 * split and the order, including what has expired: a request nobody answered before it started,
 * or a confirmed booking never started before it ended, reads as Expired and goes to Past.
 */
const UPCOMING = {
  states: [BookingState.Upcoming, BookingState.Accepted, BookingState.InProgress],
  // Soonest first — an "upcoming" list is read in the order things happen.
  sortBy: BookingSortBy.SoonestFirst,
};
const PAST = {
  states: [BookingState.Completed, BookingState.Cancelled, BookingState.Expired],
  // Most recent first — the opposite order, for the same reason.
  sortBy: BookingSortBy.LatestFirst,
};

export default function MyBookingsScreen() {
  const gutter = usePageGutter();
  const navigation = useNavigation();
  const { currentUser } = useAuth();
  const { isDarkMode, bgColor, cardBg, textColor, subtextColor, borderColor } = useThemeColors();
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const userId = currentUser?.id;

  const fetchUpcoming = useCallback(
    (page: number) => getBookingsPage({ userId, ...UPCOMING }, page),
    [userId]
  );
  const fetchPast = useCallback(
    (page: number) => getBookingsPage({ userId, ...PAST }, page),
    [userId]
  );
  const listOptions = {
    enabled: !!userId,
    resource: 'bookings',
    errorFallback: t('myBookings.loadFailed'),
  };
  const upcoming = usePagedList(fetchUpcoming, listOptions);
  const past = usePagedList(fetchPast, listOptions);
  const list = activeTab === 'upcoming' ? upcoming : past;

  // Reload after a review is submitted so the new rating replaces the CTA.
  const review = useReviewModal(() => {
    past.reload();
  });

  const visible = useMemo(() => list.items.map(bookingToViewModel), [list.items]);
  const isLoading = list.isLoading;
  const error = list.error;

  const renderBody = () => (
    <ListState
      isLoading={isLoading}
      error={error}
      isEmpty={visible.length === 0}
      emptyIcon="calendar-outline"
      emptyMessage={activeTab === 'upcoming' ? t('myBookings.noUpcoming') : t('myBookings.noPast')}>
      <>
        {activeTab === 'past' && (
          <Text className={`text-sm ${subtextColor} mb-3`}>
            {t('myBookings.bookingsCount', { count: past.totalItems })}
          </Text>
        )}
        {/*
          Booking cards are full-width rows — fine in a phone column, and on a desktop a stack of
          1120px bars each holding a thumbnail and four short lines. Two per row keeps their
          proportions and halves the scrolling.
        */}
        <ResponsiveGrid columns={{ mobile: 1, tablet: 1, desktop: 2 }} gap={12} rowGap={0}>
          {visible.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={{
                id: booking.id,
                providerName: booking.providerName,
                serviceType: booking.serviceName,
                date: booking.date,
                time: booking.time,
                price: booking.price,
                currency: booking.currency,
                status: booking.statusLabel,
                image: booking.image,
                rating: booking.rating,
              }}
              isDarkMode={isDarkMode}
              cardBg={cardBg}
              textColor={textColor}
              subtextColor={subtextColor}
              borderColor={borderColor}
              onViewDetails={() =>
                (navigation as any).navigate('BookingDetails', { bookingId: booking.id })
              }
              // Chat only on the Upcoming tab — there is nothing left to coordinate about a job
              // that has already happened (or expired).
              onMessage={
                activeTab === 'upcoming'
                  ? () =>
                      (navigation as any).navigate('Chat', {
                        serviceProviderId: booking.providerId,
                        // Names the booking the chat is about, so the message carries that
                        // context and the thread's subject follows the right service.
                        bookingId: booking.id,
                        serviceId: booking.serviceId,
                        providerName: booking.providerName,
                        providerAvatar: booking.image,
                        subtitle: booking.serviceName,
                      })
                  : undefined
              }
              onLeaveReview={() =>
                review.open({
                  bookingId: booking.id,
                  serviceProviderId: booking.providerId,
                  serviceId: booking.serviceId,
                  serviceName: booking.serviceName,
                })
              }
            />
          ))}
        </ResponsiveGrid>
        {visible.length > 0 && (
          <LoadMoreFooter
            loaded={visible.length}
            total={list.totalItems}
            hasMore={list.hasMore}
            isLoadingMore={list.isLoadingMore}
            onLoadMore={list.loadMore}
          />
        )}
      </>
    </ListState>
  );

  return (
    <>
      <ScreenLayout
        headerVariant="standard"
        headerTitle={t('myBookings.title')}
        contentBg={bgColor}
        showBackButton
        width="default">
        <ScrollView
          className="flex-1"
          scrollEventThrottle={200}
          onScroll={(e) => (isNearBottom(e) ? list.loadMore() : undefined)}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}>
          <View className={`mb-4 ${gutter.px}`}>
            <View className="flex-row">
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => setActiveTab('upcoming')}
                className={`flex-1 border-b-2 py-3 ${activeTab === 'upcoming' ? 'border-brand-500' : `border-gray-300 ${isDarkMode ? 'border-gray-700' : ''}`}`}>
                <Text
                  className={`text-center font-semibold ${activeTab === 'upcoming' ? 'text-brand-600' : subtextColor}`}>
                  {t('myBookings.upcoming')}
                  {!upcoming.isLoading && upcoming.totalItems > 0
                    ? ` (${upcoming.totalItems})`
                    : ''}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => setActiveTab('past')}
                className={`flex-1 border-b-2 py-3 ${activeTab === 'past' ? 'border-brand-500' : `border-gray-300 ${isDarkMode ? 'border-gray-700' : ''}`}`}>
                <Text
                  className={`text-center font-semibold ${activeTab === 'past' ? 'text-brand-600' : subtextColor}`}>
                  {t('myBookings.pastBookings')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className={`${gutter.px}`}>{renderBody()}</View>
        </ScrollView>
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
