import React from 'react';
import { SafeAreaView, ScrollView, Text, View, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { VerificationProgress, NeedHelpCard, WhileYouWaitCard } from '../components';

export default function ApplicationSubmittedScreen() {
  const navigation = useNavigation();
  const { isDarkMode } = useTheme();

  const bgColor = isDarkMode ? 'bg-[#0f1621]' : 'bg-white';
  const cardBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextColor = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const borderColor = isDarkMode ? 'border-gray-800' : 'border-gray-100';

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      {/* Green Header with Success Icon */}
      <View className="bg-brand-500 px-6 pt-12 pb-16 items-center">
        <View className="w-24 h-24 bg-white/20 rounded-full items-center justify-center mb-6">
          <Ionicons name="time-outline" size={48} color="white" />
        </View>
        <Text className="text-white text-2xl font-bold mb-2">Application Submitted!</Text>
        <Text className="text-white/90 text-base text-center">We're reviewing your application</Text>
      </View>

      <ScrollView 
        className={`flex-1 ${bgColor} rounded-t-3xl -mt-4`}
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
          onPress={() => (navigation as any).navigate('MainTabs', { screen: 'Home' })}
          className="bg-brand-500 py-4 rounded-2xl items-center mb-3"
        >
          <Text className="text-white text-lg font-bold">Back to Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => (navigation as any).navigate('MainTabs', { screen: 'Profile' })}
          className={`${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} py-4 rounded-2xl items-center`}
        >
          <Text className={`${textColor} text-lg font-semibold`}>View Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
