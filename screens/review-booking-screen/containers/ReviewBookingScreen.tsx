import React, { useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { PriceBreakdown, PaymentMethodSelector } from '../components';
import type { ProviderViewModel } from '../../../services/service-providers';
import { createBooking, PaymentType } from '../../../services/bookings';
import {
  getPaymentMethods,
  createPaymentMethod,
  PaymentMethodStatus,
} from '../../../services/payment-methods';

type BookingDraft = {
  serviceId: number;
  serviceName: string;
  basePrice: number;
  price: number;
  petId: number;
  petName: string;
  petImage: string;
  bookingFrom: string;
  bookingTo: string;
  pickup: boolean;
  leaveOver: boolean;
  pickupSurcharge: number;
  leaveOverSurcharge: number;
  total: number;
};

type ReviewBookingRouteParams = {
  provider: ProviderViewModel;
  booking: BookingDraft;
};

/**
 * Resolves a usable paymentMethodId for the user. The API requires bookings to
 * reference a real PaymentMethod, so if the user has none we create a default
 * placeholder (real payment UX is future work — see CLAUDE.md).
 */
async function resolvePaymentMethodId(userId: number, isCash: boolean): Promise<number> {
  const existing = await getPaymentMethods(userId);
  if (existing.length) {
    const def = existing.find((m) => m.isDefault) ?? existing[0];
    if (def.id != null) return def.id;
  }
  const created = await createPaymentMethod({
    userId,
    type: isCash ? PaymentType.Cash : PaymentType.Card,
    provider: 'manual',
    // API requires a non-empty providerPaymentMethodId; use a synthetic value
    // until a real payment gateway is wired up (see CLAUDE.md).
    providerPaymentMethodId: `manual-${userId}-${Date.now()}`,
    isDefault: true,
    status: PaymentMethodStatus.Active,
    cardHolderName: 'Account Holder',
  });
  if (created.id == null) throw new Error('Could not create a payment method.');
  return created.id;
}

export default function ReviewBookingScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: ReviewBookingRouteParams }, 'params'>>();
  const { provider, booking } = route.params;
  const { currentUser } = useAuth();
  const { isDarkMode, cardBg, bgColor: contentBg, textColor, subtextColor, borderColor } = useThemeColors();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('online');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addonsTotal =
    (booking.pickup ? booking.pickupSurcharge : 0) + (booking.leaveOver ? booking.leaveOverSurcharge : 0);

  const start = new Date(booking.bookingFrom);
  const dateLabel = start.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timeLabel = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  const handleConfirm = async () => {
    if (!currentUser?.id) {
      Alert.alert('Not signed in', 'Please sign in again to complete your booking.');
      return;
    }
    setIsSubmitting(true);
    try {
      const isCash = selectedPaymentMethod === 'cash';
      const paymentMethodId = await resolvePaymentMethodId(currentUser.id, isCash);

      await createBooking({
        userId: currentUser.id,
        serviceProviderId: provider.id,
        serviceId: booking.serviceId,
        petId: booking.petId,
        paymentMethodId,
        bookingFrom: booking.bookingFrom,
        bookingTo: booking.bookingTo,
        basePrice: booking.basePrice,
        discountAmount: 0,
        totalPrice: booking.total,
        paymentType: isCash ? PaymentType.Cash : PaymentType.Card,
      });

      (navigation as any).navigate('BookingConfirmed', { provider });
    } catch (error: any) {
      Alert.alert('Booking Failed', error?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle="Review Booking"
      contentBg={contentBg}
      contentRounded={false}
    >
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Provider Info */}
        <View className="px-6 py-5 flex-row items-center">
          <Image source={{ uri: provider.image }} className="w-16 h-16 rounded-xl mr-4" resizeMode="cover" />
          <View className="flex-1">
            <Text className={`text-lg font-bold ${textColor}`}>{provider.name}</Text>
            <Text className="text-sm text-brand-600 mt-1">{booking.serviceName}</Text>
          </View>
        </View>

        {/* Booking Details */}
        <View className={`px-6 py-5 border-t ${borderColor}`}>
          <Text className={`text-base font-semibold ${textColor} mb-4`}>Booking Details</Text>
          <DetailRow icon="paw" label="Pet" value={booking.petName} isDarkMode={isDarkMode} textColor={textColor} subtextColor={subtextColor} />
          <DetailRow icon="calendar" label="Date" value={dateLabel} isDarkMode={isDarkMode} textColor={textColor} subtextColor={subtextColor} />
          <DetailRow icon="time-outline" label="Time" value={timeLabel} isDarkMode={isDarkMode} textColor={textColor} subtextColor={subtextColor} />
          {booking.pickup && (
            <DetailRow icon="car-outline" label="Pickup" value="Included" isDarkMode={isDarkMode} textColor={textColor} subtextColor={subtextColor} />
          )}
          {booking.leaveOver && (
            <DetailRow icon="bed-outline" label="Leave-over" value="Included" isDarkMode={isDarkMode} textColor={textColor} subtextColor={subtextColor} last />
          )}
        </View>

        <PriceBreakdown
          isDarkMode={isDarkMode}
          textColor={textColor}
          subtextColor={subtextColor}
          borderColor={borderColor}
          serviceTotal={booking.price}
          addonsTotal={addonsTotal}
          total={booking.total}
        />

        <PaymentMethodSelector
          isDarkMode={isDarkMode}
          textColor={textColor}
          subtextColor={subtextColor}
          borderColor={borderColor}
          selectedMethod={selectedPaymentMethod}
          onSelectMethod={setSelectedPaymentMethod}
        />

        {/* Cancellation Policy */}
        <View className={`px-6 py-5 border-t ${borderColor}`}>
          <Text className={`text-base font-semibold ${textColor} mb-3`}>Cancellation Policy</Text>
          <Text className={`text-sm ${subtextColor} leading-6`}>
            Free cancellation up to 24 hours before the appointment. Cancellations within 24 hours may incur a 50% charge.
          </Text>
        </View>
      </ScrollView>

      <View className={`absolute bottom-0 left-0 right-0 ${cardBg} border-t ${borderColor} px-6 py-4`}>
        <TouchableOpacity
          disabled={isSubmitting}
          onPress={handleConfirm}
          className="bg-brand-500 py-4 rounded-2xl items-center"
          style={{ opacity: isSubmitting ? 0.7 : 1 }}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-lg font-bold">Confirm Booking</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScreenLayout>
  );
}

function DetailRow({
  icon, label, value, isDarkMode, textColor, subtextColor, last,
}: {
  icon: string; label: string; value: string;
  isDarkMode: boolean; textColor: string; subtextColor: string; last?: boolean;
}) {
  return (
    <View className={`flex-row items-start ${last ? '' : 'mb-4'}`}>
      <View className={`w-10 h-10 ${isDarkMode ? 'bg-brand-500/20' : 'bg-brand-50'} rounded-xl items-center justify-center mr-3`}>
        {icon === 'paw' || icon === 'calendar' ? (
          <MaterialCommunityIcons name={icon as any} size={20} color="#00C870" />
        ) : (
          <Ionicons name={icon as any} size={20} color="#00C870" />
        )}
      </View>
      <View className="flex-1">
        <Text className={`text-sm ${subtextColor}`}>{label}</Text>
        <Text className={`text-base ${textColor} font-medium mt-1`}>{value}</Text>
      </View>
    </View>
  );
}
