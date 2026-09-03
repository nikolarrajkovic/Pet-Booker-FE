import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, useThemeColors } from '../../hooks/useThemeColors';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useNotifications } from '../../context/NotificationsContext';
import { useMessages } from '../../context/MessagesContext';
import { navigateFromOutside } from '../../navigation/navigationRef';

export const TOPBAR_HEIGHT = 64;

/** Small round icon button with a count badge — the bell and the messages icon. */
function IconAction({
  icon,
  label,
  badge,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  badge: number;
  onPress: () => void;
}) {
  const { isDarkMode, hex } = useThemeColors();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ hovered }: any) => ({
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
        backgroundColor: hovered
          ? isDarkMode
            ? 'rgba(255,255,255,0.06)'
            : '#F3F4F6'
          : 'transparent',
        cursor: 'pointer',
      })}>
      <Ionicons name={icon} size={22} color={hex.subtext} />
      {badge > 0 && (
        <View className="absolute right-1 top-1 min-w-[16px] items-center rounded-full bg-red-500 px-1">
          <Text className="text-[10px] font-bold text-white">{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

/**
 * The web design's persistent top bar: search, notifications, messages, account.
 *
 * These are the four things a web user expects in the same place on every page, and on the phone
 * design each screen carries its own copy of whichever ones it needs (the bell is an `AppHeader`
 * prop, search is a whole tab). Hoisting them here is why `ScreenLayout` ignores
 * `showNotificationButton` on this design — two bells on one page is worse than none.
 *
 * Mounted once by `AppShell`, outside the navigator, so it navigates through the container ref.
 */
export default function TopBar() {
  const {
    isDarkMode,
    cardBg,
    borderColor,
    textColor,
    subtextColor,
    inputBg,
    placeholderColor,
    hex,
  } = useThemeColors();
  const { currentUser, signOut } = useAuth();
  const { t } = useLocale();
  const { unreadCount } = useNotifications();
  const { unreadCount: unreadMessages } = useMessages();

  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const initials =
    `${currentUser?.firstName?.[0] ?? ''}${currentUser?.lastName?.[0] ?? ''}`.toUpperCase() ||
    (currentUser?.userName?.[0] ?? '?').toUpperCase();
  const displayName =
    [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(' ') ||
    currentUser?.userName ||
    '';

  const submitSearch = () => {
    // The Search tab owns the actual query; this field is a way in from any page, not a second
    // search implementation.
    navigateFromOutside('MainTabs', {
      screen: 'Search',
      params: { query: query.trim() || undefined },
    });
  };

  const go = (route: string) => {
    setMenuOpen(false);
    navigateFromOutside(route);
  };

  const menuItem = (
    icon: React.ComponentProps<typeof Ionicons>['name'],
    label: string,
    onPress: () => void,
    danger = false
  ) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="menuitem"
      accessibilityLabel={label}
      style={({ hovered }: any) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        backgroundColor: hovered
          ? isDarkMode
            ? 'rgba(255,255,255,0.06)'
            : '#F3F4F6'
          : 'transparent',
        cursor: 'pointer',
      })}>
      <Ionicons name={icon} size={18} color={danger ? '#EF4444' : hex.subtext} />
      <Text className={`ml-3 text-sm ${danger ? 'text-red-500' : textColor}`}>{label}</Text>
    </Pressable>
  );

  return (
    <View
      className={`${cardBg} border-b ${borderColor} flex-row items-center px-6`}
      style={{ height: TOPBAR_HEIGHT, zIndex: 20 }}>
      {/* Search — capped rather than full-bleed, so it reads as a field and not as a page header */}
      <View
        className={`${inputBg} flex-row items-center rounded-full px-4`}
        style={{ height: 40, flex: 1, maxWidth: 420 }}>
        <Ionicons name="search" size={18} color={placeholderColor} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={submitSearch}
          returnKeyType="search"
          placeholder={t('nav.searchPlaceholder')}
          placeholderTextColor={placeholderColor}
          accessibilityLabel={t('common.search')}
          className={`ml-2 flex-1 ${textColor}`}
          // The web input keeps a focus ring by default that sits outside the pill; the pill is
          // the affordance, so the ring is redundant and clips oddly against the rounded edge.
          style={{ outlineStyle: 'none' } as any}
        />
      </View>

      <View style={{ flex: 1 }} />

      <View className="flex-row items-center gap-1">
        <IconAction
          icon="chatbubbles-outline"
          label={t('messages.title')}
          badge={unreadMessages}
          onPress={() => go('Messages')}
        />
        <IconAction
          icon="notifications-outline"
          label={t('profile.notifications')}
          badge={unreadCount}
          onPress={() => go('Notifications')}
        />

        <Pressable
          onPress={() => setMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('nav.account')}
          accessibilityState={{ expanded: menuOpen }}
          style={({ hovered }: any) => ({
            flexDirection: 'row',
            alignItems: 'center',
            marginLeft: 8,
            paddingLeft: 4,
            paddingRight: 10,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: hovered
              ? isDarkMode
                ? 'rgba(255,255,255,0.06)'
                : '#F3F4F6'
              : 'transparent',
            cursor: 'pointer',
          })}>
          <View
            className="items-center justify-center rounded-full"
            style={{ width: 32, height: 32, backgroundColor: BRAND_GREEN }}>
            <Text className="text-xs font-bold text-white">{initials}</Text>
          </View>
          {!!displayName && (
            <Text
              numberOfLines={1}
              className={`ml-2 max-w-[140px] text-sm font-medium ${textColor}`}>
              {displayName}
            </Text>
          )}
          <Ionicons name="chevron-down" size={14} color={hex.subtext} style={{ marginLeft: 4 }} />
        </Pressable>
      </View>

      {/* A Modal rather than an absolutely-positioned View: the bar is inside the shell's layout,
          so a plain dropdown would be clipped by the content region's overflow. The transparent
          backdrop is also what gives click-outside-to-close for free. */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => setMenuOpen(false)}
          accessibilityRole="button">
          <View
            className={`${cardBg} border ${borderColor} absolute rounded-xl py-2`}
            style={{
              top: TOPBAR_HEIGHT - 8,
              right: 24,
              minWidth: 220,
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 8 },
              elevation: 8,
            }}>
            <View className="px-4 pb-2 pt-1">
              <Text numberOfLines={1} className={`text-sm font-semibold ${textColor}`}>
                {displayName}
              </Text>
              <Text numberOfLines={1} className={`text-xs ${subtextColor}`}>
                {currentUser?.email}
              </Text>
            </View>
            <View className={`my-1 border-t ${borderColor}`} />
            {menuItem('person-outline', t('profile.account'), () => go('Account'))}
            {menuItem('settings-outline', t('profile.settings'), () => go('Settings'))}
            <View className={`my-1 border-t ${borderColor}`} />
            {menuItem(
              'log-out-outline',
              t('profile.logout'),
              () => {
                setMenuOpen(false);
                void signOut();
              },
              true
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
