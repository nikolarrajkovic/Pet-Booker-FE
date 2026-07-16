import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';

export default function TabBar() {
  const navigation = useNavigation();
  const route = useRoute();
  const currentRoute = route.name;
  const { isDarkMode, cardBg: bgColor, borderColor } = useThemeColors();
  const { isPartner, isAdmin } = useAuth();
  const { t } = useLocale();

  const inactiveColor = isDarkMode ? '#6B7280' : '#9CA3AF';
  const inactiveTextColor = isDarkMode ? 'text-gray-500' : 'text-gray-400';

  return (
    <View className={`absolute bottom-0 left-0 right-0 ${bgColor} border-t ${borderColor}`}>
      <View className="flex-row items-center justify-around py-2">
        {/* Home */}
        <TouchableOpacity
          className="items-center px-4 py-2"
          activeOpacity={0.8}
          onPress={() => (navigation as any).navigate('Home')}>
          <Ionicons
            name="home"
            size={24}
            color={currentRoute === 'Home' ? '#00C870' : inactiveColor}
          />
          <Text
            className={`mt-1 text-xs ${currentRoute === 'Home' ? 'font-semibold text-brand-500' : inactiveTextColor}`}>
            {t('tabs.home')}
          </Text>
        </TouchableOpacity>

        {/* Search */}
        <TouchableOpacity
          className="items-center px-4 py-2"
          activeOpacity={0.8}
          onPress={() =>
            (navigation as any).navigate('Search', { serviceType: undefined, category: undefined })
          }>
          <Ionicons
            name="search"
            size={24}
            color={currentRoute === 'Search' ? '#00C870' : inactiveColor}
          />
          <Text
            className={`mt-1 text-xs ${currentRoute === 'Search' ? 'font-semibold text-brand-500' : inactiveTextColor}`}>
            {t('tabs.search')}
          </Text>
        </TouchableOpacity>

        {/* Partner Hub — only for partners */}
        {isPartner && (
          <TouchableOpacity
            className="items-center px-4 py-2"
            activeOpacity={0.8}
            onPress={() => (navigation as any).navigate('PartnerHub')}>
            <Ionicons
              name="briefcase-outline"
              size={24}
              color={currentRoute === 'PartnerHub' ? '#00C870' : inactiveColor}
            />
            <Text
              className={`mt-1 text-xs ${currentRoute === 'PartnerHub' ? 'font-semibold text-brand-500' : inactiveTextColor}`}>
              {t('tabs.partner')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Admin — only for admins */}
        {isAdmin && (
          <TouchableOpacity
            className="items-center px-4 py-2"
            activeOpacity={0.8}
            onPress={() => (navigation as any).navigate('AdminDashboard')}>
            <Ionicons
              name="shield-checkmark-outline"
              size={24}
              color={currentRoute === 'AdminDashboard' ? '#00C870' : inactiveColor}
            />
            <Text
              className={`mt-1 text-xs ${currentRoute === 'AdminDashboard' ? 'font-semibold text-brand-500' : inactiveTextColor}`}>
              {t('tabs.admin')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Profile */}
        <TouchableOpacity
          className="items-center px-4 py-2"
          activeOpacity={0.8}
          onPress={() => (navigation as any).navigate('Profile')}>
          <Ionicons
            name="person"
            size={24}
            color={currentRoute === 'Profile' ? '#00C870' : inactiveColor}
          />
          <Text
            className={`mt-1 text-xs ${currentRoute === 'Profile' ? 'font-semibold text-brand-500' : inactiveTextColor}`}>
            {t('tabs.profile')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
