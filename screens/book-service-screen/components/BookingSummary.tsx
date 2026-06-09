import React from 'react';
import { View, Text } from 'react-native';

interface Appointment {
  id: number;
  service: { name: string; price: number };
  pet: { name: string };
  addons: { name: string; price: number }[];
  total: number;
}

interface BookingSummaryProps {
  appointments: Appointment[];
  grandTotal: number;
  isDarkMode: boolean;
  textColor: string;
  subtextColor: string;
}

export default function BookingSummary({
  appointments,
  grandTotal,
  isDarkMode,
  textColor,
  subtextColor,
}: BookingSummaryProps) {
  return (
    <View className={`px-6 py-5 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'} mx-6 rounded-2xl mb-4`}>
      <Text className={`text-base font-semibold ${textColor} mb-3`}>Booking Summary</Text>
      {appointments.map((apt, index) => (
        <View key={apt.id} className="mb-3">
          <View className="flex-row justify-between items-center">
            <Text className={`text-sm font-medium ${subtextColor}`}>Appointment {index + 1}:</Text>
            <Text className={`text-sm font-medium ${textColor}`}>{apt.pet.name}</Text>
          </View>
          <View className="flex-row justify-between mt-1">
            <Text className={`text-sm ${subtextColor}`}>{apt.service.name}</Text>
            <Text className={`text-sm ${textColor}`}>${apt.service.price}</Text>
          </View>
          {apt.addons.length > 0 && (
            <View className="flex-row justify-between mt-1">
              <Text className={`text-xs ${subtextColor}`}>Add-ons</Text>
              <Text className={`text-xs ${subtextColor}`}>
                ${apt.addons.reduce((sum: number, a: any) => sum + a.price, 0)}
              </Text>
            </View>
          )}
        </View>
      ))}
      <View className={`border-t ${isDarkMode ? 'border-gray-700' : 'border-brand-200'} mt-2 pt-3 flex-row justify-between`}>
        <Text className={`text-base font-bold ${textColor}`}>Total:</Text>
        <Text className="text-2xl font-bold text-brand-600">${grandTotal}</Text>
      </View>
    </View>
  );
}
