import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import FormCard from '../../../components/shared/FormCard';
import TwoColumn from '../../../components/shared/TwoColumn';
import DatePicker from '../../../components/shared/DatePicker';
import TimePicker from '../../../components/shared/TimePicker';
import ResponsiveModal from '../../../components/shared/ResponsiveModal';
import MapAddressPicker from '../../../components/shared/MapAddressPicker';
import ListState from '../../../components/shared/ListState';
import LoadMoreFooter, { isNearBottom } from '../../../components/shared/LoadMoreFooter';
import FilterModal from '../../../components/FilterModal';
import {
  EMPTY_FILTERS,
  activeFilterCount,
  type FilterState,
} from '../../../components/shared/SearchFilters';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useResponsive } from '../../../hooks/useResponsive';
import { usePageGutter } from '../../../hooks/usePageGutter';
import { useLocation } from '../../../hooks/useLocation';
import { useCurrency } from '../../../hooks/useCurrency';
import { usePagedList } from '../../../hooks/usePagedList';
import { useNearBottomLoader } from '../../../hooks/useNearBottomLoader';
import { useAppNavigation } from '../../../hooks/useAppNavigation';
import { useFormChain } from '../../../hooks/useFormChain';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useAuth } from '../../../context/AuthContext';
import { useEnums } from '../../../context/EnumsContext';
import { useLocale } from '../../../context/LocaleContext';
import { useToast } from '../../../context/ToastContext';
import { getErrorMessage, type PagedResult } from '../../../services/http';
import { getPets, type PetResponse } from '../../../services/pets';
import { getUser } from '../../../services/users';
import { createAddress } from '../../../services/addresses';
import { addressLabel, reverseGeocodeToAddress, type GeoPoint } from '../../../services/geocoding';
import { ensurePaymentMethodId } from '../../../services/payment-methods';
import { formatBookingDate, PaymentType } from '../../../services/bookings';
import {
  getServices,
  getServicesPage,
  serviceFromPrice,
  ServiceSortBy,
  type GetServicesParams,
  type ServiceDto,
} from '../../../services/services';
import {
  resolveImageUrl,
  ServiceProviderType,
  type AddressDto,
} from '../../../services/service-providers';
import {
  createGroupBookingRequest,
  GroupBookingAudience,
} from '../../../services/group-booking-requests';
import { MapViewComponent } from '../../search-screen/components';
import type { ServiceSearchItem } from '../../search-screen/components/ListView';
import ProviderPickRow from '../components/ProviderPickRow';
import { formatDateWindow } from '../groupRequestFormat';
import { formatWeekdayDayMonth } from '../../../i18n/dates';

/**
 * What a caller (Search, Home) hands over: the browse filters it had applied, so "send to every
 * matching provider" means the providers the user was just looking at.
 */
export type CreateGroupRequestParams = {
  serviceType?: number;
  filters?: FilterState;
  /** Whether the price slider had been moved — an untouched slider is no price bound. */
  priceTouched?: boolean;
};

const PAGE_SIZE = 20;
const DEFAULT_MAX_PRICE = 200;
const NOTE_LIMIT = 1000;

type WhereChoice = 'none' | 'account' | 'current' | 'map';

/**
 * Service types that come to the pet: a walker, a sitter or a transporter starts at the owner's,
 * so the owner's own place is the natural default for "Where". Boarding, a pet hotel and a
 * groomer work at their own premises, so those default to "At the provider's".
 */
const COMES_TO_THE_PET = new Set<number>([
  ServiceProviderType.Sitter,
  ServiceProviderType.Walker,
  ServiceProviderType.Transporter,
]);

const pointOf = (a?: AddressDto | null): GeoPoint | null =>
  a?.location?.latitude != null && a?.location?.longitude != null
    ? { latitude: a.location.latitude, longitude: a.location.longitude }
    : null;

/** The API wants a non-empty state; a reverse-geocoded place does not always carry one. */
const withState = (a: AddressDto): AddressDto => ({
  ...a,
  id: undefined,
  state: a.state || a.city || a.country || '-',
});

/** '4+' → 4, 'Any' → undefined — the same reading SearchScreen gives the rating chips. */
function ratingThreshold(minimumRating: string): number | undefined {
  if (minimumRating === 'Any') return undefined;
  const parsed = parseFloat(minimumRating);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toPickItem(svc: ServiceDto, typeLabel: string): ServiceSearchItem | null {
  if (svc.id == null) return null;
  const photoSrc = svc.imageUrl ?? (svc.photos?.find((p) => p.isSelected) ?? svc.photos?.[0])?.src;
  return {
    id: svc.id,
    name: svc.name ?? svc.basicServiceName ?? typeLabel,
    service: svc.basicServiceName || typeLabel,
    rating: svc.rating ?? 0,
    reviews: svc.totalRatingNumber ?? 0,
    distance: '',
    price: serviceFromPrice(svc),
    image: resolveImageUrl(photoSrc),
    latitude: svc.mapLocation?.latitude ?? svc.address?.location?.latitude ?? null,
    longitude: svc.mapLocation?.longitude ?? svc.address?.location?.longitude ?? null,
    dto: svc,
  };
}

/** Next whole hour at least two hours ahead — a sensible default start that is never in the past. */
function defaultStart(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 2);
  return d;
}

