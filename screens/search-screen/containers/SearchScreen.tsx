import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import TabBar from '../../../components/shared/TabBar';
import Button from '../../../components/shared/Button';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import FilterModal, { FilterState } from '../../../components/FilterModal';
import { useLocation } from '../../../hooks/useLocation';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { ListView, MapViewComponent } from '../components';
import type { ServiceSearchItem } from '../components/ListView';
import { getServices, ServiceDto } from '../../../services/services';
import { getErrorMessage } from '../../../services/http';
import { getMostPopular, getOnSale, getRecentlyBooked, getNearMe } from '../../../services/home';
import { resolveImageUrl, providerTypeValue } from '../../../services/service-providers';
import { SERVICE_ADDON_DEFS } from '../../../services/service-addons';
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
    load: (lat, lng) => getNearMe({ lat, lng, take: CATEGORY_TAKE }),
  },
};

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
    // The service address now carries geo coords (null until geocoded) — use them
    // for the map marker instead of the old 0/0 placeholder.
    latitude: svc.address?.location?.latitude ?? 0,
    longitude: svc.address?.location?.longitude ?? 0,
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

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [allServices, setAllServices] = useState<ServiceSearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
    setFilters((prev) =>
      prev.priceRange[1] === prevMaxPrice.current
        ? { ...prev, priceRange: [prev.priceRange[0], maxPrice] }
        : prev
    );
    prevMaxPrice.current = maxPrice;
  }, [maxPrice]);

  const { latitude, longitude } = location;
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const load = async () => {
        setIsLoading(true);
        setLoadError(null);
        try {
          // Search is service-centric — list bookable services, not providers.
          // From a Home "See More" the list is scoped to that Home row's
          // endpoint; otherwise it's the full active-service catalog.
          const dtos = categoryConfig
            ? await categoryConfig.load(latitude, longitude)
            : await getServices({ isActive: true, perPage: 100 });
          if (cancelled) return;
          setAllServices(
            dtos.flatMap((svc) => {
              const item = toSearchItem(svc);
              if (!item) return [];
              if (!item.service && svc.type != null)
                item.service = tEnum('serviceProviderType', svc.type);
              return [item];
            })
          );
        } catch (e) {
          if (!cancelled) setLoadError(getErrorMessage(e, t('search.loadError')));
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      };

      load();
      return () => {
        cancelled = true;
      };
    }, [categoryConfig, latitude, longitude])
  );

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

    // Additional services — service must provide every selected add-on.
    if (filters.addOns.length > 0) {
      const providesAll = filters.addOns.every(
        (id) => SERVICE_ADDON_DEFS.find((d) => d.id === id)?.read(svc)?.enabled
      );
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

  const handleApplyFilters = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle={
        categoryConfig
          ? t(categoryConfig.titleKey as any)
          : filters.serviceTypes.length === 1
            ? tEnum('serviceProviderType', filters.serviceTypes[0])
            : t('search.allServices')
      }
      contentBg={contentBg}
      footer={<TabBar />}
      rightAction={
        <TouchableOpacity
          onPress={() => setFilterModalVisible(true)}
          className="h-10 w-10 items-center justify-center rounded-full bg-brand-600">
          <Ionicons name="options-outline" size={20} color="white" />
        </TouchableOpacity>
      }
      headerChildren={
        <View className="mb-8 mt-3 flex-row gap-3">
          <View className="flex-1">
            <Button
              text={t('search.listView')}
              onPress={() => setViewMode('list')}
              icon={
                <Ionicons name="list" size={18} color={viewMode === 'list' ? '#00C870' : 'white'} />
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
                <Ionicons name="map" size={18} color={viewMode === 'map' ? '#00C870' : 'white'} />
              }
              variant={viewMode === 'map' ? 'outline' : 'primary'}
              className={viewMode === 'map' ? 'border-2 border-brand-600 bg-white' : ''}
            />
          </View>
        </View>
      }>
      {isLoading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#00C870" />
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
        />
      ) : (
        <MapViewComponent services={services} location={location} />
      )}

      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApplyFilters={handleApplyFilters}
        currentFilters={filters}
        maxPrice={maxPrice}
      />
    </ScreenLayout>
  );
}
