import React from 'react';
import { View, Text } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

interface ServiceItem {
  id: number;
  name: string;
  service: string;
  price: number;
  latitude: number;
  longitude: number;
}

interface LocationData {
  latitude: number;
  longitude: number;
  loading: boolean;
}

interface MapViewComponentProps {
  services: ServiceItem[];
  location: LocationData;
}

export default function MapViewComponent({ services, location }: MapViewComponentProps) {
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
        showsMyLocationButton={true}>
        {/* Current location marker */}
        <Marker
          coordinate={{
            latitude: location.latitude,
            longitude: location.longitude,
          }}
          title="You are here"
          pinColor="#00C870"
        />

        {/* Service markers */}
        {services.map((item) => (
          <Marker
            key={item.id}
            coordinate={{
              latitude: item.latitude,
              longitude: item.longitude,
            }}
            title={item.name}
            description={`${item.service} - $${item.price}`}>
            <View className="items-center">
              <View className="rounded-full border border-gray-200 bg-white px-3 py-1.5 shadow-lg">
                <Text className="text-xs font-bold text-gray-900">${item.price}</Text>
              </View>
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}
