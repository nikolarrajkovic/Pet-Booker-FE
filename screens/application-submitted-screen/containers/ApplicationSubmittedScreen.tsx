import React from 'react';
import { ScrollView, Text, View, TouchableOpacity } from 'react-native';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAppNavigation } from '../../../hooks/useAppNavigation';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import AnimatedCheckmark from '../../../components/shared/AnimatedCheckmark';
import { VerificationProgress, NeedHelpCard, WhileYouWaitCard } from '../components';

export default function ApplicationSubmittedScreen() {
  // Terminal screen — reset so back can't re-enter the application form.
  const { resetToTab } = useAppNavigation();
  const { isDarkMode, bgColor, cardBg, textColor, subtextColor, borderColor } = useThemeColors();

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
          <Text className="text-white text-2xl font-bold mb-2">Application Submitted!</Text>
          <Text className="text-white/90 text-base text-center">We're reviewing your application</Text>
        </View>
      }
    >

      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ paddingTop: 24, paddingBottom: 40, paddingHorizontal: 24 }}
      >
        {/* What Happens Next */}
        <View className={`${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50'} rounded-2xl p-5 mb-6 border ${isDarkMode ? 'border-blue-800' : 'border-blue-200'}`}>
          <Text className={`text-base font-semibold ${isDarkMode ? 'text-blue-200' : 'text-blue-900'} mb-3`}>
            What happens next?
          </Text>
          <Text className={`text-sm ${isDarkMode ? 'text-blue-300' : 'text-blue-700'} leading-6`}>
            Our team will review your application within 24-48 hours. We'll send you an email with updates on your verification status.
          </Text>
        </View>

        <VerificationProgress isDarkMode={isDarkMode} textColor={textColor} subtextColor={subtextColor} />

        <NeedHelpCard isDarkMode={isDarkMode} cardBg={cardBg} textColor={textColor} borderColor={borderColor} />

        <WhileYouWaitCard isDarkMode={isDarkMode} />
      </ScrollView>

      {/* Fixed Bottom Buttons */}
      <View className={`${cardBg} border-t ${borderColor} px-6 py-4`}>
        <TouchableOpacity
          onPress={() => resetToTab('Home')}
          className="bg-brand-500 py-4 rounded-2xl items-center mb-3"
        >
          <Text className="text-white text-lg font-bold">Back to Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => resetToTab('Profile')}
          className={`${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} py-4 rounded-2xl items-center`}
        >
          <Text className={`${textColor} text-lg font-semibold`}>View Profile</Text>
        </TouchableOpacity>
      </View>
    </ScreenLayout>
  );
}