/**
 * "Ask several providers" — one service request sent to many providers at once; the first to
 * accept gets the booking.
 *
 * **Two layouts, one form.** The web design shows the whole form on one page with a sticky summary
 * beside it (the commitment action lives in the aside, which is sticky without spanning the
 * window). A phone gets three steps — what & when, who, details — because the "who" step alone is
 * a full-screen list (or map) with its own filters, and stacking it between the date pickers and
 * the note made a form you could not see the end of.
 *
 * **Who** is either providers the user ticks (from a list or the map, narrowed by the same filter
 * controls as Search), or "every matching provider" — then nothing is ticked and the server keeps
 * the filters themselves, resolving the audience live (a provider who joins tomorrow still sees it).
 */
export default function CreateGroupRequestScreen() {
  const route = useRoute<RouteProp<{ params: CreateGroupRequestParams }, 'params'>>();
  const gutter = usePageGutter();
  const { resetToScreen } = useAppNavigation();
  const navigation = useNavigation();
  const { isWebLayout, isDesktop } = useResponsive();
  const {
    isDarkMode,
    bgColor,
    cardBg,
    textColor,
    subtextColor,
    borderColor,
    inputBg,
    inputText,
    placeholderColor,
  } = useThemeColors();
  const { currentUser } = useAuth();
  const { enums } = useEnums();
  const { t, tEnum, language } = useLocale();
  const { showError, showSuccess } = useToast();
  const { code: displayCurrency } = useCurrency();
  const location = useLocation();

  // ── what & when ─────────────────────────────────────────────────────────────
  const [serviceType, setServiceType] = useState<number | null>(route.params?.serviceType ?? null);
  const [pets, setPets] = useState<PetResponse[]>([]);
  const [petsLoading, setPetsLoading] = useState(true);
  // PetResponse ids are strings on the wire type; the request body takes the number.
  const [petId, setPetId] = useState<string | null>(null);
  const [from, setFrom] = useState<Date>(defaultStart);
  const [to, setTo] = useState<Date>(() => new Date(defaultStart().getTime() + 3600000));
  const [picker, setPicker] = useState<null | 'fromDate' | 'fromTime' | 'toDate' | 'toTime'>(null);

  // ── who ────────────────────────────────────────────────────────────────────
  const [anyMatching, setAnyMatching] = useState(false);
  const [filters, setFilters] = useState<FilterState>(() => ({
    ...EMPTY_FILTERS,
    priceRange: [0, DEFAULT_MAX_PRICE],
    ...route.params?.filters,
    // One type per request — chosen above, not in the filter set.
    serviceTypes: [],
  }));
  const [priceTouched, setPriceTouched] = useState(route.params?.priceTouched ?? false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  /** Narrows the hand-picked list by service name — with hundreds of providers of one type, the
   *  one the owner has in mind is otherwise pages deep. Never part of an "every matching" audience:
   *  the server stores filters, not a name, so it is ignored (and hidden) then. */
  const [nameQuery, setNameQuery] = useState('');
  const debouncedName = useDebouncedValue(nameQuery.trim(), 300);
  /** serviceId → the pick. A browse row is a service; the request names its provider. */
  const [picked, setPicked] = useState<Map<number, ServiceSearchItem>>(new Map());
  const [facets, setFacets] = useState<{ maxPrice: number; addOns: string[] }>({
    maxPrice: Math.max(DEFAULT_MAX_PRICE, route.params?.filters?.priceRange?.[1] ?? 0),
    addOns: [],
  });

  // ── details ────────────────────────────────────────────────────────────────
  // Where defaults to the owner's own place for a service that comes to the pet: their saved
  // address first, else where the device is now; for one that does not, the provider's. It
  // follows the type until the owner chooses for themselves.
  const [where, setWhere] = useState<WhereChoice>('none');
  const [whereTouched, setWhereTouched] = useState(false);
  const [accountAddress, setAccountAddress] = useState<AddressDto | null>(null);
  const [currentPlace, setCurrentPlace] = useState<AddressDto | null>(null);
  const [currentPlaceState, setCurrentPlaceState] = useState<'locating' | 'ready' | 'unavailable'>(
    'locating'
  );
  const [mapAddress, setMapAddress] = useState<AddressDto | null>(null);
  const [mapPickerVisible, setMapPickerVisible] = useState(false);
  // What "Where" was before the map opened, to go back to if the picker closes with no pin.
  const whereBeforeMap = useRef<WhereChoice>('none');
  // The picker calls onSelect and then onClose in the same tick, so onClose would read the
  // render's stale `mapAddress` (still null on a first pick) and undo the pick just made.
  const mapAddressRef = useRef<AddressDto | null>(null);
  const [note, setNote] = useState('');
  const [payByCash, setPayByCash] = useState(false);

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Pets + the saved account address — on every focus, not once: "Add a pet" goes to Add Pet
  // and comes back here, and the pet just added is the one this request is for.
  const knownPetIds = useRef<Set<string> | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!currentUser?.id) return;
      let cancelled = false;
      (async () => {
        try {
          const [mine, user] = await Promise.all([
            getPets(currentUser.id),
            getUser(currentUser.id).catch(() => null),
          ]);
          if (cancelled) return;
          setPets(mine);
          const before = knownPetIds.current;
          const added = before ? mine.filter((p) => p.id != null && !before.has(p.id)) : [];
          knownPetIds.current = new Set(mine.flatMap((p) => (p.id != null ? [p.id] : [])));
          if (added.length > 0) setPetId(added[added.length - 1].id ?? null);
          else if (mine.length === 1 && mine[0].id != null)
            setPetId((cur) => cur ?? mine[0].id ?? null);
          setAccountAddress(user?.address?.id ? user.address : null);
        } catch (e) {
          if (!cancelled) showError(getErrorMessage(e, t('groupRequest.petsLoadFailed')));
        } finally {
          if (!cancelled) setPetsLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [currentUser?.id, showError, t])
  );

  // Where the device is now, as an address — offered as "My current location".
  useEffect(() => {
    if (location.loading) return;
    if (location.error) {
      setCurrentPlaceState('unavailable');
      return;
    }
    let cancelled = false;
    reverseGeocodeToAddress({ latitude: location.latitude, longitude: location.longitude })
      .then((a) => {
        if (cancelled) return;
        if (a.line1 || a.city) {
          setCurrentPlace(a);
          setCurrentPlaceState('ready');
        } else {
          setCurrentPlaceState('unavailable');
        }
      })
      .catch(() => {
        if (!cancelled) setCurrentPlaceState('unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, [location.loading, location.error, location.latitude, location.longitude]);

  const preferredWhere: WhereChoice =
    serviceType != null && !COMES_TO_THE_PET.has(serviceType)
      ? 'none'
      : accountAddress
        ? 'account'
        : currentPlace
          ? 'current'
          : 'none';
  useEffect(() => {
    if (!whereTouched) setWhere(preferredWhere);
  }, [preferredWhere, whereTouched]);

  // Filter options for the chosen type: the price ceiling and the extras on offer. Sampled once
  // per type rather than derived from the rows on screen — see SearchScreen's `facets`.
  useEffect(() => {
    if (serviceType == null) return;
    let cancelled = false;
    getServices({
      isActive: true,
      types: [serviceType],
      sortBy: ServiceSortBy.PriceDesc,
      perPage: 100,
    })
      .then((sample) => {
        if (cancelled) return;
        const top = sample[0]?.price ?? sample[0]?.pricing?.basePrice ?? 0;
        const seen = new Map<string, string>();
        for (const svc of sample) {
          for (const a of svc.additionalServices ?? []) {
            const name = (a.name ?? '').trim();
            if (name && a.isActive !== false && !seen.has(name.toLowerCase()))
              seen.set(name.toLowerCase(), name);
          }
        }
        setFacets({
          maxPrice:
            top > 0 ? Math.max(DEFAULT_MAX_PRICE, Math.ceil(top / 10) * 10) : DEFAULT_MAX_PRICE,
          addOns: [...seen.values()].sort((a, b) => a.localeCompare(b)),
        });
      })
      .catch(() => {
        // Options are a nicety; the defaults stand.
      });
    return () => {
      cancelled = true;
    };
  }, [serviceType]);

  // An untouched slider follows the ceiling up, as on Search.
  useEffect(() => {
    if (!priceTouched) setFilters((f) => ({ ...f, priceRange: [0, facets.maxPrice] }));
  }, [facets.maxPrice, priceTouched]);

  const applyFilters = (next: FilterState) => {
    if (
      next.priceRange[0] !== filters.priceRange[0] ||
      next.priceRange[1] !== filters.priceRange[1]
    )
      setPriceTouched(true);
    setFilters({ ...next, serviceTypes: [] });
  };

  // The browse filters as API parameters — exactly SearchScreen's mapping, so the candidates
  // listed here and the audience the server resolves for "every matching provider" agree.
  const priceBounded =
    priceTouched && (filters.priceRange[0] > 0 || filters.priceRange[1] < facets.maxPrice);
  const filterParams = useMemo<GetServicesParams>(
    () => ({
      acceptedSpecies: filters.petTypes.length
        ? filters.petTypes.reduce((all, f) => all | f, 0)
        : undefined,
      additionalServiceNames: filters.addOns.length ? filters.addOns : undefined,
      minPrice: priceBounded && filters.priceRange[0] > 0 ? filters.priceRange[0] : undefined,
      maxPrice:
        priceBounded && filters.priceRange[1] < facets.maxPrice ? filters.priceRange[1] : undefined,
      priceCurrency: priceBounded ? displayCurrency : undefined,
      minRating: ratingThreshold(filters.minimumRating),
      onSaleOnly: filters.onSaleOnly || undefined,
    }),
    [filters, priceBounded, facets.maxPrice, displayCurrency]
  );
  const filterKey = JSON.stringify(filterParams);

  const fetchPage = useCallback(
    (page: number): Promise<PagedResult<ServiceDto>> =>
      getServicesPage({
        isActive: true,
        types: serviceType != null ? [serviceType] : undefined,
        ...(JSON.parse(filterKey) as GetServicesParams),
        // `query`, not `name`: the field promises a provider's name, and `name` matched only the
        // service's own title — typing "Marko" found nothing unless his listing said so.
        query: !anyMatching && debouncedName ? debouncedName : undefined,
        page,
        perPage: PAGE_SIZE,
      }),
    [serviceType, filterKey, anyMatching, debouncedName]
  );
  const candidates = usePagedList<ServiceDto>(fetchPage, {
    enabled: serviceType != null,
    errorFallback: t('groupRequest.providersLoadFailed'),
    resource: 'services',
  });

  const typeLabel = serviceType != null ? tEnum('serviceProviderType', serviceType) : '';
  const ownProviderId = currentUser?.serviceProviderId || null;
  const items = useMemo(
    () =>
      candidates.items.flatMap((svc) => {
        // A partner asking for a service never asks themselves.
        if (ownProviderId && svc.serviceProviderId === ownProviderId) return [];
        const item = toPickItem(svc, typeLabel);
        return item ? [item] : [];
      }),
    [candidates.items, typeLabel, ownProviderId]
  );
  const listRef = useNearBottomLoader(step === 2 || isWebLayout, candidates.loadMore);

  // Changing the type invalidates every pick: a groomer picked for a walk is not a walker.
  useEffect(() => {
    setPicked(new Map());
  }, [serviceType]);

  const togglePick = (item: ServiceSearchItem) =>
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });

  const pickedProviderCount = useMemo(
    () => new Set([...picked.values()].map((p) => p.dto.serviceProviderId)).size,
    [picked]
  );

  // ── validation ─────────────────────────────────────────────────────────────
  const whenError =
    to <= from
      ? t('groupRequest.endBeforeStart')
      : from <= new Date()
        ? t('groupRequest.startInPast')
        : null;
  const step1Error =
    serviceType == null
      ? t('groupRequest.chooseType')
      : petId == null
        ? t('groupRequest.choosePet')
        : whenError;
  const step2Error =
    !anyMatching && pickedProviderCount === 0 ? t('groupRequest.chooseProviders') : null;
  const step3Error =
    where === 'map' && !mapAddress
      ? t('groupRequest.pickAddress')
      : note.length > NOTE_LIMIT
        ? t('groupRequest.noteTooLong', { max: NOTE_LIMIT })
        : null;
  const firstError = step1Error ?? step2Error ?? step3Error;

  // ── submit ─────────────────────────────────────────────────────────────────
  const submit = async () => {
    if (submitting || !currentUser?.id) return;
    if (firstError) {
      showError(firstError);
      return;
    }
    setSubmitting(true);
    try {
      const paymentType = payByCash ? PaymentType.Cash : PaymentType.Card;
      const paymentMethodId = await ensurePaymentMethodId(currentUser.id, paymentType);

      let addressId: number | null = null;
      if (where === 'account' && accountAddress?.id) addressId = accountAddress.id;
      const placed = where === 'map' ? mapAddress : where === 'current' ? currentPlace : null;
      if (placed) {
        const saved = await createAddress(withState(placed));
        addressId = saved.id ?? null;
      }

      await createGroupBookingRequest({
        petId: Number(petId),
        serviceType: serviceType!,
        bookingFrom: formatBookingDate(from),
        bookingTo: formatBookingDate(to),
        addressId,
        note: note.trim() || null,
        paymentType,
        paymentMethodId,
        audience: anyMatching
          ? GroupBookingAudience.AnyEligible
          : GroupBookingAudience.SelectedProviders,
        providers: anyMatching
          ? []
          : [...picked.values()].map((p) => ({
              serviceProviderId: p.dto.serviceProviderId!,
              serviceId: p.id,
            })),
        ...(anyMatching
          ? {
              minPrice: filterParams.minPrice,
              maxPrice: filterParams.maxPrice,
              minRating: filterParams.minRating,
              acceptedSpecies: filterParams.acceptedSpecies,
              onSaleOnly: filters.onSaleOnly,
              requiredAddOnNames: filters.addOns,
            }
          : {}),
      });
      showSuccess(t('groupRequest.sent'));
      // Terminal: the finished form must not sit behind Back.
      resetToScreen('MyGroupRequests', undefined, 'Home');
    } catch (e) {
      showError(getErrorMessage(e, t('groupRequest.sendFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  const noteChain = useFormChain([{ name: 'note', multiline: true }], submit);

  // ── pieces ─────────────────────────────────────────────────────────────────
  const sectionTitle = (n: number, title: string, done: boolean, hint?: string) => (
    <View className="mb-4 flex-row items-center">
      <View
        className={`h-6 w-6 items-center justify-center rounded-full ${done ? 'bg-brand-500' : 'bg-gray-300'}`}>
        {done ? (
          <Ionicons name="checkmark" size={16} color="white" />
        ) : (
          <Text className="text-xs font-bold text-white">{n}</Text>
        )}
      </View>
      <Text className={`ml-3 text-base font-semibold ${textColor}`}>{title}</Text>
      {hint ? <Text className={`ml-2 text-sm ${subtextColor}`}>{hint}</Text> : null}
    </View>
  );

  const label = (text: string) => (
    <Text className={`mb-2 mt-4 text-sm font-semibold ${textColor}`}>{text}</Text>
  );

  const chip = (active: boolean, text: string, onPress: () => void, key?: string | number) => (
    <TouchableOpacity
      key={key ?? text}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      // react-native-web reads aria-*, not accessibilityState.
      aria-pressed={active}
      onPress={onPress}
      className={`rounded-full border px-4 py-2 ${
        active
          ? `${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'} border-brand-500`
          : `${cardBg} ${borderColor}`
      }`}>
      <Text className={`text-sm ${active ? 'font-medium text-brand-600' : subtextColor}`}>
        {text}
      </Text>
    </TouchableOpacity>
  );

  const pickerRow = (
    icon: 'calendar-outline' | 'time-outline',
    text: string,
    onPress: () => void
  ) => (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      className={`flex-1 flex-row items-center rounded-2xl border px-4 py-3 ${borderColor} ${cardBg}`}>
      <Ionicons name={icon} size={18} color={BRAND_GREEN} />
      <Text className={`ml-2 ${textColor}`}>{text}</Text>
    </TouchableOpacity>
  );

  const dateText = (d: Date) => formatWeekdayDayMonth(d, language);
  const timeText = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

  // Moving the start keeps the length of the window, so a 1h request stays 1h.
  const setStart = (next: Date) => {
    const length = to.getTime() - from.getTime();
    setFrom(next);
    setTo(new Date(next.getTime() + (length > 0 ? length : 3600000)));
  };
  const withDate = (base: Date, date: Date) => {
    const d = new Date(base);
    d.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    return d;
  };
  const withTime = (base: Date, time: Date) => {
    const d = new Date(base);
    d.setHours(time.getHours(), time.getMinutes(), 0, 0);
    return d;
  };

  // Add Pet returns here on save (goBackOnSave), and the focus reload picks the new pet.
  const addPet = () => (navigation as any).navigate('AddPet', { goBackOnSave: true });

  const whatAndWhen = (
    <View>
      {sectionTitle(1, t('groupRequest.stepWhat'), !step1Error)}
      {label(t('groupRequest.serviceType'))}
      <View className="flex-row flex-wrap gap-2">
        {(enums?.serviceProviderType ?? []).map((opt) =>
          chip(
            serviceType === opt.value,
            tEnum('serviceProviderType', opt.value, opt.name),
            () => setServiceType(opt.value),
            opt.value
          )
        )}
      </View>

      {label(t('groupRequest.forWhichPet'))}
      {petsLoading ? (
        <ActivityIndicator color={BRAND_GREEN} />
      ) : pets.length === 0 ? (
        <View
          className={`rounded-2xl border border-dashed p-4 ${isDarkMode ? 'border-gray-600' : 'border-brand-300'} ${
            isDarkMode ? 'bg-[#1a2332]' : 'bg-brand-50'
          }`}>
          <View className="flex-row items-center">
            <View
              className={`h-10 w-10 items-center justify-center rounded-full ${isDarkMode ? 'bg-[#243447]' : 'bg-white'}`}>
              <Ionicons name="paw" size={20} color={BRAND_GREEN} />
            </View>
            <View className="ml-3 flex-1">
              <Text className={`text-sm font-semibold ${textColor}`}>
                {t('groupRequest.noPetsTitle')}
              </Text>
              <Text className={`text-xs ${subtextColor}`}>{t('groupRequest.noPets')}</Text>
            </View>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={addPet}
            className="mt-3 flex-row items-center justify-center rounded-xl bg-brand-500 py-3">
            <Ionicons name="add" size={18} color="white" />
            <Text className="ml-1.5 text-sm font-bold text-white">{t('bookService.addAPet')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {pets.map((p) =>
            chip(petId === p.id, p.name, () => setPetId(p.id ?? null), p.id ?? p.name)
          )}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('bookService.addAPet')}
            onPress={addPet}
            className={`flex-row items-center rounded-full border border-dashed px-3 py-2 ${borderColor}`}>
            <Ionicons name="add" size={15} color={BRAND_GREEN} />
            <Text className="ml-1 text-sm font-medium text-brand-600">
              {t('groupRequest.addPetChip')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {label(t('groupRequest.starts'))}
      <View className="flex-row gap-2">
        {pickerRow('calendar-outline', dateText(from), () => setPicker('fromDate'))}
        {pickerRow('time-outline', timeText(from), () => setPicker('fromTime'))}
      </View>
      {label(t('groupRequest.ends'))}
      <View className="flex-row gap-2">
        {pickerRow('calendar-outline', dateText(to), () => setPicker('toDate'))}
        {pickerRow('time-outline', timeText(to), () => setPicker('toTime'))}
      </View>
      {whenError ? (
        <Text className="mt-2 text-xs text-red-500">{whenError}</Text>
      ) : (
        <Text className={`mt-2 text-xs ${subtextColor}`}>{formatDateWindow(t, from, to)}</Text>
      )}
    </View>
  );

  const appliedFilters = activeFilterCount(filters, facets.maxPrice);

  const audienceToggle = (
    <TouchableOpacity
      accessibilityRole="checkbox"
      accessibilityState={{ checked: anyMatching }}
      aria-checked={anyMatching}
      onPress={() => setAnyMatching((v) => !v)}
      className={`mb-3 flex-row items-start rounded-2xl border-2 p-4 ${
        anyMatching
          ? `border-brand-500 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'}`
          : `${borderColor} ${cardBg}`
      }`}>
      <Ionicons
        name={anyMatching ? 'checkbox' : 'square-outline'}
        size={22}
        color={anyMatching ? BRAND_GREEN : isDarkMode ? '#6B7280' : '#9CA3AF'}
      />
      <View className="ml-3 flex-1">
        <Text className={`text-sm font-semibold ${textColor}`}>
          {t('groupRequest.anyMatching')}
        </Text>
        <Text className={`mt-1 text-xs ${subtextColor}`}>
          {appliedFilters > 0
            ? t('groupRequest.anyMatchingFilteredHint', { count: appliedFilters })
            : t('groupRequest.anyMatchingHint')}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const whoToolbar = (
    <View className="mb-3 flex-row flex-wrap items-center gap-2">
      <TouchableOpacity
        accessibilityRole="button"
        onPress={() => setFilterModalVisible(true)}
        className={`flex-row items-center rounded-full border px-3 py-2 ${
          appliedFilters > 0 ? 'border-brand-500' : borderColor
        } ${cardBg}`}>
        <Ionicons name="options-outline" size={15} color={BRAND_GREEN} />
        <Text className={`ml-1.5 text-xs font-medium ${textColor}`}>{t('shared.filters')}</Text>
        {appliedFilters > 0 && (
          <View className="ml-1.5 h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1">
            <Text className="text-[10px] font-bold text-white">{appliedFilters}</Text>
          </View>
        )}
      </TouchableOpacity>
      {(['list', 'map'] as const).map((mode) => (
        <TouchableOpacity
          key={mode}
          accessibilityRole="button"
          accessibilityState={{ selected: viewMode === mode }}
          onPress={() => setViewMode(mode)}
          className={`flex-row items-center rounded-full border px-3 py-2 ${
            viewMode === mode ? 'border-brand-500 bg-brand-500' : `${borderColor} ${cardBg}`
          }`}>
          <Ionicons name={mode} size={15} color={viewMode === mode ? 'white' : BRAND_GREEN} />
          <Text
            className={`ml-1.5 text-xs font-medium ${viewMode === mode ? 'text-white' : textColor}`}>
            {mode === 'list' ? t('search.listView') : t('search.mapView')}
          </Text>
        </TouchableOpacity>
      ))}
      <Text className={`ml-auto text-xs ${subtextColor}`}>
        {anyMatching
          ? t('groupRequest.matchingCount', { count: candidates.totalItems })
          : t('groupRequest.selectedCount', { count: pickedProviderCount })}
      </Text>
    </View>
  );

  const candidateList =
    serviceType == null ? (
      <Text className={`text-sm ${subtextColor}`}>{t('groupRequest.chooseTypeFirst')}</Text>
    ) : viewMode === 'map' ? (
      <View>
        {/* The hint sits below the fixed-height map box, not inside it — inside, the map took
            the whole height and pushed the hint against the clipped bottom edge. */}
        <View style={{ height: isWebLayout ? 460 : 420 }} className="overflow-hidden rounded-2xl">
          <MapViewComponent
            services={items}
            location={location}
            isDarkMode={isDarkMode}
            selectedIds={anyMatching ? [] : [...picked.keys()]}
            onToggleSelect={anyMatching ? undefined : togglePick}
            bottomOffset={0}
          />
        </View>
        <Text className={`mt-2 text-xs ${subtextColor}`}>{t('groupRequest.mapHint')}</Text>
      </View>
    ) : (
      <View ref={listRef}>
        <ListState
          isLoading={candidates.isLoading}
          error={candidates.error}
          isEmpty={items.length === 0}
          emptyIcon="people-outline"
          emptyMessage={t('groupRequest.noProviders')}>
          {items.map((item) => (
            <ProviderPickRow
              key={item.id}
              item={item}
              selected={picked.has(item.id)}
              disabled={anyMatching}
              onToggle={togglePick}
            />
          ))}
        </ListState>
        {items.length > 0 && (
          <LoadMoreFooter
            loaded={items.length}
            total={candidates.totalItems}
            hasMore={candidates.hasMore}
            isLoadingMore={candidates.isLoadingMore}
            onLoadMore={candidates.loadMore}
          />
        )}
      </View>
    );

  const who = (
    <View>
      {sectionTitle(2, t('groupRequest.stepWho'), !step2Error)}
      {audienceToggle}
      {!anyMatching && serviceType != null && (
        <View
          className={`mb-3 flex-row items-center rounded-xl border px-3 ${borderColor} ${inputBg}`}>
          <Ionicons name="search" size={16} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
          <TextInput
            value={nameQuery}
            onChangeText={setNameQuery}
            placeholder={t('groupRequest.searchByName')}
            placeholderTextColor={placeholderColor}
            accessibilityLabel={t('groupRequest.searchByName')}
            className={`ml-2 flex-1 py-2.5 ${inputText}`}
            selectionColor={BRAND_GREEN}
          />
          {nameQuery ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('common.clear')}
              onPress={() => setNameQuery('')}>
              <Ionicons name="close-circle" size={18} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
            </TouchableOpacity>
          ) : null}
        </View>
      )}
      {whoToolbar}
      {candidateList}
    </View>
  );

  const whereOption = (choice: WhereChoice, text: string, sub?: string, disabled = false) => (
    <TouchableOpacity
      key={choice}
      accessibilityRole="radio"
      accessibilityState={{ checked: where === choice, disabled }}
      aria-checked={where === choice}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={() => {
        setWhereTouched(true);
        if (choice === 'map') {
          if (where !== 'map') whereBeforeMap.current = where;
          setMapPickerVisible(true);
        }
        setWhere(choice);
      }}
      className={`mb-2 flex-row items-center rounded-2xl border-2 px-4 py-3 ${
        where === choice
          ? `border-brand-500 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'}`
          : `${borderColor} ${cardBg}`
      }`}>
      <Ionicons
        name={where === choice ? 'radio-button-on' : 'radio-button-off'}
        size={20}
        color={BRAND_GREEN}
      />
      <View className="ml-3 flex-1">
        <Text className={`text-sm font-medium ${textColor}`}>{text}</Text>
        {sub ? (
          <Text numberOfLines={2} className={`text-xs ${subtextColor}`}>
            {sub}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  const details = (
    <View>
      {sectionTitle(3, t('groupRequest.stepDetails'), !step3Error, t('bookService.optional'))}
      {label(t('groupRequest.where'))}
      {accountAddress &&
        whereOption('account', t('groupRequest.whereAccount'), addressLabel(accountAddress))}
      {currentPlaceState !== 'unavailable' &&
        whereOption(
          'current',
          t('groupRequest.whereCurrent'),
          currentPlace ? addressLabel(currentPlace) : t('groupRequest.whereLocating'),
          !currentPlace
        )}
      {whereOption('none', t('groupRequest.whereNone'))}
      {whereOption(
        'map',
        t('groupRequest.whereMap'),
        mapAddress ? addressLabel(mapAddress) : undefined
      )}

      {label(t('groupRequest.note'))}
      <TextInput
        {...noteChain.field('note')}
        value={note}
        onChangeText={setNote}
        placeholder={t('groupRequest.notePlaceholder')}
        placeholderTextColor={placeholderColor}
        multiline
        numberOfLines={4}
        maxLength={NOTE_LIMIT}
        textAlignVertical="top"
        className={`${inputBg} rounded-xl px-4 py-3 ${inputText}`}
        style={{ minHeight: 96 }}
        selectionColor={BRAND_GREEN}
      />

      {label(t('groupRequest.payment'))}
      <View className="flex-row flex-wrap gap-2">
        {chip(!payByCash, t('groupRequest.payCard'), () => setPayByCash(false), 'card')}
        {chip(payByCash, t('groupRequest.payCash'), () => setPayByCash(true), 'cash')}
      </View>
      <Text className={`mt-2 text-xs ${subtextColor}`}>{t('groupRequest.priceNote')}</Text>
    </View>
  );

  const summaryLine = (icon: React.ComponentProps<typeof Ionicons>['name'], text: string) => (
    <View className="mb-2 flex-row items-start">
      <Ionicons name={icon} size={16} color={BRAND_GREEN} />
      <Text className={`ml-2 flex-1 text-sm ${textColor}`}>{text}</Text>
    </View>
  );
  const petName = pets.find((p) => p.id === petId)?.name;
  const whereLabel =
    where === 'account' && accountAddress
      ? addressLabel(accountAddress)
      : where === 'current' && currentPlace
        ? addressLabel(currentPlace)
        : where === 'map' && mapAddress
          ? addressLabel(mapAddress)
          : t('groupRequest.whereNone');
  // The picker opens on the place in play: a pin already dropped, else the chosen address,
  // else the saved one, else where the device is.
  const pickerStart =
    pointOf(mapAddress) ??
    (where === 'current' ? pointOf(currentPlace) : null) ??
    pointOf(accountAddress) ??
    pointOf(currentPlace);

  const summary = (
    <View className={`rounded-2xl border p-5 ${borderColor} ${cardBg}`}>
      <Text className={`mb-3 text-base font-bold ${textColor}`}>{t('groupRequest.summary')}</Text>
      {summaryLine('pricetag-outline', typeLabel || t('groupRequest.chooseType'))}
      {summaryLine('paw-outline', petName ?? t('groupRequest.choosePet'))}
      {summaryLine('calendar-outline', formatDateWindow(t, from, to))}
      {summaryLine('location-outline', whereLabel)}
      {summaryLine(
        'people-outline',
        anyMatching
          ? t('groupRequest.summaryAny', { count: candidates.totalItems })
          : t('groupRequest.selectedCount', { count: pickedProviderCount })
      )}
      <Text className={`mb-4 mt-2 text-xs ${subtextColor}`}>{t('groupRequest.firstToAccept')}</Text>
      {firstError ? <Text className="mb-3 text-xs text-red-500">{firstError}</Text> : null}
      <TouchableOpacity
        accessibilityRole="button"
        disabled={submitting || !!firstError}
        onPress={submit}
        className={`items-center rounded-2xl py-4 ${firstError ? 'bg-gray-300' : 'bg-brand-500'}`}>
        {submitting ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-base font-bold text-white">{t('groupRequest.send')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  // ── pickers (shared by both layouts) ────────────────────────────────────────
  const pickers = (
    <>
      <ResponsiveModal
        visible={picker === 'fromDate' || picker === 'toDate'}
        onClose={() => setPicker(null)}
        mobilePresentation="centered"
        dialogWidth={420}>
        <View className={`${cardBg} p-4`}>
          <DatePicker
            value={picker === 'toDate' ? to : from}
            minDate={picker === 'toDate' ? from : new Date()}
            isDarkMode={isDarkMode}
            onChange={(date) => {
              if (date) {
                if (picker === 'toDate') setTo(withDate(to, date));
                else setStart(withDate(from, date));
              }
              setPicker(null);
            }}
            onClose={() => setPicker(null)}
          />
        </View>
      </ResponsiveModal>
      <ResponsiveModal
        visible={picker === 'fromTime' || picker === 'toTime'}
        onClose={() => setPicker(null)}
        mobilePresentation="centered"
        dialogWidth={380}>
        <View className={`${cardBg} p-4`}>
          <TimePicker
            value={picker === 'toTime' ? to : from}
            isDarkMode={isDarkMode}
            onChange={(time) => {
              if (picker === 'toTime') setTo(withTime(to, time));
              else setStart(withTime(from, time));
            }}
            onClose={() => setPicker(null)}
          />
        </View>
      </ResponsiveModal>
      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApplyFilters={applyFilters}
        currentFilters={filters}
        maxPrice={facets.maxPrice}
        availableAddOns={facets.addOns}
        hideServiceTypes
      />
      {mapPickerVisible && (
        <MapAddressPicker
          visible
          title={t('groupRequest.whereMap')}
          initialRegion={
            pickerStart ?? { latitude: location.latitude, longitude: location.longitude }
          }
          // Open on the place already chosen rather than jumping to the GPS fix — an owner placing
          // the pin near home should not start from wherever they are sitting.
          locateOnOpen={!pickerStart}
          isDarkMode={isDarkMode}
          onClose={() => {
            setMapPickerVisible(false);
            if (!mapAddressRef.current) setWhere(whereBeforeMap.current);
          }}
          onSelect={(address) => {
            mapAddressRef.current = address;
            setMapAddress(address);
            setWhere('map');
          }}
        />
      )}
    </>
  );

  // ── web: one page ───────────────────────────────────────────────────────────
  if (isWebLayout) {
    return (
      <ScreenLayout
        headerVariant="standard"
        showBackButton
        headerTitle={t('groupRequest.title')}
        headerSubtitle={t('groupRequest.subtitle')}
        width="wide">
        {/* No ScrollView of its own on web: ScreenLayout owns the page scroller, and a scroll
            container between the aside and it is what stops `position: sticky` from holding the
            summary (and its Send button) in view. Paging the candidate list rides on
            useNearBottomLoader, which listens to the page scroller. */}
        <View style={{ paddingBottom: 32 }}>
          <TwoColumn aside={summary} asideWidth={isDesktop ? 340 : 300}>
            <View style={{ gap: 16 }}>
              <FormCard>{whatAndWhen}</FormCard>
              <FormCard>{who}</FormCard>
              <FormCard>{details}</FormCard>
            </View>
          </TwoColumn>
        </View>
        {pickers}
      </ScreenLayout>
    );
  }

  // ── phone: three steps ──────────────────────────────────────────────────────
  const totalSteps = 3;
  const stepError = step === 1 ? step1Error : step === 2 ? step2Error : step3Error;
  const next = () => {
    if (stepError) {
      showError(stepError);
      return;
    }
    if (step < totalSteps) setStep(step + 1);
    else submit();
  };

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      onBackPress={step > 1 ? () => setStep(step - 1) : undefined}
      headerTitle={t('groupRequest.title')}
      contentBg={bgColor}
      headerChildren={
        <>
          <View className="mb-2 mt-4 h-2 overflow-hidden rounded-full bg-white/30">
            <View
              className="h-full rounded-full bg-white"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </View>
          {/* mb-6 clears the rounded content sheet pulled 32px up over the header. */}
          <Text className="mb-6 text-sm text-white">
            {t('partnerWelcome.stepOf', { current: step, total: totalSteps })}
          </Text>
        </>
      }>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: 20,
          paddingBottom: 32,
          paddingHorizontal: gutter.value,
        }}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={
          step === 2 ? (e) => (isNearBottom(e) ? candidates.loadMore() : undefined) : undefined
        }>
        {step === 1 && whatAndWhen}
        {step === 2 && who}
        {step === 3 && (
          <>
            {details}
            <View className="mt-6">{summary}</View>
          </>
        )}
      </ScrollView>

      {step < totalSteps && (
        <View className={`${cardBg} border-t ${borderColor} ${gutter.px} flex-row gap-3 py-4`}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={next}
            className={`flex-1 items-center rounded-2xl py-4 ${stepError ? 'bg-gray-300' : 'bg-brand-500'}`}>
            <Text className="text-lg font-bold text-white">{t('common.continue')}</Text>
          </TouchableOpacity>
        </View>
      )}
      {pickers}
    </ScreenLayout>
  );
}
