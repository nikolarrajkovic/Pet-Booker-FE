import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Image } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import TabBar from '../../../components/shared/TabBar';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { resolveImageUrl } from '../../../services/service-providers';
import { getUser, UserDto } from '../../../services/users';
import { getBookings, parseBookingDate, BookingStatusType } from '../../../services/bookings';
import { MenuItem } from '../components';

const USER_MENU_ITEMS = [
  { id: 'account', icon: 'person-outline', iconType: 'ionicons', title: 'Account', subtitle: 'Manage your personal info', color: '#00C870' },
  { id: 'pets', icon: 'paw', iconType: 'material', title: 'My Pets', subtitle: 'Add and manage your pets', color: '#00C870' },
  { id: 'bookings', icon: 'briefcase-outline', iconType: 'ionicons', title: 'My Bookings', subtitle: 'View booking history', color: '#00C870' },
  { id: 'schedule', icon: 'calendar-outline', iconType: 'ionicons', title: 'My Schedule', subtitle: 'View your appointments', color: '#00C870' },
  { id: 'notifications', icon: 'notifications-outline', iconType: 'ionicons', title: 'Notifications', subtitle: 'View your notifications', color: '#00C870' },
  { id: 'notification-settings', icon: 'options-outline', iconType: 'ionicons', title: 'Notifications settings', subtitle: 'Manage your preferences', color: '#00C870' },
  { id: 'settings', icon: 'settings-outline', iconType: 'ionicons', title: 'Settings', subtitle: 'App configuration', color: '#00C870' },
];

