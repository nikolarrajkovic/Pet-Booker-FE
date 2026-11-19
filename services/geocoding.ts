import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { AddressDto } from './service-providers';
import type { TranslationKey } from '../i18n';

export type GeoPoint = { latitude: number; longitude: number };

/**
 * One-line label for an address, the way it reads here: "Nemanjina 4, 11000 Belgrade".
 *
 * The region (`state`) is left out. Serbian addresses have none, and while the backend required
 * one the apps filled it with "-", the city again or a made-up code, so every address line read
 * "Belgrade, CS". Use this for every address shown to a person rather than joining fields by hand.
 */
export function addressLabel(a: AddressDto): string {
  const place = [a.postalCode, a.city].filter(Boolean).join(' ');
  return [a.line1, place].filter(Boolean).join(', ') || 'Selected location';
}

/** Where in the building: what the map picker asks under the pin. */
export type AddressDetails = Pick<AddressDto, 'entrance' | 'floor' | 'apartment' | 'line2'>;

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** The details of an address, trimmed, with blanks as null: what is sent and stored. */
export function cleanAddressDetails(d: AddressDetails): AddressDetails {
  const clean = (v?: string | null) => (v ?? '').trim() || null;
  return {
    entrance: clean(d.entrance),
    floor: clean(d.floor),
    apartment: clean(d.apartment),
    line2: clean(d.line2),
  };
}

