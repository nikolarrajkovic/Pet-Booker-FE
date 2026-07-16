import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocale } from '../../../context/LocaleContext';

interface VerificationProgressProps {
  isDarkMode: boolean;
  textColor: string;
  subtextColor: string;
}

export default function VerificationProgress({
  isDarkMode,
  textColor,
  subtextColor,
}: VerificationProgressProps) {
  const { t } = useLocale();
  return (
    <>
      <Text className={`text-xl font-bold ${textColor} mb-4`}>
        {t('applicationSubmitted.verificationProgress')}
      </Text>

      {/* Step 1: Application Received */}
      <View className="mb-6 flex-row">
        <View className="mr-4 items-center">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-brand-500">
            <Ionicons name="checkmark" size={24} color="white" />
          </View>
          <View className="mt-2 w-0.5 flex-1 bg-gray-200" style={{ height: 40 }} />
        </View>
        <View className="flex-1">
          <Text className={`text-base font-semibold ${textColor} mb-1`}>
            {t('applicationSubmitted.step1Title')}
          </Text>
          <Text className={`text-sm ${subtextColor}`}>{t('applicationSubmitted.step1Text')}</Text>
        </View>
      </View>

      {/* Step 2: Document Review */}
      <View className="mb-6 flex-row">
        <View className="mr-4 items-center">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-blue-500">
            <Ionicons name="document-text" size={24} color="white" />
          </View>
          <View className="mt-2 w-0.5 flex-1 bg-gray-200" style={{ height: 40 }} />
        </View>
        <View className="flex-1">
          <Text className={`text-base font-semibold ${textColor} mb-1`}>
            {t('applicationSubmitted.step2Title')}
          </Text>
          <Text className={`text-sm ${subtextColor} mb-2`}>
            {t('applicationSubmitted.step2Text')}
          </Text>
          <View className="h-2 overflow-hidden rounded-full bg-gray-200">
            <View className="h-full rounded-full bg-blue-500" style={{ width: '60%' }} />
          </View>
        </View>
      </View>

      {/* Step 3: Background Check */}
      <View className="mb-6 flex-row">
        <View className="mr-4 items-center">
          <View
            className={`h-12 w-12 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'} items-center justify-center rounded-full`}>
            <Ionicons
              name="shield-checkmark"
              size={24}
              color={isDarkMode ? '#9CA3AF' : '#6B7280'}
            />
          </View>
          <View className="mt-2 w-0.5 flex-1 bg-gray-200" style={{ height: 40 }} />
        </View>
        <View className="flex-1">
          <Text className={`text-base font-semibold ${textColor} mb-1`}>
            {t('applicationSubmitted.step3Title')}
          </Text>
          <Text className={`text-sm ${subtextColor}`}>{t('applicationSubmitted.step3Text')}</Text>
        </View>
      </View>

      {/* Step 4: Final Approval */}
      <View className="mb-8 flex-row">
        <View className="mr-4 items-center">
          <View
            className={`h-12 w-12 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'} items-center justify-center rounded-full`}>
            <Ionicons name="mail" size={24} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
          </View>
        </View>
        <View className="flex-1">
          <Text className={`text-base font-semibold ${textColor} mb-1`}>
            {t('applicationSubmitted.step4Title')}
          </Text>
          <Text className={`text-sm ${subtextColor}`}>{t('applicationSubmitted.step4Text')}</Text>
        </View>
      </View>
    </>
  );
}
