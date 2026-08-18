# Android builds — test APK now, Play Store later

## What you get, and what your users get

`eas build --profile preview` produces a **signed release APK**: an ordinary Android app you can
send to anyone. They download it, tap it, allow "install unknown apps" once, and it runs.

**Nobody needs Expo.** Expo Go is a development sandbox and this project can't use it anyway
(`react-native-maps`, `expo-secure-store` and SignalR need custom native code). A Play Store
release is built from the same config as an `.aab` and installs like any other app — nothing in it
reveals which toolchain built it.

| Profile       | Artifact          | For                                     |
| ------------- | ----------------- | --------------------------------------- |
| `development` | APK + dev client  | Debugging against a Metro dev server    |
| `preview`     | APK, standalone   | **This** — your phone and your friends' |
| `production`  | AAB, store-signed | Play Store upload via `eas submit`      |

---

## One-time setup

### 1. Expo account and CLI

```bash
npm install -g eas-cli
```

Sign up at <https://expo.dev/signup> (free), then:

```bash
eas login
```

### 2. Link the project

```bash
eas init
```

This creates the project on your account and writes `extra.eas.projectId` into `app.json`. Commit
that change — it is not a secret, and **push notifications need it**: without a project id
`getExpoPushToken()` returns null and device push silently stays off.

### 3. Google Maps key for Android

The native maps (`react-native-maps`) need their own key — the web key is restricted by HTTP
referrer, which does not apply to an app. Without one, every native map renders as a blank grey
grid; nothing else breaks.

1. Google Cloud Console → the same project as the web key → enable **Maps SDK for Android**.
2. Create an API key, restrict it to **Android apps**, package name `com.petbooker.app`.
3. It also wants the signing certificate's SHA-1, which EAS only generates on the first build.
   Either run one build first and read it from `eas credentials -p android` (Keystore → SHA-1
   Fingerprint), or leave the key restricted only to the Maps SDK for Android API until you have
   it.
4. Store it where the build can see it — **not** in a committed file, this repo is public:

```bash
eas env:create --name EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY --value YOUR_KEY --environment preview --visibility sensitive
```

For local `expo run:android` builds, put the same variable in `.env.local` instead.

`app.config.ts` reads it and injects it into the native manifest; when it is unset the whole block
is omitted, so a build never ships a placeholder key.

### 4. Push notifications (optional — skip for the first test build)

Android push goes through Firebase, so Expo needs FCM V1 credentials for your app:

1. Firebase console → new project → add an Android app with package `com.petbooker.app`.
2. Download `google-services.json` into the repo root (it is **not** gitignored by default — keep
   it out of the public repo, or add it to `.gitignore` and upload it to EAS instead) and set
   `"googleServicesFile": "./google-services.json"` under `android` in `app.json`.
3. Firebase → Project settings → Service accounts → generate a private key, then upload it with
   `eas credentials -p android` → _Push Notifications: Manage your FCM V1 service account key_.

Until this is done the app behaves like a device with notifications switched off: registration
returns null and fails soft, and the in-app SignalR notifications still work while the app is
open. Only pushes to a **closed** app are missing.

---

## When the backend host URL is ready

1. Put it in `eas.json` — replace `https://REPLACE-WITH-BACKEND-HOST` in the `preview` (and later
   `production`) profile's `env`. This is the value that gets baked into the JS bundle; it is the
   only edit needed to point a build at a different server.
2. **Prefer HTTPS with a real certificate.** Android rejects self-signed certs outright. Plain
   `http://` works for `preview` and `development` (`app.config.ts` enables cleartext traffic for
   them) but **not** for `production`, deliberately.
3. Check the backend is reachable from outside your LAN and that `/hubs/chat`, `/hubs/notifications`
   and `/hubs/location` are exposed too — the app opens SignalR WebSocket connections to all three,
   and reverse proxies commonly need WebSocket upgrade enabled explicitly.

Then build:

```bash
npm run build:android
```

Roughly 10–25 minutes on the free tier (queue included). The CLI prints a build page URL; that
page has a QR code and a download link.

> First build only: EAS asks to generate an Android keystore. Say yes — it stores and reuses it.
> **That keystore is what identifies your app to Play forever**; if you lose it you cannot update
> a published app. Back it up later with `eas credentials -p android` → Keystore → Download.

