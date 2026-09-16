import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../../components/shared/Button';
import PetLoader from '../../../components/shared/PetLoader';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import TwoColumn from '../../../components/shared/TwoColumn';
import { useResponsive } from '../../../hooks/useResponsive';
import FilterModal from '../../../components/FilterModal';
import SearchFilters, {
  EMPTY_FILTERS,
  activeFilterCount,
  type FilterState,
} from '../../../components/shared/SearchFilters';
import { useLocation } from '../../../hooks/useLocation';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useCurrency } from '../../../hooks/useCurrency';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { ListView, MapViewComponent } from '../components';
import type { ServiceSearchItem } from '../components/ListView';
import {
  getServices,
  getServicesPage,
  serviceFromPrice,
  ServiceDto,
  ServiceSortBy,
  type GetServicesParams,
  type ServiceSortByValue,
} from '../../../services/services';
import type { PagedResult } from '../../../services/http';
import { usePagedList } from '../../../hooks/usePagedList';
import { forwardGeocode, GeoPoint } from '../../../services/geocoding';
import { getRecentlyBooked, getNearMe } from '../../../services/home';
import { resolveImageUrl, providerTypeValue } from '../../../services/service-providers';
import { useLocale } from '../../../context/LocaleContext';

type SearchRouteParams = {
  serviceType?: string;
  // Set when arriving from a Home "See More" — scopes the list to that Home row.
  category?: string;
};

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=600';
const DEFAULT_MAX_PRICE = 200;
const CATEGORY_TAKE = 50;

// The Home pills pass a friendly service-type label — map it back to its
// ServiceProviderType enum value (the canonical id the filter works in).
const serviceTypeParamToValue = (label?: string): number | undefined =>
  label ? providerTypeValue(label) : undefined;

/**
 * Home "See More" categories.
 *
 * Two of them are just the catalogue in a particular order or with one filter set, so they run
 * through the **paged** search as a preset: they page as you scroll and the filter rail narrows
 * them like any other search. The other two can't be expressed that way — one depends on the
 * caller's own booking history and the other ranks by distance from a coordinate — so they keep
 * their dedicated Home endpoint, which returns one complete (capped) list.
 *
 * That split is why `preset` and `load` are alternatives rather than both: a list that arrives
 * complete is filtered in the client (legitimately — every row is present), while a paged one
 * must be filtered by the server. See `clientFiltered` below.
 */
const CATEGORY_CONFIG: Record<
  string,
  {
    titleKey: string;
    badge?: 'popular' | 'deal';
    /** Expressed as catalogue-search parameters — pages and filters normally. */
    preset?: Partial<GetServicesParams>;
    /** A Home endpoint returning one complete list, for what a preset can't express. */
    load?: (lat: number, lng: number) => Promise<ServiceDto[]>;
    /** True only where `load` actually reads the coordinates. */
    usesLocation?: boolean;
  }
> = {
  'most-popular': {
    titleKey: 'home.mostPopular',
    badge: 'popular',
    preset: { sortBy: ServiceSortBy.Popularity },
  },
  'special-deals': {
    titleKey: 'home.specialDeals',
    badge: 'deal',
    preset: { onSaleOnly: true },
  },
  'recently-booked': {
    titleKey: 'home.recentlyBooked',
    load: () => getRecentlyBooked(CATEGORY_TAKE),
  },
  'near-you': {
    titleKey: 'home.nearYou',
    usesLocation: true,
    load: (lat, lng) => getNearMe({ lat, lng, take: CATEGORY_TAKE }),
  },
};

// One screenful plus headroom on a phone; the rest pages in on scroll.
const PAGE_SIZE = 25;

// A sample of the catalogue big enough to populate the filter options. See `facets` below.
const FACET_SAMPLE_SIZE = 100;

