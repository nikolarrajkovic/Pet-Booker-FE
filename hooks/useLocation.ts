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

/**
 * The device position, with a Belgrade placeholder to render against until the real fix lands.
 *
 * **Gate anything position-dependent on `loading`.** The hook always reports coordinates, so a
 * caller that fires the moment it has some issues its request against the placeholder and then
 * a second one against the real position — a wrong-city result, twice the traffic. `loading`
 * settles to false on success, denial and failure alike, so waiting on it never hangs.
 */
export function useLocation() {
  const [location, setLocation] = useState<LocationData>({
    latitude: 44.8176, // Default to Belgrade
    longitude: 20.457,
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
        },
        // Without a timeout the browser leaves this pending indefinitely while a permission
        // prompt sits unanswered — neither callback fires, so `loading` never settles and
        // anything gated on it (the Near You rail) waits forever. Time out into the error
        // path instead, which falls back to the placeholder position.
        { timeout: 10000, maximumAge: 60000 }
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

        // Reverse geocode to get address. Best-effort: the label is a nicety, the coordinates
        // are the point. Callers gate real work on `loading`, so a failed or empty lookup must
        // still settle the hook — leaving it pending stranded them on the placeholder position.
        let fullAddress = '';
        try {
          const address = await Location.reverseGeocodeAsync({
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          });
          if (address[0]) {
            // Build address in format: streetNumber, street, city
            const streetNumber = address[0].streetNumber || address[0].name?.match(/^\d+/)?.[0];
            fullAddress = [streetNumber, address[0].street, address[0].city]
              .filter(Boolean)
              .join(', ');
          }
        } catch {
          /* keep the coordinates; fall through to the generic label */
        }

        setLocation({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          address: fullAddress || 'Current Location',
          loading: false,
          error: null,
        });
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
