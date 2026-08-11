import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { formatMoney } from '../../../services/currency';
import { serviceCurrency } from '../../../services/services';
import type { ServiceSearchItem } from './ListView';

import { BRAND_GREEN } from '../../../hooks/useThemeColors';
interface LocationData {
  latitude: number;
  longitude: number;
  loading: boolean;
}

interface MapViewComponentProps {
  services: ServiceSearchItem[];
  location: LocationData;
  isDarkMode?: boolean;
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
}: MapViewComponentProps) {
  const navigation = useNavigation();
  const [selected, setSelected] = useState<ServiceSearchItem | null>(null);

  if (location.loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-gray-500">Loading map...</Text>
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
          title="You are here"
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
                    selected?.id === item.id
                      ? 'border-brand-600 bg-brand-500'
                      : 'border-gray-200 bg-white'
                  }`}>
                  <Text
                    className={`text-xs font-bold ${
                      selected?.id === item.id ? 'text-white' : 'text-gray-900'
                    }`}>
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
          activeOpacity={0.9}
          onPress={() => (navigation as any).navigate('ServiceDetail', { service: selected.dto })}
          className={`absolute bottom-4 left-4 right-4 flex-row items-center rounded-2xl p-3 shadow-lg ${
            isDarkMode ? 'bg-[#1a2332]' : 'bg-white'
          }`}
          style={{ elevation: 6 }}>
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
            <Ionicons name="chevron-forward" size={18} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}
