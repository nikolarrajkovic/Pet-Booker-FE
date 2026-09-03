import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import TabBar from '../../../components/shared/TabBar';
import Button from '../../../components/shared/Button';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { useResponsive } from '../../../hooks/useResponsive';
import FilterModal, { FilterState } from '../../../components/FilterModal';
import { useLocation } from '../../../hooks/useLocation';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { ListView, MapViewComponent } from '../components';
import type { ServiceSearchItem } from '../components/ListView';
import { getServicesPage, ServiceDto } from '../../../services/services';
import type { PagedResult } from '../../../services/http';
import { usePagedList } from '../../../hooks/usePagedList';
import { forwardGeocode, GeoPoint } from '../../../services/geocoding';
import { getMostPopular, getOnSale, getRecentlyBooked, getNearMe } from '../../../services/home';
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

// Home "See More" categories → the dedicated Home endpoint that feeds the row,
// its header title, and the banner each card should carry (mirroring HomeScreen).
const CATEGORY_CONFIG: Record<
  string,
  {
    titleKey: string;
    badge?: 'popular' | 'deal';
    /** True only where `load` actually reads the coordinates — see `fetchPage` below. */
    usesLocation?: boolean;
    load: (lat: number, lng: number) => Promise<ServiceDto[]>;
  }
> = {
  'most-popular': {
    titleKey: 'home.mostPopular',
    badge: 'popular',
    load: () => getMostPopular(CATEGORY_TAKE),
  },
  'special-deals': {
    titleKey: 'home.specialDeals',
    badge: 'deal',
    load: () => getOnSale(CATEGORY_TAKE),
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
    price: svc.price ?? svc.pricing?.basePrice ?? 0,
    image: resolveImageUrl(photoSrc) || FALLBACK_IMAGE,
    // Map pin position from the service address's geo coords. null = no pin yet:
    // addresses without coords are forward-geocoded lazily when the map view
    // opens (see the geocode effect below); services with no address get no pin.
    latitude: svc.address?.location?.latitude ?? null,
    longitude: svc.address?.location?.longitude ?? null,
    dto: svc,
  };
}

