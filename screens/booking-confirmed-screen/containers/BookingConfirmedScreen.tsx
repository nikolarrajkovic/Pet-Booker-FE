import React from 'react';
import { SafeAreaView, View, Text, TouchableOpacity } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAppNavigation } from '../../../hooks/useAppNavigation';
import AnimatedCheckmark from '../../../components/shared/AnimatedCheckmark';

type BookingConfirmedRouteParams = {
  serviceName: string;
};

export default function BookingConfirmedScreen() {
  // Terminal screen — reset so back can't re-enter the completed booking flow.
  const { resetToTab, resetToScreen } = useAppNavigation();
  const route = useRoute<RouteProp<{ params: BookingConfirmedRouteParams }, 'params'>>();
  const { serviceName } = route.params;
  const { isDarkMode, bgColor, textColor, subtextColor, borderColor } = useThemeColors();

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      <View className="flex-1 items-center justify-center px-6">
        <View className="mb-8">
          <AnimatedCheckmark size={128} isDarkMode={isDarkMode} />
        </View>
        <Text className={`self-stretch text-center text-2xl font-bold ${textColor} mb-4`}>
          Booking Confirmed!
        </Text>
        <Text className={`self-stretch text-center text-base ${subtextColor} leading-6 mb-8`}>
          Your booking for {serviceName} has been confirmed. You&apos;ll receive a confirmation email shortly.
        </Text>
        <View className="w-full">
          <TouchableOpacity
            onPress={() => resetToTab('Home')}
            className="bg-brand-500 py-4 rounded-2xl items-center mb-3"
          >
            <Text className="text-white text-lg font-bold">Back to Home</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => resetToScreen('MyBookings')}
            className={`${isDarkMode ? 'bg-[#1a2332]' : 'bg-white'} border ${borderColor} py-4 rounded-2xl items-center`}
          >
            <Text className={`${textColor} text-lg font-semibold`}>View My Bookings</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
