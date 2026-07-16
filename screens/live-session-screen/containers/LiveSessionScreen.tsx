import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View, Image, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRoute, RouteProp, useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLocale } from '../../../context/LocaleContext';
import { getErrorMessage } from '../../../services/http';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import DirectionsModal from '../../../components/shared/DirectionsModal';
import {
  getBookings,
  getBooking,
  startBookingService,
  endBookingService,
  parseBookingDate,
  formatBookingDate,
  BookingDto,
  BookingState,
  BookingStatusType,
} from '../../../services/bookings';
import { resolveImageUrl, AddressDto } from '../../../services/service-providers';
import { getPet, PetResponse } from '../../../services/pets';
import { getService, ServiceDto } from '../../../services/services';
import { getUser } from '../../../services/users';
import { addressLabel, forwardGeocode, GeoPoint } from '../../../services/geocoding';
import { useLiveLocationWatcher } from '../../../hooks/useLiveLocationWatcher';
import { useLocationSharing } from '../../../hooks/useLocationSharing';
import {
  CountdownTimer,
  AddOnChecklist,
  AddOnItem,
  PetDetailsCard,
  LiveTrackingMap,
} from '../components';

type RouteParams = { mode?: 'partner' | 'user' };
type Completion = { pickup: boolean; dropoff: boolean };

// The backend allows starting a service at most 30 minutes before its scheduled
// start time — POST /bookings/{id}/start-service 422s otherwise ("A service can
// be started at most 30 minutes before its scheduled start time."). Gate the
// Start button on the same window so it never fails mid-tap. The window doubles
// as the provider's head-out lead: on live-tracked services the booker can watch
// them coming as soon as they start.
const START_LEAD_MS = 30 * 60 * 1000;

// ── Active-session selection ────────────────────────────────────────────────
const byFrom = (a: BookingDto, b: BookingDto) =>
  parseBookingDate(a.bookingFrom).getTime() - parseBookingDate(b.bookingFrom).getTime();

/** Whether two bookings' scheduled windows overlap in time (= run concurrently). */
function overlaps(a: BookingDto, b: BookingDto): boolean {
  const af = parseBookingDate(a.bookingFrom).getTime();
  const at = parseBookingDate(a.bookingTo).getTime();
  const bf = parseBookingDate(b.bookingFrom).getTime();
  const bt = parseBookingDate(b.bookingTo).getTime();
  return af < bt && bf < at;
}

/**
 * Partner's current concurrent sessions. A service with maxConcurrentBookings > 1
 * can have several bookings sharing the same window, so we return the whole group
 * the partner is running at once (primary first) — the screen lets them swipe
 * between them.
 *
 * Keyed off `currentStatus` (the precise lifecycle), not a single `state` value:
 * the API moves `state` to Accepted(3) on confirm and InProgress(4) on start, so
 * gating on `state === Upcoming` would drop every accepted booking. We exclude
 * terminal bookings and ignore confirmed ones whose window has already passed.
 * The "primary" is a started (in-progress) booking if there is one, else the
 * soonest confirmed-but-not-yet-started one; the group is everything overlapping it.
 */
function pickPartnerSessions(bookings: BookingDto[]): BookingDto[] {
  const active = bookings.filter(
    (b) =>
      b.state !== BookingState.Cancelled &&
      b.state !== BookingState.Completed &&
      b.currentStatus !== BookingStatusType.ServiceEnded &&
      b.currentStatus !== BookingStatusType.DeclinedByProvider &&
      b.currentStatus !== BookingStatusType.CancelledByUser
  );
  const started = active
    .filter((b) => b.currentStatus === BookingStatusType.ServiceStarted)
    .sort(byFrom);
  const now = Date.now();
  const ready = active
    .filter(
      (b) =>
        (b.currentStatus === BookingStatusType.ServiceConfirmedByProvider ||
          b.currentStatus === BookingStatusType.PrePayment) &&
        parseBookingDate(b.bookingTo).getTime() >= now
    )
    .sort(byFrom);

  const primary = started[0] ?? ready[0] ?? null;
  if (!primary) return [];

  // Group = started-first then soonest-ready, de-duped, restricted to those that
  // overlap the primary's window (so they're genuinely concurrent). The primary
  // overlaps itself, so it lands first.
  const group: BookingDto[] = [];
  const seen = new Set<number>();
  for (const b of [...started, ...ready]) {
    const id = b.id ?? -1;
    if (seen.has(id)) continue;
    seen.add(id);
    if (overlaps(primary, b)) group.push(b);
  }
  return group;
}

