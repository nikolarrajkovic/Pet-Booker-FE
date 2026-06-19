import React, { useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { PriceBreakdown, PaymentMethodSelector } from '../components';
import { resolveImageUrl, AddressDto } from '../../../services/service-providers';
import { addressLabel } from '../../../services/geocoding';
import { ServiceDto } from '../../../services/services';
import { createBooking, parseBookingDate, PaymentType } from '../../../services/bookings';
import { getPaymentMethods, createPaymentMethod, PaymentMethodStatus } from '../../../services/payment-methods';

type Appointment = {
  id: number;
  service: { id: number; name: string; price: number };
  pet: { id: number; name: string; image: string };
  addons: { name: string; price: number }[];
  bookingFrom: string;
  bookingTo: string;
  total: number;
  pickupAddress?: AddressDto;
  leaveOverAddress?: AddressDto;
};

type ReviewBookingRouteParams = {
  service: ServiceDto;
  appointments: Appointment[];
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
  const { service, appointments } = route.params;
  const { currentUser } = useAuth();
  const serviceImage = resolveImageUrl(
    service.imageUrl ?? (service.photos?.find((p) => p.isSelected) ?? service.photos?.[0])?.src,
  );
  const { isDarkMode, cardBg, bgColor: contentBg, textColor, subtextColor, borderColor } = useThemeColors();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('online');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const serviceTotal = appointments.reduce((s, a) => s + a.service.price, 0);
  // Aggregate add-ons by name across all appointments so each one is its own breakdown line.
  const addonLines = Object.values(
    appointments
      .flatMap((a) => a.addons)
      .reduce<Record<string, { name: string; price: number }>>((acc, ad) => {
        acc[ad.name] = { name: ad.name, price: (acc[ad.name]?.price ?? 0) + ad.price };
        return acc;
      }, {}),
  );
  const grandTotal = appointments.reduce((s, a) => s + a.total, 0);

  const handleConfirm = async () => {
    if (!currentUser?.id) {
      Alert.alert('Not signed in', 'Please sign in again to complete your booking.');
      return;
    }
    setIsSubmitting(true);
    try {
      const isCash = selectedPaymentMethod === 'cash';
      const paymentMethodId = await resolvePaymentMethodId(currentUser.id, isCash);

      // One booking per appointment (the API creates a single booking per call).
      for (const apt of appointments) {
        await createBooking({
          userId: currentUser.id,
          serviceProviderId: service.serviceProviderId,
          serviceId: apt.service.id,
          petId: apt.pet.id,
          paymentMethodId,
          bookingFrom: apt.bookingFrom,
          bookingTo: apt.bookingTo,
          basePrice: apt.service.price,
          discountAmount: 0,
          totalPrice: apt.total,
          paymentType: isCash ? PaymentType.Cash : PaymentType.Card,
          pickupAddress: apt.pickupAddress,
          leaveOverAddress: apt.leaveOverAddress,
        });
      }

      (navigation as any).navigate('BookingConfirmed', { serviceName: service.name ?? 'your service' });
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
        {/* Service Info */}
        <View className="px-6 py-5 flex-row items-center">
          {serviceImage ? (
            <Image source={{ uri: serviceImage }} className="w-16 h-16 rounded-xl mr-4" resizeMode="cover" />
          ) : (
            <View className={`w-16 h-16 rounded-xl mr-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'} items-center justify-center`}>
              <Ionicons name="paw" size={26} color="#9CA3AF" />
            </View>
          )}
          <View className="flex-1">
            <Text className={`text-lg font-bold ${textColor}`}>{service.name ?? 'Service'}</Text>
            {service.basicServiceName ? (
              <Text className="text-sm text-brand-600 mt-1">{service.basicServiceName}</Text>
            ) : null}
          </View>
        </View>

        {/* Booking Details — one block per appointment */}
        <View className={`px-6 py-5 border-t ${borderColor}`}>
          <Text className={`text-base font-semibold ${textColor} mb-4`}>
            Booking Details{appointments.length > 1 ? ` (${appointments.length})` : ''}
          </Text>
          {appointments.map((apt, i) => {
            const start = parseBookingDate(apt.bookingFrom);
            return (
              <View key={apt.id} className={i > 0 ? `mt-4 pt-4 border-t ${borderColor}` : ''}>
                <Text className={`text-base font-semibold ${textColor}`}>
                  {apt.service.name} <Text className={`${subtextColor} font-normal`}>for {apt.pet.name}</Text>
                </Text>
                <View className="flex-row items-center mt-1.5">
                  <Ionicons name="calendar-outline" size={14} color="#00C870" style={{ marginRight: 6 }} />
                  <Text className={`text-sm ${subtextColor}`}>
                    {start.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
                <View className="flex-row items-center mt-1">
                  <Ionicons name="time-outline" size={14} color="#00C870" style={{ marginRight: 6 }} />
                  <Text className={`text-sm ${subtextColor}`}>
                    {start.toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })}
                  </Text>
                </View>
                {apt.addons.length > 0 && (
                  <Text className={`text-xs ${subtextColor} mt-1`}>+ {apt.addons.map((a) => a.name).join(', ')}</Text>
                )}
                {apt.pickupAddress ? (
                  <View className="flex-row items-start mt-1">
                    <Ionicons name="car-outline" size={14} color="#00C870" style={{ marginRight: 6, marginTop: 1 }} />
                    <Text className={`text-xs ${subtextColor} flex-1`}>Pickup: {addressLabel(apt.pickupAddress)}</Text>
                  </View>
                ) : null}
                {apt.leaveOverAddress ? (
                  <View className="flex-row items-start mt-1">
                    <Ionicons name="home-outline" size={14} color="#00C870" style={{ marginRight: 6, marginTop: 1 }} />
                    <Text className={`text-xs ${subtextColor} flex-1`}>Drop-off: {addressLabel(apt.leaveOverAddress)}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <PriceBreakdown
          isDarkMode={isDarkMode}
          textColor={textColor}
          subtextColor={subtextColor}
          borderColor={borderColor}
          serviceTotal={serviceTotal}
          addons={addonLines}
          total={grandTotal}
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
