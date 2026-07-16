import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

interface BookingDetailsProps {
  isDarkMode: boolean;
  textColor: string;
  subtextColor: string;
  borderColor: string;
}

export default function BookingDetails({
  isDarkMode,
  textColor,
  subtextColor,
  borderColor,
}: BookingDetailsProps) {
  return (
    <View className={`border-t px-6 py-5 ${borderColor}`}>
      <Text className={`text-base font-semibold ${textColor} mb-4`}>Booking Details</Text>
      <View className="mb-4 flex-row items-start">
        <View
          className={`h-10 w-10 ${isDarkMode ? 'bg-brand-500/20' : 'bg-brand-50'} mr-3 items-center justify-center rounded-xl`}>
          <MaterialCommunityIcons name="calendar" size={20} color="#00C870" />
        </View>
        <View className="flex-1">
          <Text className={`text-sm ${subtextColor}`}>Date</Text>
          <Text className={`text-base ${textColor} mt-1 font-medium`}>December 15, 2024</Text>
        </View>
      </View>
      <View className="mb-4 flex-row items-start">
        <View
          className={`h-10 w-10 ${isDarkMode ? 'bg-brand-500/20' : 'bg-brand-50'} mr-3 items-center justify-center rounded-xl`}>
          <Ionicons name="time-outline" size={20} color="#00C870" />
        </View>
        <View className="flex-1">
          <Text className={`text-sm ${subtextColor}`}>Time</Text>
          <Text className={`text-base ${textColor} mt-1 font-medium`}>2:00 PM</Text>
        </View>
      </View>
      <View className="flex-row items-start">
        <View
          className={`h-10 w-10 ${isDarkMode ? 'bg-brand-500/20' : 'bg-brand-50'} mr-3 items-center justify-center rounded-xl`}>
          <MaterialCommunityIcons name="map-marker" size={20} color="#00C870" />
        </View>
        <View className="flex-1">
          <Text className={`text-sm ${subtextColor}`}>Pickup</Text>
          <Text className={`text-base ${textColor} mt-1 font-medium`}>
            Yes - 123 Main St, San Francisco, CA
          </Text>
        </View>
      </View>
    </View>
  );
}
