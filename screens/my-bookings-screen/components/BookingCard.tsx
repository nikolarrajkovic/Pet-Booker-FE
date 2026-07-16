import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocale } from '../../../context/LocaleContext';

interface Booking {
  id: number;
  providerName: string;
  serviceType: string;
  date: string;
  time: string;
  price: number;
  status: 'upcoming' | 'completed' | 'cancelled';
  rating?: number;
  image: string;
}

interface BookingCardProps {
  booking: Booking;
  isDarkMode: boolean;
  cardBg: string;
  textColor: string;
  subtextColor: string;
  borderColor: string;
  onViewDetails?: () => void;
  onLeaveReview?: () => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'upcoming':
      return 'text-blue-600';
    case 'completed':
      return 'text-green-600';
    case 'cancelled':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
};

// statusLabel string → BookingState enum value (for the localized tEnum lookup).
const STATUS_TO_STATE: Record<string, number> = { upcoming: 0, completed: 1, cancelled: 2 };

export default function BookingCard({
  booking,
  isDarkMode,
  cardBg,
  textColor,
  subtextColor,
  borderColor,
  onViewDetails,
  onLeaveReview,
}: BookingCardProps) {
  const { t, tEnum } = useLocale();
  const canReview = booking.status === 'completed' && !booking.rating && !!onLeaveReview;
  return (
    <View className={`${cardBg} mb-3 rounded-2xl border p-4 ${borderColor}`}>
      <View className="flex-row">
        <Image source={{ uri: booking.image }} className="mr-4 h-20 w-20 rounded-xl" />
        <View className="flex-1">
          <View className="mb-2 flex-row items-start justify-between">
            <Text className={`text-base font-semibold ${textColor} flex-1`}>
              {booking.providerName}
            </Text>
            <Text className={`text-sm font-semibold ${getStatusColor(booking.status)}`}>
              {tEnum('bookingState', STATUS_TO_STATE[booking.status] ?? 0, booking.status)}
            </Text>
          </View>
          <Text className={`text-sm ${subtextColor} mb-2`}>{booking.serviceType}</Text>
          <View className="mb-2 flex-row items-center">
            <Ionicons
              name="calendar-outline"
              size={14}
              color={isDarkMode ? '#9CA3AF' : '#6B7280'}
            />
            <Text className={`text-xs ${subtextColor} ml-1`}>{booking.date}</Text>
            <Ionicons
              name="time-outline"
              size={14}
              color={isDarkMode ? '#9CA3AF' : '#6B7280'}
              style={{ marginLeft: 12 }}
            />
            <Text className={`text-xs ${subtextColor} ml-1`}>{booking.time}</Text>
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-bold text-brand-600">${booking.price}</Text>
            <View className="flex-row items-center" style={{ gap: 12 }}>
              {booking.rating ? (
                <View className="flex-row items-center">
                  <Ionicons name="star" size={16} color="#FFC107" />
                  <Text className={`text-sm font-semibold ${textColor} ml-1`}>
                    {booking.rating.toFixed(1)}
                  </Text>
                </View>
              ) : null}
              {canReview ? (
                <TouchableOpacity className="flex-row items-center" onPress={onLeaveReview}>
                  <Ionicons name="star-outline" size={15} color="#F59E0B" />
                  <Text className="ml-1 text-sm font-semibold" style={{ color: '#F59E0B' }}>
                    {t('myBookings.review')}
                  </Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={onViewDetails}>
                <Text className="text-sm font-semibold text-brand-600">
                  {t('myBookings.viewDetails')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