/**
 * Booker's current session: an in-progress (started) booking is "live"; otherwise
 * the soonest confirmed upcoming booking, so the booker can open the screen early
 * and — on live-tracked services — watch the provider heading out the moment they
 * start (the TrackingStarted hub event flips the screen without a reload).
 */
function pickUserSessions(bookings: BookingDto[]): BookingDto[] {
  const active = bookings.filter((b) => b.state !== BookingState.Cancelled);
  const started = active
    .filter((b) => b.currentStatus === BookingStatusType.ServiceStarted)
    .sort(byFrom);
  if (started.length) return [started[0]];

  const now = Date.now();
  const upcoming = active
    .filter(
      (b) =>
        (b.currentStatus === BookingStatusType.ServiceConfirmedByProvider ||
          b.currentStatus === BookingStatusType.PrePayment) &&
        parseBookingDate(b.bookingTo).getTime() >= now
    )
    .sort(byFrom);
  return upcoming.length ? [upcoming[0]] : [];
}

// ── Formatting ──────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  const d = parseBookingDate(iso);
  return isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function formatTime(iso: string): string {
  const d = parseBookingDate(iso);
  return isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}
function firstPhoto(photos?: { src?: string | null; isSelected?: boolean }[] | null): string {
  const list = photos ?? [];
  const selected = list.find((p) => p.isSelected) ?? list[0];
  return resolveImageUrl(selected?.src);
}

