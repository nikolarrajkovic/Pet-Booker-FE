import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
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
 *
 * The destinations come from `navigation/navItems.ts`, shared with the sidebar, so the two bars
 * cannot list different routes or gate them differently by role.
 *
 * ## Mounted by the navigator, not by each screen
 *
 * This is the tab navigator's `tabBar`, so exactly one of these exists. It used to be five —
 * every tab screen passed `footer={<TabBar />}` — which was harmless while tab switches were an
 * instant cut, and stopped being harmless the moment they became a slide: a bar that lives
 * *inside* a scene slides with it, so switching tabs would have dragged the navigation off the
 * screen along with the page. Mounted here it sits above the scenes and stays put while they
 * move. It still positions itself absolutely, so it overlays the content exactly as it did from
 * inside a screen and costs the scenes no height.
 */
export default function TabBar({
  state,
  navigation: tabNavigation,
  insets,
}: Partial<BottomTabBarProps> = {}) {
  // The navigator hands us its OWN navigation object, and that is the one that can reach the
  // tab routes. `useNavigation()` cannot: the `tabBar` renders outside every tab scene, so the
  // nearest navigation context is the root stack's — the one that owns `MainTabs` — where no
  // tab name exists. Navigating to a route a navigator doesn't have is not an error, just a
  // dev-only warning and a bar that does nothing when tapped. The hook stays as the fallback
  // for a bare render (tests), where it resolves to a tab screen's own navigation.
  const screenNavigation = useNavigation();
  const navigation: any = tabNavigation ?? screenNavigation;
  const route = useRoute();
  const safeInsets = useSafeAreaInsets();
  const { isDarkMode, cardBg: bgColor, borderColor } = useThemeColors();
  const { isMobile } = useResponsive();
  const { isPartner, isAdmin } = useAuth();
  const { t } = useLocale();

  // From the navigator we are handed the tab state; rendered bare (tests, and any screen that
  // still mounts one) the enclosing route is the next best answer.
  const currentRoute = state ? state.routes[state.index]?.name : route.name;
  // Outside a screen there is no SafeAreaView above us any more, so the bar owns its own
  // bottom inset — without it the icons sit under the home indicator / gesture bar.
  const bottomInset = insets?.bottom ?? safeInsets.bottom;

  const inactiveColor = isDarkMode ? '#6B7280' : '#9CA3AF';
  const inactiveTextColor = isDarkMode ? 'text-gray-500' : 'text-gray-400';

  if (!isMobile) return null;

  const tabs = primaryNavItems({ isPartner, isAdmin });

  return (
    <View
      accessibilityRole="tablist"
      style={{ paddingBottom: bottomInset }}
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
              // Plain `navigate` (not the shell's ref helper): `navigation` is MainTabs's own
              // object either way, so the tab name resolves without addressing a parent.
              onPress={() => navigation.navigate(tab.route, tab.params)}>
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
