import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
  loading: boolean;
  error: string | null;
}

export function useLocation() {
  const [location, setLocation] = useState<LocationData>({
    latitude: 44.8176, // Default to Belgrade
    longitude: 20.4570,
    address: 'Belgrade, Serbia',
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (!navigator.geolocation) {
        setLocation((prev) => ({ ...prev, loading: false, error: 'Geolocation not supported' }));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            address: 'Current Location',
            loading: false,
            error: null,
          });
        },
        () => {
          setLocation((prev) => ({ ...prev, loading: false, error: 'Failed to get location' }));
        }
      );
      return;
    }

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocation((prev) => ({
            ...prev,
            loading: false,
            error: 'Permission to access location was denied',
          }));
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({});
        
        // Reverse geocode to get address
        const address = await Location.reverseGeocodeAsync({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });

        if (address[0]) {
          // Build address in format: streetNumber, street, city
          const streetNumber = address[0].streetNumber || address[0].name?.match(/^\d+/)?.[0];
          const parts = [
            streetNumber,
            address[0].street,
            address[0].city,
          ].filter(Boolean);
          const fullAddress = parts.join(', ');
          
          setLocation({
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
            address: fullAddress || 'Unknown',
            loading: false,
            error: null,
          });
        }
      } catch (error) {
        setLocation((prev) => ({
          ...prev,
          loading: false,
          error: 'Failed to get location',
        }));
      }
    })();
  }, []);

  return location;
}
