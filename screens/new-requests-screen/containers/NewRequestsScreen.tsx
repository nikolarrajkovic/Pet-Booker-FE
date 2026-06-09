import React, { useState, useCallback, useMemo } from 'react';
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { RequestCard } from '../components';
import type { ServiceRequest, RequestStatus } from '../components';
import { getMyProvider, resolveImageUrl } from '../../../services/service-providers';
import {
  getBookings,
  setBookingStatus,
  cancelBooking,
  BookingDto,
  BookingState,
  BookingStatusType,
} from '../../../services/bookings';

function relativeTime(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

function petTypeOf(pet: any): ServiceRequest['petType'] {
  const t = (pet?.type ?? pet?.petType ?? '').toString().toLowerCase();
  if (t.includes('dog') || t === '1') return 'dog';
  if (t.includes('cat') || t === '2') return 'cat';
  return 'other';
}

// BookingDto (with nested includes) → RequestCard's ServiceRequest shape.
// Fields the booking API doesn't carry (client contact, location, owner notes,
// per-booking add-ons, pet age/weight) are blank — see BACKEND_GAPS.md.
function bookingToRequest(b: BookingDto): ServiceRequest {
  const from = new Date(b.bookingFrom);
  const to = new Date(b.bookingTo);
  const hours = Math.max(0, Math.round(((to.getTime() - from.getTime()) / 3600000) * 10) / 10);
  const status: RequestStatus =
    b.state === BookingState.Cancelled
      ? 'declined'
      : b.currentStatus === BookingStatusType.ServiceRequestedByUser
        ? 'new'
        : 'accepted';
  const pet: any = b.pet;
  return {
    id: b.id ?? 0,
    clientName: (b as any).user?.name ?? 'Client', // BACKEND-GAP: user not populated on booking
    clientAvatar: null,
    clientEmail: '',
    clientPhone: '',
    postedAgo: relativeTime(b.createdAt),
    petName: pet?.name ?? 'Pet',
    petBreed: pet?.breed ?? '',
    petAge: '',
    petWeight: '',
    petImage: resolveImageUrl(pet?.photos?.[0]?.src) || null,
    petSpecialNeeds: null,
    petType: petTypeOf(pet),
    serviceName: b.service?.name ?? 'Service',
    serviceDate: isNaN(from.getTime()) ? '' : from.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }),
    serviceTime: isNaN(from.getTime()) ? '' : from.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    serviceLocation: '', // BACKEND-GAP: no location name on booking
    duration: `${hours} hour${hours === 1 ? '' : 's'}`,
    totalPrice: b.totalPrice,
    additionalServices: [], // BACKEND-GAP: selected add-ons not recorded per booking
    notesFromOwner: '', // BACKEND-GAP: no owner-notes field
    status,
  };
}

type FilterTab = 'new' | 'accepted' | 'declined' | 'all';

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'declined', label: 'Declined' },
  { key: 'all', label: 'All' },
];

export default function NewRequestsScreen() {
  const { currentUser } = useAuth();
  const { isDarkMode, cardBg, textColor, subtextColor, borderColor } = useThemeColors();
  const [activeTab, setActiveTab] = useState<FilterTab>('new');
  const [bookings, setBookings] = useState<BookingDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!currentUser?.id) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const provider = await getMyProvider(currentUser.id);
      setBookings(provider?.id ? await getBookings({ serviceProviderId: provider.id }) : []);
    } catch (e) {
      console.warn('[NewRequests] load failed', e);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => { if (!cancelled) await load(); })();
      return () => { cancelled = true; };
    }, [load])
  );

  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-[#F5F7FA]';
  const tabBg = cardBg;

  const requests = useMemo(() => bookings.map(bookingToRequest), [bookings]);
  const newCount = requests.filter((r) => r.status === 'new').length;

  const filtered = requests.filter((r) => {
    if (activeTab === 'all') return true;
    return r.status === activeTab;
  });

  const handleAccept = async (id: number) => {
    if (busyId !== null) return;
    const raw = bookings.find((b) => b.id === id);
    if (!raw) return;
    setBusyId(id);
    try {
      await setBookingStatus(raw, BookingStatusType.ServiceConfirmedByProvider);
      await load();
    } catch (e: any) {
      Alert.alert('Could not accept', e?.message ?? 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = (id: number) => {
    if (busyId !== null) return;
    const raw = bookings.find((b) => b.id === id);
    if (!raw) return;
    Alert.alert('Decline request?', 'This cancels the booking request.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          setBusyId(id);
          try {
            await cancelBooking(raw, 'Declined by provider');
            await load();
          } catch (e: any) {
            Alert.alert('Could not decline', e?.message ?? 'Please try again.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle="Requests"
      headerSubtitle={`${newCount} pending request${newCount !== 1 ? 's' : ''}`}
      contentBg={contentBg}
      showNotificationButton
    >
      {/* Filter tabs */}
      <View className={`mx-4 mt-4 mb-3 ${tabBg} rounded-2xl p-1 flex-row border ${borderColor}`}>
        {TABS.map((tab) => {
          const count =
            tab.key === 'new'
              ? requests.filter((r) => r.status === 'new').length
              : tab.key === 'accepted'
              ? requests.filter((r) => r.status === 'accepted').length
              : tab.key === 'declined'
              ? requests.filter((r) => r.status === 'declined').length
              : requests.length;

          const isActive = activeTab === tab.key;

          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
              className={`flex-1 py-2 rounded-xl flex-row items-center justify-center ${
                isActive ? 'bg-brand-500' : ''
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  isActive ? 'text-white' : subtextColor
                }`}
              >
                {tab.label}
              </Text>
              {count > 0 && (
                <View
                  className={`ml-1.5 min-w-[18px] h-[18px] rounded-full items-center justify-center px-1 ${
                    isActive ? 'bg-white/30' : 'bg-brand-500'
                  }`}
                >
                  <Text
                    className={`text-[10px] font-bold ${
                      isActive ? 'text-white' : 'text-white'
                    }`}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 4 }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View className="items-center justify-center py-16">
            <ActivityIndicator size="large" color="#00C870" />
          </View>
        ) : filtered.length === 0 ? (
          <View className="items-center justify-center py-16">
            <Ionicons
              name="clipboard-outline"
              size={64}
              color={isDarkMode ? '#4B5563' : '#D1D5DB'}
            />
            <Text className={`${subtextColor} text-center mt-4 text-base`}>
              No {activeTab === 'all' ? '' : activeTab} requests
            </Text>
          </View>
        ) : (
          filtered.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              isDarkMode={isDarkMode}
              cardBg={cardBg}
              textColor={textColor}
              subtextColor={subtextColor}
              borderColor={borderColor}
              onAccept={handleAccept}
              onDecline={handleDecline}
            />
          ))
        )}
      </ScrollView>
    </ScreenLayout>
  );
}
