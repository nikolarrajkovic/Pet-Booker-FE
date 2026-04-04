import React, { useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { isDarkMode, toggleDarkMode } = useTheme();
  
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);

  const bgColor = isDarkMode ? 'bg-[#1a2332]' : 'bg-brand-500';
  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-white';
  const cardBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextColor = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const sectionTextColor = isDarkMode ? 'text-white' : 'text-gray-900';

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle="Settings"
      contentBg={contentBg}
    >
      <ScrollView className="flex-1" contentContainerStyle={{ paddingTop: 24, paddingBottom: 40, paddingHorizontal: 24 }}>
        {/* Appearance */}
        <Text className={`text-base font-semibold ${sectionTextColor} mb-3`}>Appearance</Text>
        <View className={`${cardBg} rounded-2xl p-4 mb-6`}>
          <View className="flex-row items-center">
            <View className="w-12 h-12 bg-brand-50 rounded-xl items-center justify-center mr-4">
              <Ionicons name={isDarkMode ? "moon" : "sunny"} size={24} color="#00C870" />
            </View>
            <View className="flex-1">
              <Text className={`text-base font-semibold ${textColor}`}>Dark Mode</Text>
              <Text className={`text-sm ${subtextColor} mt-0.5`}>{isDarkMode ? 'Dark theme enabled' : 'Light theme enabled'}</Text>
            </View>
            <Switch value={isDarkMode} onValueChange={toggleDarkMode} trackColor={{ false: '#D1D5DB', true: '#00C870' }} thumbColor="white" />
          </View>
        </View>

        {/* Notifications */}
        <Text className={`text-base font-semibold ${sectionTextColor} mb-3`}>Notifications</Text>
        <View className={`${cardBg} rounded-2xl mb-6`}>
          <View className="flex-row items-center p-4 border-b border-gray-100">
            <View className="w-12 h-12 bg-blue-50 rounded-xl items-center justify-center mr-4">
              <Ionicons name="notifications" size={24} color="#3B82F6" />
            </View>
            <View className="flex-1"><Text className={`text-base font-semibold ${textColor}`}>Push Notifications</Text></View>
            <Switch value={pushNotifications} onValueChange={setPushNotifications} trackColor={{ false: '#D1D5DB', true: '#00C870' }} thumbColor="white" />
          </View>
          <View className="flex-row items-center p-4 border-b border-gray-100">
            <View className="w-12 h-12 bg-purple-50 rounded-xl items-center justify-center mr-4">
              <Ionicons name="mail" size={24} color="#A855F7" />
            </View>
            <View className="flex-1"><Text className={`text-base font-semibold ${textColor}`}>Email Notifications</Text></View>
            <Switch value={emailNotifications} onValueChange={setEmailNotifications} trackColor={{ false: '#D1D5DB', true: '#00C870' }} thumbColor="white" />
          </View>
          <View className="flex-row items-center p-4">
            <View className="w-12 h-12 bg-orange-50 rounded-xl items-center justify-center mr-4">
              <Ionicons name="chatbubble" size={24} color="#F97316" />
            </View>
            <View className="flex-1"><Text className={`text-base font-semibold ${textColor}`}>SMS Notifications</Text></View>
            <Switch value={smsNotifications} onValueChange={setSmsNotifications} trackColor={{ false: '#D1D5DB', true: '#00C870' }} thumbColor="white" />
          </View>
        </View>

        {/* Privacy & Security */}
        <Text className={`text-base font-semibold ${sectionTextColor} mb-3`}>Privacy & Security</Text>
        <View className={`${cardBg} rounded-2xl mb-6`}>
          <TouchableOpacity className="flex-row items-center p-4 border-b border-gray-100">
            <View className="w-12 h-12 bg-red-50 rounded-xl items-center justify-center mr-4"><Ionicons name="lock-closed" size={24} color="#EF4444" /></View>
            <View className="flex-1"><Text className={`text-base font-semibold ${textColor}`}>Change Password</Text></View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center p-4 border-b border-gray-100">
            <View className="w-12 h-12 bg-green-50 rounded-xl items-center justify-center mr-4"><Ionicons name="shield-checkmark" size={24} color="#00C870" /></View>
            <View className="flex-1"><Text className={`text-base font-semibold ${textColor}`}>Two-Factor Authentication</Text></View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center p-4">
            <View className="w-12 h-12 bg-blue-50 rounded-xl items-center justify-center mr-4"><Ionicons name="eye-off" size={24} color="#3B82F6" /></View>
            <View className="flex-1"><Text className={`text-base font-semibold ${textColor}`}>Privacy Settings</Text></View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* General */}
        <Text className={`text-base font-semibold ${sectionTextColor} mb-3`}>General</Text>
        <View className={`${cardBg} rounded-2xl`}>
          <TouchableOpacity className="flex-row items-center p-4 border-b border-gray-100">
            <View className="w-12 h-12 bg-purple-50 rounded-xl items-center justify-center mr-4"><Ionicons name="globe" size={24} color="#A855F7" /></View>
            <View className="flex-1">
              <Text className={`text-base font-semibold ${textColor}`}>Language</Text>
              <Text className={`text-sm ${subtextColor} mt-0.5`}>English</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center p-4 border-b border-gray-100">
            <View className="w-12 h-12 bg-orange-50 rounded-xl items-center justify-center mr-4"><Ionicons name="help-circle" size={24} color="#F97316" /></View>
            <View className="flex-1"><Text className={`text-base font-semibold ${textColor}`}>Help & Support</Text></View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center p-4">
            <View className="w-12 h-12 bg-green-50 rounded-xl items-center justify-center mr-4"><Ionicons name="document-text" size={24} color="#00C870" /></View>
            <View className="flex-1"><Text className={`text-base font-semibold ${textColor}`}>Terms & Privacy Policy</Text></View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}
