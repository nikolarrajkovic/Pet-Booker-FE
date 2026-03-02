import React from 'react';
import { View, Text } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

interface Provider {
  id: number;
  name: string;
  service: string;
  price: number;
  verified: boolean;
  latitude: number;
  longitude: number;
}

interface LocationData {
  latitude: number;
  longitude: number;
  loading: boolean;
}

interface MapViewComponentProps {
  providers: Provider[];
  location: LocationData;
}

export default function MapViewComponent({ providers, location }: MapViewComponentProps) {
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
      >
        {/* Current location marker */}
        <Marker
          coordinate={{
            latitude: location.latitude,
            longitude: location.longitude,
          }}
          title="You are here"
          pinColor="#00C870"
        />

        {/* Provider markers */}
        {providers.map((provider) => (
          <Marker
            key={provider.id}
            coordinate={{
              latitude: provider.latitude,
              longitude: provider.longitude,
            }}
            title={provider.name}
            description={`${provider.service} - $${provider.price}`}
          >
            <View className="items-center">
              <View className="bg-white rounded-full px-3 py-1.5 shadow-lg border border-gray-200">
                <Text className="text-gray-900 font-bold text-xs">${provider.price}</Text>
              </View>
              {provider.verified && (
                <View className="absolute -top-1 -right-1 w-4 h-4 bg-brand-500 rounded-full items-center justify-center border border-white">
                  <Ionicons name="checkmark" size={10} color="white" />
                </View>
              )}
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}