// Flattens a ServiceDto (from getServices OR a Home endpoint) into a card item.
// The type-derived label is localized by the caller (via tEnum); here `service`
// holds only backend free-text (basicServiceName) so it's never left in English.
function toSearchItem(svc: ServiceDto): ServiceSearchItem | null {
  if (svc.id == null) return null;
  const photoSrc = svc.imageUrl ?? (svc.photos?.find((p) => p.isSelected) ?? svc.photos?.[0])?.src;
  return {
    id: svc.id,
    name: svc.name ?? svc.basicServiceName ?? 'Service',
    service: svc.basicServiceName ?? '',
    rating: svc.rating ?? 0,
    reviews: svc.totalRatingNumber ?? 0,
    distance:
      svc.distanceFromMyLocationKm != null ? `${Math.round(svc.distanceFromMyLocationKm)} km` : '',
    // The lowest bookable figure. The row reads "from X", and a service with pricing options
    // has no purchasable base price — see serviceFromPrice.
    price: serviceFromPrice(svc),
    image: resolveImageUrl(photoSrc) || FALLBACK_IMAGE,
    // Map pin position from the service address's geo coords. null = no pin yet:
    // addresses without coords are forward-geocoded lazily when the map view
    // opens (see the geocode effect below); services with no address get no pin.
    latitude: svc.address?.location?.latitude ?? null,
    longitude: svc.address?.location?.longitude ?? null,
    dto: svc,
  };
}

/**
 * Drops keys whose value is `undefined`.
 *
 * Object spread does not skip them — an explicit `undefined` overwrites whatever it is spread
 * over — so a filter object carrying "no value" for a key would blank out a preset that set it.
 */
function omitUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

