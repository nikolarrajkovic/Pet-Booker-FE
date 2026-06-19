import React, { useState, useCallback, useMemo } from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { RequestCard } from '../components';
import type { ServiceRequest, RequestStatus } from '../components';
import { resolveImageUrl } from '../../../services/service-providers';
import {
  getBookings,
  confirmBooking,
  declineBooking,
  parseBookingDate,
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

// Add-ons the booker selected, derived from the booking's include* flags. Labels
// match the catalog (services/service-addons.ts); the server-computed surcharge
// is appended when it's non-zero. Pickup ↔ includePickup, Drop-off ↔
// includePetReturn, Special Needs Care ↔ includeSpecialNeeds.
function selectedAddOns(b: BookingDto): string[] {
  const label = (name: string, price?: number | null) =>
    price && price > 0 ? `${name} • $${price}` : name;
  const out: string[] = [];
  if (b.includePickup) out.push(label('Pickup', b.pickupPrice));
  if (b.includePetReturn) out.push(label('Drop-off', b.petReturnPrice));
  if (b.includeSpecialNeeds) out.push(label('Special Needs Care', b.specialNeedsPrice));
  return out;
}

// BookingDto (with nested includes) → RequestCard's ServiceRequest shape.
// Add-ons come from the booking's include* flags (selectedAddOns). Fields the
// booking API still doesn't carry (client phone, location, owner notes, pet
// age/weight) are blank — see BACKEND_GAPS.md.
function bookingToRequest(b: BookingDto): ServiceRequest {
  const from = parseBookingDate(b.bookingFrom);
  const to = parseBookingDate(b.bookingTo);
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
    clientName: b.user?.userName ?? 'Client',
    clientAvatar: resolveImageUrl(b.user?.photos?.[0]?.src) || null,
    clientEmail: b.user?.email ?? '',
    clientPhone: '', // BACKEND-GAP B1: no phone on the booking's user include
    postedAgo: relativeTime(b.createdAt),
    petName: pet?.name ?? 'Pet',
    petBreed: pet?.breed ?? '',
    petAge: '',
    petWeight: '',
    petImage: resolveImageUrl(pet?.photos?.[0]?.src) || null,
    petSpecialNeeds: null,
    petType: petTypeOf(pet),
    serviceName: b.service?.name ?? 'Service',
    serviceDate: isNaN(from.getTime())
      ? ''
      : from.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }),
    serviceTime: isNaN(from.getTime())
      ? ''
      : from.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    serviceLocation: '', // BACKEND-GAP: no location name on booking
    duration: `${hours} hour${hours === 1 ? '' : 's'}`,
    totalPrice: b.totalPrice,
    additionalServices: selectedAddOns(b), // pickup / drop-off / special-needs the booker picked
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
  const {
    isDarkMode,
    cardBg,
    textColor,
    subtextColor,
    borderColor,
    inputBg,
    inputText,
    placeholderColor,
  } = useThemeColors();
  const [activeTab, setActiveTab] = useState<FilterTab>('new');
  const [bookings, setBookings] = useState<BookingDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  // Decline-reason modal: the request being declined + the partner's reason text.
  const [declineTargetId, setDeclineTargetId] = useState<number | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const load = useCallback(async () => {
    if (!currentUser?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const providerId = currentUser.serviceProviderId || null;
      setBookings(providerId ? await getBookings({ serviceProviderId: providerId }) : []);
    } catch (e) {
      console.warn('[NewRequests] load failed', e);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id, currentUser?.serviceProviderId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!cancelled) await load();
      })();
      return () => {
        cancelled = true;
      };
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

  // Accept/decline use the dedicated /bookings/{id}/confirm|decline endpoints.
  // Both are server-guarded to bookings still in ServiceRequestedByUser.
  const handleAccept = async (id: number) => {
    if (busyId !== null) return;
    setBusyId(id);
    try {
      await confirmBooking(id);
      await load();
    } catch (e: any) {
      Alert.alert('Could not accept', e?.message ?? 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  // Open the decline-reason modal for a request (reason is collected, then sent).
  const handleDecline = (id: number) => {
    if (busyId !== null) return;
    setDeclineReason('');
    setDeclineTargetId(id);
  };

  // Submit the decline: POST /bookings/{id}/decline with the partner's reason
  // (falls back to a generic reason when left blank). declineBooking is the
  // dedicated partner-decline endpoint — guarded server-side to pending requests.
  const confirmDecline = async () => {
    if (declineTargetId === null) return;
    const id = declineTargetId;
    const reason = declineReason.trim() || 'Declined by provider';
    setDeclineTargetId(null);
    setBusyId(id);
    try {
      await declineBooking(id, reason);
      await load();
    } catch (e: any) {
      Alert.alert('Could not decline', e?.message ?? 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle="Requests"
      headerSubtitle={`${newCount} pending request${newCount !== 1 ? 's' : ''}`}
      contentBg={contentBg}
      showNotificationButton>
      {/* Filter tabs */}
      <View className={`mx-4 mb-3 mt-4 ${tabBg} flex-row rounded-2xl border p-1 ${borderColor}`}>
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
              className={`flex-1 flex-row items-center justify-center rounded-xl py-2 ${
                isActive ? 'bg-brand-500' : ''
              }`}>
              <Text className={`text-xs font-semibold ${isActive ? 'text-white' : subtextColor}`}>
                {tab.label}
              </Text>
              {count > 0 && (
                <View
                  className={`ml-1.5 h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 ${
                    isActive ? 'bg-white/30' : 'bg-brand-500'
                  }`}>
                  <Text
                    className={`text-[10px] font-bold ${isActive ? 'text-white' : 'text-white'}`}>
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
        showsVerticalScrollIndicator={false}>
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
            <Text className={`${subtextColor} mt-4 text-center text-base`}>
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

      {/* Decline-reason modal */}
      <Modal
        visible={declineTargetId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeclineTargetId(null)}>
        <View className="flex-1 justify-center bg-black/50 px-6">
          <View className={`${cardBg} rounded-2xl p-5`}>
            <Text className={`text-lg font-bold ${textColor} mb-1`}>Decline request?</Text>
            <Text className={`text-sm ${subtextColor} mb-4`}>
              This cancels the booking request. Add a reason for the client (optional).
            </Text>
            <TextInput
              value={declineReason}
              onChangeText={setDeclineReason}
              placeholder="e.g. Fully booked that day"
              placeholderTextColor={placeholderColor}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              className={`${inputBg} rounded-xl px-4 py-3 ${inputText} mb-4`}
              style={{ minHeight: 80 }}
              selectionColor="#00C870"
            />
            <View className="flex-row" style={{ gap: 12 }}>
              <TouchableOpacity
                onPress={() => setDeclineTargetId(null)}
                activeOpacity={0.7}
                className={`flex-1 items-center rounded-xl border py-3 ${borderColor}`}>
                <Text className={`font-semibold ${textColor}`}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDecline}
                activeOpacity={0.7}
                className="flex-1 items-center rounded-xl bg-red-500 py-3">
                <Text className="font-semibold text-white">Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenLayout>
  );
}
