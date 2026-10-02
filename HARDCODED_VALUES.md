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

### 🔴 Terms of Service / Privacy Policy do not exist yet — kept on purpose
The register screen's "By creating an account you agree to our **Terms of Service** and **Privacy
Policy**" styles both as links with no handler, and Settings › Terms & Privacy Policy has none
either. The documents are coming (decision 2026-10-02: keep the wording and rows, wire them when
the texts exist) — at that point make them build-config URLs the way the support contact is.

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

### Backend (PetBookerBackend) — in matejamilicevic3316/PetBookerBackend#169 (open)
- **Email footer** — the shared layout ended every email, Serbian and Russian included, with the
  English tagline. Now a per-language `Footer.html`.
- **Dead templates** — `PetBooker.Services/Email/Templates` (never loaded), AuthApi's copies of 20
  templates it never sends, PetBookerApi's registration templates. Each host now ships exactly what
  it sends, pinned by a test. The "contact support" line with no contact lived only in AuthApi's
  unused `BookingCancelled` — the cancellation mail users get never said it.
- **Default sender** — base `appsettings.json` sent from `noreply@petbooker.local`; now blank, and
  both hosts refuse to boot outside Development/Docker with a blank or reserved-domain sender.
- **Nominatim User-Agent** — was `PetBooker/1.0 (+https://petbooker.example)`; the sandbox now sends
  its own `PUBLIC_HOST` as the contact.

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
| **"Continue with Google / Facebook"** — Google on placeholder client ids (`YOUR_WEB_CLIENT_ID`…), Facebook a no-op, no backend endpoint behind either | Removed from the login screen and `AuthContext` (decision 2026-10-02, "for now"); `expo-auth-session` / `expo-web-browser` stay installed so bringing it back is code only |
| Settings / Notifications painted their own grey ground and navy headings | Theme tokens |

### Resolved earlier
- **Currency symbol** (2026-08-06) — every price goes through `formatMoney(amount, currency)` from
  `services/money.ts`; never hardcode a symbol, in TSX or in an i18n string.
- **Mock schedule data** (2026-08-06) — `scheduleData.ts` has no fabricated fallback.
- **Unsplash fallback images** — gone; `ServicePhoto` layers a paw placeholder behind every photo.
- **Partner application service types** — read from `useEnums()` with `PROVIDER_TYPE_LABELS` as
  the pre-load fallback.
- **Service type colours** — one map, `SERVICE_TYPE_COLORS` in `hooks/useThemeColors.ts`.
