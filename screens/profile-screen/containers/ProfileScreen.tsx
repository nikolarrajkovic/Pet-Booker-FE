import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import { useLocale } from '../../../context/LocaleContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import ResponsiveGrid from '../../../components/shared/ResponsiveGrid';
import Avatar from '../../../components/shared/Avatar';
import { useResponsive } from '../../../hooks/useResponsive';
import { useTabBarSpacing } from '../../../hooks/useSafeAreaSpacing';
import { resolveImageUrl } from '../../../services/service-providers';
import { getUser, UserDto } from '../../../services/users';
import { countBookings, BookingState } from '../../../services/bookings';
import { MenuItem } from '../components';
import { usePageGutter } from '../../../hooks/usePageGutter';
import Constants from 'expo-constants';

/** The running build's version, from app.json via the Expo manifest. */
const APP_VERSION = Constants.expoConfig?.version ?? '';

const USER_MENU_ITEMS = [
  {
    id: 'account',
    icon: 'person-outline',
    iconType: 'ionicons',
    titleKey: 'profile.account',
    subtitleKey: 'profile.accountSub',
    color: BRAND_GREEN,
  },
  {
    id: 'pets',
    icon: 'paw',
    iconType: 'material',
    titleKey: 'profile.pets',
    subtitleKey: 'profile.petsSub',
    color: BRAND_GREEN,
  },
  {
    id: 'bookings',
    icon: 'briefcase-outline',
    iconType: 'ionicons',
    titleKey: 'profile.bookings',
    subtitleKey: 'profile.bookingsSub',
    color: BRAND_GREEN,
  },
  {
    // Requests sent to several providers at once — not bookings until one of them accepts.
    id: 'group-requests',
    icon: 'people-outline',
    iconType: 'ionicons',
    titleKey: 'groupRequest.navMine',
    subtitleKey: 'groupRequest.profileSub',
    color: BRAND_GREEN,
  },
  {
    id: 'schedule',
    icon: 'calendar-outline',
    iconType: 'ionicons',
    titleKey: 'profile.schedule',
    subtitleKey: 'profile.scheduleSub',
    color: BRAND_GREEN,
  },
  {
    id: 'messages',
    icon: 'chatbubbles-outline',
    iconType: 'ionicons',
    titleKey: 'messages.title',
    subtitleKey: 'messages.subtitle',
    color: BRAND_GREEN,
  },
  {
    id: 'notifications',
    icon: 'notifications-outline',
    iconType: 'ionicons',
    titleKey: 'profile.notifications',
    subtitleKey: 'profile.notificationsSub',
    color: BRAND_GREEN,
  },
  {
    id: 'notification-settings',
    icon: 'options-outline',
    iconType: 'ionicons',
    titleKey: 'profile.notificationSettings',
    subtitleKey: 'profile.notificationSettingsSub',
    color: BRAND_GREEN,
  },
  {
    id: 'settings',
    icon: 'settings-outline',
    iconType: 'ionicons',
    titleKey: 'profile.settings',
    subtitleKey: 'profile.settingsSub',
    color: BRAND_GREEN,
  },
];

const PARTNER_MENU_ITEMS = USER_MENU_ITEMS;

/**
 * Everything a managed ProviderProfile login cannot use, because it has no `Domain.User` row
 * behind it and the ServiceProvider group carries none of the user-scoped permissions:
 *
 *  - **notification-settings** — `UserNotificationSettings` is keyed on UserId, so every read and
 *    write is a 401. Listed anyway, the screen swallowed the failure and left toggles that looked
 *    applied and changed nothing.
 *  - **pets** — `SearchPets` is a 401, and the screen rendered the raw backend text
 *    "Missing permission for command 'SearchPets'." at the user.
 *  - **group-requests** — a group request is the owner's, keyed on their UserId like bookings.
 *  - **bookings** — the personal booking list is scoped to the caller's UserId, so it always came
 *    back empty and told a provider with a full diary "No upcoming bookings". Their real diary is
 *    My Schedule, which is listed separately and works.
 *
 * Mirrors the `requires: 'user'` gate in navigation/navItems.ts, which does the same for the web
 * sidebar and the phone tab bar.
 */
