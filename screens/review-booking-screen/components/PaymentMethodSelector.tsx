import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface PaymentMethodSelectorProps {
  isDarkMode: boolean;
  textColor: string;
  subtextColor: string;
  borderColor: string;
  selectedMethod: string;
  onSelectMethod: (method: string) => void;
}

export default function PaymentMethodSelector({
  isDarkMode,
  textColor,
  subtextColor,
  borderColor,
  selectedMethod,
  onSelectMethod,
}: PaymentMethodSelectorProps) {
  return (
    <View className={`px-6 py-5 border-t ${borderColor}`}>
      <Text className={`text-base font-semibold ${textColor} mb-4`}>Payment Method</Text>
      <TouchableOpacity
        onPress={() => onSelectMethod('online')}
        className={`mb-3 rounded-2xl p-4 border-2 flex-row items-center ${selectedMethod === 'online' ? 'border-brand-500 bg-brand-50' : isDarkMode ? 'border-gray-800 bg-[#1a2332]' : 'border-gray-200 bg-white'}`}
      >
        <View className={`w-12 h-12 rounded-xl items-center justify-center mr-3 ${selectedMethod === 'online' ? 'bg-brand-500' : isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'}`}>
          <MaterialCommunityIcons name="credit-card" size={24} color={selectedMethod === 'online' ? 'white' : '#6B7280'} />
        </View>
        <View className="flex-1">
          <Text className={`text-base font-semibold ${textColor}`}>Pay Online</Text>
          <Text className={`text-sm ${subtextColor}`}>Card or Wallet</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onSelectMethod('cash')}
        className={`rounded-2xl p-4 border-2 flex-row items-center ${selectedMethod === 'cash' ? 'border-brand-500 bg-brand-50' : isDarkMode ? 'border-gray-800 bg-[#1a2332]' : 'border-gray-200 bg-white'}`}
      >
        <View className={`w-12 h-12 rounded-xl items-center justify-center mr-3 ${selectedMethod === 'cash' ? 'bg-brand-500' : isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'}`}>
          <MaterialCommunityIcons name="cash" size={24} color={selectedMethod === 'cash' ? 'white' : '#6B7280'} />
        </View>
        <View className="flex-1">
          <Text className={`text-base font-semibold ${textColor}`}>Pay with Cash</Text>
          <Text className={`text-sm ${subtextColor}`}>Pay on service</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}
