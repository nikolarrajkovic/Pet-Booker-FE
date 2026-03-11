import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface VerificationProgressProps {
  isDarkMode: boolean;
  textColor: string;
  subtextColor: string;
}

export default function VerificationProgress({ isDarkMode, textColor, subtextColor }: VerificationProgressProps) {
  return (
    <>
      <Text className={`text-xl font-bold ${textColor} mb-4`}>Verification Progress</Text>

      {/* Step 1: Application Received */}
      <View className="flex-row mb-6">
        <View className="items-center mr-4">
          <View className="w-12 h-12 bg-brand-500 rounded-full items-center justify-center">
            <Ionicons name="checkmark" size={24} color="white" />
          </View>
          <View className="flex-1 w-0.5 bg-gray-200 mt-2" style={{ height: 40 }} />
        </View>
        <View className="flex-1">
          <Text className={`text-base font-semibold ${textColor} mb-1`}>Application Received</Text>
          <Text className={`text-sm ${subtextColor}`}>We've received your application</Text>
        </View>
      </View>

      {/* Step 2: Document Review */}
      <View className="flex-row mb-6">
        <View className="items-center mr-4">
          <View className="w-12 h-12 bg-blue-500 rounded-full items-center justify-center">
            <Ionicons name="document-text" size={24} color="white" />
          </View>
          <View className="flex-1 w-0.5 bg-gray-200 mt-2" style={{ height: 40 }} />
        </View>
        <View className="flex-1">
          <Text className={`text-base font-semibold ${textColor} mb-1`}>Document Review</Text>
          <Text className={`text-sm ${subtextColor} mb-2`}>Reviewing your submitted documents</Text>
          <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <View className="h-full bg-blue-500 rounded-full" style={{ width: '60%' }} />
          </View>
        </View>
      </View>

      {/* Step 3: Background Check */}
      <View className="flex-row mb-6">
        <View className="items-center mr-4">
          <View className={`w-12 h-12 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'} rounded-full items-center justify-center`}>
            <Ionicons name="shield-checkmark" size={24} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
          </View>
          <View className="flex-1 w-0.5 bg-gray-200 mt-2" style={{ height: 40 }} />
        </View>
        <View className="flex-1">
          <Text className={`text-base font-semibold ${textColor} mb-1`}>Background Check</Text>
          <Text className={`text-sm ${subtextColor}`}>Conducting background verification</Text>
        </View>
      </View>

      {/* Step 4: Final Approval */}
      <View className="flex-row mb-8">
        <View className="items-center mr-4">
          <View className={`w-12 h-12 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'} rounded-full items-center justify-center`}>
            <Ionicons name="mail" size={24} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
          </View>
        </View>
        <View className="flex-1">
          <Text className={`text-base font-semibold ${textColor} mb-1`}>Final Approval</Text>
          <Text className={`text-sm ${subtextColor}`}>You'll receive an email with next steps</Text>
        </View>
      </View>
    </>
  );
}
