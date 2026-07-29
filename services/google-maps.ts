/**
 * Web-only loader for the Google Maps JavaScript API. Injects the <script> tag
 * once per page and resolves with the `google.maps` namespace; every web map
 * component goes through this instead of adding its own tag.
 *
 * The key comes from EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY (referrer-restricted to
 * the dev origin, API-restricted to the Maps JavaScript API). Without billing
 * enabled Google serves the map in development mode — darkened tiles with a
 * "For development purposes only" watermark — which is expected during dev.
 *
 * Only import this from `.web.tsx` files: it touches `document`/`window`.
 */

// The google.maps namespace (untyped — @types/google.maps not installed).
export type GoogleMapsApi = any;

// Map ID required by AdvancedMarkerElement; DEMO_MAP_ID is Google's documented
// development id (swap for a real Cloud-console map ID before production).
export const DEV_MAP_ID = 'DEMO_MAP_ID';

// Google expects BCP-47 tags. Serbian must be sr-Latn so map labels render in
// Latin script (matching the app's Serbian Latin locale), not Cyrillic.
const GOOGLE_LANGUAGE: Record<string, string> = { en: 'en', sr: 'sr-Latn', ru: 'ru' };

let loadPromise: Promise<GoogleMapsApi> | null = null;

/**
 * Load the Maps JS API (idempotent). `language` only takes effect on the first
 * call — the script loads once and its label language is fixed for the session.
 */
export function loadGoogleMaps(language?: string): Promise<GoogleMapsApi> {
  if (loadPromise) return loadPromise;

  const existing = (window as any).google?.maps;
  if (existing) {
    loadPromise = Promise.resolve(existing);
    return loadPromise;
  }

  const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY;
  if (!key || key.startsWith('YOUR_')) {
    return Promise.reject(
      new Error('EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY is not set — add it to .env and restart Expo')
    );
  }

  loadPromise = new Promise((resolve, reject) => {
    const callbackName = '__pbGoogleMapsReady';
    (window as any)[callbackName] = () => {
      delete (window as any)[callbackName];
      resolve((window as any).google.maps);
    };
    const params = new URLSearchParams({
      key,
      v: 'weekly',
      loading: 'async',
      libraries: 'marker',
      language: GOOGLE_LANGUAGE[language ?? 'en'] ?? 'en',
      callback: callbackName,
    });
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      loadPromise = null;
      delete (window as any)[callbackName];
      reject(new Error('Failed to load Google Maps'));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}
