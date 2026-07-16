import React from 'react';
import { View, Text } from 'react-native';
import { useLocale } from '../../../context/LocaleContext';

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
  const { t } = useLocale();
  return (
    <View
      className={`px-6 py-5 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'} mx-6 mb-4 rounded-2xl`}>
      <Text className={`text-base font-semibold ${textColor} mb-3`}>
        {t('bookService.bookingSummary')}
      </Text>
      {appointments.map((apt, index) => (
        <View key={apt.id} className="mb-3">
          <View className="flex-row items-center justify-between">
            <Text className={`text-sm font-medium ${subtextColor}`}>
              {t('bookService.appointmentN', { n: index + 1 })}
            </Text>
            <Text className={`text-sm font-medium ${textColor}`}>{apt.pet.name}</Text>
          </View>
          <View className="mt-1 flex-row justify-between">
            <Text className={`text-sm ${subtextColor}`}>{apt.service.name}</Text>
            <Text className={`text-sm ${textColor}`}>${apt.service.price}</Text>
          </View>
          {apt.addons.length > 0 && (
            <View className="mt-1 flex-row justify-between">
              <Text className={`text-xs ${subtextColor}`}>{t('bookService.addonsLabel')}</Text>
              <Text className={`text-xs ${subtextColor}`}>
                ${apt.addons.reduce((sum: number, a: any) => sum + a.price, 0)}
              </Text>
            </View>
          )}
        </View>
      ))}
      <View
        className={`border-t ${isDarkMode ? 'border-gray-700' : 'border-brand-200'} mt-2 flex-row justify-between pt-3`}>
        <Text className={`text-base font-bold ${textColor}`}>{t('bookService.totalColon')}</Text>
        <Text className="text-2xl font-bold text-brand-600">${grandTotal}</Text>
      </View>
    </View>
  );
}
