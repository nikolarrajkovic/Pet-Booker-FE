import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useCurrency } from '../../../hooks/useCurrency';
import { useLocation } from '../../../hooks/useLocation';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLocale } from '../../../context/LocaleContext';
import { DAY_SHORT_KEYS, MONTH_KEYS, MONTH_SHORT_KEYS } from '../../../i18n';
import { durationDisplayLabel } from '../../my-services-screen/serviceModel';
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
  serviceCurrency,
} from '../../../services/services';
import { getPets, PetResponse } from '../../../services/pets';
import { resolveImageUrl, AddressDto } from '../../../services/service-providers';
import {
  parseBookingDate,
  formatBookingDate,
  type BookingAdditionalServiceReadDto,
} from '../../../services/bookings';
import {
  getEnabledServiceAddons,
  addonPriceLabel,
  isPerDistance,
  requiredAddresses,
  requiredAddressesFor,
  toBookingSelection,
  type AdditionalServiceDto,
} from '../../../services/service-addons';
import { addressLabel } from '../../../services/geocoding';
import { getBookingQuote, type BookingQuote } from '../../../services/booking-quote';

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
  // The extras as the SERVER priced them: name, amount, and for a per-distance extra the fees and
  // that leg's distance behind the number — everything Review needs to itemize the charge without
  // recomputing anything.
  addons: BookingAdditionalServiceReadDto[];
  // The ids the booking create will send (the quote priced exactly these).
  addonIds: number[];
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
  // Required when a selected extra needs that side; sent inline on booking create.
  pickupAddress?: AddressDto;
  leaveOverAddress?: AddressDto;
  // The distances the server measured for each leg when it priced this selection. Display only —
  // the create re-measures from the addresses above rather than trusting a client value.
  pickupDistanceKm?: number | null;
  leaveOverDistanceKm?: number | null;
};

// Bookable slots are derived from the day's availability windows
// (GET /api/services/{id}/availability). A date with no windows is not
// bookable. Slot length: the chosen pricing option's duration when the service
// defines options, else this 1h default (classic free-range services).
const SLOT_DURATION_MS = 60 * 60 * 1000;

// Local date-only key, "YYYY-MM-DD" — how the availability endpoint takes its from/to params and
// how its `days[]` come back. Built from the local calendar fields rather than toISOString(),
// which would shift the date across midnight for anyone east or west of UTC.
const dateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** "YYYY-MM" — the cache key for one fetched month of availability. */
const monthKeyOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

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

/**
 * Round to at most 2 decimals (trims per-km float artifacts). This is the NUMERIC value
 * carried on an appointment and handed to ReviewBooking — for anything rendered on screen
 * use `fmt` below, which adds the currency on its conventional side.
 */
const money = (n: number) => Math.round(n * 100) / 100;

/** The current server quote for the in-progress selection, plus its request state. */
type QuoteState = { quote: BookingQuote | null; loading: boolean; failed: boolean };