export default function LiveSessionScreen() {
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const navigation = useNavigation();
  const mode = route.params?.mode ?? 'partner';
  const isPartner = mode === 'partner';
  const { currentUser } = useAuth();
  const { showError, showInfo } = useToast();
  const { isDarkMode, bgColor, cardBg, textColor, subtextColor, borderColor } = useThemeColors();
  const { t, tEnum } = useLocale();

  // The concurrent group the partner is running (user: ≤1). `index` is the
  // currently-viewed session within the group.
  const [sessions, setSessions] = useState<BookingDto[]>([]);
  const [index, setIndex] = useState(0);
  // Full pet/service detail keyed by booking id — the booking's embedded includes
  // are shallow (name/photos/id only), so we fetch the complete records.
  const [petById, setPetById] = useState<Record<number, PetResponse | null>>({});
  const [serviceById, setServiceById] = useState<Record<number, ServiceDto | null>>({});
  // The booker's saved account address per booking — used as the pickup/drop-off
  // destination for directions (the booking itself doesn't persist one — B2).
  const [bookerAddrById, setBookerAddrById] = useState<Record<number, AddressDto | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<'start' | 'end' | null>(null);
  const [justCompleted, setJustCompleted] = useState(false);
  // Pickup/Drop-off completion — local-only, per booking (no backend field, B7).
  const [completedById, setCompletedById] = useState<Record<number, Completion>>({});
  // Directions modal target (resolved coordinate + label).
  const [dirTarget, setDirTarget] = useState<{ point: GeoPoint; label: string } | null>(null);
  const [dirLoadingKey, setDirLoadingKey] = useState<AddOnItem['key'] | null>(null);
  // Wall-clock tick, used to enable the Start button once we're within the
  // backend's 30-min start window (below). Only runs while a not-yet-started
  // session is on screen.
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (!currentUser?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      let group: BookingDto[] = [];
      if (isPartner) {
        const providerId = currentUser.serviceProviderId || null;
        const list = providerId ? await getBookings({ serviceProviderId: providerId }) : [];
        group = pickPartnerSessions(list);
      } else {
        // No currentStatus filter: an upcoming confirmed booking also counts —
        // the booker can open the screen early and wait for the provider to start.
        const list = await getBookings({ userId: currentUser.id });
        group = pickUserSessions(list);
      }
      setSessions(group);
      setIndex(0);
      // Side-load full pet + service (+ booker address for partner directions) for
      // each session. Best-effort — a failure falls back to the shallow data.
      if (group.length) {
        const petMap: Record<number, PetResponse | null> = {};
        const svcMap: Record<number, ServiceDto | null> = {};
        const addrMap: Record<number, AddressDto | null> = {};
        await Promise.all(
          group.map(async (b) => {
            const id = b.id!;
            const [p, s, addr] = await Promise.all([
              getPet(b.petId).catch(() => null),
              getService(b.serviceId).catch(() => null),
              isPartner
                ? getUser(b.userId)
                    .then((u) => u.address ?? null)
                    .catch(() => null)
                : Promise.resolve(null),
            ]);
            petMap[id] = p;
            svcMap[id] = s;
            addrMap[id] = addr;
          })
        );
        setPetById(petMap);
        setServiceById(svcMap);
        setBookerAddrById(addrMap);
      } else {
        setPetById({});
        setServiceById({});
        setBookerAddrById({});
      }
    } catch (e) {
      setSessions([]);
      setPetById({});
      setServiceById({});
      setBookerAddrById({});
      showError(getErrorMessage(e, t('liveSession.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id, currentUser?.serviceProviderId, isPartner, t]);

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

  // ── Current session ──
  const dto = sessions[index] ?? null;
  const pet = dto ? (petById[dto.id!] ?? null) : null;
  const service = dto ? (serviceById[dto.id!] ?? null) : null;
  const bookerAddr = dto ? (bookerAddrById[dto.id!] ?? null) : null;
  const started = dto?.currentStatus === BookingStatusType.ServiceStarted;
  const completion: Completion = (dto && completedById[dto.id!]) || {
    pickup: false,
    dropoff: false,
  };

  // ── Live location (Walker/Transporter services that opted in) ──
  const supportsLiveTracking = !!service?.details?.supportsLiveTracking;
  // Booker side: subscribe to the booking's location group. Subscribing works
  // before the session opens, so mounting early lands in 'waiting' until the
  // provider starts and TrackingStarted arrives.
  const tracking = useLiveLocationWatcher(
    !isPartner && supportsLiveTracking && dto?.id ? dto.id : null
  );
  // Partner side: stream this device's GPS while the tracked service runs. The
  // gate on `started` stops the watcher automatically when the service ends.
  const sharing = useLocationSharing(
    isPartner && started && supportsLiveTracking && dto?.id ? dto.id : null
  );

  // TrackingStarted means the provider started the service — flip the booking to
  // in-progress locally so the badge/countdown update without a manual reload.
  useEffect(() => {
    if (isPartner || !dto || started || tracking.status !== 'live') return;
    setSessions((prev) =>
      prev.map((s) =>
        s.id === dto.id ? { ...s, currentStatus: BookingStatusType.ServiceStarted } : s
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracking.status]);

  // Earliest moment the partner may start (30 min before the scheduled start).
  // `canStart` re-evaluates as `now` ticks, so the button enables on its own when
  // the window opens — no refresh needed. `startWindowIso` reuses the booking
  // date helpers to label the window in the partner's local time.
  const startWindowMs = dto ? parseBookingDate(dto.bookingFrom).getTime() - START_LEAD_MS : 0;
  const canStart = !!dto && now >= startWindowMs;
  const startWindowIso = dto ? formatBookingDate(new Date(startWindowMs)) : '';

  // Tick the clock only while waiting to start, so the Start gate stays current.
  useEffect(() => {
    if (!dto || started) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [dto, started]);

  const addOns = useMemo<AddOnItem[]>(() => {
    if (!dto) return [];
    const items: AddOnItem[] = [];
    if (dto.includePickup) {
      // Prefer the booking's own pickup address (when the backend persists one —
      // B2); otherwise fall back to the booker's saved account address.
      const addr = dto.pickupAddress ?? bookerAddr ?? undefined;
      items.push({
        key: 'pickup',
        label: t('addons.pickup'),
        icon: 'car-outline',
        completed: completion.pickup,
        detail: addr ? addressLabel(addr) : undefined,
        toggleable: true,
        address: addr,
      });
    }
    if (dto.includePetReturn) {
      const addr = dto.leaveOverAddress ?? bookerAddr ?? undefined;
      items.push({
        key: 'dropoff',
        label: t('addons.dropoff'),
        icon: 'home-outline',
        completed: completion.dropoff,
        detail: addr ? addressLabel(addr) : undefined,
        toggleable: true,
        address: addr,
      });
    }
    if (dto.includeSpecialNeeds)
      items.push({
        key: 'specialNeeds',
        label: t('addons.specialNeeds'),
        icon: 'medkit-outline',
        completed: false,
        toggleable: false,
      });
    return items;
  }, [dto, bookerAddr, completion.pickup, completion.dropoff]);

  // Only the actionable (pickup/drop-off) tasks gate ending the service.
  const canEnd = addOns.filter((a) => a.toggleable !== false).every((a) => a.completed);

  const toggleAddOn = (key: AddOnItem['key']) => {
    if (!dto) return;
    const id = dto.id!;
    setCompletedById((prev) => {
      const cur = prev[id] ?? { pickup: false, dropoff: false };
      if (key === 'pickup') return { ...prev, [id]: { ...cur, pickup: !cur.pickup } };
      if (key === 'dropoff') return { ...prev, [id]: { ...cur, dropoff: !cur.dropoff } };
      return prev;
    });
  };

  const handleDirections = async (key: AddOnItem['key']) => {
    const addr = addOns.find((a) => a.key === key)?.address;
    if (!addr) {
      showInfo(t('liveSession.noSavedAddress'));
      return;
    }
    setDirLoadingKey(key);
    try {
      const point = await forwardGeocode(addressLabel(addr));
      if (!point) {
        showError(t('liveSession.pinpointFailed'));
        return;
      }
      setDirTarget({ point, label: addressLabel(addr) });
    } catch (e) {
      showError(getErrorMessage(e, t('liveSession.directionsUnavailable')));
    } finally {
      setDirLoadingKey(null);
    }
  };

  const handleStart = async () => {
    if (!dto || busy || !canStart) return;
    setBusy('start');
    try {
      await startBookingService(dto);
      // Patch the current session in place so the countdown/End UI appear without
      // a full reload (which would reset the carousel to the first session).
      setSessions((prev) =>
        prev.map((s) =>
          s.id === dto.id ? { ...s, currentStatus: BookingStatusType.ServiceStarted } : s
        )
      );
    } catch (e) {
      showError(getErrorMessage(e, t('liveSession.startFailed')));
    } finally {
      setBusy(null);
    }
  };

  const finishEnd = (endedId: number) => {
    const remaining = sessions.filter((s) => s.id !== endedId);
    if (remaining.length === 0) {
      setJustCompleted(true);
    } else {
      // Other concurrent sessions are still running — drop the ended one and stay.
      setSessions(remaining);
      setIndex((i) => Math.min(i, remaining.length - 1));
    }
  };

  const handleEnd = async () => {
    if (!dto || busy || !canEnd) return;
    const endedId = dto.id!;
    setBusy('end');
    try {
      await endBookingService(dto);
      finishEnd(endedId);
    } catch (e: any) {
      // Guard: the completion email can still 500 on an invalid recipient (seed
      // admin) even though the status persisted (BACKEND_GAPS B4). Re-fetch and
      // confirm the booking actually reached ServiceEnded before surfacing an error.
      try {
        const fresh = await getBooking(endedId);
        if (fresh.currentStatus === BookingStatusType.ServiceEnded) {
          finishEnd(endedId);
          return;
        }
      } catch {
        /* fall through to the error toast */
      }
      showError(getErrorMessage(e, t('liveSession.endFailed')));
    } finally {
      setBusy(null);
    }
  };

  // ── Derived display values ── (prefer the full service; fall back to the
  // shallow booking include while it loads / if the fetch failed)
  const shallowSvc: any = dto?.service;
  const serviceName = service?.name ?? shallowSvc?.name ?? t('liveSession.service');
  const serviceType =
    typeof service?.type === 'number' ? tEnum('serviceProviderType', service.type) : '';
  const serviceDescription = service?.description ?? service?.about ?? '';
  const serviceImage =
    resolveImageUrl(service?.imageUrl) ||
    firstPhoto(service?.photos) ||
    firstPhoto(shallowSvc?.photos) ||
    firstPhoto(dto?.serviceProvider?.photos);
  // Partner already knows their own service — they only need the *type* (in case
  // they run several services) so they can tell which booking this is. The booker
  // sees the full name + about.
  const headerTitle = isPartner ? serviceType || t('liveSession.service') : serviceName;
  const counterpartyName = isPartner
    ? dto?.user?.userName || t('liveSession.client')
    : dto?.serviceProvider?.name || t('liveSession.provider');
  const counterpartyAvatar = isPartner
    ? firstPhoto(dto?.user?.photos)
    : firstPhoto(dto?.serviceProvider?.photos);

  const Avatar = ({
    uri,
    fallbackIcon,
  }: {
    uri: string;
    fallbackIcon: keyof typeof Ionicons.glyphMap;
  }) =>
    uri ? (
      <Image source={{ uri }} className="mr-3 h-12 w-12 rounded-full" resizeMode="cover" />
    ) : (
      <View
        className={`mr-3 h-12 w-12 items-center justify-center rounded-full ${
          isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'
        }`}>
        <Ionicons name={fallbackIcon} size={22} color="#9CA3AF" />
      </View>
    );

  return (
    <>
      <ScreenLayout
        headerVariant="standard"
        showBackButton
        headerTitle={t('liveSession.title')}
        headerSubtitle={
          isPartner ? t('liveSession.partnerSubtitle') : t('liveSession.userSubtitle')
        }
        contentBg={bgColor}>
        {isLoading ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color="#00C870" />
          </View>
        ) : justCompleted ? (
          // ── Service-completed success state ──
          <View className="flex-1 items-center justify-center px-8">
            <View className="mb-5 h-20 w-20 items-center justify-center rounded-full bg-brand-50">
              <Ionicons name="checkmark-done" size={42} color="#00C870" />
            </View>
            <Text className={`text-xl font-bold ${textColor} mb-2`}>
              {t('liveSession.serviceCompleted')}
            </Text>
            <Text className={`text-sm ${subtextColor} mb-8 text-center`}>
              {t('liveSession.serviceCompletedText')}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              activeOpacity={0.85}
              className="w-full items-center rounded-2xl bg-brand-500 px-8 py-3.5">
              <Text className="text-base font-bold text-white">{t('liveSession.done')}</Text>
            </TouchableOpacity>
          </View>
        ) : !dto ? (
          // ── Empty state ──
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="radio-outline" size={64} color={isDarkMode ? '#4B5563' : '#D1D5DB'} />
            <Text className={`text-lg font-bold ${textColor} mt-4`}>
              {t('liveSession.noActiveSession')}
            </Text>
            <Text className={`text-sm ${subtextColor} mt-2 text-center`}>
              {isPartner ? t('liveSession.partnerEmpty') : t('liveSession.userEmpty')}
            </Text>
          </View>
        ) : (
          <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            {/* Concurrent-session pager — only when the partner is running several */}
            {isPartner && sessions.length > 1 ? (
              <View
                className={`mb-4 flex-row items-center justify-between ${cardBg} rounded-2xl border ${borderColor} px-3 py-2`}>
                <TouchableOpacity
                  disabled={index === 0}
                  onPress={() => setIndex((i) => Math.max(0, i - 1))}
                  activeOpacity={0.7}
                  className="h-10 w-10 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: index === 0 ? (isDarkMode ? '#243447' : '#F3F4F6') : '#E6FAF0',
                    opacity: index === 0 ? 0.5 : 1,
                  }}>
                  <Ionicons
                    name="chevron-back"
                    size={22}
                    color={index === 0 ? '#9CA3AF' : '#00A85A'}
                  />
                </TouchableOpacity>
                <View className="items-center">
                  <Text className={`text-sm font-bold ${textColor}`}>
                    {t('liveSession.sessionOf', { current: index + 1, total: sessions.length })}
                  </Text>
                  <Text className={`text-xs ${subtextColor}`}>
                    {t('liveSession.concurrentBookings')}
                  </Text>
                </View>
                <TouchableOpacity
                  disabled={index === sessions.length - 1}
                  onPress={() => setIndex((i) => Math.min(sessions.length - 1, i + 1))}
                  activeOpacity={0.7}
                  className="h-10 w-10 items-center justify-center rounded-full"
                  style={{
                    backgroundColor:
                      index === sessions.length - 1
                        ? isDarkMode
                          ? '#243447'
                          : '#F3F4F6'
                        : '#E6FAF0',
                    opacity: index === sessions.length - 1 ? 0.5 : 1,
                  }}>
                  <Ionicons
                    name="chevron-forward"
                    size={22}
                    color={index === sessions.length - 1 ? '#9CA3AF' : '#00A85A'}
                  />
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Status badge */}
            <View
              className={`mb-4 flex-row items-center self-start rounded-full px-3 py-1.5 ${
                started ? 'bg-brand-50' : isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'
              }`}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: started ? '#00C870' : '#9CA3AF',
                  marginRight: 6,
                }}
              />
              <Text
                className="text-xs font-bold"
                style={{ color: started ? '#00A85A' : isDarkMode ? '#9CA3AF' : '#6B7280' }}>
                {started
                  ? t('liveSession.inProgress')
                  : isPartner
                    ? t('liveSession.readyToStart')
                    : t('liveSession.startingSoon')}
              </Text>
            </View>

            {/* Partner live-location sharing indicator */}
            {isPartner && sharing.isSharing ? (
              <View className="-mt-2 mb-4 flex-row items-center self-start rounded-full bg-brand-50 px-3 py-1.5">
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: '#00C870',
                    marginRight: 6,
                  }}
                />
                <Text className="text-xs font-bold" style={{ color: '#00A85A' }}>
                  {t('liveSession.sharingLocation')}
                </Text>
              </View>
            ) : null}
            {isPartner && started && supportsLiveTracking && sharing.error ? (
              <Text className="-mt-2 mb-3 text-xs text-orange-500">{sharing.error}</Text>
            ) : null}

            {/* Service header — partner sees just the type; booker sees name + type */}
            <View className="mb-5 flex-row items-center">
              {serviceImage ? (
                <Image
                  source={{ uri: serviceImage }}
                  className="mr-4 h-16 w-16 rounded-2xl"
                  resizeMode="cover"
                />
              ) : (
                <View
                  className={`mr-4 h-16 w-16 items-center justify-center rounded-2xl ${
                    isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'
                  }`}>
                  <Ionicons name="briefcase" size={26} color="#9CA3AF" />
                </View>
              )}
              <View className="flex-1">
                <Text className={`text-xl font-bold ${textColor}`}>{headerTitle}</Text>
                {!isPartner && serviceType ? (
                  <Text className={`text-sm ${subtextColor} mt-0.5`}>{serviceType}</Text>
                ) : null}
              </View>
            </View>

            {/* What the service involves — booker only (the partner created it) */}
            {!isPartner && serviceDescription ? (
              <View className={`${cardBg} rounded-2xl border ${borderColor} mb-5 p-4`}>
                <Text className={`text-xs font-bold uppercase ${subtextColor} mb-1`}>
                  {t('liveSession.aboutThisService')}
                </Text>
                <Text className={`text-sm ${textColor} leading-5`}>{serviceDescription}</Text>
              </View>
            ) : null}

            {/* Countdown — only while started */}
            {started && dto.bookingTo ? (
              <View className="mb-5">
                <CountdownTimer endTime={dto.bookingTo} isDarkMode={isDarkMode} />
              </View>
            ) : null}

            {/* Live provider location — booker side, tracked services only */}
            {!isPartner && supportsLiveTracking ? (
              <View className="mb-5">
                <View className="mb-2 flex-row items-center">
                  <Text className={`text-base font-bold ${textColor}`}>
                    {t('liveSession.liveLocation')}
                  </Text>
                  {tracking.status === 'live' ? (
                    <View className="ml-2 flex-row items-center rounded-full bg-brand-50 px-2 py-0.5">
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: '#00C870',
                          marginRight: 4,
                        }}
                      />
                      <Text className="text-[10px] font-bold" style={{ color: '#00A85A' }}>
                        {t('liveSession.live')}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {tracking.status === 'live' && tracking.latest ? (
                  <View style={{ height: 280 }}>
                    <LiveTrackingMap
                      latest={tracking.latest}
                      trail={tracking.trail}
                      isDarkMode={isDarkMode}
                    />
                  </View>
                ) : tracking.status === 'ended' ? (
                  <View
                    className={`${cardBg} rounded-2xl border ${borderColor} flex-row items-center p-4`}>
                    <Ionicons name="flag-outline" size={20} color="#9CA3AF" />
                    <Text className={`text-sm ${subtextColor} ml-2 flex-1`}>
                      {t('liveSession.trackingEnded')}
                    </Text>
                  </View>
                ) : tracking.status === 'error' ? (
                  <View
                    className={`${cardBg} rounded-2xl border ${borderColor} flex-row items-center p-4`}>
                    <Ionicons name="cloud-offline-outline" size={20} color="#F97316" />
                    <Text className={`text-sm ${subtextColor} ml-2 flex-1`}>
                      {t('liveSession.trackingError')}
                    </Text>
                  </View>
                ) : (
                  <View
                    className={`${cardBg} rounded-2xl border ${borderColor} flex-row items-center p-4`}>
                    <ActivityIndicator size="small" color="#00C870" />
                    <Text className={`text-sm ${subtextColor} ml-2 flex-1`}>
                      {started
                        ? t('liveSession.waitingForLocation')
                        : t('liveSession.locationWillAppear')}
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            {/* Pet — full detail so the provider knows the animal */}
            <Text className={`text-base font-bold ${textColor} mb-2`}>{t('liveSession.pet')}</Text>
            <View className="mb-5">
              {pet ? (
                <PetDetailsCard
                  pet={pet}
                  isDarkMode={isDarkMode}
                  cardBg={cardBg}
                  textColor={textColor}
                  subtextColor={subtextColor}
                  borderColor={borderColor}
                />
              ) : (
                // Fallback to the shallow booking include while the full pet loads / on error.
                <View
                  className={`${cardBg} rounded-2xl border ${borderColor} flex-row items-center p-4`}>
                  <View
                    className={`mr-3 h-14 w-14 items-center justify-center rounded-xl ${
                      isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'
                    }`}>
                    <Ionicons name="paw" size={24} color="#9CA3AF" />
                  </View>
                  <Text className={`text-base font-semibold ${textColor} flex-1`}>
                    {(dto.pet as any)?.name ?? t('liveSession.pet')}
                  </Text>
                </View>
              )}
            </View>

            {/* Counterparty + schedule */}
            <Text className={`text-base font-bold ${textColor} mb-2`}>
              {isPartner ? t('liveSession.client') : t('liveSession.provider')}
            </Text>
            <View className={`${cardBg} rounded-2xl border ${borderColor} mb-5 p-4`}>
              <View className="flex-row items-center">
                <Avatar uri={counterpartyAvatar} fallbackIcon="person" />
                <Text className={`text-base font-semibold ${textColor} flex-1`}>
                  {counterpartyName}
                </Text>
              </View>
              <View className={`mt-4 flex-row items-center border-t pt-4 ${borderColor}`}>
                <Ionicons name="calendar-outline" size={18} color="#00C870" />
                <Text className={`text-sm ${subtextColor} ml-2`}>
                  {formatDate(dto.bookingFrom)}
                </Text>
                <Ionicons
                  name="time-outline"
                  size={18}
                  color="#00C870"
                  style={{ marginLeft: 16 }}
                />
                <Text className={`text-sm ${subtextColor} ml-2`}>
                  {formatTime(dto.bookingFrom)} – {formatTime(dto.bookingTo)}
                </Text>
              </View>
            </View>

            {/* Add-ons — the additional services the client chose */}
            {addOns.length > 0 ? (
              <>
                <Text className={`text-base font-bold ${textColor} mb-1`}>
                  {t('liveSession.additionalServices')}
                </Text>
                <Text className={`text-xs ${subtextColor} mb-2`}>
                  {isPartner && started
                    ? t('liveSession.addonHintStarted')
                    : isPartner
                      ? t('liveSession.addonHintNotStarted')
                      : t('liveSession.addonHintUser')}
                </Text>
                <View className="mb-5">
                  <AddOnChecklist
                    items={addOns}
                    onToggle={isPartner && started ? toggleAddOn : undefined}
                    onDirections={isPartner ? handleDirections : undefined}
                    directionsLoadingKey={dirLoadingKey}
                    readOnly={!isPartner || !started}
                    isDarkMode={isDarkMode}
                    cardBg={cardBg}
                    textColor={textColor}
                    subtextColor={subtextColor}
                    borderColor={borderColor}
                  />
                </View>
              </>
            ) : null}

            {/* Partner actions */}
            {isPartner && !started ? (
              <>
                {!canStart ? (
                  <Text className="mb-2 text-center text-xs text-orange-500">
                    {t('liveSession.startWindowNote', {
                      date: formatDate(startWindowIso),
                      time: formatTime(startWindowIso),
                    })}
                  </Text>
                ) : null}
                <TouchableOpacity
                  onPress={handleStart}
                  disabled={busy !== null || !canStart}
                  activeOpacity={0.85}
                  className="flex-row items-center justify-center rounded-2xl py-4"
                  style={{
                    backgroundColor: canStart ? '#00C870' : isDarkMode ? '#374151' : '#E5E7EB',
                    opacity: busy ? 0.7 : 1,
                  }}>
                  {busy === 'start' ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Ionicons name="play" size={20} color={canStart ? 'white' : '#9CA3AF'} />
                      <Text
                        className="ml-2 text-base font-bold"
                        style={{ color: canStart ? 'white' : '#9CA3AF' }}>
                        {t('liveSession.startService')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : null}

            {isPartner && started ? (
              <>
                {!canEnd ? (
                  <Text className="mb-2 text-center text-xs text-orange-500">
                    {t('liveSession.completeAddonsNote')}
                  </Text>
                ) : null}
                <TouchableOpacity
                  onPress={handleEnd}
                  disabled={busy !== null || !canEnd}
                  activeOpacity={0.85}
                  className="flex-row items-center justify-center rounded-2xl py-4"
                  style={{
                    backgroundColor: canEnd ? '#EF4444' : isDarkMode ? '#374151' : '#E5E7EB',
                  }}>
                  {busy === 'end' ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Ionicons name="stop" size={20} color={canEnd ? 'white' : '#9CA3AF'} />
                      <Text
                        className="ml-2 text-base font-bold"
                        style={{ color: canEnd ? 'white' : '#9CA3AF' }}>
                        {t('liveSession.endService')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : null}
          </ScrollView>
        )}
      </ScreenLayout>

      <DirectionsModal
        visible={!!dirTarget}
        title={t('liveSession.directions')}
        destination={dirTarget?.point ?? null}
        destinationLabel={dirTarget?.label ?? ''}
        isDarkMode={isDarkMode}
        onClose={() => setDirTarget(null)}
      />
    </>
  );
}
