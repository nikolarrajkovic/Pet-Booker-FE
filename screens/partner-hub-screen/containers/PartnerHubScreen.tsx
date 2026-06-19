import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import { getBookings, BookingState, BookingStatusType } from '../../../services/bookings';
import TabBar from '../../../components/shared/TabBar';

// ─── Stats Pills Data ──────────────────────────────────────────────────────────
const STATS = [
  {
    id: 1,
    icon: 'cash-outline' as const,
    iconLib: 'ionicons',
    iconBg: '#E8F5EF',
    iconColor: '#00C870',
    value: '$4,250',
    label: 'This Month',
    change: '+18%',
  },
  {
    id: 2,
    icon: 'people-outline' as const,
    iconLib: 'ionicons',
    iconBg: '#E8F5EF',
    iconColor: '#00C870',
    value: '127',
    label: 'Total Clients',
    change: '+23',
  },
  {
    id: 3,
    icon: 'calendar-outline' as const,
    iconLib: 'ionicons',
    iconBg: '#EEF2FF',
    iconColor: '#6366F1',
    value: '38',
    label: 'Appointments',
    change: '+12',
  },
  {
    id: 4,
    icon: 'star-outline' as const,
    iconLib: 'ionicons',
    iconBg: '#FEF9C3',
    iconColor: '#CA8A04',
    value: '4.9',
    label: 'Rating',
    change: '+0.2',
  },
];

// ─── Quick Actions Data ────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  {
    id: 'live-session',
    title: 'Live Session',
    subtitle: 'Start & run a service',
    icon: 'radio-outline' as const,
    iconLib: 'ionicons',
    iconBg: '#FEE2E2',
    iconColor: '#EF4444',
    badge: null,
    badgeColor: null,
    route: 'LiveSession',
  },
  {
    id: 'schedule',
    title: 'My Schedule',
    subtitle: 'Manage appointments',
    icon: 'calendar-outline' as const,
    iconLib: 'ionicons',
    iconBg: '#EEF2FF',
    iconColor: '#6366F1',
    badge: '8 today',
    badgeColor: '#F97316',
    route: 'MySchedule',
  },
  {
    id: 'requests',
    title: 'Requests',
    subtitle: 'Review booking requests',
    icon: 'notifications-outline' as const,
    iconLib: 'ionicons',
    iconBg: '#FEE2E2',
    iconColor: '#EF4444',
    badge: '3 new',
    badgeColor: '#F97316',
    route: 'NewRequests',
  },
  {
    id: 'services',
    title: 'My Services',
    subtitle: 'Edit services & pricing',
    icon: 'bar-chart-outline' as const,
    iconLib: 'ionicons',
    iconBg: '#F3E8FF',
    iconColor: '#A855F7',
    badge: null,
    badgeColor: null,
    route: 'MyServices',
  },
  {
    id: 'promotions',
    title: 'Promotions',
    subtitle: 'Boost your visibility',
    icon: 'flash-outline' as const,
    iconLib: 'ionicons',
    iconBg: '#FEF3C7',
    iconColor: '#F59E0B',
    badge: '2 active',
    badgeColor: '#F97316',
    route: 'Promotions',
  },
];

// ─── Recent Activity Data ──────────────────────────────────────────────────────
const RECENT_ACTIVITY = [
  {
    id: 1,
    title: 'New booking from Sarah',
    time: '2 hours ago',
    icon: 'calendar-outline' as const,
    iconBg: '#E8F5EF',
    iconColor: '#00C870',
  },
  {
    id: 2,
    title: '5-star review received',
    time: '5 hours ago',
    icon: 'star-outline' as const,
    iconBg: '#FEF3C7',
    iconColor: '#F59E0B',
  },
  {
    id: 3,
    title: 'Payment received - $85',
    time: 'Yesterday',
    icon: 'cash-outline' as const,
    iconBg: '#EEF2FF',
    iconColor: '#6366F1',
  },
];

