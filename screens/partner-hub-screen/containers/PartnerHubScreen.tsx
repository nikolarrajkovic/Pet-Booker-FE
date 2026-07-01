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
import { useToast } from '../../../context/ToastContext';
import { getErrorMessage } from '../../../services/http';
import {
  getBookings,
  BookingDto,
  BookingState,
  BookingStatusType,
  parseBookingDate,
} from '../../../services/bookings';
import { getServiceProvider } from '../../../services/service-providers';
import { getServices } from '../../../services/services';
import { getServiceDiscounts } from '../../../services/service-discounts';
import TabBar from '../../../components/shared/TabBar';

// ─── Formatting / time helpers ───────────────────────────────────────────────
const fmtMoney = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const fmtPct = (p: number | null): string | undefined =>
  p == null ? undefined : `${p >= 0 ? '+' : ''}${Math.round(p)}%`;

function relativeTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ─── Computed dashboard shape ────────────────────────────────────────────────
type ActivityItem = {
  id: number;
  title: string;
  time: string;
  icon: any;
  iconBg: string;
  iconColor: string;
  bookingId?: number;
};

type HubData = {
  revenueThisMonth: number;
  revenueChangePct: number | null;
  totalClients: number;
  appointments: number;
  rating: number | null;
  todayCount: number;
  newRequests: number;
  activePromos: number;
  hasLiveSession: boolean;
  recent: ActivityItem[];
};

const EMPTY_HUB: HubData = {
  revenueThisMonth: 0,
  revenueChangePct: null,
  totalClients: 0,
  appointments: 0,
  rating: null,
  todayCount: 0,
  newRequests: 0,
  activePromos: 0,
  hasLiveSession: false,
  recent: [],
};

function toActivity(b: BookingDto): ActivityItem {
  const client = b.user?.userName?.trim() || 'a client';
  const id = b.id ?? 0;
  if (b.review?.rating) {
    return {
      id,
      bookingId: id,
      title: `${b.review.rating}-star review from ${client}`,
      time: relativeTime(b.updatedAt ?? b.createdAt),
      icon: 'star-outline',
      iconBg: '#FEF3C7',
      iconColor: '#F59E0B',
    };
  }
  if (b.state === BookingState.Completed) {
    return {
      id,
      bookingId: id,
      title: `Service completed for ${client}`,
      time: relativeTime(b.updatedAt ?? b.createdAt),
      icon: 'checkmark-done-outline',
      iconBg: '#EEF2FF',
      iconColor: '#6366F1',
    };
  }
  return {
    id,
    bookingId: id,
    title:
      b.currentStatus === BookingStatusType.ServiceRequestedByUser
        ? `New booking request from ${client}`
        : `Booking from ${client}`,
    time: relativeTime(b.createdAt),
    icon: 'calendar-outline',
    iconBg: '#E8F5EF',
    iconColor: '#00C870',
  };
}

/** Counts a partner's enabled discounts across all their services. */
async function countActivePromos(providerId: number): Promise<number> {
  try {
    const services = await getServices({ serviceProviderId: providerId });
    const lists = await Promise.all(
      services.map((s) =>
        s.id != null ? getServiceDiscounts({ serviceId: s.id }) : Promise.resolve([])
      )
    );
    return lists.flat().filter((d) => d.isEnabled).length;
  } catch {
    return 0;
  }
}

function computeHub(bookings: BookingDto[], rating: number | null, activePromos: number): HubData {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const active = bookings.filter((b) => b.state !== BookingState.Cancelled);

  const inRange = (iso: string, start: Date, end: Date) => {
    const d = parseBookingDate(iso);
    return !isNaN(d.getTime()) && d >= start && d < end;
  };

  const revenueThisMonth = active
    .filter((b) => inRange(b.bookingFrom, startOfThisMonth, startOfNextMonth))
    .reduce((t, b) => t + (b.totalPrice || 0), 0);
  const revenueLastMonth = active
    .filter((b) => inRange(b.bookingFrom, startOfLastMonth, startOfThisMonth))
    .reduce((t, b) => t + (b.totalPrice || 0), 0);

  const totalClients = new Set(active.map((b) => b.userId)).size;
  // Confirmed upcoming appointments only — a pending request (ServiceRequestedByUser)
  // is not yet an appointment (it's counted in the "Requests" badge instead).
  const appointments = active.filter(
    (b) =>
      b.currentStatus !== BookingStatusType.ServiceRequestedByUser &&
      parseBookingDate(b.bookingFrom) >= startOfToday
  ).length;
  const todayCount = active.filter((b) =>
    inRange(b.bookingFrom, startOfToday, startOfTomorrow)
  ).length;
  const newRequests = bookings.filter(
    (b) => b.currentStatus === BookingStatusType.ServiceRequestedByUser
  ).length;
  const hasLiveSession = bookings.some(
    (b) => b.currentStatus === BookingStatusType.ServiceStarted
  );

  const recent = [...bookings]
    .sort((a, b) => {
      const ta = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
      const tb = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
      return tb - ta;
    })
    .slice(0, 4)
    .map(toActivity);

  return {
    revenueThisMonth,
    revenueChangePct:
      revenueLastMonth > 0
        ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
        : null,
    totalClients,
    appointments,
    rating,
    todayCount,
    newRequests,
    activePromos,
    hasLiveSession,
    recent,
  };
}