const PROFILE_ONLY_HIDDEN_IDS = ['notification-settings', 'pets', 'bookings', 'group-requests'];

const withoutUserScopedItems = (items: typeof USER_MENU_ITEMS) =>
  items.filter((item) => !PROFILE_ONLY_HIDDEN_IDS.includes(item.id));

export default function ProfileScreen() {
  const gutter = usePageGutter();
  const navigation = useNavigation();
  const {
    isDarkMode,
    cardBg,
    bgColor: contentBg,
    textColor,
    subtextColor,
    borderColor,
  } = useThemeColors();
  const { signOut, isPartner, isProviderProfile, currentUser } = useAuth();
  const { t } = useLocale();
  const { isWebLayout } = useResponsive();
  const tabBarSpacing = useTabBarSpacing();

  const [user, setUser] = useState<UserDto | null>(null);
  // Surfaces the "Live Session" menu item while one of the user's own bookings is
  // in progress — or confirmed and still upcoming, so they can open the screen
  // early and (on live-tracked services) watch the provider head out.
  const [liveSession, setLiveSession] = useState<'none' | 'upcoming' | 'started'>('none');

  // Load the real profile (name + avatar) on focus — auth/me has no avatarUrl.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (currentUser?.id) {
        getUser(currentUser.id)
          .then((u) => {
            if (!cancelled) setUser(u);
          })
          .catch(() => {});
        // Two counts rather than a page of bookings: a page of the oldest 50 never contained the
        // session that was due once an account had more. Accepted excludes expired ones.
        Promise.all([
          countBookings({ userId: currentUser.id, state: BookingState.InProgress }),
          countBookings({ userId: currentUser.id, state: BookingState.Accepted }),
        ])
          .then(([started, upcoming]) => {
            if (cancelled) return;
            setLiveSession(started > 0 ? 'started' : upcoming > 0 ? 'upcoming' : 'none');
          })
          .catch(() => {
            if (!cancelled) setLiveSession('none');
          });
      }
      return () => {
        cancelled = true;
      };
    }, [currentUser?.id])
  );

  const fullName =
    [user?.firstName ?? currentUser?.firstName, user?.lastName ?? currentUser?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    currentUser?.userName ||
    t('profile.yourProfile');
  const email = user?.email ?? currentUser?.email ?? '';
  const avatarUri = resolveImageUrl(user?.avatarUrl);
  const avatarName = user?.firstName ?? currentUser?.firstName ?? email;

  const baseMenu = isPartner ? PARTNER_MENU_ITEMS : USER_MENU_ITEMS;
  const scopedMenu = isProviderProfile ? withoutUserScopedItems(baseMenu) : baseMenu;
  const menuItems =
    liveSession !== 'none'
      ? [
          {
            id: 'live-session',
            icon: 'radio',
            iconType: 'ionicons',
            titleKey: 'profile.liveSession',
            subtitleKey:
              liveSession === 'started'
                ? 'profile.liveSessionStartedSub'
                : 'profile.liveSessionUpcomingSub',
            color: liveSession === 'started' ? '#EF4444' : '#00A85A',
          },
          ...scopedMenu,
        ]
      : scopedMenu;

  const handleMenuPress = (id: string) => {
    if (id === 'live-session') (navigation as any).navigate('LiveSession', { mode: 'user' });
    else if (id === 'account') (navigation as any).navigate('Account');
    else if (id === 'pets') (navigation as any).navigate('MyPets');
    else if (id === 'bookings') (navigation as any).navigate('MyBookings');
    else if (id === 'group-requests') (navigation as any).navigate('MyGroupRequests');
    else if (id === 'new-requests') (navigation as any).navigate('NewRequests');
    else if (id === 'schedule') (navigation as any).navigate('MySchedule', { mode: 'user' });
    else if (id === 'services') (navigation as any).navigate('MyServices');
    else if (id === 'promotions') (navigation as any).navigate('Promotions');
    else if (id === 'messages') (navigation as any).navigate('Messages');
    else if (id === 'notifications') (navigation as any).navigate('Notifications');
    else if (id === 'notification-settings') (navigation as any).navigate('NotificationSettings');
    else if (id === 'settings') (navigation as any).navigate('Settings');
  };

  return (
    <ScreenLayout
      headerVariant="large"
      showBackButton
      contentBg={contentBg}
      width="wide"
      // On the web design the account menu in the TopBar already names the signed-in user, so the
      // page needs a title rather than a second identity card.
      headerTitle={isWebLayout ? t('profile.title') : undefined}
      headerSubtitle={isWebLayout ? [fullName, email].filter(Boolean).join(' · ') : undefined}
      headerChildren={
        isWebLayout ? undefined : (
          <>
            <Text className="mb-6 text-2xl font-bold text-white">{t('profile.title')}</Text>
            <View
              className={`${isDarkMode ? 'bg-[#243447]' : 'bg-brand-400'} mb-8 flex-row items-center rounded-2xl p-4`}>
              <Avatar uri={avatarUri} name={avatarName} size={64} className="mr-4" />
              <View className="flex-1">
                <Text className="text-lg font-bold text-white">{fullName}</Text>
                {email ? <Text className="mt-1 text-sm text-brand-100">{email}</Text> : null}
              </View>
            </View>
          </>
        )
      }>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 24, paddingBottom: isWebLayout ? 32 : tabBarSpacing }}>
        {/* Become a Partner Banner — only for non-partners */}
        {!isPartner && (
          <View className={`${gutter.mx} mb-6 rounded-2xl bg-brand-500 p-6`}>
            <Text className="mb-2 text-xl font-bold text-white">{t('profile.becomePartner')}</Text>
            <Text className="mb-4 text-sm text-brand-100">{t('profile.becomePartnerSub')}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              className="rounded-xl bg-white py-3"
              activeOpacity={0.7}
              onPress={() => (navigation as any).navigate('BecomePartner')}>
              <Text className="text-center font-semibold text-brand-600">
                {t('profile.learnMore')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View className={`${gutter.px}`}>
          {/*
            Nine settings rows stacked full-width read as a phone list on a desktop — each one a
            1120px-wide bar holding an icon and two short lines. As a grid they become tiles the
            eye can scan in two dimensions, which is how every web settings page is laid out.
          */}
          <ResponsiveGrid columns={{ mobile: 1, tablet: 2, desktop: 3 }} gap={12} rowGap={0}>
            {menuItems.map((item) => (
              <MenuItem
                key={item.id}
                icon={item.icon}
                iconType={item.iconType}
                title={t(item.titleKey as any)}
                subtitle={t(item.subtitleKey as any)}
                color={item.color}
                isDarkMode={isDarkMode}
                cardBg={cardBg}
                textColor={textColor}
                subtextColor={subtextColor}
                borderColor={borderColor}
                badge={(item as any).badge}
                onPress={() => handleMenuPress(item.id)}
              />
            ))}
          </ResponsiveGrid>

          <TouchableOpacity
            accessibilityRole="button"
            className={`flex-row items-center ${cardBg} mb-3 rounded-2xl border p-4 ${borderColor}`}
            activeOpacity={0.7}
            onPress={() => signOut()}>
            <View
              className={`h-12 w-12 ${isDarkMode ? 'bg-[#243447]' : 'bg-red-50'} mr-4 items-center justify-center rounded-xl`}>
              <Ionicons name="log-out-outline" size={24} color="#EF4444" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-red-600">{t('profile.logout')}</Text>
              <Text className={`text-sm ${subtextColor} mt-0.5`}>{t('profile.logoutSub')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <View className="mb-4 mt-6 items-center">
            {/* The version is the build's own (app.json), and the year is today's — both were typed
                in, so the footer read "v1.0.0" whatever shipped and "© 2025" from January on. */}
            <Text className={`text-sm ${subtextColor}`}>
              {t('login.appName')} v{APP_VERSION}
            </Text>
            <Text className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
              {t('profile.rights', { year: new Date().getFullYear() })}
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}
