import React, { useState, useCallback } from 'react';
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import TabBar from '../../../components/shared/TabBar';
import ServiceCard from '../../../components/shared/ServiceCard';
import SeeMoreCard from '../../../components/shared/SeeMoreCard';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { Ionicons , MaterialCommunityIcons } from '@expo/vector-icons';

import { useLocation } from '../../../hooks/useLocation';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import { resolveImageUrl, providerTypeLabel } from '../../../services/service-providers';
import { getErrorMessage } from '../../../services/http';
import { ServiceDto } from '../../../services/services';
import { getMostPopular, getOnSale, getRecentlyBooked, getNearMe } from '../../../services/home';
import { getUnreadNotificationCount } from '../../../services/app-notifications';
import { getServiceDiscounts, ServiceDiscountDto, DiscountType } from '../../../services/service-discounts';
import { formatOfferAmount } from '../../../screens/promotions-screen/components';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=600';

// Service type pills — labels are the serviceProviderType enum `displayName`s
// (Sitter/Walker/Boarder/Pet Hotel/Groomer) so SearchScreen's reverse lookup
// (providerTypeValue) resolves the tapped pill back to its enum value.
const SERVICE_TYPES = [
  { id: 'pet-sitting', label: 'Sitter', icon: 'bed' },
  { id: 'dog-walking', label: 'Walker', icon: 'walk' },
  { id: 'boarding', label: 'Boarder', icon: 'home' },
  { id: 'pet-hotel', label: 'Pet Hotel', icon: 'business' },
  { id: 'grooming', label: 'Groomer', icon: 'cut' },
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
    subtitle: svc.basicServiceName ?? (svc.type != null ? providerTypeLabel(svc.type) : ''),
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

  const [nearYou, setNearYou] = useState<ServiceItem[]>([]);
  const [mostPopular, setMostPopular] = useState<ServiceItem[]>([]);
  const [recentlyBooked, setRecentlyBooked] = useState<ServiceItem[]>([]);
  const [specialDeals, setSpecialDeals] = useState<ServiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

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
            (r): r is PromiseRejectedResult => r.status === 'rejected',
          );
          setLoadError(getErrorMessage(firstError?.reason, 'Could not load services. Please try again.'));
        }
        setIsLoading(false);
      };

      load();
      return () => { cancelled = true; };
    }, [latitude, longitude])
  );

  // Unread-notification badge on the bell — refreshed on every focus.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const userId = currentUser?.id;
      if (!userId) { setUnreadCount(0); return; }
      getUnreadNotificationCount(userId)
        .then((count) => { if (!cancelled) setUnreadCount(count); })
        .catch(() => {});
      return () => { cancelled = true; };
    }, [currentUser?.id])
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
    badge?: 'popular' | 'deal',
  ) => {
    if (!isLoading && items.length === 0) return null;
    return (
      <View className="mb-6">
        <View className="flex-row justify-between items-center px-6 mb-3">
          <View className="flex-row items-center">
            <Ionicons name={icon as any} size={20} color="#10B981" />
            <Text className={`font-semibold text-base ml-2 ${sectionTitleColor}`}>{title}</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-6">
          <View className="flex-row gap-3">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <View
                    key={i}
                    className={`rounded-2xl overflow-hidden ${isDarkMode ? 'bg-[#1a2332]' : 'bg-white'}`}
                    style={{ width: 200, height: 160 }}
                  >
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
                    service={item.subtitle}
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
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center flex-1">
              <Ionicons name="location-outline" size={18} color="#ffffff" />
              {location.loading ? (
                <ActivityIndicator size="small" color="#ffffff" style={{ marginLeft: 8 }} />
              ) : (
                <Text className="text-white ml-2 text-sm" numberOfLines={1}>{location.address}</Text>
              )}
            </View>
            <TouchableOpacity className="p-2" onPress={() => (navigation as any).navigate('Notifications')}>
              <Ionicons name="notifications-outline" size={22} color="white" />
              {unreadCount > 0 && (
                <View className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 items-center justify-center border border-brand-500">
                  <Text className="text-white text-[10px] font-bold">{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center mb-2">
            <MaterialCommunityIcons name="paw" size={24} color="white" />
            <Text className="text-white text-2xl font-bold ml-2">PawCare</Text>
          </View>
          <Text className={`${subtitleColor} text-sm mb-8`}>Find the perfect care for your pet</Text>
        </>
      }
    >

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Service Type Pills */}
        <View className="px-6 py-4">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row -mx-2">
            {SERVICE_TYPES.map((service, index) => (
              <TouchableOpacity
                key={service.id}
                onPress={() => handleServiceTypePress(service.label)}
                className={`rounded-full px-6 py-3 flex-row items-center mx-2 ${
                  index === 0
                    ? 'bg-blue-500'
                    : index === 1
                    ? 'bg-purple-500'
                    : 'bg-brand-500'
                }`}
              >
                <Ionicons name={service.icon as any} size={18} color="white" />
                <Text className="text-white font-semibold ml-2">{service.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {renderSection('Recently Booked', 'time-outline', recentlyBooked, 'recently-booked')}
        {renderSection('Near You', 'location-outline', nearYou, 'near-you')}
        {renderSection('Most Popular', 'trending-up-outline', mostPopular, 'most-popular', 'popular')}
        {renderSection('Special Deals', 'pricetag-outline', specialDeals, 'special-deals', 'deal')}

        {!isLoading && nearYou.length === 0 && mostPopular.length === 0 && recentlyBooked.length === 0 && specialDeals.length === 0 && (
          loadError ? (
            <View className="flex-1 items-center justify-center py-20 px-6">
              <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
              <Text className={`text-lg font-semibold ${sectionTitleColor} mt-4 text-center`}>Couldn’t load services</Text>
              <Text className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-2 text-center`}>
                {loadError}
              </Text>
            </View>
          ) : (
            <View className="flex-1 items-center justify-center py-20 px-6">
              <Ionicons name="paw-outline" size={48} color="#9CA3AF" />
              <Text className={`text-lg font-semibold ${sectionTitleColor} mt-4 text-center`}>No services found</Text>
              <Text className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-2 text-center`}>
                Check back soon — new partners are joining every day.
              </Text>
            </View>
          )
        )}
      </ScrollView>
    </ScreenLayout>
  );
}
