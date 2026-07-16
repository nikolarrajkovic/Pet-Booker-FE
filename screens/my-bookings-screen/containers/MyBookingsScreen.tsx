import React, { useState, useCallback } from 'react';
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import { useLocale } from '../../../context/LocaleContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import ReviewModal from '../../../components/shared/ReviewModal';
import { useReviewModal } from '../../../hooks/useReviewModal';
import { BookingCard } from '../components';
import { getBookings, bookingToViewModel, BookingViewModel } from '../../../services/bookings';

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

  const upcomingBookings = bookings.filter((b) => b.statusLabel === 'upcoming');
  const pastBookings = bookings.filter((b) => b.statusLabel !== 'upcoming');
  const visible = activeTab === 'upcoming' ? upcomingBookings : pastBookings;

  const renderBody = () => {
    if (isLoading) {
      return (
        <View className="items-center justify-center py-16">
          <ActivityIndicator size="large" color="#00C870" />
        </View>
      );
    }
    if (error) {
      return (
        <View className="items-center justify-center py-12">
          <Ionicons
            name="alert-circle-outline"
            size={56}
            color={isDarkMode ? '#6B7280' : '#9CA3AF'}
          />
          <Text className={`${subtextColor} mt-4 text-center`}>{error}</Text>
        </View>
      );
    }
    if (visible.length === 0) {
      return (
        <View className="items-center justify-center py-12">
          <Ionicons name="calendar-outline" size={64} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
          <Text className={`${subtextColor} mt-4 text-center`}>
            {activeTab === 'upcoming' ? t('myBookings.noUpcoming') : t('myBookings.noPast')}
          </Text>
        </View>
      );
    }
    return (
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
            onLeaveReview={() =>
              review.open({
                bookingId: booking.id,
                serviceProviderId: booking.providerId,
                serviceName: booking.serviceName,
              })
            }
          />
        ))}
      </>
    );
  };

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
