import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { ScrollView, Text, View, TouchableOpacity, TextInput } from 'react-native';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLocale } from '../../../context/LocaleContext';
import { getErrorMessage } from '../../../services/http';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import ListState from '../../../components/shared/ListState';
import { RequestCard } from '../components';
import type { ServiceRequest, RequestStatus } from '../components';
import { resolveImageUrl } from '../../../services/service-providers';
import {
  getBookingsPage,
  countBookings,
  confirmBooking,
  declineBooking,
  parseBookingDate,
  BookingDto,
  BookingState,
  BookingSortBy,
  BookingStatusType,
  GetBookingsParams,
} from '../../../services/bookings';
import { usePagedList } from '../../../hooks/usePagedList';
import LoadMoreFooter, { isNearBottom } from '../../../components/shared/LoadMoreFooter';
import { formatMoney } from '../../../services/currency';
import ResponsiveGrid from '../../../components/shared/ResponsiveGrid';
import ResponsiveModal from '../../../components/shared/ResponsiveModal';
import { usePageGutter } from '../../../hooks/usePageGutter';
import { formatLongDate } from '../../../i18n/dates';

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

// The extras charged on this booking, straight off its frozen bill lines. Names are the
// provider's own (shown verbatim) and the amount is what was actually charged — no derivation
// from flags, and no recomputing: the server froze both when it priced the booking.
function selectedAddOns(_t: TFn, b: BookingDto): string[] {
  return (b.additionalServices ?? []).map((line) => {
    const named = 'name' in line ? line.name : '';
    const price = 'price' in line ? line.price : 0;
    return price > 0 ? `${named} • ${formatMoney(price, b.priceCurrency)}` : named;
  });
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
    b.state === BookingState.Expired
      ? 'expired'
      : b.state === BookingState.Cancelled
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
    serviceDate: isNaN(from.getTime()) ? '' : formatLongDate(from),
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
    expiredAfterAccepting:
      status === 'expired' && b.currentStatus !== BookingStatusType.ServiceRequestedByUser,
  };
}

type FilterTab = 'new' | 'accepted' | 'declined' | 'all';

/**
 * Each tab is a server query, paged as it scrolls. They used to be one 50-row page filtered on the
 * device: past a provider's 50th booking, new requests were never fetched, and requests whose date
 * had passed sat at the top still offering Accept. The server now decides which requests are still
 * open (an unanswered request expires at its start time) and the order.
 */
const TAB_QUERY: Record<FilterTab, Pick<GetBookingsParams, 'state' | 'states' | 'sortBy'>> = {
  // Still awaiting a decision, the soonest first: that is the one to answer first.
  new: { state: BookingState.Upcoming, sortBy: BookingSortBy.SoonestFirst },
  // Work agreed to and not yet done.
  accepted: {
    states: [BookingState.Accepted, BookingState.InProgress],
    sortBy: BookingSortBy.SoonestFirst,
  },
  declined: { state: BookingState.Cancelled, sortBy: BookingSortBy.LatestFirst },
  // Everything, most recently made first; expired and completed ones are marked on the card.
  all: { sortBy: BookingSortBy.NewestFirst },
};

// Tab labels are translation keys, resolved with t() at render.
const TABS: { key: FilterTab; labelKey: string }[] = [
  { key: 'new', labelKey: 'requests.tabNew' },
  { key: 'accepted', labelKey: 'requests.tabAccepted' },
  { key: 'declined', labelKey: 'requests.tabDeclined' },
  { key: 'all', labelKey: 'requests.tabAll' },
];

