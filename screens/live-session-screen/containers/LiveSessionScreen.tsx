import React, { useCallback, useMemo, useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRoute, RouteProp, useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import {
  getBookings,
  getBooking,
  startBookingService,
  endBookingService,
  parseBookingDate,
  BookingDto,
  BookingState,
  BookingStatusType,
} from '../../../services/bookings';
import { resolveImageUrl, providerTypeLabel } from '../../../services/service-providers';
import { CountdownTimer, AddOnChecklist, AddOnItem } from '../components';

type RouteParams = { mode?: 'partner' | 'user' };

// ── Active-session selection ────────────────────────────────────────────────
const byFrom = (a: BookingDto, b: BookingDto) =>
  parseBookingDate(a.bookingFrom).getTime() - parseBookingDate(b.bookingFrom).getTime();

/**
 * Partner's current session: a started booking takes priority (in-progress);
 * otherwise the soonest confirmed-but-not-yet-started one is offered to start.
 */
function pickPartnerSession(bookings: BookingDto[]): BookingDto | null {
  const upcoming = bookings.filter((b) => b.state === BookingState.Upcoming);
  const started = upcoming
    .filter((b) => b.currentStatus === BookingStatusType.ServiceStarted)
    .sort(byFrom);
  if (started.length) return started[0];
  const ready = upcoming
    .filter(
      (b) =>
        b.currentStatus === BookingStatusType.ServiceConfirmedByProvider ||
        b.currentStatus === BookingStatusType.PrePayment,
    )
    .sort(byFrom);
  return ready[0] ?? null;
}

/** Booker's current session: only an in-progress (started) booking is "live". */
function pickUserSession(bookings: BookingDto[]): BookingDto | null {
  const started = bookings
    .filter(
      (b) =>
        b.state === BookingState.Upcoming &&
        b.currentStatus === BookingStatusType.ServiceStarted,
    )
    .sort(byFrom);
  return started[0] ?? null;
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
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
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
  const { isDarkMode, bgColor, cardBg, textColor, subtextColor, borderColor } = useThemeColors();

  const [dto, setDto] = useState<BookingDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<'start' | 'end' | null>(null);
  const [justCompleted, setJustCompleted] = useState(false);
  // Pickup/Drop-off completion — local-only (no backend field, BACKEND_GAPS B7).
  const [pickupDone, setPickupDone] = useState(false);
  const [dropoffDone, setDropoffDone] = useState(false);

  const load = useCallback(async () => {
    if (!currentUser?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      let found: BookingDto | null = null;
      if (isPartner) {
        const providerId = currentUser.serviceProviderId || null;
        const list = providerId ? await getBookings({ serviceProviderId: providerId }) : [];
        found = pickPartnerSession(list);
      } else {
        const list = await getBookings({
          userId: currentUser.id,
          currentStatus: BookingStatusType.ServiceStarted,
          state: BookingState.Upcoming,
        });
        found = pickUserSession(list);
      }
      setDto(found);
    } catch (e) {
      console.warn('[LiveSession] load failed', e);
      setDto(null);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id, currentUser?.serviceProviderId, isPartner]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!cancelled) await load();
      })();
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  const started = dto?.currentStatus === BookingStatusType.ServiceStarted;

  const addOns = useMemo<AddOnItem[]>(() => {
    if (!dto) return [];
    const items: AddOnItem[] = [];
    if (dto.includePickup)
      items.push({ key: 'pickup', label: 'Pickup', icon: 'car-outline', completed: pickupDone });
    if (dto.includePetReturn)
      items.push({ key: 'dropoff', label: 'Drop-off', icon: 'home-outline', completed: dropoffDone });
    return items;
  }, [dto, pickupDone, dropoffDone]);

  const canEnd = addOns.every((a) => a.completed);

  const toggleAddOn = (key: AddOnItem['key']) => {
    if (key === 'pickup') setPickupDone((v) => !v);
    else setDropoffDone((v) => !v);
  };

  const handleStart = async () => {
    if (!dto || busy) return;
    setBusy('start');
    try {
      await startBookingService(dto);
      await load();
    } catch (e: any) {
      Alert.alert('Could not start service', e?.message ?? 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const handleEnd = async () => {
    if (!dto || busy || !canEnd) return;
    setBusy('end');
    try {
      await endBookingService(dto);
      setJustCompleted(true);
    } catch (e: any) {
      // Guard: the completion email can still 500 on an invalid recipient (seed
      // admin) even though the status persisted (BACKEND_GAPS B4). Re-fetch and
      // confirm the booking actually reached ServiceEnded before surfacing an error.
      try {
        const fresh = await getBooking(dto.id!);
        if (fresh.currentStatus === BookingStatusType.ServiceEnded) {
          setJustCompleted(true);
          return;
        }
      } catch {
        /* fall through to the error alert */
      }
      Alert.alert('Could not end service', e?.message ?? 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  // ── Derived display values ──
  const svc: any = dto?.service;
  const pet: any = dto?.pet;
  const serviceName = svc?.name ?? 'Service';
  const serviceType =
    typeof svc?.type === 'number' ? providerTypeLabel(svc.type) : (svc?.type ?? '');
  const serviceImage = firstPhoto(svc?.photos) || firstPhoto(dto?.serviceProvider?.photos);
  const petImage = firstPhoto(pet?.photos);
  const counterpartyName = isPartner
    ? dto?.user?.userName || 'Client'
    : dto?.serviceProvider?.name || 'Provider';
  const counterpartyAvatar = isPartner
    ? firstPhoto(dto?.user?.photos)
    : firstPhoto(dto?.serviceProvider?.photos);

  const Avatar = ({ uri, fallbackIcon }: { uri: string; fallbackIcon: keyof typeof Ionicons.glyphMap }) =>
    uri ? (
      <Image source={{ uri }} className="w-12 h-12 rounded-full mr-3" resizeMode="cover" />
    ) : (
      <View
        className={`w-12 h-12 rounded-full mr-3 items-center justify-center ${
          isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'
        }`}>
        <Ionicons name={fallbackIcon} size={22} color="#9CA3AF" />
      </View>
    );

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle="Live Session"
      headerSubtitle={isPartner ? 'Run your current service' : 'Track your service'}
      contentBg={bgColor}>
      {isLoading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#00C870" />
        </View>
      ) : justCompleted ? (
        // ── Service-completed success state ──
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-brand-50 items-center justify-center mb-5">
            <Ionicons name="checkmark-done" size={42} color="#00C870" />
          </View>
          <Text className={`text-xl font-bold ${textColor} mb-2`}>Service completed</Text>
          <Text className={`text-sm ${subtextColor} text-center mb-8`}>
            Nice work! This booking has been marked as ended.
          </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
            className="bg-brand-500 rounded-2xl px-8 py-3.5 w-full items-center">
            <Text className="text-white font-bold text-base">Done</Text>
          </TouchableOpacity>
        </View>
      ) : !dto ? (
        // ── Empty state ──
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="radio-outline" size={64} color={isDarkMode ? '#4B5563' : '#D1D5DB'} />
          <Text className={`text-lg font-bold ${textColor} mt-4`}>No active session right now</Text>
          <Text className={`text-sm ${subtextColor} text-center mt-2`}>
            {isPartner
              ? 'When you have a confirmed upcoming booking, you can start it here.'
              : 'Your live session will appear here once your provider starts the service.'}
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          {/* Status badge */}
          <View
            className={`self-start flex-row items-center px-3 py-1.5 rounded-full mb-4 ${
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
              {started ? 'IN PROGRESS' : 'READY TO START'}
            </Text>
          </View>

          {/* Service header */}
          <View className="flex-row items-center mb-5">
            {serviceImage ? (
              <Image source={{ uri: serviceImage }} className="w-16 h-16 rounded-2xl mr-4" resizeMode="cover" />
            ) : (
              <View
                className={`w-16 h-16 rounded-2xl mr-4 items-center justify-center ${
                  isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'
                }`}>
                <Ionicons name="briefcase" size={26} color="#9CA3AF" />
              </View>
            )}
            <View className="flex-1">
              <Text className={`text-xl font-bold ${textColor}`}>{serviceName}</Text>
              {serviceType ? <Text className={`text-sm ${subtextColor} mt-0.5`}>{serviceType}</Text> : null}
            </View>
          </View>

          {/* Countdown — only while started */}
          {started && dto.bookingTo ? (
            <View className="mb-5">
              <CountdownTimer endTime={dto.bookingTo} isDarkMode={isDarkMode} />
            </View>
          ) : null}

          {/* Pet card */}
          <Text className={`text-base font-bold ${textColor} mb-2`}>Pet</Text>
          <View className={`${cardBg} rounded-2xl border ${borderColor} p-4 mb-5 flex-row items-center`}>
            {petImage ? (
              <Image source={{ uri: petImage }} className="w-14 h-14 rounded-xl mr-3" resizeMode="cover" />
            ) : (
              <View
                className={`w-14 h-14 rounded-xl mr-3 items-center justify-center ${
                  isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'
                }`}>
                <Ionicons name="paw" size={24} color="#9CA3AF" />
              </View>
            )}
            <View className="flex-1">
              <Text className={`text-base font-semibold ${textColor}`}>{pet?.name ?? 'Pet'}</Text>
              {pet?.breed ? <Text className={`text-sm ${subtextColor} mt-0.5`}>{pet.breed}</Text> : null}
            </View>
          </View>

          {/* Counterparty + schedule */}
          <Text className={`text-base font-bold ${textColor} mb-2`}>
            {isPartner ? 'Client' : 'Provider'}
          </Text>
          <View className={`${cardBg} rounded-2xl border ${borderColor} p-4 mb-5`}>
            <View className="flex-row items-center">
              <Avatar uri={counterpartyAvatar} fallbackIcon="person" />
              <Text className={`text-base font-semibold ${textColor} flex-1`}>{counterpartyName}</Text>
            </View>
            <View className={`flex-row items-center mt-4 pt-4 border-t ${borderColor}`}>
              <Ionicons name="calendar-outline" size={18} color="#00C870" />
              <Text className={`text-sm ${subtextColor} ml-2`}>{formatDate(dto.bookingFrom)}</Text>
              <Ionicons name="time-outline" size={18} color="#00C870" style={{ marginLeft: 16 }} />
              <Text className={`text-sm ${subtextColor} ml-2`}>
                {formatTime(dto.bookingFrom)} – {formatTime(dto.bookingTo)}
              </Text>
            </View>
          </View>

          {/* Add-ons */}
          {addOns.length > 0 ? (
            <>
              <Text className={`text-base font-bold ${textColor} mb-1`}>Add-ons</Text>
              <Text className={`text-xs ${subtextColor} mb-2`}>
                {isPartner && started
                  ? 'Mark each as complete before ending the service.'
                  : isPartner
                    ? 'You can complete these once the service starts.'
                    : 'Your provider will complete these during the session.'}
              </Text>
              <View className="mb-5">
                <AddOnChecklist
                  items={addOns}
                  onToggle={isPartner && started ? toggleAddOn : undefined}
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
            <TouchableOpacity
              onPress={handleStart}
              disabled={busy !== null}
              activeOpacity={0.85}
              className="bg-brand-500 rounded-2xl py-4 items-center flex-row justify-center"
              style={{ opacity: busy ? 0.7 : 1 }}>
              {busy === 'start' ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="play" size={20} color="white" />
                  <Text className="text-white font-bold text-base ml-2">Start Service</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}

          {isPartner && started ? (
            <>
              {!canEnd ? (
                <Text className="text-xs text-center text-orange-500 mb-2">
                  Complete all add-ons above to end the service.
                </Text>
              ) : null}
              <TouchableOpacity
                onPress={handleEnd}
                disabled={busy !== null || !canEnd}
                activeOpacity={0.85}
                className="rounded-2xl py-4 items-center flex-row justify-center"
                style={{ backgroundColor: canEnd ? '#EF4444' : isDarkMode ? '#374151' : '#E5E7EB' }}>
                {busy === 'end' ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Ionicons name="stop" size={20} color={canEnd ? 'white' : '#9CA3AF'} />
                    <Text
                      className="font-bold text-base ml-2"
                      style={{ color: canEnd ? 'white' : '#9CA3AF' }}>
                      End Service
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : null}
        </ScrollView>
      )}
    </ScreenLayout>
  );
}
