import React, { useState, useEffect, useMemo } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useLocation } from '../../../hooks/useLocation';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLocale } from '../../../context/LocaleContext';
import { getErrorMessage } from '../../../services/http';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import DatePicker from '../../../components/shared/DatePicker';
import MapAddressPicker from '../../../components/shared/MapAddressPicker';
import { PetSelector, BookingSummary, TimeSlotPicker, TimeSlot } from '../components';
import {
  ServiceDto,
  getService,
  getServiceAvailability,
  AvailabilityWindowDto,
  effectiveOptionPrice,
} from '../../../services/services';
import { getPets } from '../../../services/pets';
import { resolveImageUrl, AddressDto } from '../../../services/service-providers';
import { parseBookingDate, formatBookingDate } from '../../../services/bookings';
import { getEnabledServiceAddons } from '../../../services/service-addons';
import { addressLabel } from '../../../services/geocoding';

// The user books one specific service (chosen before entering this screen), not
// a provider — the service comes in as a route param and carries serviceProviderId.
type BookServiceRouteParams = { service: ServiceDto };

const servicePrice = (s: ServiceDto) => s.price ?? s.pricing?.basePrice ?? 0;

// Add-ons come from the service itself (see services/service-addons.ts), so a
// booker sees exactly what the provider configured — nothing is hardcoded here.

type Appointment = {
  id: number;
  service: { id: number; name: string; price: number };
  pet: { id: number; name: string; image: string };
  addons: { name: string; price: number }[];
  bookingFrom: string;
  bookingTo: string;
  total: number;
  // The chosen pricing option (duration/price variant) — required when the
  // service defines options. Frozen at add time: changing the selector never
  // mutates an already-added appointment. `pricingOptionBase` keeps the
  // pre-discount option price for the Review breakdown's discount line.
  pricingOptionId?: number;
  pricingOptionName?: string;
  pricingOptionBase?: number;
  // Required when the matching add-on is selected; sent inline on booking create.
  pickupAddress?: AddressDto;
  leaveOverAddress?: AddressDto;
  // Special Needs add-on has no address — it's carried as a flag (→ includeSpecialNeeds).
  includeSpecialNeeds?: boolean;
};

// Bookable slots are derived from the day's availability windows
// (GET /api/services/{id}/availability). A date with no windows is not
// bookable. Slot length: the chosen pricing option's duration when the service
// defines options, else this 1h default (classic free-range services).
const SLOT_DURATION_MS = 60 * 60 * 1000;

// "HH:mm:ss" (or "HH:mm") → minutes since midnight, rounded to the nearest
// minute. Rounding lets the 23:59:59 end-of-day sentinel (= 24:00) read back as
// 1440 so a window ending at midnight still yields its final 23:00–24:00 slot.
const hmsToMinutes = (t?: string | null): number => {
  if (!t) return 0;
  const [h, m, s] = t.split(':');
  const total = (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0) + (parseInt(s, 10) || 0) / 60;
  return Math.round(total);
};

/** Two time ranges overlap (half-open intervals). */
const overlaps = (aFrom: number, aTo: number, bFrom: number, bTo: number) =>
  aFrom < bTo && aTo > bFrom;

