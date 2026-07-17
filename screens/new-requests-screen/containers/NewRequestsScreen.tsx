import React, { useState, useCallback, useMemo } from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLocale } from '../../../context/LocaleContext';
import { getErrorMessage } from '../../../services/http';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { RequestCard } from '../components';
import type { ServiceRequest, RequestStatus } from '../components';
import { resolveImageUrl } from '../../../services/service-providers';
import {
  getBookings,
  confirmBooking,
  declineBooking,
  parseBookingDate,
  formatMoney,
  BookingDto,
  BookingState,
  BookingStatusType,
} from '../../../services/bookings';

// Translate function shape shared by the helpers below (labels follow the
// active language; the container passes its useLocale().t down).
type TFn = (key: any, params?: Record<string, string | number>) => string;

function relativeTime(t: TFn, iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return t('requests.today');
  return t('requests.daysAgo', { d: days });
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
function selectedAddOns(t: TFn, b: BookingDto): string[] {
  const label = (name: string, price?: number | null) =>
    price && price > 0 ? `${name} • ${formatMoney(price, b.priceCurrency)}` : name;
  const out: string[] = [];
  if (b.includePickup) out.push(label(t('addons.pickup'), b.pickupPrice));
  if (b.includePetReturn) out.push(label(t('addons.dropoff'), b.petReturnPrice));
  if (b.includeSpecialNeeds) out.push(label(t('addons.specialNeeds'), b.specialNeedsPrice));
  return out;
}

// BookingDto (with nested includes) → RequestCard's ServiceRequest shape.
// Add-ons come from the booking's include* flags (selectedAddOns). Fields the
// booking API still doesn't carry (client phone, location, owner notes, pet
// age/weight) are blank — see BACKEND_GAPS.md.
function bookingToRequest(t: TFn, b: BookingDto): ServiceRequest {
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
    clientName: b.user?.userName ?? t('requests.client'),
    clientAvatar: resolveImageUrl(b.user?.photos?.[0]?.src) || null,
    clientEmail: b.user?.email ?? '',
    clientPhone: '', // BACKEND-GAP B1: no phone on the booking's user include
    postedAgo: relativeTime(t, b.createdAt),
    petName: pet?.name ?? t('requests.pet'),
    petBreed: pet?.breed ?? '',
    petAge: '',
    petWeight: '',
    petImage: resolveImageUrl(pet?.photos?.[0]?.src) || null,
    petSpecialNeeds: null,
    petType: petTypeOf(pet),
    serviceName: b.service?.name ?? t('requests.service'),
    serviceDate: isNaN(from.getTime())
      ? ''
      : from.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }),
    serviceTime: isNaN(from.getTime())
      ? ''
      : from.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }),
    serviceLocation: '', // BACKEND-GAP: no location name on booking
    duration: hours === 1 ? t('requests.hour', { h: hours }) : t('requests.hours', { h: hours }),
    totalPrice: b.totalPrice,
    currency: b.priceCurrency ?? null,
    additionalServices: selectedAddOns(t, b), // pickup / drop-off / special-needs the booker picked
    notesFromOwner: '', // BACKEND-GAP: no owner-notes field
    status,
  };
}

type FilterTab = 'new' | 'accepted' | 'declined' | 'all';

// Tab labels are translation keys, resolved with t() at render.
const TABS: { key: FilterTab; labelKey: string }[] = [
  { key: 'new', labelKey: 'requests.tabNew' },
  { key: 'accepted', labelKey: 'requests.tabAccepted' },
  { key: 'declined', labelKey: 'requests.tabDeclined' },
  { key: 'all', labelKey: 'requests.tabAll' },
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
  const { showError } = useToast();
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<FilterTab>('new');
  const [bookings, setBookings] = useState<BookingDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
    setLoadError(null);
    try {
      const providerId = currentUser.serviceProviderId || null;
      setBookings(providerId ? await getBookings({ serviceProviderId: providerId }) : []);
    } catch (e) {
      setLoadError(getErrorMessage(e, t('requests.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id, currentUser?.serviceProviderId, t]);

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

  const requests = useMemo(() => bookings.map((b) => bookingToRequest(t, b)), [bookings, t]);
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
    } catch (e) {
      showError(getErrorMessage(e, t('requests.acceptFailed')));
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
    const trimmed = declineReason.trim();
    // Server requires a reason of ≥10 chars when one is given; blank is allowed
    // and uses a generic fallback. Guard the 1–9 char range.
    if (trimmed.length > 0 && trimmed.length < 10) return;
    const reason = trimmed || t('requests.declinedByProvider');
    setDeclineTargetId(null);
    setBusyId(id);
    try {
      await declineBooking(id, reason);
      await load();
    } catch (e) {
      showError(getErrorMessage(e, t('requests.declineFailed')));
    } finally {
      setBusyId(null);
    }
  };

  // A typed reason must be ≥10 chars (server rule); blank is fine (uses fallback).
  const declineReasonTooShort = declineReason.trim().length > 0 && declineReason.trim().length < 10;

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle={t('requests.title')}
      headerSubtitle={
        newCount === 1
          ? t('requests.pendingOne', { count: newCount })
          : t('requests.pendingMany', { count: newCount })
      }
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
                {t(tab.labelKey as any)}
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
        ) : loadError ? (
          <View className="items-center justify-center py-16">
            <Ionicons
              name="alert-circle-outline"
              size={64}
              color={isDarkMode ? '#4B5563' : '#D1D5DB'}
            />
            <Text className={`${subtextColor} mt-4 text-center text-base`}>{loadError}</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View className="items-center justify-center py-16">
            <Ionicons
              name="clipboard-outline"
              size={64}
              color={isDarkMode ? '#4B5563' : '#D1D5DB'}
            />
            <Text className={`${subtextColor} mt-4 text-center text-base`}>
              {activeTab === 'all'
                ? t('requests.noRequests')
                : activeTab === 'new'
                  ? t('requests.noNewRequests')
                  : activeTab === 'accepted'
                    ? t('requests.noAcceptedRequests')
                    : t('requests.noDeclinedRequests')}
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
            <Text className={`text-lg font-bold ${textColor} mb-1`}>
              {t('requests.declineTitle')}
            </Text>
            <Text className={`text-sm ${subtextColor} mb-4`}>{t('requests.declineSubtitle')}</Text>
            <TextInput
              value={declineReason}
              onChangeText={setDeclineReason}
              placeholder={t('requests.declinePlaceholder')}
              placeholderTextColor={placeholderColor}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              className={`${inputBg} rounded-xl px-4 py-3 ${inputText} ${declineReasonTooShort ? 'mb-1' : 'mb-4'}`}
              style={{ minHeight: 80 }}
              selectionColor="#00C870"
            />
            {declineReasonTooShort && (
              <Text className="mb-4 text-xs text-red-500">{t('requests.declineTooShort')}</Text>
            )}
            <View className="flex-row" style={{ gap: 12 }}>
              <TouchableOpacity
                onPress={() => setDeclineTargetId(null)}
                activeOpacity={0.7}
                className={`flex-1 items-center rounded-xl border py-3 ${borderColor}`}>
                <Text className={`font-semibold ${textColor}`}>{t('requests.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDecline}
                disabled={declineReasonTooShort}
                activeOpacity={0.7}
                className={`flex-1 items-center rounded-xl bg-red-500 py-3 ${declineReasonTooShort ? 'opacity-50' : ''}`}>
                <Text className="font-semibold text-white">{t('requests.decline')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenLayout>
  );
}
