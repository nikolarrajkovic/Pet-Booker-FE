import React from 'react';
import { View, Text } from 'react-native';
import { useLocale } from '../../../context/LocaleContext';

interface TestimonialCardProps {
  isDarkMode: boolean;
  cardBg: string;
  textColor: string;
  subtextColor: string;
  borderColor: string;
}

export default function TestimonialCard({
  isDarkMode,
  cardBg,
  textColor,
  subtextColor,
  borderColor,
}: TestimonialCardProps) {
  const { t } = useLocale();
  return (
    <View className={`${cardBg} rounded-2xl border p-6 ${borderColor} mb-6`}>
      <View className="mb-4 flex-row items-center">
        <View className="mr-3 h-12 w-12 items-center justify-center rounded-full bg-brand-500">
          <Text className="text-lg font-bold text-white">SJ</Text>
        </View>
        <View>
          <Text className={`text-base font-semibold ${textColor}`}>Sarah Johnson</Text>
          <Text className={`text-sm ${subtextColor}`}>{t('becomePartner.testimonialRole')}</Text>
        </View>
      </View>
      <Text
        className={`text-sm ${isDarkMode ? 'text-green-200' : 'text-green-900'} italic leading-6`}>
        {t('becomePartner.testimonialQuote')}
      </Text>
    </View>
  );
}
