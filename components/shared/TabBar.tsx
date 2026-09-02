import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, useThemeColors } from '../../hooks/useThemeColors';
import { useResponsive } from '../../hooks/useResponsive';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { primaryNavItems } from '../../navigation/navItems';

/**
 * The phone design's bottom navigation.
 *
 * **Renders nothing above 768px**, where `AppShell`'s sidebar is the navigation instead — two
 * navigations on one screen is the obvious failure mode of running both designs from one tree.
 * Screens keep passing `footer={<TabBar />}` unchanged; there was no reason to edit five screens
 * to say the same thing five times.
 *
 * The destinations come from `navigation/navItems.ts`, shared with the sidebar, so the two bars
 * cannot list different routes or gate them differently by role.
 */
export default function TabBar() {
  const navigation = useNavigation();
  const route = useRoute();
  const currentRoute = route.name;
  const { isDarkMode, cardBg: bgColor, borderColor } = useThemeColors();
  const { isMobile } = useResponsive();
  const { isPartner, isAdmin } = useAuth();
  const { t } = useLocale();

  const inactiveColor = isDarkMode ? '#6B7280' : '#9CA3AF';
  const inactiveTextColor = isDarkMode ? 'text-gray-500' : 'text-gray-400';

  if (!isMobile) return null;

  const tabs = primaryNavItems({ isPartner, isAdmin });

  return (
    <View
      accessibilityRole="tablist"
      className={`absolute bottom-0 left-0 right-0 ${bgColor} border-t ${borderColor}`}>
      <View className="flex-row items-center justify-around py-2">
        {tabs.map((tab) => {
          const isSelected = currentRoute === tab.route;
          return (
            <TouchableOpacity
              key={tab.route}
              className="items-center px-4 py-2"
              activeOpacity={0.8}
              // `selected` is what tells a screen reader which tab you are on — without it every
              // tab announces identically and the current one is indistinguishable.
              accessibilityRole="tab"
              accessibilityLabel={t(tab.labelKey)}
              accessibilityState={{ selected: isSelected }}
              // Plain `navigate` (not the shell's ref helper): this bar only ever renders on a
              // tab screen, so it is already inside `MainTabs` and the tab name resolves.
              onPress={() => (navigation as any).navigate(tab.route, tab.params)}>
              <Ionicons
                name={tab.icon}
                size={24}
                color={isSelected ? BRAND_GREEN : inactiveColor}
              />
              <Text
                className={`mt-1 text-xs ${isSelected ? 'font-semibold text-brand-500' : inactiveTextColor}`}>
                {t(tab.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