/** "Entrance 2 · Floor 3 · Flat 12 · intercom Petrović", or '' when none was given. */
export function addressDetailsLine(a: AddressDto | null | undefined, t: Translate): string {
  if (!a) return '';
  const d = cleanAddressDetails(a);
  return [
    d.entrance ? t('address.entranceValue', { value: d.entrance }) : null,
    d.floor ? t('address.floorValue', { value: d.floor }) : null,
    d.apartment ? t('address.apartmentValue', { value: d.apartment }) : null,
    d.line2,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The address with where in the building after it: for the person going there, or checking it. */
export function addressWithDetails(a: AddressDto, t: Translate): string {
  const details = addressDetailsLine(a, t);
  return details ? `${addressLabel(a)} · ${details}` : addressLabel(a);
}

/**
 * A Google Maps link that shows an address: by its stored coordinates when it has them, else by
 * the address text. Opens the maps app on a phone and the site on the web.
 */
export function mapsSearchUrl(a: AddressDto): string {
  const point = a.location;
  const query =
    point?.latitude != null && point?.longitude != null
      ? `${point.latitude},${point.longitude}`
      : [a.line1, a.postalCode, a.city, a.country].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
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
    line1: streetLine(a.street, streetNumber) || a.name || '',
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

/** One match for a typed address, as the map picker lists it. */
export type AddressSuggestion = { point: GeoPoint; title: string; subtitle: string };

/**
 * The places matching a typed address, nearest to `near` first where the geocoder can tell, so
 * the map picker can list them and the person picks the right one (app review 2026-11-13). The
 * picker used to jump to the first match, and "Nemanjina 4" has one in central Belgrade, one in
 * Grocka and one in Zemun. Run on an explicit search, never per keystroke: Nominatim's usage
 * policy forbids search-as-you-type. Native uses the OS geocoder, labelled by reverse lookup.
 */
export async function searchAddresses(
  query: string,
  near?: GeoPoint | null
): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (!q) return [];
  if (Platform.OS === 'web') {
    // A viewbox around the map biases the ranking toward where the person is looking, without
    // ruling out a match elsewhere (bounded=0).
    const box = near
      ? `&bounded=0&viewbox=${near.longitude - 0.3},${near.latitude + 0.3},${near.longitude + 0.3},${near.latitude - 0.3}`
      : '';
    const url =
      `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&accept-language=sr-Latn` +
      `${box}&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return distinct(
      data.map((item: any) => {
        const a = item.address ?? {};
        const city = cityOf(a);
        return {
          point: { latitude: parseFloat(item.lat), longitude: parseFloat(item.lon) },
          title:
            streetLine(a.road, a.house_number) ||
            item.name ||
            String(item.display_name ?? '').split(',')[0],
          subtitle: [[a.postcode, areaOf(a, city)].filter(Boolean).join(' '), city]
            .filter(Boolean)
            .join(', '),
        };
      })
    );
  }
  const found = (await Location.geocodeAsync(q)).slice(0, 5);
  const labelled = await Promise.all(
    found.map(async (r) => {
      const point = { latitude: r.latitude, longitude: r.longitude };
      try {
        const a = await reverseGeocodeNative(point);
        return {
          point,
          title: a.line1 || q,
          subtitle: [a.postalCode, a.city].filter(Boolean).join(' '),
        };
      } catch {
        return { point, title: q, subtitle: '' };
      }
    })
  );
  return distinct(labelled);
}

/** Matches that read the same are one choice, however many OSM objects stand behind them. */
function distinct(items: AddressSuggestion[]): AddressSuggestion[] {
  const seen = new Set<string>();
  return items
    .filter((s) => Number.isFinite(s.point.latitude) && Number.isFinite(s.point.longitude))
    .filter((s) => {
      const key = `${s.title}|${s.subtitle}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

/**
 * The part of a city a match is in ("Zemun", "Grocka"), when it isn't the city itself: what tells
 * apart two "Nemanjina 4" in Belgrade. Nominatim names a Serbian municipality "Gradska opština …".
 */
function areaOf(a: NominatimAddress & { city_district?: string }, city: string): string {
  const raw = a.suburb || a.city_district || a.city || '';
  let area = raw.replace(/^(gradska opština|opština|градска општина|општина)\s+/i, '').trim();
  // Belgrade's parts come as "Beograd (Savski venac)": the city is said once, after it.
  const inCity = /^(.+?)\s*\((.+)\)$/.exec(area);
  if (inCity && inCity[1].trim().toLowerCase() === city.toLowerCase()) area = inCity[2].trim();
  return area && area.toLowerCase() !== city.toLowerCase() ? area : '';
}

/**
 * Resolves an address to a coordinate: its stored `location` when the API has
 * one, otherwise forward-geocodes its text. Returns null when the address is
 * missing, has no usable text, or can't be found.
 *
 * Stored service/profile addresses very often have `location: null` (seeded
 * rows, or ones copied from a profile address that itself had no coords), so
 * the geocode fallback is what makes address-based positioning actually work.
 * Uses postalCode + country (rather than the display-oriented `addressLabel`)
 * because that reads far better as a geocoder query.
 */
export async function addressToPoint(a?: AddressDto | null): Promise<GeoPoint | null> {
  if (!a) return null;
  if (a.location) return { latitude: a.location.latitude, longitude: a.location.longitude };
  const query = [a.line1, a.postalCode, a.city, a.country].filter(Boolean).join(', ');
  if (!query) return null;
  try {
    return await forwardGeocode(query);
  } catch {
    return null;
  }
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

/**
 * "Bulevar kralja Aleksandra 73": the street, then the number, as addresses are written here.
 * Both geocoders hand the parts back separately, and the number went first ("73 Bulevar…").
 */
export function streetLine(street?: string | null, houseNumber?: string | null): string {
  return [street, houseNumber]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  suburb?: string;
  county?: string;
};

/**
 * The city of a Nominatim address. In Serbian cities Nominatim puts the municipality in `city`
 * ("Gradska opština Vračar") and the city itself in `county` ("Grad Beograd"), so Belgrade was
 * stored under seventeen municipality names. The `Grad …` county names the city.
 */
export function cityOf(a: NominatimAddress): string {
  const county = (a.county ?? '').trim();
  const isMunicipality = /^(gradska opština|opština|градска општина|општина)\s/i.test(
    (a.city ?? '').trim()
  );
  const countyCity = county.match(/^(grad|град)\s+(.+)$/i)?.[2];
  if (isMunicipality && countyCity) return countyCity;
  return a.city || a.town || a.village || a.hamlet || a.suburb || countyCity || '';
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
    line1: streetLine(a.road, a.house_number) || data.name || '',
    line2: '',
    city: cityOf(a),
    state: a.state || a.region || '',
    postalCode: a.postcode || '',
    country: a.country_code ? String(a.country_code).toUpperCase() : a.country || '',
  };
}
