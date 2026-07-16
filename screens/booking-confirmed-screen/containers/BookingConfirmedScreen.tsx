import React from 'react';
import { SafeAreaView, View, Text, TouchableOpacity } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAppNavigation } from '../../../hooks/useAppNavigation';
import { useLocale } from '../../../context/LocaleContext';
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
  const { t } = useLocale();

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      <View className="flex-1 items-center justify-center px-6">
        <View className="mb-8">
          <AnimatedCheckmark size={128} isDarkMode={isDarkMode} />
        </View>
        <Text className={`self-stretch text-center text-2xl font-bold ${textColor} mb-4`}>
          {t('bookingConfirmed.title')}
        </Text>
        <Text className={`self-stretch text-center text-base ${subtextColor} mb-8 leading-6`}>
          {t('bookingConfirmed.message', { service: serviceName })}
        </Text>
        <View className="w-full">
          <TouchableOpacity
            onPress={() => resetToTab('Home')}
            className="mb-3 items-center rounded-2xl bg-brand-500 py-4">
            <Text className="text-lg font-bold text-white">{t('bookingConfirmed.backToHome')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => resetToScreen('MyBookings')}
            className={`${isDarkMode ? 'bg-[#1a2332]' : 'bg-white'} border ${borderColor} items-center rounded-2xl py-4`}>
            <Text className={`${textColor} text-lg font-semibold`}>
              {t('bookingConfirmed.viewBookings')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