// The client measures nothing. It used to geocode the service address and route to the picked
// pickup/drop-off point with Google Directions, then apply its own copy of the surcharge formula.
// That produced a different price on native (no Directions → straight-line distance) than on web,
// from a number the client chose. Both legs are now measured server-side and reach this screen
// only inside a quote — see useBookingQuote below.

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

  // Selected extras by their real AdditionalService id (they were catalog string ids before).
  const [selectedAddons, setSelectedAddons] = useState<number[]>([]);
  // Pickup / Drop-off addresses are picked on a map (reverse-geocoded to AddressDto).
  const [pickupAddr, setPickupAddr] = useState<AddressDto | null>(null);
  const [dropoffAddr, setDropoffAddr] = useState<AddressDto | null>(null);
  const [pickerFor, setPickerFor] = useState<'pickup' | 'dropoff' | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null); // date only (slot picks the time)
  const [startDateTime, setStartDateTime] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedPet, setSelectedPet] = useState<number | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // Server-derived bookable windows (with remaining capacity), keyed by "YYYY-MM-DD".
  //
  // Fetched a MONTH at a time rather than a day at a time. The endpoint accepts a range of up to
  // 31 days, so a whole calendar month is one request — where picking through a month used to cost
  // one request per tap. It also means the calendar can grey out days that are genuinely
  // unbookable (see `bookableDates`) instead of making the user discover them one tap at a time.
  const [availByDate, setAvailByDate] = useState<Record<string, AvailabilityWindowDto[]>>({});
  const [loadedMonths, setLoadedMonths] = useState<Record<string, true>>({});
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  const petToListItem = useCallback(
    (p: PetResponse) => ({
      id: Number(p.id),
      name: p.name,
      breed: p.breed || tEnum('petSpeciesType', p.type),
      image: p.photoUrl ? resolveImageUrl(p.photoUrl) : resolveImageUrl(p.photos?.[0]?.src),
    }),
    [tEnum]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        // This screen needs the service's working-hours `schedules` and its `details`. Every
        // screen that navigates here now hands over a read DTO that already carries both —
        // ServiceDetail passes the service it just fetched, and the service list and Home rails
        // both embed them — so re-fetching by id would be asking for a payload we already hold.
        // The fetch is kept as a fallback for a caller that passes a leaner shape; it fails soft,
        // in which case the DTO we were navigated with stands.
        const needsFullService =
          service.id != null && (service.schedules == null || service.details == null);
        const [petList, fullService] = await Promise.all([
          currentUser?.id ? getPets(currentUser.id) : Promise.resolve([]),
          needsFullService ? getService(service.id!).catch(() => null) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        if (fullService) setSelectedService(fullService);
        setPets(petList.map(petToListItem));
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

  // This screen stays mounted while AddPet is pushed on top of it, so a pet
  // created mid-booking isn't picked up by the mount fetch above. Refresh the
  // pet list on every refocus (skipping the initial one) and auto-select the
  // newest pet when none is selected yet.
  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      if (!currentUser?.id) return;
      let cancelled = false;
      (async () => {
        try {
          const petList = await getPets(currentUser.id);
          if (cancelled) return;
          const mapped = petList.map(petToListItem);
          setPets(mapped);
          setSelectedPet((prev) => prev ?? (mapped.length ? mapped[mapped.length - 1].id : null));
        } catch (e) {
          if (!cancelled) showError(getErrorMessage(e, t('bookService.petsLoadError')));
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [currentUser?.id, petToListItem])
  );

  // Fetch the availability for the whole month a date belongs to, once. This is the ONLY source
  // of slot availability — the server already factors in the provider's bookings (per-window
  // remainingCapacity), so we never query the bookings API here.
  //
  // The month the user is most likely to pick from is loaded up front so the calendar opens with
  // its unbookable days already greyed out, rather than looking uniformly available until tapped.
  const monthToLoad = useMemo(() => monthKeyOf(selectedDate ?? new Date()), [selectedDate]);

  useEffect(() => {
    if (serviceId == null || loadedMonths[monthToLoad]) return;

    let cancelled = false;
    (async () => {
      setIsLoadingSlots(true);
      try {
        const [year, month] = monthToLoad.split('-').map(Number);
        const first = new Date(year, month - 1, 1);
        const last = new Date(year, month, 0); // day 0 of the next month = last of this one
        // Date-only keys ("YYYY-MM-DD", local). A calendar month is at most 31 days, which is
        // exactly the range cap the endpoint enforces.
        const availability = await getServiceAvailability(serviceId, dateKey(first), dateKey(last));
        if (cancelled) return;
        const byDate: Record<string, AvailabilityWindowDto[]> = {};
        for (const day of availability?.days ?? []) {
          // `date` comes back date-only, but slice defensively in case it ever carries a time.
          byDate[String(day.date).slice(0, 10)] = day.windows ?? [];
        }
        setAvailByDate((prev) => ({ ...prev, ...byDate }));
        setLoadedMonths((prev) => ({ ...prev, [monthToLoad]: true }));
      } catch (e) {
        if (!cancelled) showError(getErrorMessage(e, t('bookService.slotsLoadError')));
      } finally {
        if (!cancelled) setIsLoadingSlots(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serviceId, monthToLoad, loadedMonths]);

  // Re-fetch from scratch if the service changes underneath us.
  useEffect(() => {
    setAvailByDate({});
    setLoadedMonths({});
  }, [serviceId]);

  const availWindows = useMemo(
    () => (selectedDate ? (availByDate[dateKey(selectedDate)] ?? []) : []),
    [selectedDate, availByDate]
  );

  // Which dates the calendar should let the user pick.
  //
  // Prefers real availability — a day the server reported no windows for is not bookable, whether
  // that is because the provider doesn't work that weekday or because the day is fully booked.
  // Until the month has loaded, fall back to the service's weekly schedule pattern (JS getDay(),
  // 0=Sun…6=Sat, matches the schedule's .NET DayOfWeek) so the calendar isn't briefly wide open.
  const scheduledDays = useMemo(
    () => new Set((selectedService?.schedules ?? []).map((s) => s.day)),
    [selectedService]
  );

  const isDateBookable = useCallback(
    (d: Date) => {
      const key = dateKey(d);
      if (loadedMonths[monthKeyOf(d)]) return (availByDate[key]?.length ?? 0) > 0;
      return scheduledDays.size === 0 || scheduledDays.has(d.getDay());
    },
    [availByDate, loadedMonths, scheduledDays]
  );

  // A service with no working hours at all is unbookable outright. Saying so once is far kinder
  // than letting the booker tap through a calendar where every day reports "not available".
  const hasNoWorkingHours =
    selectedService != null && (selectedService.schedules?.length ?? 0) === 0;

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

  const toggleAddon = (id: number) =>
    setSelectedAddons((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));

  const selectedAddonDefs = useMemo(
    () => serviceAddons.filter((a) => a.id != null && selectedAddons.includes(a.id)),
    [serviceAddons, selectedAddons]
  );

  // Which address pickers the selection needs, derived from each extra's declared journey
  // (DistanceLeg) rather than from hardcoded add-on names: a pickup extra needs a collection
  // address, a drop-off extra a return address, a round-trip one both.
  const { pickup: pickupSelected, dropoff: dropoffSelected } = useMemo(
    () => requiredAddressesFor(selectedAddonDefs),
    [selectedAddonDefs]
  );
  const addressesProvided =
    (!pickupSelected || !!pickupAddr) && (!dropoffSelected || !!dropoffAddr);

  // Several extras can involve the same journey (and a round-trip one involves both), so the
  // price check under an address lists every selected extra that leg serves.
  const addonsOnPickupLeg = useMemo(
    () => selectedAddonDefs.filter((a) => requiredAddresses(a).pickup),
    [selectedAddonDefs]
  );
  const addonsOnDropoffLeg = useMemo(
    () => selectedAddonDefs.filter((a) => requiredAddresses(a).dropoff),
    [selectedAddonDefs]
  );

  // --- Server-priced quote --------------------------------------------------
  // Every amount on this screen comes from POST /api/bookings/quote — the same server code that
  // will charge the booking measures each trip leg and applies the surcharge formula. The preview
  // therefore cannot drift from the bill, and it's identical on web and native.
  const [quoteState, setQuoteState] = useState<QuoteState>({
    quote: null,
    loading: false,
    failed: false,
  });

  // Per-selection service price: the chosen option's (discounted) price when the service defines
  // options, else the classic effective service price. Only a starting point for the quote body —
  // the server recomputes base/discount itself when a promotion or option applies.
  const currentServicePrice = () =>
    selectedOption
      ? effectiveOptionPrice(selectedService, selectedOption)
      : servicePrice(selectedService);

  // The body the quote (and later the create) is built from. Serialized into the effect's dep so
  // the quote re-runs exactly when something price-relevant changes — not on every render.
  const quoteRequest = useMemo(() => {
    if (!optionChosen || !startDateTime || selectedPet === null || !addressesProvided) return null;
    return {
      userId: currentUser?.id ?? 0,
      serviceProviderId: selectedService.serviceProviderId,
      serviceId: selectedService.id ?? 0,
      petId: selectedPet,
      bookingFrom: formatBookingDate(startDateTime),
      bookingTo: formatBookingDate(new Date(startDateTime.getTime() + slotMs)),
      basePrice: currentServicePrice(),
      discountAmount: 0,
      pricingOptionId: selectedOption?.id ?? null,
      additionalServices: toBookingSelection(selectedAddonDefs),
      // Addresses only — never a distance. The server measures each leg from these; sending a
      // client-measured value would override the measurement that sets the price.
      location:
        pickupSelected || dropoffSelected
          ? {
              pickupAddress: pickupSelected ? (pickupAddr ?? undefined) : undefined,
              leaveOverAddress: dropoffSelected ? (dropoffAddr ?? undefined) : undefined,
            }
          : undefined,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    optionChosen,
    startDateTime,
    selectedPet,
    addressesProvided,
    pickupSelected,
    dropoffSelected,
    pickupAddr,
    dropoffAddr,
    selectedAddonDefs,
    selectedOption,
    selectedService,
    slotMs,
    currentUser?.id,
  ]);

  const quoteKey = quoteRequest ? JSON.stringify(quoteRequest) : null;

  useEffect(() => {
    if (!quoteKey || !quoteRequest) {
      setQuoteState({ quote: null, loading: false, failed: false });
      return;
    }
    let cancelled = false;
    setQuoteState((prev) => ({ ...prev, loading: true, failed: false }));
    getBookingQuote(quoteRequest as any)
      .then((quote) => {
        if (!cancelled) setQuoteState({ quote, loading: false, failed: false });
      })
      .catch(() => {
        // A failed quote must not silently show a stale or guessed price — the UI blocks
        // continuing instead (see selectionComplete).
        if (!cancelled) setQuoteState({ quote: null, loading: false, failed: true });
      });
    return () => {
      cancelled = true;
    };
    // quoteKey is the value-identity of quoteRequest; depending on the object would refire
    // whenever it's rebuilt with equal contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey]);

  const quote = quoteState.quote;

  // What the amounts on this screen are denominated in. The quote is authoritative once it lands
  // (it is the server's own pricing, already converted to the caller's display currency); until
  // then the service DTO's own stamp is the best available. Never assume a symbol.
  const displayCurrency = quote?.priceCurrency ?? serviceCurrency(selectedService);
  const { money: fmt } = useCurrency(displayCurrency);

  /** The server's charge for one selected extra, or null until the quote lands. */
  const quotedAddonLine = (addon: AdditionalServiceDto): BookingAdditionalServiceReadDto | null =>
    quote?.additionalServices.find((l) => l.additionalServiceId === addon.id) ?? null;

  const km1 = (km: number) => (Math.round(km * 10) / 10).toFixed(1);

  /**
   * The "price check" line under a per-distance extra's address: the leg the server measured and
   * what it charged. Only meaningful once the quote has landed — before that the amount is
   * genuinely unknown, so it says so rather than showing a placeholder.
   */
  const renderDistanceEstimate = (addon: AdditionalServiceDto | undefined) => {
    if (!addon || !isPerDistance(addon)) return null;

    if (quoteState.loading) {
      return (
        <View className="mt-2 flex-row items-center">
          <ActivityIndicator size="small" color={BRAND_GREEN} />
          <Text className={`text-xs ${subtextColor} ml-2`}>
            {t('bookService.distanceEstimating')}
          </Text>
        </View>
      );
    }
    if (quoteState.failed) {
      return <Text className={`text-xs ${subtextColor} mt-2`}>{t('bookService.quoteFailed')}</Text>;
    }

    const line = quotedAddonLine(addon);
    if (!line) return null;
    // No measurable distance (address without resolvable coordinates) → only the base fee applies.
    if (line.distanceKm == null || line.distanceKm <= 0) {
      return (
        <Text className={`text-xs ${subtextColor} mt-2`}>
          {t('bookService.distanceUnavailable')}
        </Text>
      );
    }
    return (
      <Text className="mt-2 text-xs font-medium text-brand-600">
        {t('bookService.distanceSurcharge', {
          km: km1(line.distanceKm),
          price: fmt(line.price),
        })}
      </Text>
    );
  };

  // Total for the in-progress selection: the server quote when it has landed, else the service
  // price alone (extras are simply not counted yet — never estimated).
  const currentTotal = () => money(quote ? quote.totalPrice : currentServicePrice());

  // A quote is part of "ready": without it the extras have no price, so continuing would show the
  // user one number and charge another.
  const selectionComplete =
    optionChosen &&
    !!startDateTime &&
    selectedPet !== null &&
    addressesProvided &&
    !quoteState.loading &&
    !quoteState.failed &&
    (selectedAddonDefs.length === 0 || quote != null);

  const buildAppointment = (): Appointment | null => {
    if (!optionChosen || !startDateTime || selectedPet === null || !addressesProvided) return null;
    const pet = pets.find((p) => p.id === selectedPet);
    return {
      id: Date.now(),
      service: {
        id: selectedService.id ?? 0,
        name: selectedService.name ?? 'Service',
        price: money(quote ? quote.basePrice - quote.discountAmount : currentServicePrice()),
      },
      pet: { id: selectedPet, name: pet?.name ?? 'Pet', image: pet?.image ?? '' },
      // Freeze the SERVER's priced lines. Each already carries the name, the amount, and (for a
      // per-distance extra) the fees and that leg's distance — so Review itemizes the charge
      // without recomputing it, and what is shown is what will be billed.
      addons: quote?.additionalServices ?? [],
      addonIds: selectedAddonDefs.map((a) => a.id as number),
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
      pickupDistanceKm: quote?.pickupDistanceKm ?? null,
      leaveOverDistanceKm: quote?.leaveOverDistanceKm ?? null,
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
          <ActivityIndicator size="large" color={BRAND_GREEN} />
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
                      ? fmt(effectiveOptionPrice(selectedService, selectedOption))
                      : `${t('bookService.priceFrom')} ${fmt(
                          Math.min(
                            ...pricingOptions.map((o) => effectiveOptionPrice(selectedService, o))
                          )
                        )}`
                    : fmt(servicePrice(selectedService))}
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
                            {durationDisplayLabel(t, option.name)}
                          </Text>
                          <Text className={`text-sm ${subtextColor} mt-1`}>
                            {t('durations.nMin', { n: option.durationMinutes })}
                            {option.description ? ` • ${option.description}` : ''}
                          </Text>
                        </View>
                        <View className="ml-4 items-end">
                          {effective < option.price && (
                            <Text className={`text-xs ${subtextColor} line-through`}>
                              {fmt(option.price)}
                            </Text>
                          )}
                          <Text className="text-lg font-bold text-brand-600">{fmt(effective)}</Text>
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
              serviceAddons.map((addon) => {
                const selected = addon.id != null && selectedAddons.includes(addon.id);
                // Once selected, show what the server actually quoted for it; before that (or for
                // an unselected extra) show the provider's rate card, e.g. "$5 + $2/km".
                const line = selected ? quotedAddonLine(addon) : null;
                return (
                  <TouchableOpacity
                    key={addon.id ?? addon.name}
                    onPress={() => addon.id != null && toggleAddon(addon.id)}
                    className={`mb-3 rounded-2xl border-2 p-4 ${
                      selected
                        ? `border-brand-500 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'}`
                        : `${borderColor} ${cardBg}`
                    }`}>
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        {/* Provider-authored name/description — shown verbatim. */}
                        <Text className={`text-base font-semibold ${textColor}`}>{addon.name}</Text>
                        {addon.description ? (
                          <Text className={`text-sm ${subtextColor} mt-1`}>
                            {addon.description}
                          </Text>
                        ) : null}
                      </View>
                      <Text className="ml-4 text-lg font-bold text-brand-600">
                        {line
                          ? fmt(line.price)
                          : (addonPriceLabel(t, addon, displayCurrency) ?? t('addons.included'))}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
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
                  <Ionicons name="location-outline" size={20} color={BRAND_GREEN} />
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
                {/* Price check: measured distance + estimated per-km surcharge. */}
                {pickupAddr
                  ? addonsOnPickupLeg.map((a) => (
                      <View key={a.id ?? a.name}>{renderDistanceEstimate(a)}</View>
                    ))
                  : null}
                {/* Copy the drop-off address into pickup (explicit, not auto-filled). */}
                {dropoffSelected && dropoffAddr && pickupAddr !== dropoffAddr ? (
                  <TouchableOpacity
                    onPress={() => setPickupAddr(dropoffAddr)}
                    className="mt-2 flex-row items-center self-start">
                    <Ionicons name="copy-outline" size={14} color={BRAND_GREEN} />
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
                  <Ionicons name="location-outline" size={20} color={BRAND_GREEN} />
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
                {/* Price check: measured distance + estimated per-km surcharge. */}
                {dropoffAddr
                  ? addonsOnDropoffLeg.map((a) => (
                      <View key={a.id ?? a.name}>{renderDistanceEstimate(a)}</View>
                    ))
                  : null}
                {/* Copy the pickup address into drop-off (explicit, not auto-filled). */}
                {pickupSelected && pickupAddr && dropoffAddr !== pickupAddr ? (
                  <TouchableOpacity
                    onPress={() => setDropoffAddr(pickupAddr)}
                    className="mt-2 flex-row items-center self-start">
                    <Ionicons name="copy-outline" size={14} color={BRAND_GREEN} />
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
            {/* A service with no working hours at all can never be booked. Say so once, here,
                instead of opening a calendar in which every single day reports "not available". */}
            {hasNoWorkingHours ? (
              <View className={`mb-3 rounded-2xl border p-4 ${borderColor} ${cardBg}`}>
                <View className="flex-row items-center">
                  <Ionicons name="information-circle-outline" size={20} color="#F59E0B" />
                  <Text className={`ml-3 flex-1 ${subtextColor}`}>
                    {t('bookService.noWorkingHours')}
                  </Text>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowDatePicker((v) => !v)}
                className={`mb-3 rounded-2xl border p-4 ${borderColor} ${cardBg} flex-row items-center justify-between`}>
                <View className="flex-row items-center">
                  <Ionicons name="calendar-outline" size={20} color={BRAND_GREEN} />
                  <Text className={`ml-3 ${selectedDate ? textColor : subtextColor}`}>
                    {selectedDate
                      ? `${t(DAY_SHORT_KEYS[selectedDate.getDay()])}, ${t(MONTH_KEYS[selectedDate.getMonth()])} ${selectedDate.getDate()}, ${selectedDate.getFullYear()}`
                      : t('bookService.selectDate')}
                  </Text>
                </View>
                <Ionicons
                  name={showDatePicker ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={isDarkMode ? '#9CA3AF' : '#6B7280'}
                />
              </TouchableOpacity>
            )}
            {showDatePicker && (
              <DatePicker
                value={selectedDate ?? new Date()}
                minDate={new Date()}
                isDarkMode={isDarkMode}
                // Grey out days that are genuinely unbookable — no schedule window, or fully
                // booked — using the month of availability already fetched, falling back to the
                // weekly schedule pattern until it lands.
                isDateEnabled={isDateBookable}
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
                onPress={() => (navigation as any).navigate('AddPet', { goBackOnSave: true })}
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
                        {(() => {
                          const d = parseBookingDate(apt.bookingFrom);
                          return `${t(DAY_SHORT_KEYS[d.getDay()])}, ${t(MONTH_SHORT_KEYS[d.getMonth()])} ${d.getDate()}`;
                        })()}{' '}
                        {t('bookService.at')}{' '}
                        {parseBookingDate(apt.bookingFrom).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })}
                      </Text>
                      {apt.pricingOptionName && (
                        <Text className={`text-xs ${subtextColor} mt-1`}>
                          {t('bookService.option', {
                            name: durationDisplayLabel(t, apt.pricingOptionName),
                          })}
                        </Text>
                      )}
                      {apt.addons.length > 0 && (
                        <Text className={`text-xs ${subtextColor} mt-1`}>
                          + {apt.addons.map((a) => a.name).join(', ')}
                        </Text>
                      )}
                    </View>
                    <View className="ml-2 items-end">
                      <Text className="text-lg font-bold text-brand-600">{fmt(apt.total)}</Text>
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
              currency={displayCurrency}
            />
          )}

          {/* Running total for the current (unadded) selection */}
          {appointments.length === 0 && selectedService && (
            <View
              className={`border-t px-6 py-5 ${borderColor} flex-row items-center justify-between`}>
              <Text className={`text-base font-semibold ${textColor}`}>
                {t('bookService.total')}
              </Text>
              <Text className="text-2xl font-bold text-brand-600">{fmt(currentTotal())}</Text>
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
