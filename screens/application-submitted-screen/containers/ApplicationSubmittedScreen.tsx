import React from 'react';
import { ScrollView, Text, View, TouchableOpacity } from 'react-native';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAppNavigation } from '../../../hooks/useAppNavigation';
import { useLocale } from '../../../context/LocaleContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import AnimatedCheckmark from '../../../components/shared/AnimatedCheckmark';
import { VerificationProgress, NeedHelpCard, WhileYouWaitCard } from '../components';

export default function ApplicationSubmittedScreen() {
  // Terminal screen — reset so back can't re-enter the application form.
  const { resetToTab } = useAppNavigation();
  const { isDarkMode, bgColor, cardBg, textColor, subtextColor, borderColor } = useThemeColors();
  const { t } = useLocale();

  return (
    <ScreenLayout
      headerVariant="large"
      contentBg={bgColor}
      contentRounded={false}
      headerChildren={
        <View className="items-center py-4">
          <View className="mb-6">
            <AnimatedCheckmark size={96} color="white" ringColor="rgba(255,255,255,0.2)" />
          </View>
          <Text className="mb-2 text-2xl font-bold text-white">
            {t('applicationSubmitted.title')}
          </Text>
          <Text className="text-center text-base text-white/90">
            {t('applicationSubmitted.subtitle')}
          </Text>
        </View>
      }>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 24, paddingBottom: 40, paddingHorizontal: 24 }}>
        {/* What Happens Next */}
        <View
          className={`${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50'} mb-6 rounded-2xl border p-5 ${isDarkMode ? 'border-blue-800' : 'border-blue-200'}`}>
          <Text
            className={`text-base font-semibold ${isDarkMode ? 'text-blue-200' : 'text-blue-900'} mb-3`}>
            {t('applicationSubmitted.whatNext')}
          </Text>
          <Text className={`text-sm ${isDarkMode ? 'text-blue-300' : 'text-blue-700'} leading-6`}>
            {t('applicationSubmitted.whatNextBody')}
          </Text>
        </View>

        <VerificationProgress
          isDarkMode={isDarkMode}
          textColor={textColor}
          subtextColor={subtextColor}
        />

        <NeedHelpCard
          isDarkMode={isDarkMode}
          cardBg={cardBg}
          textColor={textColor}
          borderColor={borderColor}
        />

        <WhileYouWaitCard isDarkMode={isDarkMode} />
      </ScrollView>

      {/* Fixed Bottom Buttons */}
      <View className={`${cardBg} border-t ${borderColor} px-6 py-4`}>
        <TouchableOpacity
          onPress={() => resetToTab('Home')}
          className="mb-3 items-center rounded-2xl bg-brand-500 py-4">
          <Text className="text-lg font-bold text-white">
            {t('applicationSubmitted.backToHome')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => resetToTab('Profile')}
          className={`${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} items-center rounded-2xl py-4`}>
          <Text className={`${textColor} text-lg font-semibold`}>
            {t('applicationSubmitted.viewProfile')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenLayout>
  );
}
