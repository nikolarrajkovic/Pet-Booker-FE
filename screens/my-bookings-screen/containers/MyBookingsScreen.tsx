import React, { useState, useCallback } from 'react';
import { ScrollView, Text, View, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import { useLocale } from '../../../context/LocaleContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import ListState from '../../../components/shared/ListState';
import ReviewModal from '../../../components/shared/ReviewModal';
import { useReviewModal } from '../../../hooks/useReviewModal';
import { BookingCard } from '../components';
import {
  getBookings,
  bookingToViewModel,
  parseBookingDate,
  BookingViewModel,
  ACTIVE_STATUS_LABELS,
} from '../../../services/bookings';

export default function MyBookingsScreen() {
  const navigation = useNavigation();
  const { currentUser } = useAuth();
  const { isDarkMode, bgColor, cardBg, textColor, subtextColor, borderColor } = useThemeColors();
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [bookings, setBookings] = useState<BookingViewModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const userId = currentUser?.id;
    if (!userId) {
      setBookings([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const dtos = await getBookings({ userId });
      setBookings(dtos.map(bookingToViewModel));
    } catch (e: any) {
      setError(e?.message ?? t('myBookings.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id, t]);

  // Reload after a review is submitted so the new rating replaces the CTA.
  const review = useReviewModal(() => {
    load();
  });

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

  /**
   * Splits the two tabs by state AND by the clock.
   *
   * State alone is not enough: a booking the provider accepted but never completed keeps its
   * "Booked" status forever, so it sat under **Upcoming** indefinitely — this account's Upcoming
   * tab listed six appointments, every one of them weeks in the past. A tab labelled "Upcoming"
   * has to mean "still ahead of you".
   *
   * Two deliberate softenings so nothing vanishes while the user is looking at it:
   * - an in-progress booking always counts as current, whatever its start time says;
   * - the cutoff is the START OF TODAY, not "now", so a booking earlier today stays put rather
   *   than jumping tabs partway through the day it happens on.
   */
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const isStillAhead = (b: BookingViewModel) => {
    if (b.statusLabel === 'in-progress') return true;
    const start = parseBookingDate(b.bookingFrom);
    return isNaN(start.getTime()) || start.getTime() >= startOfToday.getTime();
  };

  const upcomingBookings = bookings
    .filter((b) => ACTIVE_STATUS_LABELS.includes(b.statusLabel) && isStillAhead(b))
    // Soonest first — an "upcoming" list is read in the order things happen.
    .sort(
      (a, b) =>
        parseBookingDate(a.bookingFrom).getTime() - parseBookingDate(b.bookingFrom).getTime()
    );
  const pastBookings = bookings
    .filter((b) => !ACTIVE_STATUS_LABELS.includes(b.statusLabel) || !isStillAhead(b))
    // Most recent first — the opposite order, for the same reason.
    .sort(
      (a, b) =>
        parseBookingDate(b.bookingFrom).getTime() - parseBookingDate(a.bookingFrom).getTime()
    );
  const visible = activeTab === 'upcoming' ? upcomingBookings : pastBookings;

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
            {t('myBookings.bookingsCount', { count: pastBookings.length })}
          </Text>
        )}
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
            // that has already happened. Keyed off the tab rather than the status label on
            // purpose: a booking the provider accepted but never completed keeps an "active"
            // label forever, and those sit under Past once their date has gone by.
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
      </>
    </ListState>
  );

  return (
    <>
      <ScreenLayout
        headerVariant="standard"
        showBackButton
        headerTitle={t('myBookings.title')}
        contentBg={bgColor}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}>
          <View className="mb-4 px-6">
            <View className="flex-row">
              <TouchableOpacity
                onPress={() => setActiveTab('upcoming')}
                className={`flex-1 border-b-2 py-3 ${activeTab === 'upcoming' ? 'border-brand-500' : `border-gray-300 ${isDarkMode ? 'border-gray-700' : ''}`}`}>
                <Text
                  className={`text-center font-semibold ${activeTab === 'upcoming' ? 'text-brand-600' : subtextColor}`}>
                  {t('myBookings.upcoming')}
                  {!isLoading && upcomingBookings.length > 0 ? ` (${upcomingBookings.length})` : ''}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab('past')}
                className={`flex-1 border-b-2 py-3 ${activeTab === 'past' ? 'border-brand-500' : `border-gray-300 ${isDarkMode ? 'border-gray-700' : ''}`}`}>
                <Text
                  className={`text-center font-semibold ${activeTab === 'past' ? 'text-brand-600' : subtextColor}`}>
                  {t('myBookings.pastBookings')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="px-6">{renderBody()}</View>
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
