import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { formatMoney } from '../../../services/currency';
import { serviceCurrency } from '../../../services/services';
import type { ServiceSearchItem } from './ListView';

import { BRAND_GREEN } from '../../../hooks/useThemeColors';
import { useTabBarHeight } from '../../../hooks/useSafeAreaSpacing';
import { useLocale } from '../../../context/LocaleContext';
import { serviceDetailParams } from '../../../navigation/linking';
interface LocationData {
  latitude: number;
  longitude: number;
  loading: boolean;
}

interface MapViewComponentProps {
  services: ServiceSearchItem[];
  location: LocationData;
  isDarkMode?: boolean;
  /**
   * Selection mode (the group-request picker). When given, a pin's card toggles the service in
   * or out of the selection instead of opening ServiceDetail, and selected pins are drawn filled.
   */
  selectedIds?: number[];
  onToggleSelect?: (item: ServiceSearchItem) => void;
  /** Distance of the card from the bottom edge. Defaults to clearing the tab bar. */
  bottomOffset?: number;
}

// Hide POI icons/labels and transit clutter so the service pins stand out.
// Labels-only for POIs keeps park/landscape fills (relevant for walkers).
const MAP_DECLUTTER_STYLE = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

/**
 * Search results map (native). Tapping a price pin opens a bottom card with the
 * service photo/name/type/rating/price (custom, instead of the default callout
 * — Android callouts render as a static bitmap and won't show async-loaded
 * images); tapping the card goes to ServiceDetail, tapping the map dismisses.
 */
export default function MapViewComponent({
  services,
  location,
  isDarkMode,
  selectedIds,
  onToggleSelect,
  bottomOffset,
}: MapViewComponentProps) {
  const navigation = useNavigation();
  const { t } = useLocale();
  const tabBarHeight = useTabBarHeight();
  const [selected, setSelected] = useState<ServiceSearchItem | null>(null);
  const selectMode = onToggleSelect != null;
  const isPicked = (id: number) => selectedIds?.includes(id) ?? false;

  if (location.loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-gray-500">{t('shared.loadingMap')}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 overflow-hidden">
      <MapView
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsPointsOfInterest={false}
        customMapStyle={MAP_DECLUTTER_STYLE}
        onPress={() => setSelected(null)}>
        {/* Current location marker */}
        <Marker
          coordinate={{
            latitude: location.latitude,
            longitude: location.longitude,
          }}
          title={t('shared.youAreHere')}
          pinColor={BRAND_GREEN}
        />

        {/* Service markers — only services with a geocoded address get a pin */}
        {services
          .filter((item) => item.latitude != null && item.longitude != null)
          .map((item) => (
            <Marker
              key={item.id}
              coordinate={{
                latitude: item.latitude!,
                longitude: item.longitude!,
              }}
              onPress={(e) => {
                e.stopPropagation();
                setSelected(item);
              }}>
              <View className="items-center">
                <View
                  className={`rounded-full border px-3 py-1.5 shadow-lg ${
                    selected?.id === item.id || (selectMode && isPicked(item.id))
                      ? 'border-brand-600 bg-brand-500'
                      : 'border-gray-200 bg-white'
                  }`}>
                  <Text
                    className={`text-xs font-bold ${
                      selected?.id === item.id || (selectMode && isPicked(item.id))
                        ? 'text-white'
                        : 'text-gray-900'
                    }`}>
                    {selectMode && isPicked(item.id) ? '✓ ' : ''}
                    {formatMoney(item.price, serviceCurrency(item.dto))}
                  </Text>
                </View>
              </View>
            </Marker>
          ))}
      </MapView>

      {/* Selected-service card — replaces the default marker callout */}
      {selected && (
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.9}
          accessibilityLabel={
            selectMode
              ? isPicked(selected.id)
                ? t('groupRequest.removeProvider')
                : t('groupRequest.addProvider')
              : undefined
          }
          onPress={() =>
            selectMode
              ? onToggleSelect!(selected)
              : (navigation as any).navigate('ServiceDetail', serviceDetailParams(selected.dto))
          }
          className={`absolute left-4 right-4 flex-row items-center rounded-2xl p-3 shadow-lg ${
            isDarkMode ? 'bg-[#1a2332]' : 'bg-white'
          }`}
          // Sits above the tab bar rather than behind it. `bottom-4` measured from the screen edge,
          // which put the card under the bar on a phone — and under the system navigation buttons
          // below that.
          style={{ elevation: 6, bottom: (bottomOffset ?? tabBarHeight) + 16 }}>
          <Image source={{ uri: selected.image }} className="h-16 w-16 rounded-xl" />
          <View className="ml-3 flex-1">
            <Text
              numberOfLines={1}
              className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {selected.name}
            </Text>
            {!!selected.service && (
              <Text
                numberOfLines={1}
                className={`mt-0.5 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {selected.service}
              </Text>
            )}
            {selected.rating > 0 && (
              <View className="mt-1 flex-row items-center">
                <Ionicons name="star" size={12} color="#FBBF24" />
                <Text className={`ml-1 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {selected.rating.toFixed(1)}
                  {selected.reviews > 0 ? ` (${selected.reviews})` : ''}
                </Text>
              </View>
            )}
          </View>
          <View className="ml-2 items-end">
            <Text className="text-base font-bold text-brand-500">
              {formatMoney(selected.price, serviceCurrency(selected.dto))}
            </Text>
            {selectMode ? (
              <Ionicons
                name={isPicked(selected.id) ? 'checkbox' : 'square-outline'}
                size={22}
                color={BRAND_GREEN}
              />
            ) : (
              <Ionicons
                name="chevron-forward"
                size={18}
                color={isDarkMode ? '#9CA3AF' : '#6B7280'}
              />
            )}
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}
