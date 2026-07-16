import React, { useState, useCallback } from 'react';
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import TabBar from '../../../components/shared/TabBar';
import ServiceCard from '../../../components/shared/ServiceCard';
import SeeMoreCard from '../../../components/shared/SeeMoreCard';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { useLocation } from '../../../hooks/useLocation';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import { useLocale } from '../../../context/LocaleContext';
import { resolveImageUrl } from '../../../services/service-providers';
import { getErrorMessage } from '../../../services/http';
import { ServiceDto } from '../../../services/services';
import { getMostPopular, getOnSale, getRecentlyBooked, getNearMe } from '../../../services/home';
import { useNotifications } from '../../../context/NotificationsContext';
import {
  getServiceDiscounts,
  ServiceDiscountDto,
  DiscountType,
} from '../../../services/service-discounts';
import { formatOfferAmount } from '../../../screens/promotions-screen/components';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=600';

// Service type pills — `label` is the serviceProviderType enum `displayName`
// (Sitter/Walker/Boarder/Pet Hotel/Groomer), passed to Search so its reverse
// lookup (providerTypeValue) resolves the tapped pill back to its enum value.
// The DISPLAYED text is localized via tEnum(value); the nav key stays English.
const SERVICE_TYPES = [
  { id: 'pet-sitting', label: 'Sitter', value: 0, icon: 'bed' },
  { id: 'dog-walking', label: 'Walker', value: 1, icon: 'walk' },
  { id: 'boarding', label: 'Boarder', value: 2, icon: 'home' },
  { id: 'pet-hotel', label: 'Pet Hotel', value: 3, icon: 'business' },
  { id: 'grooming', label: 'Groomer', value: 4, icon: 'cut' },
];

/** A service flattened for ServiceCard. Booking targets the service itself. */
type ServiceItem = {
  id: number;
  name: string;
  subtitle: string;
  rating: number;
  reviews: number;
  price: number;
  image: string;
  dealAmount?: string; // formatted discount (e.g. "3% OFF") for Special Deals cards
  dto: ServiceDto; // the real service record — carries serviceProviderId for booking
};

/** Picks the discount to display for a service: the enabled one whose apply
 *  window covers now, else any enabled one. */
function pickActiveDiscount(discounts: ServiceDiscountDto[]): ServiceDiscountDto | undefined {
  const enabled = discounts.filter((d) => d.isEnabled);
  const now = Date.now();
  const active = enabled.find((d) => {
    const from = d.applyFrom ? new Date(d.applyFrom).getTime() : -Infinity;
    const to = d.applyTo ? new Date(d.applyTo).getTime() : Infinity;
    return from <= now && now <= to;
  });
  return active ?? enabled[0];
}

/** "3% OFF" / "$5 OFF" for a discount (Percent uses percentAmount, Fixed uses amount). */
function discountLabel(d: ServiceDiscountDto): string {
  const value = d.type === DiscountType.Fixed ? d.amount : (d.percentAmount ?? d.amount);
  return formatOfferAmount(d.type, value);
}

/** Flattens a ServiceDto from a home endpoint into a card item. */
function toServiceItem(svc: ServiceDto): ServiceItem | null {
  if (svc.id == null) return null;
  const photoSrc = svc.imageUrl ?? (svc.photos?.find((p) => p.isSelected) ?? svc.photos?.[0])?.src;
  return {
    id: svc.id,
    name: svc.name ?? svc.basicServiceName ?? 'Service',
    // Backend free-text name if present; else the (localized-at-render) type label.
    subtitle: svc.basicServiceName ?? '',
    rating: svc.rating ?? 0,
    reviews: svc.totalRatingNumber ?? 0,
    price: svc.price ?? svc.pricing?.basePrice ?? 0,
    image: resolveImageUrl(photoSrc) || FALLBACK_IMAGE,
    dto: svc,
  };
}

const toItems = (dtos: ServiceDto[]): ServiceItem[] =>
  dtos.map(toServiceItem).filter((i): i is ServiceItem => i !== null);

