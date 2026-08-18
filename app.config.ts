import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic half of the Expo config. The static identity (name, slug, package, icons, plugins)
 * lives in `app.json` and is handed to this file as `config`; everything here is a value that
 * either comes from the environment or depends on which build profile is running.
 *
 * ## Why the Maps keys are not in app.json
 *
 * This repo is public, so a native Google Maps key committed to `app.json` would be scraped
 * within days. The keys are read from the environment instead — locally from `.env.local`, and
 * on EAS from that profile's environment variables (see `ANDROID_BUILD.md`). They still end up
 * inside the built APK, as they must for the Maps SDK to read them: what protects them is the
 * key restriction in Google Cloud (package name + signing SHA-1), not secrecy of the binary.
 *
 * When a key is absent the whole `config.googleMaps` block is omitted rather than shipping a
 * placeholder string, so the failure mode is a blank map rather than a rejected key.
 *
 * ## Why cleartext HTTP is profile-dependent
 *
 * Android has blocked plain `http://` since API 28. A debug build is exempt, which is why the
 * dev server works, but a release APK — which is what the `preview` profile produces — is not:
 * against an `http://` backend every request fails with a cleartext-not-permitted error. Test
 * builds therefore opt in, and `production` deliberately does not: a store build must talk
 * HTTPS.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  // Set by EAS Build; absent for local `expo start` / `expo run:android`, which are debug builds
  // and allow cleartext anyway.
  const profile = process.env.EAS_BUILD_PROFILE;
  const isProduction = profile === 'production';

  const androidMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY;
  const iosMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY;

  return {
    ...config,
    name: config.name ?? 'PetBooker',
    slug: config.slug ?? 'petbooker',
    android: {
      ...config.android,
      ...(androidMapsKey ? { config: { googleMaps: { apiKey: androidMapsKey } } } : {}),
    },
    ios: {
      ...config.ios,
      ...(iosMapsKey ? { config: { googleMapsApiKey: iosMapsKey } } : {}),
    },
    plugins: [
      ...(config.plugins ?? []),
      [
        'expo-build-properties',
        {
          android: { usesCleartextTraffic: !isProduction },
        },
      ],
    ],
  };
};
