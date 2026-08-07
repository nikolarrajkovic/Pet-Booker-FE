import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import type { TranslationKey } from '../../i18n';

type TabDef = {
  /** Route this tab navigates to, and the one that marks it selected. */
  route: string;
  labelKey: TranslationKey;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  params?: Record<string, unknown>;
};

export default function TabBar() {
  const navigation = useNavigation();
  const route = useRoute();
  const currentRoute = route.name;
  const { isDarkMode, cardBg: bgColor, borderColor } = useThemeColors();
  const { isPartner, isAdmin } = useAuth();
  const { t } = useLocale();

  const inactiveColor = isDarkMode ? '#6B7280' : '#9CA3AF';
  const inactiveTextColor = isDarkMode ? 'text-gray-500' : 'text-gray-400';

  // Tabs were five copies of the same block differing only in route/icon/label, which is why the
  // accessibility attributes had to be added five times to be added at all.
  const tabs: TabDef[] = [
    { route: 'Home', labelKey: 'tabs.home', icon: 'home' },
    {
      route: 'Search',
      labelKey: 'tabs.search',
      icon: 'search',
      params: { serviceType: undefined, category: undefined },
    },
    ...(isPartner
      ? [{ route: 'PartnerHub', labelKey: 'tabs.partner', icon: 'briefcase-outline' } as TabDef]
      : []),
    ...(isAdmin
      ? [
          {
            route: 'AdminDashboard',
            labelKey: 'tabs.admin',
            icon: 'shield-checkmark-outline',
          } as TabDef,
        ]
      : []),
    { route: 'Profile', labelKey: 'tabs.profile', icon: 'person' },
  ];

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
              onPress={() => (navigation as any).navigate(tab.route, tab.params)}>
              <Ionicons
                name={tab.icon}
                size={24}
                color={isSelected ? '#00C870' : inactiveColor}
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