export default function NewRequestsScreen() {
  const gutter = usePageGutter();
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
  const [busyId, setBusyId] = useState<number | null>(null);
  // Decline-reason modal: the request being declined + the partner's reason text.
  const [declineTargetId, setDeclineTargetId] = useState<number | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [counts, setCounts] = useState<Record<FilterTab, number>>({
    new: 0,
    accepted: 0,
    declined: 0,
    all: 0,
  });

  const providerId = currentUser?.serviceProviderId || undefined;
  const fetchPage = useCallback(
    (page: number) =>
      getBookingsPage({ serviceProviderId: providerId, ...TAB_QUERY[activeTab] }, page),
    [providerId, activeTab]
  );
  const list = usePagedList(fetchPage, {
    enabled: !!providerId,
    resource: 'bookings',
    errorFallback: t('requests.loadFailed'),
  });

  // Tab badges: one count per tab, from the server, so they describe every booking rather than
  // the rows loaded so far.
  const refreshCounts = useCallback(async () => {
    if (!providerId) return;
    try {
      const keys = Object.keys(TAB_QUERY) as FilterTab[];
      const values = await Promise.all(
        keys.map((key) => countBookings({ serviceProviderId: providerId, ...TAB_QUERY[key] }))
      );
      setCounts(
        Object.fromEntries(keys.map((k, i) => [k, values[i]])) as Record<FilterTab, number>
      );
    } catch {
      // Badges are a convenience; the list itself reports its own errors.
    }
  }, [providerId]);
  useEffect(() => {
    refreshCounts();
  }, [refreshCounts, list.items]);

  const isLoading = list.isLoading;
  const loadError = list.error;

  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-[#F5F7FA]';
  const tabBg = cardBg;

  const filtered = useMemo(() => list.items.map((b) => bookingToRequest(t, b)), [list.items, t]);
  const newCount = counts.new;

  // A decided request leaves the tab it was in (New to Accepted or Declined); on All it stays, updated.
  const applyDecision = (updated: BookingDto) => {
    list.setItems((prev) =>
      activeTab === 'all'
        ? prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b))
        : prev.filter((b) => b.id !== updated.id)
    );
  };

  // Accept/decline use the dedicated /bookings/{id}/confirm|decline endpoints.
  // Both are server-guarded to bookings still in ServiceRequestedByUser.
  const handleAccept = async (id: number) => {
    if (busyId !== null) return;
    setBusyId(id);
    try {
      // The transition returns the updated booking, so fold it into the row we already hold
      // rather than refetching every one of the partner's bookings to learn one status.
      const updated = await confirmBooking(id);
      applyDecision(updated);
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
    // A blank reason gets a generic one; anything typed is sent as written.
    const reason = declineReason.trim() || t('requests.declinedByProvider');
    setDeclineTargetId(null);
    setBusyId(id);
    try {
      const updated = await declineBooking(id, reason);
      applyDecision(updated);
    } catch (e) {
      showError(getErrorMessage(e, t('requests.declineFailed')));
    } finally {
      setBusyId(null);
    }
  };

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
      showNotificationButton
      width="wide">
      {/* Filter tabs */}
      <View
        className={`${gutter.mx} mb-3 mt-4 ${tabBg} flex-row rounded-2xl border p-1 ${borderColor}`}>
        {TABS.map((tab) => {
          const count = counts[tab.key];

          const isActive = activeTab === tab.key;

          return (
            <TouchableOpacity
              accessibilityRole="button"
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
        contentContainerStyle={{
          paddingHorizontal: gutter.value,
          paddingBottom: 32,
          paddingTop: 4,
        }}
        scrollEventThrottle={200}
        onScroll={(e) => (isNearBottom(e) ? list.loadMore() : undefined)}
        showsVerticalScrollIndicator={false}>
        <ListState
          isLoading={isLoading}
          error={loadError}
          isEmpty={filtered.length === 0}
          emptyIcon="clipboard-outline"
          emptyMessage={
            activeTab === 'all'
              ? t('requests.noRequests')
              : activeTab === 'new'
                ? t('requests.noNewRequests')
                : activeTab === 'accepted'
                  ? t('requests.noAcceptedRequests')
                  : t('requests.noDeclinedRequests')
          }>
          {/*
            Booking requests are wide cards with the client, the service and the accept/decline
            actions. Two per row on a desktop puts a partner's whole morning queue on one screen.
          */}
          <ResponsiveGrid columns={{ mobile: 1, tablet: 1, desktop: 2 }} gap={12} rowGap={0}>
            {filtered.map((request) => (
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
            ))}
          </ResponsiveGrid>
          {filtered.length > 0 && (
            <LoadMoreFooter
              loaded={filtered.length}
              total={list.totalItems}
              hasMore={list.hasMore}
              isLoadingMore={list.isLoadingMore}
              onLoadMore={list.loadMore}
            />
          )}
        </ListState>
      </ScrollView>

      {/* Decline-reason modal */}
      {/* ResponsiveModal owns the presentation: a centred card on both designs here (the prompt
          is two fields, not a sheet's worth of content), the scrim, the width cap and Esc. */}
      <ResponsiveModal
        visible={declineTargetId !== null}
        onClose={() => setDeclineTargetId(null)}
        mobilePresentation="centered"
        dialogWidth={480}>
        <View className={`${cardBg} p-5`}>
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
            className={`${inputBg} rounded-xl px-4 py-3 ${inputText} ${'mb-4'}`}
            style={{ minHeight: 80 }}
            selectionColor={BRAND_GREEN}
          />
          <View className="flex-row" style={{ gap: 12 }}>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setDeclineTargetId(null)}
              activeOpacity={0.7}
              className={`flex-1 items-center rounded-xl border py-3 ${borderColor}`}>
              <Text className={`font-semibold ${textColor}`}>{t('requests.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={confirmDecline}
              activeOpacity={0.7}
              className="flex-1 items-center rounded-xl bg-red-500 py-3">
              <Text className="font-semibold text-white">{t('requests.decline')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ResponsiveModal>
    </ScreenLayout>
  );
}
