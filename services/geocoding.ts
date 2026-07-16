import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { AddressDto } from './service-providers';

export type GeoPoint = { latitude: number; longitude: number };

/** One-line label for a resolved address (for display in the booking UI). */
export function addressLabel(a: AddressDto): string {
  return [a.line1, a.city, a.state].filter(Boolean).join(', ') || 'Selected location';
}

/**
 * Reverse-geocodes a map pin into the `AddressDto` the booking endpoint needs
 * (line1 / city / state / postalCode / country). Native uses the OS geocoder via
 * expo-location; web uses OpenStreetMap Nominatim (expo-location's reverse
 * geocode is not available on web).
 */
export async function reverseGeocodeToAddress(point: GeoPoint): Promise<AddressDto> {
  const address =
    Platform.OS === 'web' ? await reverseGeocodeWeb(point) : await reverseGeocodeNative(point);
  // The address DTO now carries geo coords — attach the exact pin location the
  // user picked so the saved address (booking pickup/drop-off, account) keeps it.
  return { ...address, location: { latitude: point.latitude, longitude: point.longitude } };
}

async function reverseGeocodeNative(point: GeoPoint): Promise<AddressDto> {
  const [a] = await Location.reverseGeocodeAsync(point);
  if (!a) return { line1: '', line2: '', city: '', state: '', postalCode: '', country: '' };
  const streetNumber = a.streetNumber || a.name?.match(/^\d+/)?.[0] || '';
  return {
    line1: [streetNumber, a.street].filter(Boolean).join(' ') || a.name || '',
    line2: '',
    city: a.city || a.subregion || a.district || '',
    state: a.region || '',
    postalCode: a.postalCode || '',
    country: a.isoCountryCode || a.country || '',
  };
}

/**
 * Forward-geocodes a typed address/place into a coordinate, so the map can jump
 * to it. Native uses the OS geocoder; web uses Nominatim search. Returns null
 * when nothing matches.
 */
export async function forwardGeocode(query: string): Promise<GeoPoint | null> {
  const q = query.trim();
  if (!q) return null;
  if (Platform.OS === 'web') {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=sr-Latn&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return null;
    return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
  }
  const results = await Location.geocodeAsync(q);
  if (!results?.length) return null;
  return { latitude: results[0].latitude, longitude: results[0].longitude };
}

/** One-shot current position (null if unavailable/denied). */
export async function getCurrentPosition(): Promise<GeoPoint | null> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({});
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return null;
  }
}

async function reverseGeocodeWeb(point: GeoPoint): Promise<AddressDto> {
  // External geocoding service (not the app API), so a direct fetch is correct
  // here — apiFetch/apiAuthFetch build URLs from the app's base URL.
  // accept-language=sr-Latn → Nominatim prefers the `name:sr-Latn` OSM tags, so
  // Serbian place/road names come back in Latin script instead of Cyrillic
  // (matches the map's Latin labels). Falls back to the default name elsewhere.
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=sr-Latn` +
    `&lat=${point.latitude}&lon=${point.longitude}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Could not look up that location. Please try again.');
  const data = await res.json();
  const a = data.address ?? {};
  return {
    line1: [a.house_number, a.road].filter(Boolean).join(' ') || data.name || '',
    line2: '',
    city: a.city || a.town || a.village || a.hamlet || a.suburb || '',
    state: a.state || a.region || '',
    postalCode: a.postcode || '',
    country: a.country_code ? String(a.country_code).toUpperCase() : a.country || '',
  };
}
