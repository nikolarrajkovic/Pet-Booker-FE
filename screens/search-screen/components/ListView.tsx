import React from 'react';
import { ScrollView, Text, View, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ServiceDto, serviceCurrency } from '../../../services/services';
import { formatMoney } from '../../../services/currency';
import { useLocale } from '../../../context/LocaleContext';
import LoadMoreFooter, { isNearBottom } from '../../../components/shared/LoadMoreFooter';
import ResponsiveGrid from '../../../components/shared/ResponsiveGrid';
import { useResponsive } from '../../../hooks/useResponsive';

export interface ServiceSearchItem {
  id: number;
  name: string;
  service: string; // service-type displayName (e.g. "Walker")
  rating: number;
  reviews: number;
  distance: string;
  price: number;
  image: string;
  // Pin position from the service address (null = not geocoded → no map pin)
  latitude: number | null;
  longitude: number | null;
  dto: ServiceDto; // the real service record — booking targets this
}

interface ListViewProps {
  services: ServiceSearchItem[];
  isDarkMode: boolean;
  textColor: string;
  subtextColor: string;
  cardBg: string;
  borderColor: string;
  // When the list is scoped to a Home category (Most Popular / Special Deals),
  // every card carries the same banner the Home cards show.
  badge?: 'popular' | 'deal';
  /**
   * Paging, when the caller's list is paged. Omit for a complete list (a Home rail) and no
   * footer renders. The next page loads as the user nears the bottom — phone-first — with the
   * footer's button as the manual fallback.
   */
  paging?: {
    total: number;
    hasMore: boolean;
    isLoadingMore: boolean;
    onLoadMore: () => void;
  };
}

export default function ListView({
  services,
  isDarkMode,
  textColor,
  subtextColor,
  cardBg,
  borderColor,
  badge,
  paging,
}: ListViewProps) {
  const navigation = useNavigation();
  const { t } = useLocale();
  const { isWebLayout } = useResponsive();

  /**
   * One result card — identical in both designs, so only the arrangement changes and the two
   * cannot drift apart in what a result actually tells you.
   *
   * `mb-3` is the phone stack's spacing; in a grid the cell owns the gap, so it is dropped there.
   */
  const card = (item: ServiceSearchItem) => (
    <TouchableOpacity
      accessibilityRole="button"
      key={item.id}
      onPress={() => (navigation as any).navigate('ServiceDetail', { service: item.dto })}
      className={`${cardBg} ${isWebLayout ? '' : 'mb-3'} flex-row rounded-2xl border p-3 shadow-sm ${borderColor}`}
      activeOpacity={0.9}>
      {/* Service image + category banner (Popular / Deal) */}
      <View className="relative">
        <Image source={{ uri: item.image }} className="h-20 w-20 rounded-xl" resizeMode="cover" />
        {badge === 'popular' && (
          <View className="absolute left-1 top-1 flex-row items-center rounded-full bg-amber-500 px-1.5 py-0.5">
            <Ionicons name="flame" size={10} color="white" />
            <Text className="ml-0.5 text-[9px] font-bold text-white">Popular</Text>
          </View>
        )}
        {badge === 'deal' && (
          <View className="absolute left-1 top-1 flex-row items-center rounded-full bg-red-500 px-1.5 py-0.5">
            <Ionicons name="pricetag" size={10} color="white" />
            <Text className="ml-0.5 text-[9px] font-bold text-white">Deal</Text>
          </View>
        )}
      </View>

      {/* Service info */}
      <View className="ml-3 flex-1 justify-between">
        <View>
          <Text className={`text-base font-semibold ${textColor}`} numberOfLines={1}>
            {item.name}
          </Text>
          {item.service ? (
            <Text className={`text-sm ${subtextColor} mt-0.5`}>{item.service}</Text>
          ) : null}
        </View>

        <View className="flex-row items-center gap-3">
          {item.rating > 0 && (
            <View className="flex-row items-center">
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text
                className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} ml-1 font-medium`}>
                {item.rating.toFixed(1)} <Text className={subtextColor}>({item.reviews})</Text>
              </Text>
            </View>
          )}
          {item.distance ? (
            <View className="flex-row items-center">
              <Ionicons name="location" size={14} color="#6B7280" />
              <Text className={`text-sm ${subtextColor} ml-1`}>{item.distance}</Text>
            </View>
          ) : null}
        </View>

        {/* Each service prices in its own provider's currency, so format per item. */}
        <Text className="mt-1 font-semibold text-brand-600">
          {t('bookService.priceFrom')} {formatMoney(item.price, serviceCurrency(item.dto))}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      className="flex-1"
      scrollEventThrottle={16}
      onScroll={paging ? (e) => (isNearBottom(e) ? paging.onLoadMore() : undefined) : undefined}>
      <View className="px-6 pt-8">
        <Text className={`text-sm ${subtextColor} mb-4`}>{services.length} services found</Text>

        {/*
          The card is a wide, short row: the right shape in a 390px column, and the wrong one
          across 1120px, where it becomes a thumbnail with an acre of blank space beside it. Two
          per row on a desktop keeps the row's proportions close to the phone's while using the
          width — three would squeeze the name and price into ellipses.
        */}
        {isWebLayout ? (
          <ResponsiveGrid columns={{ mobile: 1, tablet: 1, desktop: 2, wide: 3 }} gap={12}>
            {services.map(card)}
          </ResponsiveGrid>
        ) : (
          services.map(card)
        )}
      </View>

      {paging && services.length > 0 && (
        <LoadMoreFooter
          loaded={services.length}
          total={paging.total}
          hasMore={paging.hasMore}
          isLoadingMore={paging.isLoadingMore}
          onLoadMore={paging.onLoadMore}
        />
      )}

      {/* Bottom spacing — clears the phone's pinned tab bar, which the web design does not have. */}
      <View className={isWebLayout ? 'h-8' : 'h-24'} />
    </ScrollView>
  );
}
