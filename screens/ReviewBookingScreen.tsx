import React, { useState } from 'react';
import { SafeAreaView, ScrollView, Text, View, TouchableOpacity, Image } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

type ReviewBookingRouteParams = {
  provider: {
    id: number;
    name: string;
    service: string;
    rating: number;
    reviews: number;
    distance: string;
    price: number;
    image: string;
    verified: boolean;
    latitude: number;
    longitude: number;
  };
  appointments: any[];
};

export default function ReviewBookingScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: ReviewBookingRouteParams }, 'params'>>();
  const { provider, appointments } = route.params;
  const { isDarkMode } = useTheme();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('online');

  const bgColor = isDarkMode ? 'bg-[#1a2332]' : 'bg-brand-500';
  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-white';
  const cardBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextColor = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const borderColor = isDarkMode ? 'border-gray-800' : 'border-gray-200';

  const calculateTotal = () => {
    return appointments.reduce((sum, apt) => sum + apt.total, 0);
  };

  const calculateServiceTotal = () => {
    return appointments.reduce((sum, apt) => sum + apt.service.price, 0);
  };

  const calculateAddonsTotal = () => {
    return appointments.reduce((sum, apt) => {
      return sum + apt.addons.reduce((addonSum: number, addon: any) => addonSum + addon.price, 0);
    }, 0);
  };

  return (
    <SafeAreaView className={`flex-1 ${contentBg}`}>
      {/* Green Header */}
      <View className={`${bgColor} px-6 pt-12 pb-6`}>
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mr-4"
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Review Booking</Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Provider Info */}
        <View className="px-6 py-5 flex-row items-center">
          <Image
            source={{ uri: provider.image }}
            className="w-16 h-16 rounded-xl mr-4"
            resizeMode="cover"
          />
          <View className="flex-1">
            <Text className={`text-lg font-bold ${textColor}`}>{provider.name}</Text>
            <Text className="text-sm text-brand-600 mt-1">{provider.service}</Text>
            <View className="flex-row items-center mt-1">
              <Ionicons name="location-outline" size={14} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
              <Text className={`text-xs ${subtextColor} ml-1`}>{provider.distance} away</Text>
            </View>
          </View>
        </View>

        {/* Booking Details */}
        <View className={`px-6 py-5 border-t ${borderColor}`}>
          <Text className={`text-base font-semibold ${textColor} mb-4`}>Booking Details</Text>
          
          {/* Date */}
          <View className="flex-row items-start mb-4">
            <View className={`w-10 h-10 ${isDarkMode ? 'bg-brand-500/20' : 'bg-brand-50'} rounded-xl items-center justify-center mr-3`}>
              <MaterialCommunityIcons name="calendar" size={20} color="#00C870" />
            </View>
            <View className="flex-1">
              <Text className={`text-sm ${subtextColor}`}>Date</Text>
              <Text className={`text-base ${textColor} font-medium mt-1`}>December 15, 2024</Text>
            </View>
          </View>

          {/* Time */}
          <View className="flex-row items-start mb-4">
            <View className={`w-10 h-10 ${isDarkMode ? 'bg-brand-500/20' : 'bg-brand-50'} rounded-xl items-center justify-center mr-3`}>
              <Ionicons name="time-outline" size={20} color="#00C870" />
            </View>
            <View className="flex-1">
              <Text className={`text-sm ${subtextColor}`}>Time</Text>
              <Text className={`text-base ${textColor} font-medium mt-1`}>2:00 PM</Text>
            </View>
          </View>

          {/* Pickup */}
          <View className="flex-row items-start">
            <View className={`w-10 h-10 ${isDarkMode ? 'bg-brand-500/20' : 'bg-brand-50'} rounded-xl items-center justify-center mr-3`}>
              <MaterialCommunityIcons name="map-marker" size={20} color="#00C870" />
            </View>
            <View className="flex-1">
              <Text className={`text-sm ${subtextColor}`}>Pickup</Text>
              <Text className={`text-base ${textColor} font-medium mt-1`}>Yes - 123 Main St, San Francisco, CA</Text>
            </View>
          </View>
        </View>

        {/* Price Breakdown */}
        <View className={`px-6 py-5 border-t ${borderColor}`}>
          <Text className={`text-base font-semibold ${textColor} mb-4`}>Price Breakdown</Text>
          
          <View className="flex-row justify-between mb-3">
            <Text className={`text-sm ${subtextColor}`}>Service</Text>
            <Text className={`text-sm ${textColor}`}>${calculateServiceTotal()}</Text>
          </View>

          {calculateAddonsTotal() > 0 && (
            <View className="flex-row justify-between mb-3">
              <Text className={`text-sm ${subtextColor}`}>Pickup Fee</Text>
              <Text className={`text-sm ${textColor}`}>${calculateAddonsTotal()}</Text>
            </View>
          )}

          <View className={`border-t ${borderColor} mt-3 pt-3 flex-row justify-between`}>
            <Text className={`text-base font-bold ${textColor}`}>Total</Text>
            <Text className="text-2xl font-bold text-brand-600">${calculateTotal()}</Text>
          </View>
        </View>

        {/* Payment Method */}
        <View className={`px-6 py-5 border-t ${borderColor}`}>
          <Text className={`text-base font-semibold ${textColor} mb-4`}>Payment Method</Text>
          
          {/* Pay Online */}
          <TouchableOpacity
            onPress={() => setSelectedPaymentMethod('online')}
            className={`mb-3 rounded-2xl p-4 border-2 flex-row items-center ${
              selectedPaymentMethod === 'online'
                ? 'border-brand-500 bg-brand-50'
                : isDarkMode ? 'border-gray-800 bg-[#1a2332]' : 'border-gray-200 bg-white'
            }`}
          >
            <View className={`w-12 h-12 rounded-xl items-center justify-center mr-3 ${
              selectedPaymentMethod === 'online' ? 'bg-brand-500' : isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'
            }`}>
              <MaterialCommunityIcons 
                name="credit-card" 
                size={24} 
                color={selectedPaymentMethod === 'online' ? 'white' : '#6B7280'} 
              />
            </View>
            <View className="flex-1">
              <Text className={`text-base font-semibold ${textColor}`}>Pay Online</Text>
              <Text className={`text-sm ${subtextColor}`}>Card or Wallet</Text>
            </View>
          </TouchableOpacity>

          {/* Pay with Cash */}
          <TouchableOpacity
            onPress={() => setSelectedPaymentMethod('cash')}
            className={`rounded-2xl p-4 border-2 flex-row items-center ${
              selectedPaymentMethod === 'cash'
                ? 'border-brand-500 bg-brand-50'
                : isDarkMode ? 'border-gray-800 bg-[#1a2332]' : 'border-gray-200 bg-white'
            }`}
          >
            <View className={`w-12 h-12 rounded-xl items-center justify-center mr-3 ${
              selectedPaymentMethod === 'cash' ? 'bg-brand-500' : isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'
            }`}>
              <MaterialCommunityIcons 
                name="cash" 
                size={24} 
                color={selectedPaymentMethod === 'cash' ? 'white' : '#6B7280'} 
              />
            </View>
            <View className="flex-1">
              <Text className={`text-base font-semibold ${textColor}`}>Pay with Cash</Text>
              <Text className={`text-sm ${subtextColor}`}>Pay on service</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Cancellation Policy */}
        <View className={`px-6 py-5 border-t ${borderColor}`}>
          <Text className={`text-base font-semibold ${textColor} mb-3`}>Cancellation Policy</Text>
          <Text className={`text-sm ${subtextColor} leading-6`}>
            Free cancellation up to 24 hours before the appointment. Cancellations within 24 hours may incur a 50% charge.
          </Text>
        </View>
      </ScrollView>

      {/* Confirm Booking Button */}
      <View className={`absolute bottom-0 left-0 right-0 ${cardBg} border-t ${borderColor} px-6 py-4`}>
        <TouchableOpacity
          onPress={() => (navigation as any).navigate('BookingConfirmed', { provider })}
          className="bg-brand-500 py-4 rounded-2xl items-center"
        >
          <Text className="text-white text-lg font-bold">Confirm Booking</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
