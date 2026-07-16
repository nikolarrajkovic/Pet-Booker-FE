import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocale } from '../../../context/LocaleContext';

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
  const { t } = useLocale();
  return (
    <View className={`border-t px-6 py-5 ${borderColor}`}>
      <Text className={`text-base font-semibold ${textColor} mb-4`}>
        {t('reviewBooking.paymentMethod')}
      </Text>
      <TouchableOpacity
        onPress={() => onSelectMethod('online')}
        className={`mb-3 flex-row items-center rounded-2xl border-2 p-4 ${selectedMethod === 'online' ? 'border-brand-500 bg-brand-50' : isDarkMode ? 'border-gray-800 bg-[#1a2332]' : 'border-gray-200 bg-white'}`}>
        <View
          className={`mr-3 h-12 w-12 items-center justify-center rounded-xl ${selectedMethod === 'online' ? 'bg-brand-500' : isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'}`}>
          <MaterialCommunityIcons
            name="credit-card"
            size={24}
            color={selectedMethod === 'online' ? 'white' : '#6B7280'}
          />
        </View>
        <View className="flex-1">
          <Text className={`text-base font-semibold ${textColor}`}>
            {t('reviewBooking.payOnline')}
          </Text>
          <Text className={`text-sm ${subtextColor}`}>{t('reviewBooking.cardOrWallet')}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onSelectMethod('cash')}
        className={`flex-row items-center rounded-2xl border-2 p-4 ${selectedMethod === 'cash' ? 'border-brand-500 bg-brand-50' : isDarkMode ? 'border-gray-800 bg-[#1a2332]' : 'border-gray-200 bg-white'}`}>
        <View
          className={`mr-3 h-12 w-12 items-center justify-center rounded-xl ${selectedMethod === 'cash' ? 'bg-brand-500' : isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'}`}>
          <MaterialCommunityIcons
            name="cash"
            size={24}
            color={selectedMethod === 'cash' ? 'white' : '#6B7280'}
          />
        </View>
        <View className="flex-1">
          <Text className={`text-base font-semibold ${textColor}`}>
            {t('reviewBooking.payWithCash')}
          </Text>
          <Text className={`text-sm ${subtextColor}`}>{t('reviewBooking.payOnService')}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}
