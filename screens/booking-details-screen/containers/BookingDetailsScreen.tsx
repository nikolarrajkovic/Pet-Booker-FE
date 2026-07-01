import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View, Image, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import ReviewModal from '../../../components/shared/ReviewModal';
import { useReviewModal } from '../../../hooks/useReviewModal';
import { getBooking, bookingToViewModel, BookingDto } from '../../../services/bookings';
import { resolveImageUrl } from '../../../services/service-providers';
import { addressLabel } from '../../../services/geocoding';

type RouteParams = { bookingId: number };

const PAYMENT_LABELS: Record<number, string> = {
  0: 'Cash',
  1: 'Card',
  2: 'Bank Transfer',
  3: 'Wallet',
};
const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  upcoming: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Upcoming' },
  completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' },
};

export default function BookingDetailsScreen() {
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const { bookingId } = route.params;
  const { isDarkMode, bgColor, textColor, subtextColor, borderColor } = useThemeColors();

  const [dto, setDto] = useState<BookingDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Re-fetch after a review is submitted so the recap shows the new rating.
  const review = useReviewModal(() => {
    getBooking(bookingId)
      .then(setDto)
      .catch(() => {});
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const b = await getBooking(bookingId);
        if (!cancelled) setDto(b);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load booking.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const vm = dto ? bookingToViewModel(dto) : null;
  const heroImage = vm?.image || '';
  const status = STATUS_STYLE[vm?.statusLabel ?? 'upcoming'] ?? STATUS_STYLE.upcoming;
  const pickup = dto?.pickupAddress;
  const dropoff = dto?.leaveOverAddress;
  const reviewRating = dto?.review?.rating ?? null;
  const isCompleted = vm?.statusLabel === 'completed';
  const petImage = resolveImageUrl(
    dto?.pet?.photos?.find((p) => p.isSelected)?.src ?? dto?.pet?.photos?.[0]?.src
  );

  const Row = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
    <View className={`flex-row items-center justify-between border-b py-3 ${borderColor}`}>
      <View className="mr-3 flex-1 flex-row items-center">
        <Ionicons name={icon as any} size={18} color="#00C870" />
        <Text className={`text-sm ${subtextColor} ml-3`}>{label}</Text>
      </View>
      <Text className={`text-sm font-semibold ${textColor} flex-1 text-right`} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );

  return (
    <>
      <ScreenLayout
        headerVariant="standard"
        showBackButton
        headerTitle="Booking Details"
        contentBg={bgColor}>
        {isLoading ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color="#00C870" />
          </View>
        ) : error || !dto || !vm ? (
          <View className="flex-1 items-center justify-center px-6 py-20">
            <Ionicons
              name="alert-circle-outline"
              size={56}
              color={isDarkMode ? '#6B7280' : '#9CA3AF'}
            />
            <Text className={`${subtextColor} mt-4 text-center`}>
              {error ?? 'Booking not found.'}
            </Text>
          </View>
        ) : (
          <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
            {/* Service / provider header */}
            <View className="flex-row items-center px-6 pt-5">
              {heroImage ? (
                <Image
                  source={{ uri: heroImage }}
                  className="mr-4 h-20 w-20 rounded-2xl"
                  resizeMode="cover"
                />
              ) : (
                <View
                  className={`mr-4 h-20 w-20 rounded-2xl ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'} items-center justify-center`}>
                  <Ionicons name="paw" size={30} color="#9CA3AF" />
                </View>
              )}
              <View className="flex-1">
                <Text className={`text-lg font-bold ${textColor}`}>{vm.serviceName}</Text>
                <Text className={`text-sm ${subtextColor} mt-0.5`}>{vm.providerName}</Text>
                <View className={`mt-2 self-start rounded-full px-2.5 py-1 ${status.bg}`}>
                  <Text className={`text-xs font-semibold ${status.text}`}>{status.label}</Text>
                </View>
              </View>
            </View>

            {/* Appointment */}
            <View className="mt-6 px-6">
              <Text className={`text-base font-bold ${textColor} mb-1`}>Appointment</Text>
              <Row icon="calendar-outline" label="Date" value={vm.date} />
              <Row icon="time-outline" label="Time" value={vm.time} />
              <Row icon="paw-outline" label="Pet" value={dto.pet?.name ?? vm.petName} />
              <Row icon="person-outline" label="Provider" value={vm.providerName} />
            </View>

            {/* Pet image (optional flourish) */}
            {petImage ? (
              <View className="mt-4 flex-row items-center px-6">
                <Image
                  source={{ uri: petImage }}
                  className="mr-3 h-12 w-12 rounded-xl"
                  resizeMode="cover"
                />
                <Text className={`text-sm ${subtextColor}`}>{dto.pet?.name ?? vm.petName}</Text>
              </View>
            ) : null}

            {/* Location */}
            {(pickup || dropoff) && (
              <View className="mt-6 px-6">
                <Text className={`text-base font-bold ${textColor} mb-1`}>Location</Text>
                {pickup ? (
                  <Row icon="car-outline" label="Pickup" value={addressLabel(pickup)} />
                ) : null}
                {dropoff ? (
                  <Row icon="home-outline" label="Drop-off" value={addressLabel(dropoff)} />
                ) : null}
              </View>
            )}

            {/* Payment */}
            <View className="mt-6 px-6">
              <Text className={`text-base font-bold ${textColor} mb-1`}>Payment</Text>
              <Row
                icon="card-outline"
                label="Method"
                value={PAYMENT_LABELS[dto.paymentType] ?? '—'}
              />
              <View
                className={`flex-row items-center justify-between border-b py-3 ${borderColor}`}>
                <Text className={`text-sm ${subtextColor}`}>Subtotal</Text>
                <Text className={`text-sm ${textColor}`}>${dto.basePrice}</Text>
              </View>
              {dto.discountAmount > 0 && (
                <View
                  className={`flex-row items-center justify-between border-b py-3 ${borderColor}`}>
                  <Text className={`text-sm ${subtextColor}`}>Discount</Text>
                  <Text className="text-sm text-brand-600">- ${dto.discountAmount}</Text>
                </View>
              )}
              <View className="flex-row items-center justify-between py-3">
                <Text className={`text-base font-bold ${textColor}`}>Total</Text>
                <Text className="text-xl font-bold text-brand-600">${dto.totalPrice}</Text>
              </View>
            </View>

            {/* Review — show the existing rating, or a CTA for completed bookings */}
            {reviewRating != null ? (
              <View className="mt-6 px-6">
                <Text className={`text-base font-bold ${textColor} mb-2`}>Your Review</Text>
                <View className="flex-row items-center">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <Ionicons
                      key={v}
                      name={v <= reviewRating ? 'star' : 'star-outline'}
                      size={22}
                      color="#F59E0B"
                      style={{ marginRight: 4 }}
                    />
                  ))}
                </View>
              </View>
            ) : isCompleted ? (
              <View className="mt-6 px-6">
                <TouchableOpacity
                  onPress={() =>
                    review.open({
                      bookingId: dto.id ?? bookingId,
                      serviceProviderId: dto.serviceProviderId,
                      serviceName: vm.serviceName,
                    })
                  }
                  activeOpacity={0.85}
                  className="flex-row items-center justify-center rounded-2xl bg-brand-500 py-4">
                  <Ionicons name="star" size={18} color="white" />
                  <Text className="ml-2 text-base font-bold text-white">Leave a Review</Text>
                </TouchableOpacity>
              </View>
            ) : null}
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
