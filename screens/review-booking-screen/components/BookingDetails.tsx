import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

interface BookingDetailsProps {
  isDarkMode: boolean;
  textColor: string;
  subtextColor: string;
  borderColor: string;
}

export default function BookingDetails({ isDarkMode, textColor, subtextColor, borderColor }: BookingDetailsProps) {
  return (
    <View className={`px-6 py-5 border-t ${borderColor}`}>
      <Text className={`text-base font-semibold ${textColor} mb-4`}>Booking Details</Text>
      <View className="flex-row items-start mb-4">
        <View className={`w-10 h-10 ${isDarkMode ? 'bg-brand-500/20' : 'bg-brand-50'} rounded-xl items-center justify-center mr-3`}>
          <MaterialCommunityIcons name="calendar" size={20} color="#00C870" />
        </View>
        <View className="flex-1">
          <Text className={`text-sm ${subtextColor}`}>Date</Text>
          <Text className={`text-base ${textColor} font-medium mt-1`}>December 15, 2024</Text>
        </View>
      </View>
      <View className="flex-row items-start mb-4">
        <View className={`w-10 h-10 ${isDarkMode ? 'bg-brand-500/20' : 'bg-brand-50'} rounded-xl items-center justify-center mr-3`}>
          <Ionicons name="time-outline" size={20} color="#00C870" />
        </View>
        <View className="flex-1">
          <Text className={`text-sm ${subtextColor}`}>Time</Text>
          <Text className={`text-base ${textColor} font-medium mt-1`}>2:00 PM</Text>
        </View>
      </View>
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
  );
}
