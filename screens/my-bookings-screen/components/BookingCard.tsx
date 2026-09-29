import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocale } from '../../../context/LocaleContext';
import { BRAND_GREEN } from '../../../hooks/useThemeColors';
import { BookingStatusLabel } from '../../../services/bookings';
import { formatMoney } from '../../../services/currency';

interface Booking {
  id: number;
  providerName: string;
  serviceType: string;
  date: string;
  time: string;
  price: number;
  currency?: string | null;
  status: BookingStatusLabel;
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
  /** Omit to hide the chat action — the parent decides which bookings are still messageable. */
  onMessage?: () => void;
}

// Tinted pill per state — the same treatment Booking Details gives the status, so the list and the
// detail screen read as one design. Fill + text pairs are chosen per theme so the pill keeps its
// contrast on the dark card too.
const getStatusPill = (status: string, isDarkMode: boolean) => {
  const light: Record<string, string> = {
    upcoming: 'bg-blue-50 text-blue-700',
    booked: 'bg-indigo-50 text-indigo-700',
    'in-progress': 'bg-amber-50 text-amber-700',
    completed: 'bg-green-50 text-green-700',
    cancelled: 'bg-red-50 text-red-700',
  };
  const dark: Record<string, string> = {
    upcoming: 'bg-blue-500/15 text-blue-300',
    booked: 'bg-indigo-500/15 text-indigo-300',
    'in-progress': 'bg-amber-500/15 text-amber-300',
    completed: 'bg-green-500/15 text-green-300',
    cancelled: 'bg-red-500/15 text-red-300',
  };
  return (
    (isDarkMode ? dark : light)[status] ??
    (isDarkMode ? 'bg-white/10 text-gray-300' : 'bg-gray-100 text-gray-700')
  );
};

// statusLabel string → BookingState enum value (for the localized tEnum lookup).
const STATUS_TO_STATE: Record<string, number> = {
  upcoming: 0,
  completed: 1,
  cancelled: 2,
  booked: 3,
  'in-progress': 4,
};

export default function BookingCard({
  booking,
  isDarkMode,
  cardBg,
  textColor,
  subtextColor,
  borderColor,
  onViewDetails,
  onLeaveReview,
  onMessage,
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
            <Text
              className={`ml-2 overflow-hidden rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusPill(
                booking.status,
                isDarkMode
              )}`}>
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
          {/* `gap` keeps the price from touching the chat bubble, and the price never shrinks —
              it is the one figure on the card that must read in full. */}
          <View className="flex-row items-center justify-between" style={{ gap: 6 }}>
            <Text className="text-base font-bold text-brand-600" style={{ flexShrink: 0 }}>
              {formatMoney(booking.price, booking.currency)}
            </Text>
            <View className="flex-row items-center" style={{ gap: 8 }}>
              {booking.rating ? (
                <View className="flex-row items-center">
                  <Ionicons name="star" size={16} color="#FFC107" />
                  <Text className={`text-sm font-semibold ${textColor} ml-1`}>
                    {booking.rating.toFixed(1)}
                  </Text>
                </View>
              ) : null}
              {canReview ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  className="flex-row items-center"
                  onPress={onLeaveReview}>
                  <Ionicons name="star-outline" size={15} color="#F59E0B" />
                  <Text className="ml-1 text-sm font-semibold" style={{ color: '#F59E0B' }}>
                    {t('myBookings.review')}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {/* Only offered while the booking is still live — there is nothing to
                  coordinate about a completed or cancelled job. */}
              {onMessage ? (
                <TouchableOpacity
                  onPress={onMessage}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={t('messages.messageProvider')}
                  className={`h-8 w-8 items-center justify-center rounded-full ${
                    isDarkMode ? 'bg-brand-500/15' : 'bg-brand-50'
                  }`}>
                  <Ionicons name="chatbubble-outline" size={15} color={BRAND_GREEN} />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity accessibilityRole="button" onPress={onViewDetails}>
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
