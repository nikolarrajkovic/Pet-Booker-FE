import React from 'react';
import { SafeAreaView, ScrollView, Text, View, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

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

        {/* Verification Progress */}
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
            {/* Progress Bar */}
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

        {/* Need Help */}
        <View className={`${cardBg} rounded-2xl p-5 border ${borderColor} mb-6`}>
          <Text className={`text-base font-semibold ${textColor} mb-4`}>Need Help?</Text>
          
          <TouchableOpacity className="flex-row items-center mb-3">
            <View className={`w-10 h-10 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-full items-center justify-center mr-3`}>
              <Ionicons name="mail-outline" size={20} color="#00C870" />
            </View>
            <Text className="text-brand-600 text-sm">partners@pawcare.com</Text>
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center">
            <View className={`w-10 h-10 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-full items-center justify-center mr-3`}>
              <Ionicons name="call-outline" size={20} color="#00C870" />
            </View>
            <Text className="text-brand-600 text-sm">(555) 123-4567</Text>
          </TouchableOpacity>
        </View>

        {/* While You Wait */}
        <View className={`${isDarkMode ? 'bg-green-900/20' : 'bg-green-50'} rounded-2xl p-5 border ${isDarkMode ? 'border-green-800' : 'border-green-200'}`}>
          <Text className={`text-base font-semibold ${isDarkMode ? 'text-green-200' : 'text-green-900'} mb-3`}>
            While You Wait
          </Text>
          
          <View className="flex-row items-start mb-2">
            <Ionicons 
              name="checkmark-circle" 
              size={20} 
              color="#00C870" 
              style={{ marginTop: 2, marginRight: 8 }} 
            />
            <Text className={`flex-1 text-sm ${isDarkMode ? 'text-green-300' : 'text-green-800'}`}>
              Check your email regularly for updates
            </Text>
          </View>

          <View className="flex-row items-start mb-2">
            <Ionicons 
              name="checkmark-circle" 
              size={20} 
              color="#00C870" 
              style={{ marginTop: 2, marginRight: 8 }} 
            />
            <Text className={`flex-1 text-sm ${isDarkMode ? 'text-green-300' : 'text-green-800'}`}>
              Prepare your service space and materials
            </Text>
          </View>

          <View className="flex-row items-start">
            <Ionicons 
              name="checkmark-circle" 
              size={20} 
              color="#00C870" 
              style={{ marginTop: 2, marginRight: 8 }} 
            />
            <Text className={`flex-1 text-sm ${isDarkMode ? 'text-green-300' : 'text-green-800'}`}>
              Review our provider guidelines and best practices
            </Text>
          </View>
        </View>
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