export default function HomeScreen() {
  const navigation = useNavigation();
  const location = useLocation();
  const { isDarkMode, textColor } = useThemeColors();
  const { currentUser } = useAuth();
  const { t, tEnum } = useLocale();

  const [nearYou, setNearYou] = useState<ServiceItem[]>([]);
  const [mostPopular, setMostPopular] = useState<ServiceItem[]>([]);
  const [recentlyBooked, setRecentlyBooked] = useState<ServiceItem[]>([]);
  const [specialDeals, setSpecialDeals] = useState<ServiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Live badge count — kept current by the SignalR push in NotificationsProvider.
  const { unreadCount, refreshUnreadCount } = useNotifications();

  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-gray-50';
  const sectionTitleColor = textColor;
  const subtitleColor = isDarkMode ? 'text-gray-400' : 'text-brand-100';

  const { latitude, longitude } = location;
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const load = async () => {
        setIsLoading(true);
        setLoadError(null);
        // Each Home row is its own backend endpoint. Settle each independently so
        // one failing section doesn't blank the whole page — but if EVERY content
        // row fails, surface a single inline error instead of a misleading
        // "No services found". Discounts are fetched once and matched to the
        // Special Deals services to show each deal's amount.
        const val = <T,>(r: PromiseSettledResult<T[]>): T[] =>
          r.status === 'fulfilled' ? r.value : [];
        const results = await Promise.allSettled([
          getMostPopular(),
          getOnSale(),
          getRecentlyBooked(),
          getNearMe({ lat: latitude, lng: longitude }),
          getServiceDiscounts({ perPage: 100 }),
        ]);
        if (cancelled) return;
        const [popularR, saleR, recentR, nearR, discountsR] = results;
        const discounts = val(discountsR);
        const deals = toItems(val(saleR)).map((item) => {
          const d = pickActiveDiscount(discounts.filter((x) => x.serviceId === item.id));
          return d ? { ...item, dealAmount: discountLabel(d) } : item;
        });
        setMostPopular(toItems(val(popularR)));
        setSpecialDeals(deals);
        setRecentlyBooked(toItems(val(recentR)));
        setNearYou(toItems(val(nearR)));

        // Only the four content endpoints determine a "page failed" state.
        const contentResults = [popularR, saleR, recentR, nearR];
        const allFailed = contentResults.every((r) => r.status === 'rejected');
        if (allFailed) {
          const firstError = contentResults.find(
            (r): r is PromiseRejectedResult => r.status === 'rejected'
          );
          setLoadError(getErrorMessage(firstError?.reason, t('home.loadError')));
        }
        setIsLoading(false);
      };

      load();
      return () => {
        cancelled = true;
      };
    }, [latitude, longitude])
  );

  // Unread-notification badge on the bell — pushed live over SignalR; the focus
  // refresh re-seeds from REST (covers rows read while this screen was blurred).
  useFocusEffect(
    useCallback(() => {
      refreshUnreadCount();
    }, [refreshUnreadCount])
  );

  const handleServicePress = (item: ServiceItem) => {
    // Open the service detail screen first — the booker reads everything about
    // the service there, then proceeds to BookService from its "Book Now" CTA.
    (navigation as any).navigate('ServiceDetail', { service: item.dto });
  };

  const handleServiceTypePress = (serviceType: string) => {
    (navigation as any).navigate('Search', { serviceType, category: undefined });
  };

  const handleSeeAll = (category: string) => {
    (navigation as any).navigate('Search', { category, serviceType: undefined });
  };

  const renderSection = (
    title: string,
    icon: string,
    items: ServiceItem[],
    category: string,
    badge?: 'popular' | 'deal'
  ) => {
    if (!isLoading && items.length === 0) return null;
    return (
      <View className="mb-6">
        <View className="mb-3 flex-row items-center justify-between px-6">
          <View className="flex-row items-center">
            <Ionicons name={icon as any} size={20} color="#10B981" />
            <Text className={`ml-2 text-base font-semibold ${sectionTitleColor}`}>{title}</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-6">
          <View className="flex-row gap-3">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <View
                    key={i}
                    className={`overflow-hidden rounded-2xl ${isDarkMode ? 'bg-[#1a2332]' : 'bg-white'}`}
                    style={{ width: 200, height: 160 }}>
                    <View className={`flex-1 items-center justify-center`}>
                      <ActivityIndicator color="#00C870" />
                    </View>
                  </View>
                ))
              : items.map((item) => (
                  <ServiceCard
                    key={item.id}
                    image={item.image}
                    name={item.name}
                    service={
                      item.subtitle ||
                      (item.dto.type != null ? tEnum('serviceProviderType', item.dto.type) : '')
                    }
                    rating={item.rating}
                    reviews={item.reviews}
                    price={item.price}
                    badge={badge}
                    dealAmount={item.dealAmount}
                    onPress={() => handleServicePress(item)}
                  />
                ))}
            {!isLoading && <SeeMoreCard onPress={() => handleSeeAll(category)} />}
          </View>
        </ScrollView>
      </View>
    );
  };

  return (
    <ScreenLayout
      headerVariant="large"
      contentBg={contentBg}
      footer={<TabBar />}
      headerChildren={
        <>
          <View className="mb-4 flex-row items-center justify-between">
            <View className="flex-1 flex-row items-center">
              <Ionicons name="location-outline" size={18} color="#ffffff" />
              {location.loading ? (
                <ActivityIndicator size="small" color="#ffffff" style={{ marginLeft: 8 }} />
              ) : (
                <Text className="ml-2 text-sm text-white" numberOfLines={1}>
                  {location.address}
                </Text>
              )}
            </View>
            <TouchableOpacity
              className="p-2"
              onPress={() => (navigation as any).navigate('Notifications')}>
              <Ionicons name="notifications-outline" size={22} color="white" />
              {unreadCount > 0 && (
                <View className="absolute right-0.5 top-0.5 h-[18px] min-w-[18px] items-center justify-center rounded-full border border-brand-500 bg-red-500 px-1">
                  <Text className="text-[10px] font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View className="mb-2 flex-row items-center">
            <MaterialCommunityIcons name="paw" size={24} color="white" />
            <Text className="ml-2 text-2xl font-bold text-white">PawCare</Text>
          </View>
          <Text className={`${subtitleColor} mb-8 text-sm`}>{t('home.tagline')}</Text>
        </>
      }>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Service Type Pills */}
        <View className="px-6 py-4">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-2 flex-row">
            {SERVICE_TYPES.map((service, index) => (
              <TouchableOpacity
                key={service.id}
                onPress={() => handleServiceTypePress(service.label)}
                className={`mx-2 flex-row items-center rounded-full px-6 py-3 ${
                  index === 0 ? 'bg-blue-500' : index === 1 ? 'bg-purple-500' : 'bg-brand-500'
                }`}>
                <Ionicons name={service.icon as any} size={18} color="white" />
                <Text className="ml-2 font-semibold text-white">
                  {tEnum('serviceProviderType', service.value, service.label)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {renderSection(t('home.recentlyBooked'), 'time-outline', recentlyBooked, 'recently-booked')}
        {renderSection(t('home.nearYou'), 'location-outline', nearYou, 'near-you')}
        {renderSection(
          t('home.mostPopular'),
          'trending-up-outline',
          mostPopular,
          'most-popular',
          'popular'
        )}
        {renderSection(
          t('home.specialDeals'),
          'pricetag-outline',
          specialDeals,
          'special-deals',
          'deal'
        )}

        {!isLoading &&
          nearYou.length === 0 &&
          mostPopular.length === 0 &&
          recentlyBooked.length === 0 &&
          specialDeals.length === 0 &&
          (loadError ? (
            <View className="flex-1 items-center justify-center px-6 py-20">
              <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
              <Text className={`text-lg font-semibold ${sectionTitleColor} mt-4 text-center`}>
                {t('home.couldntLoad')}
              </Text>
              <Text
                className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-2 text-center`}>
                {loadError}
              </Text>
            </View>
          ) : (
            <View className="flex-1 items-center justify-center px-6 py-20">
              <Ionicons name="paw-outline" size={48} color="#9CA3AF" />
              <Text className={`text-lg font-semibold ${sectionTitleColor} mt-4 text-center`}>
                {t('home.noServices')}
              </Text>
              <Text
                className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-2 text-center`}>
                {t('home.noServicesSub')}
              </Text>
            </View>
          ))}
      </ScrollView>
    </ScreenLayout>
  );
}
