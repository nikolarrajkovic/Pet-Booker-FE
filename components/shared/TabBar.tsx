import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

export default function TabBar() {
  const navigation = useNavigation();
  const route = useRoute();
  const currentRoute = route.name;
  const { isDarkMode } = useTheme();
  const { isPartner, isAdmin } = useAuth();

  const bgColor = isDarkMode ? 'bg-[#1a2332]' : 'bg-white';
  const borderColor = isDarkMode ? 'border-gray-800' : 'border-gray-200';
  const inactiveColor = isDarkMode ? '#6B7280' : '#9CA3AF';
  const inactiveTextColor = isDarkMode ? 'text-gray-500' : 'text-gray-400';

  return (
    <View className={`absolute bottom-0 left-0 right-0 ${bgColor} border-t ${borderColor}`}>
      <View className="flex-row justify-around items-center py-2">
        {/* Home */}
        <TouchableOpacity
          className="items-center py-2 px-4"
          activeOpacity={0.8}
          onPress={() => (navigation as any).navigate('Home')}
        >
          <Ionicons 
            name="home" 
            size={24} 
            color={currentRoute === 'Home' ? '#00C870' : inactiveColor} 
          />
          <Text className={`text-xs mt-1 ${currentRoute === 'Home' ? 'text-brand-500 font-semibold' : inactiveTextColor}`}>
            Home
          </Text>
        </TouchableOpacity>

        {/* Search */}
        <TouchableOpacity
          className="items-center py-2 px-4"
          activeOpacity={0.8}
          onPress={() => (navigation as any).navigate('Search')}
        >
          <Ionicons 
            name="search" 
            size={24} 
            color={currentRoute === 'Search' ? '#00C870' : inactiveColor} 
          />
          <Text className={`text-xs mt-1 ${currentRoute === 'Search' ? 'text-brand-500 font-semibold' : inactiveTextColor}`}>
            Search
          </Text>
        </TouchableOpacity>

        {/* Partner Hub — only for partners */}
        {isPartner && (
        <TouchableOpacity
          className="items-center py-2 px-4"
          activeOpacity={0.8}
          onPress={() => (navigation as any).navigate('PartnerHub')}
        >
          <Ionicons 
            name="briefcase-outline" 
            size={24} 
            color={currentRoute === 'PartnerHub' ? '#00C870' : inactiveColor} 
          />
          <Text className={`text-xs mt-1 ${currentRoute === 'PartnerHub' ? 'text-brand-500 font-semibold' : inactiveTextColor}`}>
            Partner
          </Text>
        </TouchableOpacity>
        )}

        {/* Admin — only for admins */}
        {isAdmin && (
        <TouchableOpacity
          className="items-center py-2 px-4"
          activeOpacity={0.8}
          onPress={() => (navigation as any).navigate('AdminDashboard')}
        >
          <Ionicons 
            name="shield-checkmark-outline" 
            size={24} 
            color={currentRoute === 'AdminDashboard' ? '#00C870' : inactiveColor} 
          />
          <Text className={`text-xs mt-1 ${currentRoute === 'AdminDashboard' ? 'text-brand-500 font-semibold' : inactiveTextColor}`}>
            Admin
          </Text>
        </TouchableOpacity>
        )}

        {/* Profile */}
        <TouchableOpacity
          className="items-center py-2 px-4"
          activeOpacity={0.8}
          onPress={() => (navigation as any).navigate('Profile')}
        >
          <Ionicons 
            name="person" 
            size={24} 
            color={currentRoute === 'Profile' ? '#00C870' : inactiveColor} 
          />
          <Text className={`text-xs mt-1 ${currentRoute === 'Profile' ? 'text-brand-500 font-semibold' : inactiveTextColor}`}>
            Profile
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