// ─── Quick Actions (static config; badges are computed) ──────────────────────
const QUICK_ACTIONS = [
  {
    id: 'live-session',
    title: 'Live Session',
    subtitle: 'Start & run a service',
    icon: 'radio-outline' as const,
    iconBg: '#FEE2E2',
    iconColor: '#EF4444',
    route: 'LiveSession',
  },
  {
    id: 'schedule',
    title: 'My Schedule',
    subtitle: 'Manage appointments',
    icon: 'calendar-outline' as const,
    iconBg: '#EEF2FF',
    iconColor: '#6366F1',
    route: 'MySchedule',
  },
  {
    id: 'requests',
    title: 'Requests',
    subtitle: 'Review booking requests',
    icon: 'notifications-outline' as const,
    iconBg: '#FEE2E2',
    iconColor: '#EF4444',
    route: 'NewRequests',
  },
  {
    id: 'services',
    title: 'My Services',
    subtitle: 'Edit services & pricing',
    icon: 'bar-chart-outline' as const,
    iconBg: '#F3E8FF',
    iconColor: '#A855F7',
    route: 'MyServices',
  },
  {
    id: 'promotions',
    title: 'Promotions',
    subtitle: 'Boost your visibility',
    icon: 'flash-outline' as const,
    iconBg: '#FEF3C7',
    iconColor: '#F59E0B',
    route: 'Promotions',
  },
];

export default function PartnerHubScreen() {
  const navigation = useNavigation();
  const { isDarkMode, hex } = useThemeColors();
  const { currentUser } = useAuth();
  const { showError } = useToast();
  const insets = useSafeAreaInsets();

  const bgColor = hex.bg;
  const cardBg = hex.card;
  const borderColor = hex.border;
  const activityBorder = isDarkMode ? '#2d3748' : '#F3F4F6';

  const [hub, setHub] = useState<HubData>(EMPTY_HUB);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const providerId = currentUser?.serviceProviderId || null;
        if (!providerId) {
          if (!cancelled) {
            setHub(EMPTY_HUB);
            setLoaded(true);
          }
          return;
        }
        try {
          let bookingsError: unknown = null;
          const [bookings, provider, activePromos] = await Promise.all([
            getBookings({ serviceProviderId: providerId, perPage: 200 }).catch((e) => {
              bookingsError = e;
              return [] as BookingDto[];
            }),
            getServiceProvider(providerId).catch(() => null),
            countActivePromos(providerId),
          ]);
          if (!cancelled) {
            setHub(computeHub(bookings, provider?.ratingAvg ?? null, activePromos));
            setLoaded(true);
            // The dashboard otherwise degrades silently to zeros — surface the
            // failure of its primary data source so it doesn't read as "no activity".
            if (bookingsError) {
              showError(getErrorMessage(bookingsError, 'Could not load your dashboard data. Please try again.'));
            }
          }
        } catch {
          if (!cancelled) {
            setHub(EMPTY_HUB);
            setLoaded(true);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [currentUser?.serviceProviderId])
  );

  const hasLiveSession = hub.hasLiveSession;
  const dash = (s: string) => (loaded ? s : '—');

  const pills = [
    {
      id: 'revenue',
      icon: 'cash-outline' as const,
      value: dash(fmtMoney(hub.revenueThisMonth)),
      label: 'This Month',
      change: loaded ? fmtPct(hub.revenueChangePct) : undefined,
    },
    {
      id: 'clients',
      icon: 'people-outline' as const,
      value: dash(String(hub.totalClients)),
      label: 'Total Clients',
      change: undefined,
    },
    {
      id: 'appointments',
      icon: 'calendar-outline' as const,
      value: dash(String(hub.appointments)),
      label: 'Appointments',
      change: undefined,
    },
    {
      id: 'rating',
      icon: 'star-outline' as const,
      value: loaded ? (hub.rating && hub.rating > 0 ? hub.rating.toFixed(1) : 'New') : '—',
      label: 'Rating',
      change: undefined,
    },
  ];

  const badgeFor = (id: string): string | null => {
    if (id === 'live-session') return hasLiveSession ? 'LIVE' : null;
    if (id === 'schedule') return hub.todayCount > 0 ? `${hub.todayCount} today` : null;
    if (id === 'requests') return hub.newRequests > 0 ? `${hub.newRequests} new` : null;
    if (id === 'promotions') return hub.activePromos > 0 ? `${hub.activePromos} active` : null;
    return null;
  };

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
              Welcome back, {currentUser?.firstName?.trim() || 'Partner'}!
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
          {pills.map((stat) => (
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
                  {stat.change && (
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
                  )}
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
                const badgeText = badgeFor(action.id);
                const badgeColor = isLive ? '#EF4444' : '#F97316';
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
                        backgroundColor: badgeColor,
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
              {hub.recent.length === 0 ? (
                <View style={{ paddingHorizontal: 16, paddingVertical: 24, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: '#9CA3AF' }}>
                    {loaded ? 'No recent activity yet' : 'Loading…'}
                  </Text>
                </View>
              ) : (
                hub.recent.map((item, index) => (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.8}
                    onPress={() =>
                      item.bookingId
                        ? (navigation as any).navigate('BookingDetails', { bookingId: item.bookingId })
                        : undefined
                    }
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      borderBottomWidth: index < hub.recent.length - 1 ? 1 : 0,
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
                ))
              )}
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
