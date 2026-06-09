import React, { useState, useCallback } from 'react';
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { BookingCard } from '../components';
import { getBookings, bookingToViewModel, BookingViewModel } from '../../../services/bookings';

export default function MyBookingsScreen() {
  const { currentUser } = useAuth();
  const { isDarkMode, bgColor, cardBg, textColor, subtextColor, borderColor } = useThemeColors();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [bookings, setBookings] = useState<BookingViewModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const userId = currentUser?.id;
      if (!userId) {
        setBookings([]);
        setIsLoading(false);
        return;
      }

      const load = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const dtos = await getBookings({ userId });
          if (!cancelled) setBookings(dtos.map(bookingToViewModel));
        } catch (e: any) {
          if (!cancelled) setError(e?.message ?? 'Failed to load bookings.');
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      };

      load();
      return () => { cancelled = true; };
    }, [currentUser?.id])
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
          <Ionicons name="alert-circle-outline" size={56} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
          <Text className={`${subtextColor} text-center mt-4`}>{error}</Text>
        </View>
      );
    }
    if (visible.length === 0) {
      return (
        <View className="items-center justify-center py-12">
          <Ionicons name="calendar-outline" size={64} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
          <Text className={`${subtextColor} text-center mt-4`}>
            No {activeTab === 'upcoming' ? 'upcoming' : 'past'} bookings
          </Text>
        </View>
      );
    }
    return (
      <>
        {activeTab === 'past' && (
          <Text className={`text-sm ${subtextColor} mb-3`}>{pastBookings.length} bookings</Text>
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
          />
        ))}
      </>
    );
  };

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle="My Bookings"
      contentBg={bgColor}
    >
      <ScrollView className="flex-1" contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}>
        <View className="px-6 mb-4">
          <View className="flex-row">
            <TouchableOpacity
              onPress={() => setActiveTab('upcoming')}
              className={`flex-1 py-3 border-b-2 ${activeTab === 'upcoming' ? 'border-brand-500' : `border-gray-300 ${isDarkMode ? 'border-gray-700' : ''}`}`}
            >
              <Text className={`text-center font-semibold ${activeTab === 'upcoming' ? 'text-brand-600' : subtextColor}`}>
                Upcoming{!isLoading && upcomingBookings.length > 0 ? ` (${upcomingBookings.length})` : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('past')}
              className={`flex-1 py-3 border-b-2 ${activeTab === 'past' ? 'border-brand-500' : `border-gray-300 ${isDarkMode ? 'border-gray-700' : ''}`}`}
            >
              <Text className={`text-center font-semibold ${activeTab === 'past' ? 'text-brand-600' : subtextColor}`}>Past Bookings</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="px-6">{renderBody()}</View>
      </ScrollView>
    </ScreenLayout>
  );
}
