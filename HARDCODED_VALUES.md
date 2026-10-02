# Hardcoded Values Register

What the app shows or depends on that is typed into the source rather than coming from the API,
the build config or a translation — fake data, invented claims, untranslated text, magic config.

First swept 2026-06-27; **fully re-swept 2026-10-02** across the front end and the backend. Each
entry below was re-verified against the code that day. `__tests__/hardcodedValues.test.ts` fails if
any of the removed fake data comes back.

Legend: 🔴 fake data or claim shown to users · 🟠 config that belongs in env/one constant ·
🟡 untranslated or static copy · ✅ resolved

---

## Open

### 🔴 Social sign-in does not work
`context/AuthContext.tsx` calls Google with the literal client ids `'YOUR_ANDROID_CLIENT_ID'` /
`'YOUR_IOS_CLIENT_ID'` / `'YOUR_WEB_CLIENT_ID'`, and the login screen's "Continue with Facebook"
button has an empty `onPress`. Neither can work as things stand: the backend has **no social-login
endpoint**, and on a Google "success" the app stores Google's access token as if it were a
PetBooker JWT. Needs a product decision — remove the buttons, or build the feature end to end
(AuthApi endpoint that verifies the provider token and issues our own, then env-configured ids).

### 🔴 Terms of Service / Privacy Policy do not exist
The register screen's "By creating an account you agree to our **Terms of Service** and **Privacy
Policy**" styles both as links with no handler, and Settings › Terms & Privacy Policy has none
either. There is no such document anywhere. Legal/product, not code — once there are documents,
wire them as build-config URLs the same way the support contact is (see below).