export default function PartnerHubScreen() {
  const navigation = useNavigation();
  const { isDarkMode, hex } = useThemeColors();
  const { currentUser } = useAuth();
  const insets = useSafeAreaInsets();

  const bgColor = hex.bg;
  const cardBg = hex.card;
  const borderColor = hex.border;
  const activityBorder = isDarkMode ? '#2d3748' : '#F3F4F6';

  // Is a service currently in progress? Drives the "live" banner + card badge.
  const [hasLiveSession, setHasLiveSession] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const providerId = currentUser?.serviceProviderId || null;
        if (!providerId) {
          if (!cancelled) setHasLiveSession(false);
          return;
        }
        try {
          const live = await getBookings({
            serviceProviderId: providerId,
            currentStatus: BookingStatusType.ServiceStarted,
            state: BookingState.Upcoming,
          });
          if (!cancelled) setHasLiveSession(live.length > 0);
        } catch {
          if (!cancelled) setHasLiveSession(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [currentUser?.serviceProviderId]),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#00C870' }}>
      {/* ── Header ── */}
      <View
        style={{
          backgroundColor: '#00C870',
          paddingHorizontal: 20,
          paddingTop: insets.top > 0 ? 8 : 16,
          paddingBottom: 24,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'white', fontSize: 26, fontWeight: '700', letterSpacing: -0.5 }}>
              Partner Hub
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 2 }}>
              Welcome back, Jessica!
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => (navigation as any).navigate('Settings')}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.25)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="settings-outline" size={20} color="white" />
          </TouchableOpacity>
        </View>

        {/* ── Stats Pills (horizontally scrollable) ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 16 }}
          contentContainerStyle={{ gap: 10, paddingRight: 4 }}
        >
          {STATS.map((stat) => (
            <View
              key={stat.id}
              style={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                minWidth: 150,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: 'rgba(255,255,255,0.3)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={stat.icon} size={18} color="white" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>
                    {stat.value}
                  </Text>
                  <View
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.3)',
                      borderRadius: 6,
                      paddingHorizontal: 5,
                      paddingVertical: 1,
                    }}
                  >
                    <Text style={{ color: 'white', fontSize: 10, fontWeight: '600' }}>
                      {stat.change}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 1 }}>
                  {stat.label}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* ── Main Content ── */}
      <View
        style={{
          flex: 1,
          backgroundColor: bgColor,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          marginTop: -16,
          overflow: 'hidden',
        }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* ── Active Live Session banner ── */}
          {hasLiveSession && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => (navigation as any).navigate('LiveSession', { mode: 'partner' })}
              style={{
                marginHorizontal: 20,
                marginTop: 24,
                backgroundColor: '#EF4444',
                borderRadius: 16,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255,255,255,0.25)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="radio" size={22} color="white" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: 'white', fontSize: 15, fontWeight: '700' }}>
                  Service in progress
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 2 }}>
                  Tap to open your live session
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="white" />
            </TouchableOpacity>
          )}

          {/* ── Quick Actions ── */}
          <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: isDarkMode ? '#ffffff' : '#111827', marginBottom: 14 }}>
              Quick Actions
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {QUICK_ACTIONS.map((action) => {
                const isLive = action.id === 'live-session';
                const badgeText = isLive ? (hasLiveSession ? 'LIVE' : null) : action.badge;
                const badgeColor = isLive ? '#EF4444' : action.badgeColor;
                return (
                <TouchableOpacity
                  key={action.id}
                  activeOpacity={0.85}
                  onPress={() => (navigation as any).navigate(action.route, action.id === 'schedule' || isLive ? { mode: 'partner' } : undefined)}
                  style={{
                    width: '47%',
                    backgroundColor: cardBg,
                    borderRadius: 16,
                    padding: 16,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: isDarkMode ? 0 : 0.05,
                    shadowRadius: 3,
                    elevation: 2,
                    borderWidth: 1,
                    borderColor: isLive && hasLiveSession ? '#EF4444' : borderColor,
                  }}
                >
                  {/* Badge */}
                  {badgeText && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        backgroundColor: badgeColor!,
                        borderRadius: 8,
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                      }}
                    >
                      <Text style={{ color: 'white', fontSize: 10, fontWeight: '600' }}>
                        {badgeText}
                      </Text>
                    </View>
                  )}

                  {/* Icon */}
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: action.iconBg,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 10,
                    }}
                  >
                    <Ionicons name={action.icon} size={22} color={action.iconColor} />
                  </View>

                  <Text style={{ fontSize: 14, fontWeight: '600', color: isDarkMode ? '#ffffff' : '#111827', marginBottom: 3 }}>
                    {action.title}
                  </Text>
                  <Text style={{ fontSize: 11, color: isDarkMode ? '#6B7280' : '#6B7280', lineHeight: 15 }}>
                    {action.subtitle}
                  </Text>
                </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Recent Activity ── */}
          <View style={{ paddingHorizontal: 20, paddingTop: 28 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: isDarkMode ? '#ffffff' : '#111827', marginBottom: 14 }}>
              Recent Activity
            </Text>
            <View
              style={{
                backgroundColor: cardBg,
                borderRadius: 16,
                overflow: 'hidden',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: isDarkMode ? 0 : 0.05,
                shadowRadius: 3,
                elevation: 2,
                borderWidth: 1,
                borderColor: borderColor,
              }}
            >
              {RECENT_ACTIVITY.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderBottomWidth: index < RECENT_ACTIVITY.length - 1 ? 1 : 0,
                    borderBottomColor: activityBorder,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: item.iconBg,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Ionicons name={item.icon} size={20} color={item.iconColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: isDarkMode ? '#ffffff' : '#111827' }}>
                      {item.title}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                      {item.time}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Growth Tip ── */}
          <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
            <View
              style={{
                backgroundColor: isDarkMode ? '#1e1b4b' : '#EEF2FF',
                borderRadius: 16,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: isDarkMode ? '#3730a3' : '#C7D2FE',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <MaterialCommunityIcons name="bullseye-arrow" size={22} color="#6366F1" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: isDarkMode ? '#a5b4fc' : '#4338CA', marginBottom: 4 }}>
                  Growth Tip
                </Text>
                <Text style={{ fontSize: 13, color: isDarkMode ? '#818CF8' : '#6366F1', lineHeight: 18, marginBottom: 8 }}>
                  Complete your profile with photos and detailed service descriptions to get 40% more bookings.
                </Text>
                <TouchableOpacity onPress={() => (navigation as any).navigate('Profile')}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#00C870' }}>
                    Complete Profile {'>'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>

      <TabBar />
    </SafeAreaView>
  );
}
