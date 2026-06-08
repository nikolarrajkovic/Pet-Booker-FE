import React, { useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Image } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { BookingDetails, PriceBreakdown, PaymentMethodSelector } from '../components';

type ReviewBookingRouteParams = {
  provider: {
    id: number; name: string; service: string; rating: number; reviews: number;
    distance: string; price: number; image: string; verified: boolean;
    latitude: number; longitude: number;
  };
  appointments: any[];
};

export default function ReviewBookingScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: ReviewBookingRouteParams }, 'params'>>();
  const { provider, appointments } = route.params;
  const { isDarkMode, cardBg, bgColor: contentBg, textColor, subtextColor, borderColor } = useThemeColors();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('online');

  const bgColor = isDarkMode ? 'bg-[#1a2332]' : 'bg-brand-500';

  const calculateTotal = () => appointments.reduce((sum: number, apt: any) => sum + apt.total, 0);
  const calculateServiceTotal = () => appointments.reduce((sum: number, apt: any) => sum + apt.service.price, 0);
  const calculateAddonsTotal = () => appointments.reduce((sum: number, apt: any) => sum + apt.addons.reduce((addonSum: number, addon: any) => addonSum + addon.price, 0), 0);

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
            <Text className="text-sm text-brand-600 mt-1">{provider.service}</Text>
            <View className="flex-row items-center mt-1">
              <Ionicons name="location-outline" size={14} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
              <Text className={`text-xs ${subtextColor} ml-1`}>{provider.distance} away</Text>
            </View>
          </View>
        </View>

        <BookingDetails isDarkMode={isDarkMode} textColor={textColor} subtextColor={subtextColor} borderColor={borderColor} />

        <PriceBreakdown
          isDarkMode={isDarkMode}
          textColor={textColor}
          subtextColor={subtextColor}
          borderColor={borderColor}
          serviceTotal={calculateServiceTotal()}
          addonsTotal={calculateAddonsTotal()}
          total={calculateTotal()}
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
        <TouchableOpacity onPress={() => (navigation as any).navigate('BookingConfirmed', { provider })} className="bg-brand-500 py-4 rounded-2xl items-center">
          <Text className="text-white text-lg font-bold">Confirm Booking</Text>
        </TouchableOpacity>
      </View>
    </ScreenLayout>
  );
}
