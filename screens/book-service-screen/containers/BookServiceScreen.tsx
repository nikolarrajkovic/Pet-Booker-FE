import React, { useState, useEffect, useMemo } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useLocation } from '../../../hooks/useLocation';
import { useAuth } from '../../../context/AuthContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import DatePicker from '../../../components/shared/DatePicker';
import MapAddressPicker from '../../../components/shared/MapAddressPicker';
import { PetSelector, BookingSummary, TimeSlotPicker, TimeSlot } from '../components';
import { ServiceDto, getService } from '../../../services/services';
import { getPets, petTypeLabel } from '../../../services/pets';
import {
  resolveImageUrl,
  providerTypeLabel,
  AddressDto,
} from '../../../services/service-providers';
import {
  getBookings,
  parseBookingDate,
  formatBookingDate,
  BookingDto,
  BookingState,
} from '../../../services/bookings';
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
  // Required when the matching add-on is selected; sent inline on booking create.
  pickupAddress?: AddressDto;
  leaveOverAddress?: AddressDto;
};

// Bookable slots are 1h each, derived from the service's per-day working hours
// (service.schedules). A weekday with no schedule entry is not bookable.
const SLOT_DURATION_MS = 60 * 60 * 1000;

// "HH:mm:ss" (or "HH:mm") → minutes since midnight, rounded to the nearest
// minute. Rounding lets the 23:59:59 end-of-day sentinel (= 24:00) read back as
// 1440 so a window ending at midnight still yields its final 23:00–24:00 slot.
const hmsToMinutes = (t?: string | null): number => {
  if (!t) return 0;
  const [h, m, s] = t.split(':');
  const total =
    (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0) + (parseInt(s, 10) || 0) / 60;
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
  const {
    isDarkMode,
    cardBg,
    bgColor: contentBg,
    textColor,
    subtextColor,
    borderColor,
  } = useThemeColors();
  const location = useLocation();

  // The service is fixed for this screen — booking targets this one service.
  // It arrives from Home/Search list endpoints, which return a LEANER ServiceDto
  // without the working-hours `schedules` (and without full `details`). We
  // re-fetch the full service by id on mount (below) so the time-slot picker is
  // built from the provider's real work times for this service.
  const [selectedService, setSelectedService] = useState<ServiceDto>(service);
  const serviceProviderId = selectedService.serviceProviderId;
  const serviceImage = resolveImageUrl(
    selectedService.imageUrl ??
      (selectedService.photos?.find((p) => p.isSelected) ?? selectedService.photos?.[0])?.src
  );
  const serviceTypeLabel =
    selectedService.basicServiceName ??
    (selectedService.type != null ? providerTypeLabel(selectedService.type) : '');

  const [pets, setPets] = useState<{ id: number; name: string; breed: string; image: string }[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);

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

  // Provider's existing bookings for the selected date — drives slot availability
  const [dayBookings, setDayBookings] = useState<BookingDto[]>([]);
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
            breed: p.breed || petTypeLabel(p.type),
            image: p.photoUrl ? resolveImageUrl(p.photoUrl) : resolveImageUrl(p.photos?.[0]?.src),
          }))
        );
      } catch (e) {
        console.warn('[BookServiceScreen] load failed', e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, service.id]);

  // Fetch the provider's bookings for the chosen day (no availability endpoint
  // exists — availability is computed client-side from real bookings).
  useEffect(() => {
    if (!selectedDate) {
      setDayBookings([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoadingSlots(true);
      try {
        const dayStart = new Date(selectedDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const booked = await getBookings({
          serviceProviderId,
          // Naive local-day bounds (booking times are naive wall-clock — see
          // parseBookingDate), so the day filter matches what's stored.
          bookingFrom: formatBookingDate(dayStart),
          bookingTo: formatBookingDate(dayEnd),
        });
        if (!cancelled) setDayBookings(booked);
      } catch (e) {
        if (!cancelled) {
          console.warn('[BookServiceScreen] availability load failed', e);
          setDayBookings([]); // fail open: show slots rather than block booking
        }
      } finally {
        if (!cancelled) setIsLoadingSlots(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, serviceProviderId]);

  // Weekdays the service has working hours for (from its schedules). JS getDay()
  // (0=Sun…6=Sat) matches the schedule's .NET DayOfWeek numbering. Used to gate
  // both the calendar and slot generation.
  const scheduledDays = useMemo(
    () => new Set((selectedService?.schedules ?? []).map((s) => s.day)),
    [selectedService]
  );

  // Build hourly slots for the selected date from the service's working-hours
  // window(s) for that weekday. A weekday with no schedule yields no slots (not
  // bookable). A slot is unavailable when the overlapping non-cancelled bookings
  // (server) plus appointments added this session reach capacity, or it's past.
  const timeSlots: TimeSlot[] = useMemo(() => {
    if (!selectedDate) return [];
    const dayOfWeek = selectedDate.getDay();
    const windows = (selectedService?.schedules ?? []).filter((s) => s.day === dayOfWeek);
    if (windows.length === 0) return []; // day not scheduled → unavailable
    const maxConcurrent = selectedService?.details?.maxConcurrentBookings ?? 1;
    const now = Date.now();
    const slotMinutes = SLOT_DURATION_MS / 60000;
    const byId = new Map<string, TimeSlot>();
    for (const w of windows) {
      const fromMin = hmsToMinutes(w.from);
      const toMin = hmsToMinutes(w.to);
      // Only whole 1h slots that fit inside the window [from, to).
      for (let m = fromMin; m + slotMinutes <= toMin; m += slotMinutes) {
        const hour = Math.floor(m / 60);
        const minute = m % 60;
        const id = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        if (byId.has(id)) continue; // overlapping windows → keep one slot per start
        const start = new Date(selectedDate);
        start.setHours(hour, minute, 0, 0);
        const end = start.getTime() + SLOT_DURATION_MS;
        const taken =
          dayBookings.filter(
            (b) =>
              b.state !== BookingState.Cancelled &&
              overlaps(
                parseBookingDate(b.bookingFrom).getTime(),
                parseBookingDate(b.bookingTo).getTime(),
                start.getTime(),
                end
              )
          ).length +
          appointments.filter((a) =>
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
          available: start.getTime() > now && taken < maxConcurrent,
        });
      }
    }
    return Array.from(byId.values()).sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [selectedDate, dayBookings, appointments, selectedService]);

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

  const currentTotal = () => {
    const addons = selectedAddons.reduce((sum, id) => {
      const def = serviceAddons.find((a) => a.id === id);
      return sum + (def?.price ?? 0);
    }, 0);
    return servicePrice(selectedService) + addons;
  };

  const selectionComplete = !!startDateTime && selectedPet !== null && addressesProvided;

  const buildAppointment = (): Appointment | null => {
    if (!startDateTime || selectedPet === null || !addressesProvided) return null;
    const pet = pets.find((p) => p.id === selectedPet);
    return {
      id: Date.now(),
      service: {
        id: selectedService.id ?? 0,
        name: selectedService.name ?? 'Service',
        price: servicePrice(selectedService),
      },
      pet: { id: selectedPet, name: pet?.name ?? 'Pet', image: pet?.image ?? '' },
      addons: selectedAddons.flatMap((id) => {
        const def = serviceAddons.find((a) => a.id === id);
        return def ? [{ name: def.name, price: def.price }] : [];
      }),
      // Naive local wall-clock (no offset) so the booking round-trips to the same
      // time the user picked under parseBookingDate (see services/bookings.ts).
      bookingFrom: formatBookingDate(startDateTime),
      bookingTo: formatBookingDate(new Date(startDateTime.getTime() + 60 * 60 * 1000)), // +1h default
      total: currentTotal(),
      pickupAddress: pickupSelected ? (pickupAddr ?? undefined) : undefined,
      leaveOverAddress: dropoffSelected ? (dropoffAddr ?? undefined) : undefined,
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
          <Text className="text-xl font-bold text-white">Book Service</Text>
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
          {/* Step 1: Service (fixed — chosen before entering this screen) */}
          <View className="px-6 py-5">
            <View className="mb-4 flex-row items-center">
              {stepDot(true, 1)}
              <Text className={`text-base font-semibold ${textColor} ml-3`}>Service</Text>
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
                  ${servicePrice(selectedService)}
                </Text>
              </View>
            </View>
          </View>

          {/* Step 2: Additional Services */}
          <View className={`border-t px-6 py-5 ${borderColor}`}>
            <View className="mb-4 flex-row items-center">
              {stepDot(selectedAddons.length > 0, 2)}
              <Text className={`text-base font-semibold ${textColor} ml-3`}>
                Additional Services
              </Text>
              <Text className={`text-sm ${subtextColor} ml-2`}>Optional</Text>
            </View>
            {serviceAddons.length === 0 ? (
              <Text className={`text-sm ${subtextColor}`}>
                This service doesn&apos;t offer any additional services.
              </Text>
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
                      <Text className={`text-base font-semibold ${textColor}`}>{addon.name}</Text>
                      <Text className={`text-sm ${subtextColor} mt-1`}>{addon.description}</Text>
                    </View>
                    <Text className="ml-4 text-lg font-bold text-brand-600">${addon.price}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}

            {/* Location required when Pickup / Drop-off is selected — picked on a map */}
            {pickupSelected && (
              <View className="mb-3 mt-1">
                <Text className={`text-sm font-semibold ${textColor} mb-2`}>Pickup Address *</Text>
                <TouchableOpacity
                  onPress={() => setPickerFor('pickup')}
                  className={`rounded-2xl border px-4 py-3 ${borderColor} ${cardBg} flex-row items-center`}>
                  <Ionicons name="location-outline" size={20} color="#00C870" />
                  <Text
                    className={`ml-3 flex-1 ${pickupAddr ? textColor : subtextColor}`}
                    numberOfLines={2}>
                    {pickupAddr ? addressLabel(pickupAddr) : 'Pick location on map'}
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
                      Same as drop-off address
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
            {dropoffSelected && (
              <View className="mb-1 mt-1">
                <Text className={`text-sm font-semibold ${textColor} mb-2`}>
                  Drop-off Address *
                </Text>
                <TouchableOpacity
                  onPress={() => setPickerFor('dropoff')}
                  className={`rounded-2xl border px-4 py-3 ${borderColor} ${cardBg} flex-row items-center`}>
                  <Ionicons name="location-outline" size={20} color="#00C870" />
                  <Text
                    className={`ml-3 flex-1 ${dropoffAddr ? textColor : subtextColor}`}
                    numberOfLines={2}>
                    {dropoffAddr ? addressLabel(dropoffAddr) : 'Pick location on map'}
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
                      Same as pickup address
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
                Choose Date & Time
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
                    : 'Select date'}
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
                <Text className={`text-base font-semibold ${textColor} ml-3`}>Select Pet</Text>
              </View>
              <Text className={`text-sm ${subtextColor} mb-3`}>
                You don&apos;t have any pets yet.
              </Text>
              <TouchableOpacity
                onPress={() => (navigation as any).navigate('AddPet')}
                className="flex-row items-center justify-center rounded-2xl bg-brand-500 py-3">
                <Ionicons name="add" size={20} color="white" />
                <Text className="ml-2 font-bold text-white">Add a Pet</Text>
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
                  {appointments.length === 0 ? 'Add This Appointment' : 'Add Another Appointment'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Added Appointments */}
          {appointments.length > 0 && (
            <View className="px-6 py-5">
              <Text className={`text-base font-semibold ${textColor} mb-4`}>
                Added Appointments ({appointments.length})
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
                        <Text className={`${subtextColor} font-normal`}>for {apt.pet.name}</Text>
                      </Text>
                      <Text className={`text-sm ${subtextColor} mt-1`}>
                        {parseBookingDate(apt.bookingFrom).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        at{' '}
                        {parseBookingDate(apt.bookingFrom).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })}
                      </Text>
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
              <Text className={`text-base font-semibold ${textColor}`}>Total</Text>
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
          <Text className="text-lg font-bold text-white">Continue to Review</Text>
        </TouchableOpacity>
      </View>

      {/* Map picker for pickup / drop-off location — mounted only when open so it
          centres on the user's current location each time (not a stale default). */}
      {pickerFor !== null && (
        <MapAddressPicker
          visible
          title={pickerFor === 'pickup' ? 'Pickup location' : 'Drop-off location'}
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