export default function SearchScreen() {
  const route = useRoute<RouteProp<{ params: SearchRouteParams }, 'params'>>();
  const serviceType = route.params?.serviceType;
  const category = route.params?.category;
  const categoryConfig = category ? CATEGORY_CONFIG[category] : undefined;
  const location = useLocation();
  const {
    isDarkMode,
    cardBg,
    bgColor: contentBg,
    textColor,
    subtextColor,
    borderColor,
  } = useThemeColors();
  const { t, tEnum } = useLocale();
  const { isWebLayout } = useResponsive();

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState<FilterState>(() => {
    const v = serviceTypeParamToValue(serviceType);
    return {
      serviceTypes: v != null ? [v] : [],
      petTypes: [],
      addOns: [],
      priceRange: [0, DEFAULT_MAX_PRICE],
      minimumRating: 'Any',
    };
  });

  // Sync the service-type filter when the route param changes (tapping a pill from HomeScreen)
  useEffect(() => {
    const v = serviceTypeParamToValue(serviceType);
    setFilters((prev) => ({
      ...prev,
      serviceTypes: v != null ? [v] : [],
    }));
  }, [serviceType]);

  // Only the Near You rail is a function of where the phone is. Pinning the coordinates to 0
  // everywhere else keeps `fetchPage`'s identity stable when the GPS fix replaces useLocation's
  // placeholder — otherwise `usePagedList` reloaded page 1 of a catalogue query that never
  // looked at the position, so opening Search cost two full pages.
  const usesLocation = categoryConfig?.usesLocation ?? false;
  const latitude = usesLocation ? location.latitude : 0;
  const longitude = usesLocation ? location.longitude : 0;

  // The catalogue pages; a Home "See More" rail is a fixed take, so it reports one complete page
  // and the footer stays hidden.
  const fetchPage = useCallback(
    async (page: number): Promise<PagedResult<ServiceDto>> => {
      if (categoryConfig) {
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
      return getServicesPage({ isActive: true, page, perPage: PAGE_SIZE });
    },
    [categoryConfig, latitude, longitude]
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

  // Add-on filter chips derived from the loaded services. Extras are provider-named free text,
  // so there is no catalog to enumerate — the options are whatever is on offer. Deduped
  // case-insensitively (two providers may capitalise "Pickup" differently) keeping first spelling.
  const availableAddOns = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of allServices) {
      for (const addOn of item.dto.additionalServices ?? []) {
        const name = (addOn.name ?? '').trim();
        if (!name || addOn.isActive === false) continue;
        const key = name.toLowerCase();
        if (!seen.has(key)) seen.set(key, name);
      }
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }, [allServices]);

  // Price-slider ceiling derived from the actual services — no hardcoded cap.
  const maxPrice = useMemo(() => {
    const top = allServices.reduce((m, s) => Math.max(m, s.price), 0);
    return top > 0 ? Math.max(DEFAULT_MAX_PRICE, Math.ceil(top / 10) * 10) : DEFAULT_MAX_PRICE;
  }, [allServices]);

  // When new data raises the ceiling, follow the upper bound up — but only while
  // the user hasn't dragged it below the previous max (so an untouched slider
  // never silently filters out the priciest services).
  const prevMaxPrice = useRef(DEFAULT_MAX_PRICE);
  useEffect(() => {
    // Read the old ceiling into a local BEFORE advancing the ref. A `setState`
    // updater is invoked lazily during the next render, not at call time — so
    // mutating the ref first and reading `prevMaxPrice.current` inside the
    // updater compared the new ceiling against itself, the guard never matched,
    // and the range stayed pinned at DEFAULT_MAX_PRICE. Any service priced above
    // it was then silently filtered out of a search the user never narrowed.
    const previousCeiling = prevMaxPrice.current;
    prevMaxPrice.current = maxPrice;
    setFilters((prev) =>
      prev.priceRange[1] === previousCeiling
        ? { ...prev, priceRange: [prev.priceRange[0], maxPrice] }
        : prev
    );
  }, [maxPrice]);

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

  // Client-side filtering on the loaded data — every predicate works off the
  // service DTO's real fields (type, accepted species, add-on flags, price, rating).
  const services = allServices.filter((item) => {
    const svc = item.dto;

    // Service type — ServiceProviderType enum value.
    if (filters.serviceTypes.length > 0) {
      if (svc.type == null || !filters.serviceTypes.includes(svc.type)) return false;
    }

    // Accepted pets — service's acceptedSpecies (FLAGS) must include a selected species.
    if (filters.petTypes.length > 0) {
      const accepted = svc.details?.acceptedSpecies ?? 0;
      if (!filters.petTypes.some((flag) => (accepted & flag) !== 0)) return false;
    }

    // Additional services — the service must offer every selected extra. Matched on name
    // (case-insensitively) because extras are provider-authored, not a fixed catalog.
    if (filters.addOns.length > 0) {
      const offered = (svc.additionalServices ?? [])
        .filter((a) => a.isActive !== false)
        .map((a) => (a.name ?? '').toLowerCase());
      const providesAll = filters.addOns.every((name) => offered.includes(name.toLowerCase()));
      if (!providesAll) return false;
    }

    // Price range.
    if (item.price > 0) {
      if (item.price < filters.priceRange[0] || item.price > filters.priceRange[1]) {
        return false;
      }
    }

    // Minimum rating.
    if (filters.minimumRating !== 'Any' && item.rating > 0) {
      if (item.rating < parseFloat(filters.minimumRating)) return false;
    }

    return true;
  });

  // Map items with the lazily-geocoded coordinates merged in (list view never
  // needs coords, so the merge is map-only).
  const mapServices = services.map((s) => {
    if (s.latitude != null) return s;
    const g = geocoded[s.id];
    return g ? { ...s, latitude: g.latitude, longitude: g.longitude } : s;
  });

  const handleApplyFilters = (newFilters: FilterState) => {
    setFilters(newFilters);
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
      footer={<TabBar />}
      width="wide"
      // Back is a phone affordance here — on the web design Search is a sidebar destination, not
      // somewhere you drilled into, so there is nothing above it to go back to.
      showBackButton={!isWebLayout}
      rightAction={
        <TouchableOpacity
          onPress={() => setFilterModalVisible(true)}
          className="h-10 w-10 items-center justify-center rounded-full bg-brand-600">
          <Ionicons name="options-outline" size={20} color="white" />
        </TouchableOpacity>
      }
      webHeaderRight={
        <View className="flex-row items-center gap-3">
          {viewToggle}
          <Button
            text={t('shared.filters')}
            onPress={() => setFilterModalVisible(true)}
            variant="outline"
            icon={<Ionicons name="options-outline" size={18} color={BRAND_GREEN} />}
          />
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
      {isLoading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color={BRAND_GREEN} />
          <Text className={`mt-4 text-sm ${subtextColor}`}>{t('search.findingServices')}</Text>
        </View>
      ) : loadError ? (
        <View className="flex-1 items-center justify-center px-8 py-20">
          <Ionicons
            name="alert-circle-outline"
            size={56}
            color={isDarkMode ? '#6B7280' : '#9CA3AF'}
          />
          <Text className={`${subtextColor} mt-4 text-center`}>{loadError}</Text>
        </View>
      ) : viewMode === 'list' ? (
        <ListView
          services={services}
          isDarkMode={isDarkMode}
          textColor={textColor}
          subtextColor={subtextColor}
          cardBg={cardBg}
          borderColor={borderColor}
          badge={categoryConfig?.badge}
          paging={{ total: totalItems, hasMore, isLoadingMore, onLoadMore: loadMore }}
        />
      ) : (
        // The TabBar overlays the bottom of the content area (absolute bottom-0), so inset the map
        // by its height — otherwise the map's bottom strip and Google's attribution hide behind it
        // and the map centre sits too low. The web design has no such bar, and the inset there
        // would just be a strip of dead space under the map.
        <View className={`flex-1 ${isWebLayout ? 'pb-4' : 'pb-20'}`}>
          <MapViewComponent services={mapServices} location={location} isDarkMode={isDarkMode} />
        </View>
      )}

      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApplyFilters={handleApplyFilters}
        currentFilters={filters}
        maxPrice={maxPrice}
        availableAddOns={availableAddOns}
      />
    </ScreenLayout>
  );
}
