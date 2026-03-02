import React from 'react';
import { SafeAreaView, View, Text, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

type BookingConfirmedRouteParams = {
  provider: {
    name: string;
  };
};

export default function BookingConfirmedScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: BookingConfirmedRouteParams }, 'params'>>();
  const { provider } = route.params;
  const { isDarkMode } = useTheme();

  const bgColor = isDarkMode ? 'bg-[#0f1621]' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextColor = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const borderColor = isDarkMode ? 'border-gray-800' : 'border-gray-300';

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      <View className="flex-1 items-center justify-center px-6">
        {/* Success Icon */}
        <View className={`w-32 h-32 ${isDarkMode ? 'bg-brand-500/20' : 'bg-brand-100'} rounded-full items-center justify-center mb-8`}>
          <Ionicons name="checkmark" size={64} color="#00C870" />
        </View>

        {/* Title */}
        <Text className={`text-2xl font-bold ${textColor} mb-4`}>Booking Confirmed!</Text>

        {/* Message */}
        <Text className={`text-base ${subtextColor} text-center leading-6 mb-8`}>
          Your appointment with {provider.name} has been confirmed. You'll receive a confirmation email shortly.
        </Text>

        {/* Buttons */}
        <View className="w-full">
          <TouchableOpacity
            onPress={() => (navigation as any).navigate('MainTabs', { screen: 'Home' })}
            className="bg-brand-500 py-4 rounded-2xl items-center mb-3"
          >
            <Text className="text-white text-lg font-bold">Back to Home</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {/* Navigate to bookings */}}
            className={`${isDarkMode ? 'bg-[#1a2332]' : 'bg-white'} border ${borderColor} py-4 rounded-2xl items-center`}
          >
            <Text className={`${textColor} text-lg font-semibold`}>View My Bookings</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