export default function BookServiceScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: BookServiceRouteParams }, 'params'>>();
  const { service } = route.params;
  const { currentUser } = useAuth();
  const { showError } = useToast();
  const {
    isDarkMode,
    cardBg,
    bgColor: contentBg,
    textColor,
    subtextColor,
    borderColor,
  } = useThemeColors();
  const location = useLocation();
  const { t, tEnum } = useLocale();

  // The service is fixed for this screen — booking targets this one service.
  // It arrives from Home/Search list endpoints, which return a LEANER ServiceDto
  // without the working-hours `schedules` (and without full `details`). We
  // re-fetch the full service by id on mount (below) so the time-slot picker is
  // built from the provider's real work times for this service.
  const [selectedService, setSelectedService] = useState<ServiceDto>(service);
  const serviceId = selectedService.id ?? service.id ?? null;
  const serviceImage = resolveImageUrl(
    selectedService.imageUrl ??
      (selectedService.photos?.find((p) => p.isSelected) ?? selectedService.photos?.[0])?.src
  );
  const serviceTypeLabel =
    selectedService.basicServiceName ??
    (selectedService.type != null ? tEnum('serviceProviderType', selectedService.type) : '');

  const [pets, setPets] = useState<{ id: number; name: string; breed: string; image: string }[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);

  // Pricing options (duration/price variants). A service that defines any
  // REQUIRES the booker to pick one — the server derives bookingTo and the
  // price from it. An option-less service keeps the classic 1h-slot booking.
  const pricingOptions = selectedService.pricingOptions ?? [];
  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);
  const selectedOption = pricingOptions.find((o) => o.id === selectedOptionId) ?? null;
  const optionChosen = pricingOptions.length === 0 || selectedOption != null;
  // Slot length (and stride) for the time picker — the option's duration when
  // one is chosen, else the classic 1h grid.
  const slotMs = selectedOption ? selectedOption.durationMinutes * 60000 : SLOT_DURATION_MS;

  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  // Pickup / Drop-off addresses are picked on a map (reverse-geocoded to AddressDto).
  const [pickupAddr, setPickupAddr] = useState<AddressDto | null>(null);
  const [dropoffAddr, setDropoffAddr] = useState<AddressDto | null>(null);
  const [pickerFor, setPickerFor] = useState<'pickup' | 'dropoff' | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null); // date only (slot picks the time)
  const [startDateTime, setStartDateTime] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedPet, setSelectedPet] = useState<number | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // Bookable windows for the selected date, fetched from the service's
  // availability endpoint (server-derived, with remaining capacity per window).
  const [availWindows, setAvailWindows] = useState<AvailabilityWindowDto[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        // Fetch the user's pets and the FULL service (with its working-hours
        // schedules + details) in parallel. The list DTO we were navigated with
        // omits schedules, so without this re-fetch the slot picker would be
        // empty for every day. Service fetch fails soft → keep the lean DTO.
        const [petList, fullService] = await Promise.all([
          currentUser?.id ? getPets(currentUser.id) : Promise.resolve([]),
          service.id != null ? getService(service.id).catch(() => null) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        if (fullService) setSelectedService(fullService);
        setPets(
          petList.map((p) => ({
            id: Number(p.id),
            name: p.name,
            breed: p.breed || tEnum('petSpeciesType', p.type),
            image: p.photoUrl ? resolveImageUrl(p.photoUrl) : resolveImageUrl(p.photos?.[0]?.src),
          }))
        );
      } catch (e) {
        if (!cancelled) showError(getErrorMessage(e, t('bookService.petsLoadError')));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, service.id]);

  // For the chosen day, fetch the service's bookable windows from the
  // availability endpoint. This is the ONLY source of slot availability — the
  // server already factors in the provider's bookings (per-window
  // remainingCapacity), so we no longer query the bookings API here.
  useEffect(() => {
    if (!selectedDate || serviceId == null) {
      setAvailWindows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoadingSlots(true);
      try {
        const dayStart = new Date(selectedDate);
        dayStart.setHours(0, 0, 0, 0);
        // Date-only key ("YYYY-MM-DD", local) — the availability endpoint rejects
        // full ISO datetimes.
        const dayKey = formatBookingDate(dayStart).slice(0, 10);
        const availability = await getServiceAvailability(serviceId, dayKey, dayKey);
        if (!cancelled) setAvailWindows(availability?.days?.[0]?.windows ?? []);
      } catch (e) {
        if (!cancelled) {
          setAvailWindows([]); // no windows → no slots
          showError(getErrorMessage(e, t('bookService.slotsLoadError')));
        }
      } finally {
        if (!cancelled) setIsLoadingSlots(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, serviceId]);

  // Weekdays the service has working hours for (from its schedules). JS getDay()
  // (0=Sun…6=Sat) matches the schedule's .NET DayOfWeek numbering. Cheap weekly
  // pattern used only to gray out the calendar; the actual per-date slots come
  // from the availability endpoint once a day is picked.
  const scheduledDays = useMemo(
    () => new Set((selectedService?.schedules ?? []).map((s) => s.day)),
    [selectedService]
  );

  // Build bookable slots for the selected date from the availability endpoint's
  // window(s) for that date. Slot length AND stride follow the chosen pricing
  // option's duration (a back-to-back grid inside each window); option-less
  // services keep the classic hourly grid. No windows → no slots (not
  // bookable). A slot is unavailable when it's in the past, the window has no
  // capacity left (remainingCapacity already accounts for the provider's
  // bookings), or appointments added this session have filled that capacity.
  const timeSlots: TimeSlot[] = useMemo(() => {
    if (!selectedDate) return [];
    const windows = availWindows;
    if (windows.length === 0) return []; // no availability → unavailable
    const now = Date.now();
    const slotMinutes = slotMs / 60000;
    const byId = new Map<string, TimeSlot>();
    for (const w of windows) {
      const fromMin = hmsToMinutes(w.from);
      const toMin = hmsToMinutes(w.to);
      // Only whole slots that fit inside the window [from, to).
      for (let m = fromMin; m + slotMinutes <= toMin; m += slotMinutes) {
        const hour = Math.floor(m / 60);
        const minute = m % 60;
        const id = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        if (byId.has(id)) continue; // overlapping windows → keep one slot per start
        const start = new Date(selectedDate);
        start.setHours(hour, minute, 0, 0);
        const end = start.getTime() + slotMs;
        // Appointments added this session count against the window's remaining
        // capacity (the server already subtracted real bookings).
        const localTaken = appointments.filter((a) =>
          overlaps(
            parseBookingDate(a.bookingFrom).getTime(),
            parseBookingDate(a.bookingTo).getTime(),
            start.getTime(),
            end
          )
        ).length;
        byId.set(id, {
          id,
          label: start.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }),
          start,
          available: start.getTime() > now && localTaken < w.remainingCapacity,
        });
      }
    }
    return Array.from(byId.values()).sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [selectedDate, availWindows, appointments, slotMs]);

  const selectedSlotId = startDateTime
    ? `${String(startDateTime.getHours()).padStart(2, '0')}:${String(startDateTime.getMinutes()).padStart(2, '0')}`
    : null;

  // Add-ons reflect exactly what the provider enabled on THIS service.
  const serviceAddons = useMemo(() => getEnabledServiceAddons(selectedService), [selectedService]);

  const toggleAddon = (id: string) =>
    setSelectedAddons((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));

  // Pickup / Drop-off require the booker to pick a location before continuing.
  const pickupSelected = selectedAddons.includes('pickup');
  const dropoffSelected = selectedAddons.includes('dropoff');
  const addressesProvided =
    (!pickupSelected || !!pickupAddr) && (!dropoffSelected || !!dropoffAddr);

  // Per-selection service price: the chosen option's (discounted) price when
  // the service defines options, else the classic effective service price.
  const currentServicePrice = () =>
    selectedOption
      ? effectiveOptionPrice(selectedService, selectedOption)
      : servicePrice(selectedService);

  const currentTotal = () => {
    const addons = selectedAddons.reduce((sum, id) => {
      const def = serviceAddons.find((a) => a.id === id);
      return sum + (def?.price ?? 0);
    }, 0);
    return currentServicePrice() + addons;
  };

  const selectionComplete =
    optionChosen && !!startDateTime && selectedPet !== null && addressesProvided;

  const buildAppointment = (): Appointment | null => {
    if (!optionChosen || !startDateTime || selectedPet === null || !addressesProvided) return null;
    const pet = pets.find((p) => p.id === selectedPet);
    return {
      id: Date.now(),
      service: {
        id: selectedService.id ?? 0,
        name: selectedService.name ?? 'Service',
        price: currentServicePrice(),
      },
      pet: { id: selectedPet, name: pet?.name ?? 'Pet', image: pet?.image ?? '' },
      addons: selectedAddons.flatMap((id) => {
        const def = serviceAddons.find((a) => a.id === id);
        // Localized display name, frozen at add time (shown here + on Review).
        return def ? [{ name: t(`addons.${def.id}` as any), price: def.price }] : [];
      }),
      // Naive local wall-clock (no offset) so the booking round-trips to the same
      // time the user picked under parseBookingDate (see services/bookings.ts).
      // End = start + the chosen option's duration (1h for option-less services);
      // for option bookings the server re-derives it from the option anyway.
      bookingFrom: formatBookingDate(startDateTime),
      bookingTo: formatBookingDate(new Date(startDateTime.getTime() + slotMs)),
      total: currentTotal(),
      pricingOptionId: selectedOption?.id ?? undefined,
      pricingOptionName: selectedOption?.name,
      pricingOptionBase: selectedOption?.price,
      pickupAddress: pickupSelected ? (pickupAddr ?? undefined) : undefined,
      leaveOverAddress: dropoffSelected ? (dropoffAddr ?? undefined) : undefined,
      includeSpecialNeeds: selectedAddons.includes('specialNeeds'),
    };
  };

  const resetSelection = () => {
    setSelectedAddons([]);
    setPickupAddr(null);
    setDropoffAddr(null);
    setSelectedDate(null);
    setStartDateTime(null);
    setSelectedPet(null);
  };

  const addAppointment = () => {
    const apt = buildAppointment();
    if (!apt) return;
    setAppointments((prev) => [...prev, apt]);
    resetSelection();
  };

  const removeAppointment = (id: number) =>
    setAppointments((prev) => prev.filter((a) => a.id !== id));

  const grandTotal = appointments.reduce((sum, a) => sum + a.total, 0);

  const onContinue = () => {
    const current = [...appointments];
    const apt = buildAppointment();
    if (apt) current.push(apt);
    if (current.length === 0) return;
    (navigation as any).navigate('ReviewBooking', {
      service: selectedService,
      appointments: current,
    });
  };

  const stepDot = (done: boolean, n: number) => (
    <View
      className={`h-6 w-6 items-center justify-center rounded-full ${done ? 'bg-brand-500' : 'bg-gray-300'}`}>
      {done ? (
        <Ionicons name="checkmark" size={16} color="white" />
      ) : (
        <Text className="text-xs font-bold text-white">{n}</Text>
      )}
    </View>
  );

  const canContinue = selectionComplete || appointments.length > 0;

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      contentBg={contentBg}
      contentRounded={false}
      headerChildren={
        <View className="flex-1">
          <Text className="text-xl font-bold text-white">{t('bookService.title')}</Text>
          <Text className={`${isDarkMode ? 'text-gray-300' : 'text-brand-100'} text-sm`}>
            {[selectedService.name, selectedService.basicServiceName].filter(Boolean).join(' • ')}
          </Text>
        </View>
      }>
      {isLoading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#00C870" />
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Step 1: Service (fixed — chosen before entering this screen). When
              the service defines pricing options, picking one is part of this
              step — the booking can't proceed without it. */}
          <View className="px-6 py-5">
            <View className="mb-4 flex-row items-center">
              {stepDot(optionChosen, 1)}
              <Text className={`text-base font-semibold ${textColor} ml-3`}>
                {t('bookService.step1')}
              </Text>
            </View>
            <View
              className={`overflow-hidden rounded-2xl border-2 border-brand-500 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'}`}>
              {/* Service profile picture */}
              {serviceImage ? (
                <Image source={{ uri: serviceImage }} className="h-40 w-full" resizeMode="cover" />
              ) : (
                <View
                  className={`h-40 w-full ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'} items-center justify-center`}>
                  <Ionicons name="paw" size={40} color="#9CA3AF" />
                </View>
              )}
              <View className="flex-row items-start justify-between p-4">
                <View className="mr-4 flex-1">
                  {/* Service name */}
                  <Text className={`text-base font-semibold ${textColor}`}>
                    {selectedService.name ?? 'Service'}
                  </Text>
                  {/* Service type */}
                  {serviceTypeLabel ? (
                    <Text className="mt-1 text-sm text-brand-600">{serviceTypeLabel}</Text>
                  ) : null}
                </View>
                <Text className="text-xl font-bold text-brand-600">
                  {pricingOptions.length > 0
                    ? selectedOption
                      ? `$${effectiveOptionPrice(selectedService, selectedOption)}`
                      : `${t('bookService.priceFrom')} $${Math.min(
                          ...pricingOptions.map((o) => effectiveOptionPrice(selectedService, o))
                        )}`
                    : `$${servicePrice(selectedService)}`}
                </Text>
              </View>
            </View>

            {/* Duration/price options — required pick when the service defines any */}
            {pricingOptions.length > 0 && (
              <View className="mt-4">
                <Text className={`text-sm font-semibold ${textColor} mb-2`}>
                  {t('bookService.chooseDuration')}
                </Text>
                {pricingOptions.map((option) => {
                  const effective = effectiveOptionPrice(selectedService, option);
                  const isSelected = option.id != null && option.id === selectedOptionId;
                  return (
                    <TouchableOpacity
                      key={option.id ?? option.name}
                      onPress={() => {
                        setSelectedOptionId(option.id ?? null);
                        // Slot length follows the option — a picked start time may
                        // no longer be valid, so re-pick.
                        setStartDateTime(null);
                      }}
                      className={`mb-3 rounded-2xl border-2 p-4 ${
                        isSelected
                          ? `border-brand-500 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'}`
                          : `${borderColor} ${cardBg}`
                      }`}>
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1">
                          <Text className={`text-base font-semibold ${textColor}`}>
                            {option.name}
                          </Text>
                          <Text className={`text-sm ${subtextColor} mt-1`}>
                            {option.durationMinutes} min
                            {option.description ? ` • ${option.description}` : ''}
                          </Text>
                        </View>
                        <View className="ml-4 items-end">
                          {effective < option.price && (
                            <Text className={`text-xs ${subtextColor} line-through`}>
                              ${option.price}
                            </Text>
                          )}
                          <Text className="text-lg font-bold text-brand-600">${effective}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Step 2: Additional Services */}
          <View className={`border-t px-6 py-5 ${borderColor}`}>
            <View className="mb-4 flex-row items-center">
              {stepDot(selectedAddons.length > 0, 2)}
              <Text className={`text-base font-semibold ${textColor} ml-3`}>
                {t('bookService.additionalServices')}
              </Text>
              <Text className={`text-sm ${subtextColor} ml-2`}>{t('bookService.optional')}</Text>
            </View>
            {serviceAddons.length === 0 ? (
              <Text className={`text-sm ${subtextColor}`}>{t('bookService.noAddons')}</Text>
            ) : (
              serviceAddons.map((addon) => (
                <TouchableOpacity
                  key={addon.id}
                  onPress={() => toggleAddon(addon.id)}
                  className={`mb-3 rounded-2xl border-2 p-4 ${
                    selectedAddons.includes(addon.id)
                      ? `border-brand-500 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'}`
                      : `${borderColor} ${cardBg}`
                  }`}>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className={`text-base font-semibold ${textColor}`}>
                        {t(`addons.${addon.id}` as any)}
                      </Text>
                      <Text className={`text-sm ${subtextColor} mt-1`}>
                        {t(`addons.${addon.id}Desc` as any)}
                      </Text>
                    </View>
                    <Text className="ml-4 text-lg font-bold text-brand-600">${addon.price}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}

            {/* Location required when Pickup / Drop-off is selected — picked on a map */}
            {pickupSelected && (
              <View className="mb-3 mt-1">
                <Text className={`text-sm font-semibold ${textColor} mb-2`}>
                  {t('bookService.pickupAddress')}
                </Text>
                <TouchableOpacity
                  onPress={() => setPickerFor('pickup')}
                  className={`rounded-2xl border px-4 py-3 ${borderColor} ${cardBg} flex-row items-center`}>
                  <Ionicons name="location-outline" size={20} color="#00C870" />
                  <Text
                    className={`ml-3 flex-1 ${pickupAddr ? textColor : subtextColor}`}
                    numberOfLines={2}>
                    {pickupAddr ? addressLabel(pickupAddr) : t('bookService.pickOnMap')}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={isDarkMode ? '#9CA3AF' : '#6B7280'}
                  />
                </TouchableOpacity>
                {/* Copy the drop-off address into pickup (explicit, not auto-filled). */}
                {dropoffSelected && dropoffAddr && pickupAddr !== dropoffAddr ? (
                  <TouchableOpacity
                    onPress={() => setPickupAddr(dropoffAddr)}
                    className="mt-2 flex-row items-center self-start">
                    <Ionicons name="copy-outline" size={14} color="#00C870" />
                    <Text className="ml-1.5 text-sm font-medium text-brand-600">
                      {t('bookService.sameAsDropoff')}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
            {dropoffSelected && (
              <View className="mb-1 mt-1">
                <Text className={`text-sm font-semibold ${textColor} mb-2`}>
                  {t('bookService.dropoffAddress')}
                </Text>
                <TouchableOpacity
                  onPress={() => setPickerFor('dropoff')}
                  className={`rounded-2xl border px-4 py-3 ${borderColor} ${cardBg} flex-row items-center`}>
                  <Ionicons name="location-outline" size={20} color="#00C870" />
                  <Text
                    className={`ml-3 flex-1 ${dropoffAddr ? textColor : subtextColor}`}
                    numberOfLines={2}>
                    {dropoffAddr ? addressLabel(dropoffAddr) : t('bookService.pickOnMap')}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={isDarkMode ? '#9CA3AF' : '#6B7280'}
                  />
                </TouchableOpacity>
                {/* Copy the pickup address into drop-off (explicit, not auto-filled). */}
                {pickupSelected && pickupAddr && dropoffAddr !== pickupAddr ? (
                  <TouchableOpacity
                    onPress={() => setDropoffAddr(pickupAddr)}
                    className="mt-2 flex-row items-center self-start">
                    <Ionicons name="copy-outline" size={14} color="#00C870" />
                    <Text className="ml-1.5 text-sm font-medium text-brand-600">
                      {t('bookService.sameAsPickup')}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </View>

          {/* Step 3: Choose Date & Time */}
          <View className={`border-t px-6 py-5 ${borderColor}`}>
            <View className="mb-4 flex-row items-center">
              {stepDot(!!startDateTime, 3)}
              <Text className={`text-base font-semibold ${textColor} ml-3`}>
                {t('bookService.chooseDateTime')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowDatePicker((v) => !v)}
              className={`mb-3 rounded-2xl border p-4 ${borderColor} ${cardBg} flex-row items-center justify-between`}>
              <View className="flex-row items-center">
                <Ionicons name="calendar-outline" size={20} color="#00C870" />
                <Text className={`ml-3 ${selectedDate ? textColor : subtextColor}`}>
                  {selectedDate
                    ? selectedDate.toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : t('bookService.selectDate')}
                </Text>
              </View>
              <Ionicons
                name={showDatePicker ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={isDarkMode ? '#9CA3AF' : '#6B7280'}
              />
            </TouchableOpacity>
            {showDatePicker && (
              <DatePicker
                value={selectedDate ?? new Date()}
                minDate={new Date()}
                isDarkMode={isDarkMode}
                // Gray out weekdays the service isn't scheduled for. Only applied
                // when the service has any schedule, so services without working
                // hours configured still show a normal (if empty-slot) calendar.
                isDateEnabled={
                  scheduledDays.size > 0 ? (d) => scheduledDays.has(d.getDay()) : undefined
                }
                onChange={(date) => {
                  if (date) {
                    setSelectedDate(new Date(date));
                    setStartDateTime(null); // availability differs per day — re-pick a slot
                  }
                  setShowDatePicker(false);
                }}
                onClose={() => setShowDatePicker(false)}
              />
            )}
            {selectedDate && (
              <TimeSlotPicker
                slots={timeSlots}
                selectedSlotId={selectedSlotId}
                onSelectSlot={(slot) => setStartDateTime(slot.start)}
                isLoading={isLoadingSlots}
                isDarkMode={isDarkMode}
                textColor={textColor}
                subtextColor={subtextColor}
              />
            )}
          </View>

          {/* Step 4: Select Pet */}
          {pets.length > 0 ? (
            <PetSelector
              selectedPet={selectedPet}
              onSelectPet={setSelectedPet}
              pets={pets}
              isDarkMode={isDarkMode}
              textColor={textColor}
              subtextColor={subtextColor}
              cardBg={cardBg}
              borderColor={borderColor}
            />
          ) : (
            <View className={`border-t px-6 py-5 ${borderColor}`}>
              <View className="mb-3 flex-row items-center">
                {stepDot(false, 4)}
                <Text className={`text-base font-semibold ${textColor} ml-3`}>
                  {t('bookService.selectPet')}
                </Text>
              </View>
              <Text className={`text-sm ${subtextColor} mb-3`}>{t('bookService.noPetsYet')}</Text>
              <TouchableOpacity
                onPress={() => (navigation as any).navigate('AddPet')}
                className="flex-row items-center justify-center rounded-2xl bg-brand-500 py-3">
                <Ionicons name="add" size={20} color="white" />
                <Text className="ml-2 font-bold text-white">{t('bookService.addAPet')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Add This / Add Another Appointment */}
          {selectionComplete && (
            <View className="px-6 py-4">
              <TouchableOpacity
                onPress={addAppointment}
                className="flex-row items-center justify-center rounded-2xl bg-brand-500 py-4">
                <Ionicons name="add" size={20} color="white" />
                <Text className="ml-2 text-base font-bold text-white">
                  {appointments.length === 0
                    ? t('bookService.addThisAppointment')
                    : t('bookService.addAnotherAppointment')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Added Appointments */}
          {appointments.length > 0 && (
            <View className="px-6 py-5">
              <Text className={`text-base font-semibold ${textColor} mb-4`}>
                {t('bookService.addedAppointments', { count: appointments.length })}
              </Text>
              {appointments.map((apt) => (
                <View
                  key={apt.id}
                  className={`${cardBg} border ${borderColor} mb-3 rounded-2xl p-4`}>
                  <View className="flex-row items-start">
                    {apt.pet.image ? (
                      <Image
                        source={{ uri: apt.pet.image }}
                        className="mr-3 h-16 w-16 rounded-xl"
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        className={`mr-3 h-16 w-16 rounded-xl ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'} items-center justify-center`}>
                        <Ionicons name="paw" size={26} color="#9CA3AF" />
                      </View>
                    )}
                    <View className="flex-1">
                      <Text className={`text-base font-semibold ${textColor}`}>
                        {apt.service.name}{' '}
                        <Text className={`${subtextColor} font-normal`}>
                          {t('bookService.forPet', { name: apt.pet.name })}
                        </Text>
                      </Text>
                      <Text className={`text-sm ${subtextColor} mt-1`}>
                        {parseBookingDate(apt.bookingFrom).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        {t('bookService.at')}{' '}
                        {parseBookingDate(apt.bookingFrom).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })}
                      </Text>
                      {apt.pricingOptionName && (
                        <Text className={`text-xs ${subtextColor} mt-1`}>
                          {t('bookService.option', { name: apt.pricingOptionName })}
                        </Text>
                      )}
                      {apt.addons.length > 0 && (
                        <Text className={`text-xs ${subtextColor} mt-1`}>
                          + {apt.addons.map((a) => a.name).join(', ')}
                        </Text>
                      )}
                    </View>
                    <View className="ml-2 items-end">
                      <Text className="text-lg font-bold text-brand-600">${apt.total}</Text>
                      <TouchableOpacity onPress={() => removeAppointment(apt.id)} className="mt-2">
                        <Ionicons
                          name="close"
                          size={20}
                          color={isDarkMode ? '#9CA3AF' : '#6B7280'}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Booking Summary */}
          {appointments.length > 0 && (
            <BookingSummary
              appointments={appointments}
              grandTotal={grandTotal}
              isDarkMode={isDarkMode}
              textColor={textColor}
              subtextColor={subtextColor}
            />
          )}

          {/* Running total for the current (unadded) selection */}
          {appointments.length === 0 && selectedService && (
            <View
              className={`border-t px-6 py-5 ${borderColor} flex-row items-center justify-between`}>
              <Text className={`text-base font-semibold ${textColor}`}>
                {t('bookService.total')}
              </Text>
              <Text className="text-2xl font-bold text-brand-600">${currentTotal()}</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Fixed Bottom Button */}
      <View
        className={`absolute bottom-0 left-0 right-0 ${cardBg} border-t ${borderColor} px-6 py-4`}>
        <TouchableOpacity
          disabled={!canContinue}
          onPress={onContinue}
          className={`items-center rounded-2xl py-4 ${canContinue ? 'bg-brand-500' : 'bg-gray-300'}`}>
          <Text className="text-lg font-bold text-white">{t('bookService.continueToReview')}</Text>
        </TouchableOpacity>
      </View>

      {/* Map picker for pickup / drop-off location — mounted only when open so it
          centres on the user's current location each time (not a stale default). */}
      {pickerFor !== null && (
        <MapAddressPicker
          visible
          title={
            pickerFor === 'pickup'
              ? t('bookService.pickupLocation')
              : t('bookService.dropoffLocation')
          }
          initialRegion={{ latitude: location.latitude, longitude: location.longitude }}
          isDarkMode={isDarkMode}
          onClose={() => setPickerFor(null)}
          onSelect={(address) => {
            if (pickerFor === 'pickup') setPickupAddr(address);
            else setDropoffAddr(address);
          }}
        />
      )}
    </ScreenLayout>
  );
}