### 🔴 `ProviderDetailScreen` is orphaned
Registered in `App.tsx`, reached by nothing. Its invented "About" bio is gone, but the screen still
has untranslated literals ("Contact for pricing", "Loading services...", "Tap a service to book
it"). Delete it, or route to it and translate it.

### 🟠 Boost / featured / ad promotion types are dead
Only `'offer'` promotions (backed by a `ServiceDiscount`) are ever created. The `'boost'` budget,
views and clicks branches in `PromotionCard` and `EditPromotionScreen` are reachable by nothing now
that the mock fallback is gone. Safe to delete with the `TYPE_META` entries they use.

### 🟠 Token lifetimes mirrored by hand
`services/token-storage.ts` — `ACCESS_TOKEN_TTL_MS = 30 min`, `REFRESH_TOKEN_TTL_MS = 7 days`.
These must match AuthApi's token lifetimes; the login response does not carry an expiry to read.

### 🟠 Third-party endpoints
Each is now defined once, but still a public free service: Nominatim (`services/geocoding.ts`, web
only), the OSRM demo router (`services/route-path.ts` — `OSRM_ROUTE_URL`), flagcdn
(`components/shared/CountryFlag.tsx`). Fine for display; swap for hosted ones before real traffic.

### 🟡 Small untranslated strings
`addressLabel()` falls back to English `'Selected location'` (`services/geocoding.ts`); the
web-only `MessagesSplitView` panel and a few `accessibilityLabel`s are English. Icon-only buttons on
My Services (edit/delete) have no `accessibilityLabel` at all.

### 🟡 Brand spelling
"Pet Booker" (login, `login.appName`) vs "PetBooker" (side-nav, emails). Pick one.

### Backend (PetBookerBackend) — reported, not yet changed
- 🟡 **Email footer** — `EmailTemplates/Layout.html` (both hosts) ends every email with the English
  "PetBooker • Love, care, and trust for every pet.", including Serbian and Russian ones.
- 🟠 **Dead templates** — `PetBooker.Services/Email/Templates/*` is never loaded (the renderer reads
  each host's `EmailTemplates/`), and `AuthApi/EmailTemplates` carries booking/review/certificate
  templates AuthApi never sends.
- 🔴 **"Contact support" with no contact** — the BookingCancelled email says so and names none.
  Pairs with the FE's `EXPO_PUBLIC_SUPPORT_EMAIL`; the backend needs the same as config.
- 🟠 **Nominatim User-Agent** — `GeoOptions.NominatimUserAgent` defaults to
  `PetBooker/1.0 (+https://petbooker.example)`. OSM's policy wants a real contact; set
  `Geo:NominatimUserAgent` on every deployed environment.
- 🟠 **Default sender** — base `appsettings.json` sends from `noreply@petbooker.local`; a deployment
  that forgets `EMAIL_FROM` mails from a domain that does not exist.

---

## Resolved 2026-10-02

| Was | Now |
|---|---|
| Service preview location always **"San Francisco, CA"**; its extras section rendered a heading with nothing under it (it expected the old fixed pickup/drop-off numbers) | The address picked for the service (section hidden without one) and the real extras by name and price |
| `review-booking-screen/components/BookingDetails.tsx` — "December 15, 2024", "123 Main St, San Francisco" | Deleted (nothing imported it) |
| **Promotion analytics** entirely invented — 3,420 views, 156 clicks, "586%" ROI, an April chart, a cost analysis, three "insights" | The offer's real details plus a plain "performance tracking is coming" note; the 20 mock i18n keys removed |
| Edit Promotion / Analytics fell back to a made-up **"Spring Boost – Golden Gate Park"** campaign when opened without one | A "this promotion isn't available" state |
| Promotion card **"0 uses"** on every offer | Hidden until redemptions are tracked |
| "Partners who run promotions get **3x more bookings**" (sr/ru only — en had been fixed) | Same honest line as English |
| Tour slide **"Bookings ↑ 32%"** | "Shown in Special Deals while an offer is active" — what an offer really does |
| Account **"VISA •••• 4242, Expires 12/25"** with dead Add Card / Remove | Removed — there is no card entry, and the payment methods bookings create are internal placeholders |
| Support card **`partners@pawcare.com` / `(555) 123-4567`**; Settings › Help & Support did nothing | `EXPO_PUBLIC_SUPPORT_EMAIL` / `EXPO_PUBLIC_SUPPORT_PHONE` (`services/support.ts`, Dockerfile.web + compose args); every surface hides itself when unset |
| Cancellation policy: free until 24h before, then **a 50% charge** | What the backend enforces: cancellable any time before the service starts, no fee |
| Application progress: a **"Background Check"** step and a bar fixed at **60%** | Received → Review → Decision; no bar. The applicant's "Background Check" notice (which addressed the admin) is now "How we verify you" |
| Profile footer **"v1.0.0"** and **"© 2025"** | The build's version (`expo-constants`) and the current year |
| Tour: **"JUNE 2025"**, English weekday initials, every label English | Current month and weekdays in the reader's language (sr-Latn for Serbian); all scene text translated |
| "% OFF" badges English in every language | `shared.amountOff` (sr "POPUSTA", ru "СКИДКА") |
| Home location label **"Belgrade, Serbia"** / **"Current Location"** in English | `locationLabel()` → `home.defaultArea` / `home.currentLocation` |
| Country picker "Select Country" / "No matches"; map "Loading map..." / "You are here" | Translated |
| Belgrade default coordinates typed in **3 files**; OSRM URL and Google directions link in **3 files** each | `DEFAULT_LOCATION` (`hooks/useLocation.ts`); `osrmRouteUrl` / `googleDirectionsUrl` (`services/route-path.ts`) |
| Placeholders "Central Park", "123 Main Street", literal `john@example.com` | Belgrade examples (Kalemegdan, Knez Mihailova) in every language; the localized email example |
| `ProviderDetailScreen` "…a trusted provider on **PawCare**" bio | Removed (no bio field exists) |
| Settings / Notifications painted their own grey ground and navy headings | Theme tokens |

### Resolved earlier
- **Currency symbol** (2026-08-06) — every price goes through `formatMoney(amount, currency)` from
  `services/money.ts`; never hardcode a symbol, in TSX or in an i18n string.
- **Mock schedule data** (2026-08-06) — `scheduleData.ts` has no fabricated fallback.
- **Unsplash fallback images** — gone; `ServicePhoto` layers a paw placeholder behind every photo.
- **Partner application service types** — read from `useEnums()` with `PROVIDER_TYPE_LABELS` as
  the pre-load fallback.
- **Service type colours** — one map, `SERVICE_TYPE_COLORS` in `hooks/useThemeColors.ts`.
