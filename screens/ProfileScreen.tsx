import React from 'react';
import { SafeAreaView, ScrollView, Text, View, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import TabBar from '../components/shared/TabBar';
import { useTheme } from '../context/ThemeContext';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { isDarkMode } = useTheme();

  const menuItems = [
    {
      id: 'account',
      icon: 'person-outline',
      iconType: 'ionicons',
      title: 'Account',
      subtitle: 'Manage your personal info',
      color: '#00C870',
    },
    {
      id: 'pets',
      icon: 'paw',
      iconType: 'material',
      title: 'My Pets',
      subtitle: 'Add and manage your pets',
      color: '#00C870',
    },
    {
      id: 'bookings',
      icon: 'briefcase-outline',
      iconType: 'ionicons',
      title: 'My Bookings',
      subtitle: 'View booking history',
      color: '#00C870',
    },
    {
      id: 'notifications',
      icon: 'notifications-outline',
      iconType: 'ionicons',
      title: 'Notifications',
      subtitle: 'Manage your preferences',
      color: '#00C870',
    },
    {
      id: 'settings',
      icon: 'settings-outline',
      iconType: 'ionicons',
      title: 'Settings',
      subtitle: 'App configuration',
      color: '#00C870',
    },
  ];

  const bgColor = isDarkMode ? 'bg-[#1a2332]' : 'bg-brand-500';
  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-white';
  const cardBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-white';
  const partnerCardBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-brand-500';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextColor = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const headerTextColor = 'text-white';
  const borderColor = isDarkMode ? 'border-gray-800' : 'border-gray-100';

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      {/* Header with Profile - Fixed */}
      <View className={`${bgColor} px-6 pt-12 pb-8`}>
        <Text className={`${headerTextColor} text-2xl font-bold mb-6`}>Profile</Text>
        
        {/* User Info Card */}
        <View className={`${isDarkMode ? 'bg-[#243447]' : 'bg-brand-400'} rounded-2xl p-4 flex-row items-center`}>
          <View className="w-16 h-16 bg-orange-400 rounded-full items-center justify-center mr-4">
            <Text className="text-3xl">👩</Text>
          </View>
          <View className="flex-1">
            <Text className="text-white text-lg font-bold">Alex Johnson</Text>
            <Text className="text-brand-100 text-sm mt-1">alex@email.com</Text>
          </View>
        </View>
      </View>

      <ScrollView className={`flex-1 ${contentBg} rounded-t-3xl -mt-4`} contentContainerStyle={{ paddingTop: 24, paddingBottom: 100 }}>
        {/* Become a Partner Card */}
        <View className="mx-6 mb-6 bg-brand-500 rounded-2xl p-6">
          <Text className="text-white text-xl font-bold mb-2">Become a Partner</Text>
          <Text className="text-brand-100 text-sm mb-4">
            Share your passion for pets and earn extra income
          </Text>
          <TouchableOpacity 
            className="bg-white py-3 rounded-xl"
            activeOpacity={0.7}
            onPress={() => (navigation as any).navigate('BecomePartner')}
          >
            <Text className="text-brand-600 text-center font-semibold">Learn More</Text>
          </TouchableOpacity>
        </View>

        {/* Menu Items */}
        <View className="px-6">
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              className={`flex-row items-center ${cardBg} rounded-2xl p-4 mb-3 border ${borderColor}`}
              activeOpacity={0.7}
              onPress={() => {
                if (item.id === 'account') {
                  (navigation as any).navigate('Account');
                } else if (item.id === 'pets') {
                  (navigation as any).navigate('MyPets');
                } else if (item.id === 'bookings') {
                  (navigation as any).navigate('MyBookings');
                } else if (item.id === 'notifications') {
                  (navigation as any).navigate('Notifications');
                } else if (item.id === 'settings') {
                  (navigation as any).navigate('Settings');
                }
                /* Navigate to respective screen */
              }}
            >
              <View className={`w-12 h-12 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'} rounded-xl items-center justify-center mr-4`}>
                {item.iconType === 'ionicons' ? (
                  <Ionicons name={item.icon as any} size={24} color={item.color} />
                ) : (
                  <MaterialCommunityIcons name={item.icon as any} size={24} color={item.color} />
                )}
              </View>
              <View className="flex-1">
                <Text className={`text-base font-semibold ${textColor}`}>{item.title}</Text>
                <Text className={`text-sm ${subtextColor} mt-0.5`}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ))}

          {/* Logout */}
          <TouchableOpacity
            className={`flex-row items-center ${cardBg} rounded-2xl p-4 mb-3 border ${borderColor}`}
            activeOpacity={0.7}
            onPress={() => {/* Handle logout */}}
          >
            <View className={`w-12 h-12 ${isDarkMode ? 'bg-[#243447]' : 'bg-red-50'} rounded-xl items-center justify-center mr-4`}>
              <Ionicons name="log-out-outline" size={24} color="#EF4444" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-red-600">Logout</Text>
              <Text className={`text-sm ${subtextColor} mt-0.5`}>Sign out of your account</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          {/* App Info */}
          <View className="items-center mt-6 mb-4">
            <Text className={`text-sm ${subtextColor}`}>PawCare v1.0.0</Text>
            <Text className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} mt-1`}>© 2025 All rights reserved</Text>
          </View>
        </View>
      </ScrollView>

      <TabBar />
    </SafeAreaView>
  );
}
