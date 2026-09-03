import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, useThemeColors } from '../../hooks/useThemeColors';
import { useResponsive } from '../../hooks/useResponsive';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useNotifications } from '../../context/NotificationsContext';
import { useMessages } from '../../context/MessagesContext';
import {
  GROUP_LABEL_KEYS,
  primaryNavItems,
  secondaryNavGroups,
  type NavItem,
} from '../../navigation/navItems';
import { navigateToNavItem } from '../../navigation/navigateToNavItem';

/** Full sidebar on desktop; an icon-only rail on tablet, where 240px of nav is too much. */
export const SIDENAV_WIDTH = { desktop: 244, tablet: 72 } as const;

type SideNavProps = {
  /** The route currently showing, so the matching item can be marked selected. */
  activeRoute: string | undefined;
};

/**
 * The web design's primary navigation.
 *
 * Replaces the phone's bottom `TabBar` above 768px, and carries more than the bar can: the
 * `manage` / `partner` / `admin` groups are destinations that on a phone are only reachable by
 * going to Profile or Partner Hub first. Both bars read `navigation/navItems.ts`, so they cannot
 * list different destinations or gate them differently by role.
 *
 * Mounted once by `AppShell`, outside the navigator — see the note there.
 */
export default function SideNav({ activeRoute }: SideNavProps) {
  const { isDarkMode, cardBg, borderColor, textColor, subtextColor, hex } = useThemeColors();
  const { isTablet } = useResponsive();
  const { isPartner, isAdmin } = useAuth();
  const { t } = useLocale();
  const { unreadCount } = useNotifications();
  const { unreadCount: unreadMessages } = useMessages();

  const roles = { isPartner, isAdmin };
  const primary = primaryNavItems(roles);
  const groups = secondaryNavGroups(roles);

  const collapsed = isTablet;
  const inactiveIcon = isDarkMode ? '#9CA3AF' : '#6B7280';

  /** The count badge an item carries, if any. Only two destinations have one. */
  const badgeFor = (item: NavItem): number => {
    if (item.route === 'Notifications') return unreadCount;
    if (item.route === 'Messages') return unreadMessages;
    return 0;
  };

  const renderItem = (item: NavItem) => {
    const isSelected = activeRoute === item.route;
    const badge = badgeFor(item);

    return (
      <Pressable
        key={item.route}
        onPress={() => navigateToNavItem(item)}
        accessibilityRole="link"
        accessibilityLabel={t(item.labelKey)}
        accessibilityState={{ selected: isSelected }}
        style={({ hovered }: any) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          paddingVertical: 10,
          paddingHorizontal: collapsed ? 0 : 12,
          marginBottom: 2,
          borderRadius: 10,
          backgroundColor: isSelected
            ? isDarkMode
              ? 'rgba(0,200,112,0.16)'
              : '#E6FAF0'
            : hovered
              ? isDarkMode
                ? 'rgba(255,255,255,0.05)'
                : '#F3F4F6'
              : 'transparent',
          cursor: 'pointer',
        })}>
        <View>
          <Ionicons name={item.icon} size={20} color={isSelected ? BRAND_GREEN : inactiveIcon} />
          {/* On the collapsed rail the label is gone, so the badge is the only signal that
              anything is waiting — it moves onto the icon rather than disappearing with the row. */}
          {collapsed && badge > 0 && (
            <View
              style={{
                position: 'absolute',
                top: -4,
                right: -6,
                minWidth: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#EF4444',
              }}
            />
          )}
        </View>

        {!collapsed && (
          <>
            <Text
              numberOfLines={1}
              className={`ml-3 flex-1 text-sm ${
                isSelected ? 'font-semibold text-brand-600' : `font-medium ${textColor}`
              }`}>
              {t(item.labelKey)}
            </Text>
            {badge > 0 && (
              <View className="ml-2 min-w-[20px] items-center rounded-full bg-red-500 px-1.5 py-0.5">
                <Text className="text-[10px] font-bold text-white">
                  {badge > 99 ? '99+' : badge}
                </Text>
              </View>
            )}
          </>
        )}
      </Pressable>
    );
  };

  return (
    <View
      role="navigation"
      accessibilityLabel={t('nav.mainNavigation')}
      className={`${cardBg} border-r ${borderColor}`}
      style={{
        width: collapsed ? SIDENAV_WIDTH.tablet : SIDENAV_WIDTH.desktop,
        height: '100%',
      }}>
      {/* Brand mark — doubles as the "go home" affordance every web app has in this corner.
          Labelled with the app's name, not "Home": the Home item is right below it, and two
          links announcing the same word is worse for a screen reader than an unlabelled logo. */}
      <Pressable
        onPress={() => navigateToNavItem(primary[0])}
        accessibilityRole="link"
        accessibilityLabel="PetBooker"
        style={({ hovered }: any) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          height: 64,
          paddingHorizontal: collapsed ? 0 : 20,
          opacity: hovered ? 0.8 : 1,
          cursor: 'pointer',
        })}>
        <Ionicons name="paw" size={24} color={BRAND_GREEN} />
        {!collapsed && <Text className={`ml-2 text-lg font-bold ${textColor}`}>PetBooker</Text>}
      </Pressable>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: collapsed ? 12 : 12, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}>
        {primary.map(renderItem)}

        {groups.map(({ group, items }) => (
          <View key={group} style={{ marginTop: 20 }}>
            {collapsed ? (
              // A hairline instead of a heading: the rail has no room for one, but the groups
              // still need to read as groups rather than one long list of icons.
              <View
                style={{
                  height: 1,
                  backgroundColor: hex.border,
                  marginHorizontal: 8,
                  marginBottom: 12,
                }}
              />
            ) : (
              <Text
                className={`mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider ${subtextColor}`}>
                {t(GROUP_LABEL_KEYS[group])}
              </Text>
            )}
            {items.map(renderItem)}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