/** `'4+'` → `4`; `'Any'` → undefined. */
function ratingThreshold(minimumRating: string): number | undefined {
  if (minimumRating === 'Any') return undefined;
  const parsed = parseFloat(minimumRating);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default function SearchScreen() {
  const route = useRoute<RouteProp<{ params: SearchRouteParams }, 'params'>>();
  const serviceType = route.params?.serviceType;
  const category = route.params?.category;
  const categoryConfig = category ? CATEGORY_CONFIG[category] : undefined;
  const location = useLocation();
  const {
    isDarkMode,
    bgColor: contentBg,
    textColor,
    subtextColor,
    borderColor,
    cardBg,
  } = useThemeColors();
  const { t, tEnum } = useLocale();
  const { isWebLayout, width: windowWidth } = useResponsive();
  const { code: displayCurrency } = useCurrency();

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortBy, setSortBy] = useState<ServiceSortByValue>(
    categoryConfig?.preset?.sortBy ?? ServiceSortBy.Default
  );

  // A category backed by a Home endpoint arrives complete, so it is filtered here; everything
  // else pages, and is filtered by the server.
  const clientFiltered = categoryConfig?.load != null;

  // ── filter options ────────────────────────────────────────────────────────
  // The add-on chips and the price ceiling are facts about the catalogue, not about the current
  // results, so they are sampled once rather than derived from the rows on screen. Deriving them
  // from the results is circular under server-side filtering: filter by "Pickup" and every row
  // offers Pickup, so the chip list collapses to that one chip and there is no way back.
  //
  // The ceiling is exact despite being a sample — the sample is sorted most-expensive-first, so
  // its first row IS the most expensive service. The add-on names are a genuine sample; a facets
  // endpoint would be the real fix if the catalogue grows past this.
  const [facets, setFacets] = useState<{ maxPrice: number; addOns: string[] }>({
    maxPrice: DEFAULT_MAX_PRICE,
    addOns: [],
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sample = await getServices({
          isActive: true,
          sortBy: ServiceSortBy.PriceDesc,
          perPage: FACET_SAMPLE_SIZE,
        });
        if (cancelled) return;

        const top = sample[0]?.price ?? sample[0]?.pricing?.basePrice ?? 0;
        const seen = new Map<string, string>();
        for (const svc of sample) {
          for (const addOn of svc.additionalServices ?? []) {
            const name = (addOn.name ?? '').trim();
            if (!name || addOn.isActive === false) continue;
            // Deduped case-insensitively (two providers may capitalise "Pickup" differently),
            // keeping the first spelling seen.
            const key = name.toLowerCase();
            if (!seen.has(key)) seen.set(key, name);
          }
        }

        setFacets({
          maxPrice:
            top > 0 ? Math.max(DEFAULT_MAX_PRICE, Math.ceil(top / 10) * 10) : DEFAULT_MAX_PRICE,
          addOns: [...seen.values()].sort((a, b) => a.localeCompare(b)),
        });
      } catch {
        // Filter options are a nicety — a failure here leaves the defaults rather than blocking
        // the search itself.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const maxPrice = facets.maxPrice;

  const [filters, setFilters] = useState<FilterState>(() => {
    const v = serviceTypeParamToValue(serviceType);
    return {
      ...EMPTY_FILTERS,
      serviceTypes: v != null ? [v] : [],
      priceRange: [0, DEFAULT_MAX_PRICE],
    };
  });

  // Sync the service-type filter when the route param changes (tapping a pill from HomeScreen).
  // Returns the previous state unchanged when it already matches: a new object here is a new
  // filter set, which reloads the list from page 1 — and on mount the param usually says exactly
  // what the state already says, so the unconditional version cost a whole extra page fetch every
  // time Search was opened.
  useEffect(() => {
    const v = serviceTypeParamToValue(serviceType);
    const next = v != null ? [v] : [];
    setFilters((prev) =>
      prev.serviceTypes.length === next.length && prev.serviceTypes.every((x, i) => x === next[i])
        ? prev
        : { ...prev, serviceTypes: next }
    );
  }, [serviceType]);

  // When the sampled ceiling raises the maximum, follow the upper bound up — but only while the
  // user hasn't dragged it below the previous ceiling, so an untouched slider never silently
  // filters out the priciest services.
  const prevMaxPrice = useRef(DEFAULT_MAX_PRICE);
  useEffect(() => {
    // Read the old ceiling into a local BEFORE advancing the ref. A `setState` updater is invoked
    // lazily during the next render, not at call time — so mutating the ref first and reading
    // `prevMaxPrice.current` inside the updater compared the new ceiling against itself, the guard
    // never matched, and the range stayed pinned at DEFAULT_MAX_PRICE. Any service priced above it
    // was then silently filtered out of a search the user never narrowed.
    const previousCeiling = prevMaxPrice.current;
    prevMaxPrice.current = maxPrice;
    setFilters((prev) =>
      prev.priceRange[1] === previousCeiling
        ? { ...prev, priceRange: [prev.priceRange[0], maxPrice] }
        : prev
    );
  }, [maxPrice]);

  /**
   * Whether the user has actually moved the price slider.
   *
   * Without this the price bound is inferred from "upper < ceiling", and that is briefly true for
   * a reason the user had nothing to do with: the slider starts at the 200 placeholder and the
   * real ceiling arrives with the facets, so for one render the app asks the server for
   * "under 200 RSD" against a catalogue that runs to 9000 — verified in the network log as a real
   * `MaxPrice=200` request — and the results flash down to a handful before correcting. An
   * untouched slider means no bound at all, whatever the ceiling happens to be.
   */
  const [priceTouched, setPriceTouched] = useState(false);

  const applyFilters = useCallback(
    (next: FilterState) => {
      setPriceTouched(
        (touched) =>
          touched ||
          next.priceRange[0] !== filters.priceRange[0] ||
          next.priceRange[1] !== filters.priceRange[1]
      );
      setFilters(next);
    },
    [filters]
  );

  // The rail applies filters as they are touched, and the price slider emits a value per frame of
  // the drag — so the query settles rather than firing a search per intermediate position.
  const appliedFilters = useDebouncedValue(filters, 300);

  // Only the Near You rail is a function of where the phone is. Pinning the coordinates to 0
  // everywhere else keeps `fetchPage`'s identity stable when the GPS fix replaces useLocation's
  // placeholder — otherwise `usePagedList` reloaded page 1 of a catalogue query that never
  // looked at the position, so opening Search cost two full pages.
  const usesLocation = categoryConfig?.usesLocation ?? false;
  const latitude = usesLocation ? location.latitude : 0;
  const longitude = usesLocation ? location.longitude : 0;

  // Every narrowing the user has made, as query parameters. This is the whole point of the
  // server-side filter set: the search the API runs is the search the user asked for, so the
  // result count describes the search rather than the page, and scrolling never runs out of
  // matches that were quietly filtered away client-side.
  //
  // Memoized on the SERIALISED params rather than on the inputs, so the object's identity only
  // changes when the query actually changes. `fetchPage` reloads from page 1 whenever its identity
  // moves, and several things settle independently just after mount — the route-param sync, the
  // user's display currency arriving, the sampled price ceiling landing — none of which alter the
  // query when no filter is set. Keyed on the inputs this screen issued FOUR identical page-1
  // requests on every open; keyed on the result it issues one.
  const filterParamsKey = useMemo(() => {
    if (clientFiltered) return '{}';
    const f = appliedFilters;
    // Undefined entries are STRIPPED rather than left in place: `fetchPage` spreads this over the
    // category preset, and `{...{onSaleOnly: true}, ...{onSaleOnly: undefined}}` is
    // `{onSaleOnly: undefined}` — an explicit undefined overwrites. Leaving them in silently
    // undid the Special Deals preset for anyone who had not also ticked the filter by hand.
    // (JSON.stringify would drop them anyway; doing it here keeps the two forms identical.)
    return JSON.stringify(
      omitUndefined({
        types: f.serviceTypes.length ? f.serviceTypes : undefined,
        // Species are FLAGS — the selected ones OR together into the single value the API takes.
        acceptedSpecies: f.petTypes.length
          ? f.petTypes.reduce((all, flag) => all | flag, 0)
          : undefined,
        additionalServiceNames: f.addOns.length ? f.addOns : undefined,
        minPrice: priceTouched && f.priceRange[0] > 0 ? f.priceRange[0] : undefined,
        maxPrice: priceTouched && f.priceRange[1] < maxPrice ? f.priceRange[1] : undefined,
        // The bounds are in whatever currency the prices are displayed in, so the server is told
        // which — without it, a EUR bound is compared against RSD prices and matches nothing.
        priceCurrency:
          priceTouched && (f.priceRange[0] > 0 || f.priceRange[1] < maxPrice)
            ? displayCurrency
            : undefined,
        minRating: ratingThreshold(f.minimumRating),
        onSaleOnly: f.onSaleOnly || undefined,
      })
    );
  }, [appliedFilters, clientFiltered, maxPrice, displayCurrency, priceTouched]);

  const filterParams: GetServicesParams = useMemo(
    () => JSON.parse(filterParamsKey) as GetServicesParams,
    [filterParamsKey]
  );

  const fetchPage = useCallback(
    async (page: number): Promise<PagedResult<ServiceDto>> => {
      if (categoryConfig?.load) {
        const dtos = await categoryConfig.load(latitude, longitude);
        return {
          items: dtos,
          totalItems: dtos.length,
          totalPages: 1,
          currentPage: 1,
          itemsPerPage: dtos.length,
          hasMore: false,
        };
      }
      return getServicesPage({
        isActive: true,
        ...categoryConfig?.preset,
        ...filterParams,
        sortBy,
        page,
        perPage: PAGE_SIZE,
      });
    },
    [categoryConfig, latitude, longitude, filterParams, sortBy]
  );

  const {
    items: serviceDtos,
    isLoading,
    isLoadingMore,
    error: loadError,
    totalItems,
    hasMore,
    loadMore,
  } = usePagedList<ServiceDto>(fetchPage, {
    // Near You waits for a real fix; ranking against the placeholder would list another city's
    // services and be replaced seconds later. Every other view is position-independent and
    // loads immediately. `location.loading` settles on denial too, so this never hangs.
    enabled: !(usesLocation && location.loading),
    errorFallback: t('search.loadError'),
  });

  // DTO -> card item. Kept out of the fetch so a re-render doesn't refetch.
  const allServices: ServiceSearchItem[] = useMemo(
    () =>
      serviceDtos.flatMap((svc) => {
        const item = toSearchItem(svc);
        if (!item) return [];
        if (!item.service && svc.type != null)
          item.service = tEnum('serviceProviderType', svc.type);
        return [item];
      }),
    [serviceDtos, tEnum]
  );

  // Lazily resolve pin coordinates when the map view opens: services whose
  // address has no geo coords yet are forward-geocoded from the address text,
  // one at a time (Nominatim's fair-use rate on web). Keyed by service id;
  // null = lookup failed (don't retry). Fail-soft — a service that can't be
  // geocoded simply gets no pin.
  const [geocoded, setGeocoded] = useState<Record<number, GeoPoint | null>>({});
  useEffect(() => {
    if (viewMode !== 'map') return;
    const pending = allServices
      .filter((s) => s.latitude == null && s.dto.address && geocoded[s.id] === undefined)
      .slice(0, 25);
    if (!pending.length) return;
    let cancelled = false;
    (async () => {
      for (const item of pending) {
        const a = item.dto.address!;
        const query = [a.line1, a.postalCode, a.city, a.country].filter(Boolean).join(', ');
        let point: GeoPoint | null = null;
        try {
          point = await forwardGeocode(query);
        } catch {
          point = null;
        }
        if (cancelled) return;
        setGeocoded((prev) => ({ ...prev, [item.id]: point }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewMode, allServices, geocoded]);

  /**
   * The rows to render.
   *
   * A paged search is already exactly what was asked for — every predicate ran in SQL over the
   * whole catalogue — so filtering again here would be a no-op at best and, for the rows a later
   * page has yet to deliver, actively wrong. The Home-endpoint categories are the exception: they
   * return one complete list, so narrowing it in the client filters the entire result set and is
   * sound.
   */
  const services = useMemo(() => {
    if (!clientFiltered) return allServices;
    return allServices.filter((item) => {
      const svc = item.dto;

      if (filters.serviceTypes.length > 0) {
        if (svc.type == null || !filters.serviceTypes.includes(svc.type)) return false;
      }
      if (filters.petTypes.length > 0) {
        const accepted = svc.details?.acceptedSpecies ?? 0;
        if (!filters.petTypes.some((flag) => (accepted & flag) !== 0)) return false;
      }
      if (filters.addOns.length > 0) {
        const offered = (svc.additionalServices ?? [])
          .filter((a) => a.isActive !== false)
          .map((a) => (a.name ?? '').toLowerCase());
        if (!filters.addOns.every((name) => offered.includes(name.toLowerCase()))) return false;
      }
      if (filters.onSaleOnly && svc.appliedDiscountAmount == null) return false;
      if (item.price > 0) {
        if (item.price < filters.priceRange[0] || item.price > filters.priceRange[1]) return false;
      }
      const threshold = ratingThreshold(filters.minimumRating);
      if (threshold != null && item.rating > 0 && item.rating < threshold) return false;

      return true;
    });
  }, [allServices, clientFiltered, filters]);

  // Map items with the lazily-geocoded coordinates merged in (list view never
  // needs coords, so the merge is map-only).
  const mapServices = services.map((s) => {
    if (s.latitude != null) return s;
    const g = geocoded[s.id];
    return g ? { ...s, latitude: g.latitude, longitude: g.longitude } : s;
  });

  const appliedCount = activeFilterCount(filters, maxPrice);
  const clearFilters = () => {
    setPriceTouched(false);
    setFilters({ ...EMPTY_FILTERS, priceRange: [0, maxPrice] });
  };

  // The view toggle and the filter button are the page's controls, so on the web design they sit
  // on the title row where a web user looks for them, rather than as a full-width pair of buttons
  // and a circular icon in a coloured bar.
  const viewToggle = (
    <View className={isWebLayout ? 'flex-row gap-2' : 'mb-8 mt-3 flex-row gap-3'}>
      <View className={isWebLayout ? '' : 'flex-1'}>
        <Button
          text={t('search.listView')}
          onPress={() => setViewMode('list')}
          icon={
            <Ionicons name="list" size={18} color={viewMode === 'list' ? BRAND_GREEN : 'white'} />
          }
          variant={viewMode === 'list' ? 'outline' : 'primary'}
          className={viewMode === 'list' ? 'border-2 border-brand-600 bg-white' : ''}
        />
      </View>
      <View className={isWebLayout ? '' : 'flex-1'}>
        <Button
          text={t('search.mapView')}
          onPress={() => setViewMode('map')}
          icon={
            <Ionicons name="map" size={18} color={viewMode === 'map' ? BRAND_GREEN : 'white'} />
          }
          variant={viewMode === 'map' ? 'outline' : 'primary'}
          className={viewMode === 'map' ? 'border-2 border-brand-600 bg-white' : ''}
        />
      </View>
    </View>
  );

  /**
   * Whether there is room for the rail beside the results.
   *
   * The rail costs 300px plus its gap, and it is taken out of what is left after the sidebar —
   * so on a 900px window the results end up narrower than a phone's, and every row ellipsises.
   * Below this the filters go back to the modal, reached from the button in the results header;
   * the filtering itself is identical either way, only where the controls live changes.
   */
  const showFilterRail = isWebLayout && windowWidth >= 1180;

  /**
   * The sticky filter rail — the web design's answer to a list that never ends.
   *
   * With a scroll that keeps loading, a filter behind a button at the top of the page is out of
   * reach by the third screenful: narrowing the search would mean scrolling all the way back up.
   * Pinned beside the results it stays reachable at any depth, and it doubles as a readout of what
   * is currently applied — which a modal can only show as a number on a button.
   *
   * It sits on the **right**. The left edge already belongs to the app's own sidebar, and a second
   * column of controls immediately beside it reads as more navigation and pushes the results —
   * the thing the page is for — into the middle of the window. On the right the results keep the
   * leading edge and the rail reads as a tool acting on them. It is also the side that suits the
   * map, where the filters sit beside the thing they are narrowing rather than between the
   * navigation and it.
   */
  const filterRail = (
    <View className={`rounded-2xl border p-4 ${borderColor} ${cardBg}`}>
      <View className="mb-4 flex-row items-center justify-between">
        <Text className={`text-base font-bold ${textColor}`}>{t('search.filtersTitle')}</Text>
        {appliedCount > 0 && (
          <TouchableOpacity accessibilityRole="button" onPress={clearFilters}>
            <Text className="text-xs font-medium text-brand-600">{t('search.clearFilters')}</Text>
          </TouchableOpacity>
        )}
      </View>
      {/* The rail can outgrow a short window, so it scrolls within its own sticky height rather
          than pushing the page taller than the results beside it. */}
      <ScrollView style={{ maxHeight: 620 }} showsVerticalScrollIndicator={false}>
        <SearchFilters
          value={filters}
          onChange={applyFilters}
          maxPrice={maxPrice}
          availableAddOns={facets.addOns}
        />
      </ScrollView>
    </View>
  );

  // Wherever the rail is not shown, the filters are reached from a button in the results header,
  // with the count of what is currently applied — the one thing a modal cannot show at a glance.
  const inlineFilterBar = showFilterRail ? null : (
    <View className="mb-4 flex-row items-center gap-2">
      <TouchableOpacity
        accessibilityRole="button"
        onPress={() => setFilterModalVisible(true)}
        className={`flex-row items-center rounded-full border px-3 py-2 ${
          appliedCount > 0 ? 'border-brand-500' : borderColor
        } ${cardBg}`}>
        <Ionicons name="options-outline" size={15} color={BRAND_GREEN} />
        <Text className={`ml-1.5 text-xs font-medium ${textColor}`}>{t('shared.filters')}</Text>
        {appliedCount > 0 && (
          <View className="ml-1.5 h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1">
            <Text className="text-[10px] font-bold text-white">{appliedCount}</Text>
          </View>
        )}
      </TouchableOpacity>
      {appliedCount > 0 && (
        <TouchableOpacity accessibilityRole="button" onPress={clearFilters}>
          <Text className="text-xs font-medium text-brand-600">{t('search.clearFilters')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const listContent = (
    <ListView
      services={services}
      badge={categoryConfig?.badge}
      paging={{ total: totalItems, hasMore, isLoadingMore, onLoadMore: loadMore }}
      // A complete Home list has its own meaning-bearing order (most booked, nearest); re-sorting
      // it would quietly turn it into a different rail.
      sort={clientFiltered ? undefined : { value: sortBy, onChange: setSortBy }}
      header={inlineFilterBar}
    />
  );

  const body = isLoading ? (
    <View className="flex-1 items-center justify-center py-20">
      <PetLoader label={t('search.findingServices')} />
    </View>
  ) : loadError ? (
    <View className="flex-1 items-center justify-center px-8 py-20">
      <Ionicons name="alert-circle-outline" size={56} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
      <Text className={`${subtextColor} mt-4 text-center`}>{loadError}</Text>
    </View>
  ) : viewMode === 'list' ? (
    listContent
  ) : (
    // The TabBar overlays the bottom of the content area (absolute bottom-0), so inset the map
    // by its height — otherwise the map's bottom strip and Google's attribution hide behind it
    // and the map centre sits too low. The web design has no such bar, and the inset there
    // would just be a strip of dead space under the map.
    //
    // Beside the rail the map also needs a definite height: TwoColumn lays its columns out
    // top-aligned with auto height, so a `flex-1` map collapses to its 400px minimum and reads as
    // a letterbox strip under the header.
    <View
      className={`flex-1 ${isWebLayout ? 'px-8 pb-4' : 'pb-20'}`}
      style={showFilterRail ? { height: 680 } : undefined}>
      <MapViewComponent services={mapServices} location={location} isDarkMode={isDarkMode} />
    </View>
  );

  return (
    <ScreenLayout
      headerVariant="standard"
      headerTitle={
        categoryConfig
          ? t(categoryConfig.titleKey as any)
          : filters.serviceTypes.length === 1
            ? tEnum('serviceProviderType', filters.serviceTypes[0])
            : t('search.allServices')
      }
      contentBg={contentBg}
      // Uncapped, unlike every other screen. `ContentContainer` centres a capped column, and that
      // centring margin STACKS on top of the gutter — so past ~1750px the space outside the
      // results grew with the window (43px at 1800, 243px at 2200) while the gap between the
      // results and the filter rail stayed at its fixed 32. The page then read as a narrow strip
      // adrift in the window. A browse list has no reading-measure problem to solve — its rows are
      // built from fixed-width blocks and one flexible middle — so it takes the width it is given
      // and every gutter stays the same size.
      width="full"
      // Back is a phone affordance here — on the web design Search is a sidebar destination, not
      // somewhere you drilled into, so there is nothing above it to go back to.
      showBackButton
      rightAction={
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => setFilterModalVisible(true)}
          className="h-10 w-10 items-center justify-center rounded-full bg-brand-600">
          <Ionicons name="options-outline" size={20} color="white" />
        </TouchableOpacity>
      }
      webHeaderRight={
        <View className="flex-row items-center gap-3">
          {viewToggle}
          {/* Only where the rail is actually showing would this be a second door to the same room.
              The map has no rail — its surface is the map — and nor does a narrow window. */}
          {!showFilterRail && (
            <Button
              text={t('shared.filters')}
              onPress={() => setFilterModalVisible(true)}
              variant="outline"
              icon={<Ionicons name="options-outline" size={18} color={BRAND_GREEN} />}
            />
          )}
        </View>
      }
      headerChildren={
        isWebLayout ? undefined : (
          <View className="mb-8 mt-3 flex-row gap-3">
            <View className="flex-1">
              <Button
                text={t('search.listView')}
                onPress={() => setViewMode('list')}
                icon={
                  <Ionicons
                    name="list"
                    size={18}
                    color={viewMode === 'list' ? BRAND_GREEN : 'white'}
                  />
                }
                variant={viewMode === 'list' ? 'outline' : 'primary'}
                className={viewMode === 'list' ? 'border-2 border-brand-600 bg-white' : ''}
              />
            </View>
            <View className="flex-1">
              <Button
                text={t('search.mapView')}
                onPress={() => setViewMode('map')}
                icon={
                  <Ionicons
                    name="map"
                    size={18}
                    color={viewMode === 'map' ? BRAND_GREEN : 'white'}
                  />
                }
                variant={viewMode === 'map' ? 'outline' : 'primary'}
                className={viewMode === 'map' ? 'border-2 border-brand-600 bg-white' : ''}
              />
            </View>
          </View>
        )
      }>
      {/* The rail only makes sense beside a list — the map view is its own full-bleed surface. */}
      {/* The rail accompanies BOTH views: filters narrow the map's pins exactly as they narrow the
          list, and hiding the controls on the map made it the one place you could not act on what
          you were looking at. */}
      {showFilterRail && !isLoading && !loadError ? (
        // The results column carries its own 24px gutter (see ListView), so the gap here only has
        // to separate the two columns; the rail takes the page gutter on its outer edge.
        <TwoColumn
          aside={<View className="pr-8">{filterRail}</View>}
          asidePosition="right"
          asideWidth={332}
          gap={0}>
          {body}
        </TwoColumn>
      ) : (
        body
      )}

      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApplyFilters={applyFilters}
        currentFilters={filters}
        maxPrice={maxPrice}
        availableAddOns={facets.addOns}
      />
    </ScreenLayout>
  );
}