---

## Shipping changes: over the air vs. a new build

The app carries `expo-updates`, so which route a change takes depends on what it touched.

**JS/TS and assets — over the air.** Screens, services, i18n, styling: publish and every installed
app picks it up on next launch. No reinstall, no new link to hand out.

```bash
npm run update:preview
```

That takes about a minute. The update goes to the `preview` **channel**, which is the channel the
`preview` build profile stamps into the APK, so only those builds receive it. `production` builds
follow the `production` channel and are untouched until you publish there too.

**Native changes — a new build.** A dependency with native code, anything in `app.json` /
`app.config.ts` (permissions, plugins, package name, Maps key, cleartext), the icon or splash, or
an Expo SDK bump. An OTA update cannot add native code to an already-installed binary.

### The rule that bites people

`runtimeVersion` uses the `appVersion` policy: an update is only delivered to builds whose
`version` in `app.json` matches. So when a change **adds or upgrades a native module, bump
`version`** (1.0.0 → 1.1.0) in the same commit as the rebuild. Otherwise the next OTA update
reaches older binaries that lack the native code it calls, and they crash on launch — the one
failure mode of EAS Update that is genuinely hard to diagnose after the fact.

Bumping `version` also fences off the old builds cleanly: they stay on the last update that
matched their version instead of receiving something they cannot run.

---

## Installing on a phone

- **Your phone**: open the build page link, tap Install (or scan the QR), then allow the browser to
  install unknown apps when Android prompts.
- **Friends' phones**: send them the same link. It works for anyone, no account, no device
  registration. Free-plan builds stay downloadable for ~30 days; after that, rebuild.
- **Over USB**: `npx eas-cli build:run -p android --latest` installs the newest build via adb.

iOS is not comparable here — Apple forbids sideloading, so testers go through TestFlight, which
needs a paid Apple Developer account ($99/yr) and `eas build -p ios --profile preview`.

---

## Before you publish to Play

- **`com.petbooker.app` is permanent.** The package name cannot be changed after the first upload
  to Play. Change it now (in `app.json`) if you want something else — e.g. a domain you own.
- **The app icon and splash are still the Expo template placeholders** (`assets/icon.png`,
  `adaptive-icon.png`, `splash.png` — grey circles). Replace before release: 1024×1024 icon, and an
  adaptive-icon foreground with its content inside the central safe zone.
- `version` in `app.json` is what users see; `versionCode` is managed remotely by EAS
  (`appVersionSource: "remote"` + `autoIncrement` on the production profile), so you never bump it
  by hand.
- `npm run build:android:production` → `.aab`, then `eas submit -p android`.
- Play also requires a privacy policy URL, the Data safety form (this app collects location,
  photos, and account data), and a content rating questionnaire.

---

## Troubleshooting

| Symptom                                    | Cause                                                                                                                                           |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Every screen errors, nothing loads         | `EXPO_PUBLIC_API_BASE_URL` unreachable from the phone, or `https` with an invalid/self-signed certificate                                       |
| Works on Wi-Fi at home only                | The URL is a LAN address; the phone must be on the same network, and the backend bound to `0.0.0.0` with the Windows firewall open on that port |
| Requests fail only in a `production` build | Cleartext HTTP is disabled there on purpose — the host must be HTTPS                                                                            |
| Maps are blank grey                        | Missing `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY`, or its package/SHA-1 restriction doesn't match this build's keystore                             |
| Live chat/notifications don't arrive       | SignalR hubs not exposed through the host, or WebSocket upgrade not enabled on the proxy                                                        |
| Push never arrives when the app is closed  | FCM V1 credentials not set up (step 4)                                                                                                          |
| Need the crash reason                      | Build page → Logs, or `adb logcat` while reproducing                                                                                            |

---

## Local build (alternative, no cloud)

Possible but heavier: install JDK 17 and the Android SDK (~10 GB), then

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

The APK lands in `android/app/build/outputs/apk/release/`. Note `android/` is gitignored — it is
generated output, and `app.json` / `app.config.ts` remain the source of truth. Nothing about your
source leaves the machine this way, but you sign and manage the keystore yourself.