const PARTNER_MENU_ITEMS = [
  { id: 'account', icon: 'person-outline', iconType: 'ionicons', title: 'Account', subtitle: 'Manage your personal info', color: '#00C870' },
  { id: 'pets', icon: 'paw', iconType: 'material', title: 'My Pets', subtitle: 'Add and manage your pets', color: '#00C870' },
  { id: 'bookings', icon: 'briefcase-outline', iconType: 'ionicons', title: 'My Bookings', subtitle: 'View booking history', color: '#00C870' },
  { id: 'schedule', icon: 'calendar-outline', iconType: 'ionicons', title: 'My Schedule', subtitle: 'View your appointments', color: '#00C870' },
  { id: 'notifications', icon: 'notifications-outline', iconType: 'ionicons', title: 'Notifications', subtitle: 'View your notifications', color: '#00C870' },
  { id: 'notification-settings', icon: 'options-outline', iconType: 'ionicons', title: 'Notifications settings', subtitle: 'Manage your preferences', color: '#00C870' },
  { id: 'settings', icon: 'settings-outline', iconType: 'ionicons', title: 'Settings', subtitle: 'App configuration', color: '#00C870' },
];

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { isDarkMode, cardBg, bgColor: contentBg, textColor, subtextColor, borderColor } = useThemeColors();
  const { signOut, isPartner, currentUser } = useAuth();

  const [user, setUser] = useState<UserDto | null>(null);
  const [avatarError, setAvatarError] = useState(false);
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
          .then((u) => { if (!cancelled) { setUser(u); setAvatarError(false); } })
          .catch(() => {});
        getBookings({ userId: currentUser.id })
          .then((list) => {
            if (cancelled) return;
            const started = list.some(
              (b) => b.currentStatus === BookingStatusType.ServiceStarted
            );
            const upcoming = list.some(
              (b) =>
                (b.currentStatus === BookingStatusType.ServiceConfirmedByProvider ||
                  b.currentStatus === BookingStatusType.PrePayment) &&
                parseBookingDate(b.bookingTo).getTime() >= Date.now()
            );
            setLiveSession(started ? 'started' : upcoming ? 'upcoming' : 'none');
          })
          .catch(() => { if (!cancelled) setLiveSession('none'); });
      }
      return () => { cancelled = true; };
    }, [currentUser?.id])
  );

  const fullName =
    [user?.firstName ?? currentUser?.firstName, user?.lastName ?? currentUser?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim() || currentUser?.userName || 'Your Profile';
  const email = user?.email ?? currentUser?.email ?? '';
  const avatarUri = avatarError ? '' : resolveImageUrl(user?.avatarUrl);
  const initials = ((user?.firstName ?? currentUser?.firstName ?? email ?? '?').trim()[0] ?? '?').toUpperCase();

  const baseMenu = isPartner ? PARTNER_MENU_ITEMS : USER_MENU_ITEMS;
  const menuItems =
    liveSession !== 'none'
      ? [
          {
            id: 'live-session',
            icon: 'radio',
            iconType: 'ionicons',
            title: 'Live Session',
            subtitle:
              liveSession === 'started'
                ? 'Service in progress — tap to track'
                : 'Upcoming service — open to watch it start',
            color: liveSession === 'started' ? '#EF4444' : '#00A85A',
          },
          ...baseMenu,
        ]
      : baseMenu;

  const handleMenuPress = (id: string) => {
    if (id === 'live-session') (navigation as any).navigate('LiveSession', { mode: 'user' });
    else if (id === 'account') (navigation as any).navigate('Account');
    else if (id === 'pets') (navigation as any).navigate('MyPets');
    else if (id === 'bookings') (navigation as any).navigate('MyBookings');
    else if (id === 'new-requests') (navigation as any).navigate('NewRequests');
    else if (id === 'schedule') (navigation as any).navigate('MySchedule', { mode: 'user' });
    else if (id === 'services') (navigation as any).navigate('MyServices');
    else if (id === 'promotions') (navigation as any).navigate('Promotions');
    else if (id === 'notifications') (navigation as any).navigate('Notifications');
    else if (id === 'notification-settings') (navigation as any).navigate('NotificationSettings');
    else if (id === 'settings') (navigation as any).navigate('Settings');
  };

  return (
    <ScreenLayout
      headerVariant="large"
      contentBg={contentBg}
      footer={<TabBar />}
      headerChildren={
        <>
          <Text className="text-white text-2xl font-bold mb-6">Profile</Text>
          <View className={`${isDarkMode ? 'bg-[#243447]' : 'bg-brand-400'} rounded-2xl p-4 flex-row items-center mb-8`}>
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                className="w-16 h-16 rounded-full mr-4"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <View className="w-16 h-16 rounded-full items-center justify-center mr-4 bg-white/25">
                <Text className="text-white text-2xl font-bold">{initials}</Text>
              </View>
            )}
            <View className="flex-1">
              <Text className="text-white text-lg font-bold">{fullName}</Text>
              {email ? <Text className="text-brand-100 text-sm mt-1">{email}</Text> : null}
            </View>
          </View>
        </>
      }
    >
      <ScrollView className="flex-1" contentContainerStyle={{ paddingTop: 24, paddingBottom: 100 }}>
        {/* Become a Partner Banner — only for non-partners */}
        {!isPartner && (
        <View className="mx-6 mb-6 bg-brand-500 rounded-2xl p-6">
          <Text className="text-white text-xl font-bold mb-2">Become a Partner</Text>
          <Text className="text-brand-100 text-sm mb-4">Share your passion for pets and earn extra income</Text>
          <TouchableOpacity className="bg-white py-3 rounded-xl" activeOpacity={0.7} onPress={() => (navigation as any).navigate('BecomePartner')}>
            <Text className="text-brand-600 text-center font-semibold">Learn More</Text>
          </TouchableOpacity>
        </View>
        )}

        <View className="px-6">
          {menuItems.map((item) => (
            <MenuItem
              key={item.id}
              icon={item.icon}
              iconType={item.iconType}
              title={item.title}
              subtitle={item.subtitle}
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

          <TouchableOpacity className={`flex-row items-center ${cardBg} rounded-2xl p-4 mb-3 border ${borderColor}`} activeOpacity={0.7} onPress={() => signOut()}>
            <View className={`w-12 h-12 ${isDarkMode ? 'bg-[#243447]' : 'bg-red-50'} rounded-xl items-center justify-center mr-4`}>
              <Ionicons name="log-out-outline" size={24} color="#EF4444" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-red-600">Logout</Text>
              <Text className={`text-sm ${subtextColor} mt-0.5`}>Sign out of your account</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <View className="items-center mt-6 mb-4">
            <Text className={`text-sm ${subtextColor}`}>PawCare v1.0.0</Text>
            <Text className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} mt-1`}>© 2025 All rights reserved</Text>
          </View>
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}
