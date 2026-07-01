# Hardcoded Values Audit

A sweep of the codebase for hardcoded values — mock/placeholder data that should come
from the API, hardcoded config that should be env/constants, sample display strings,
brand-name inconsistencies, and colors that bypass the theme system.

Generated 2026-06-27. Line numbers are approximate and may drift as the code changes.

Legend:
- 🔴 **Data** — fake/mock/placeholder data shown to users; should be API-driven or removed.
- 🟠 **Config** — values that belong in env vars or a central constants file.
- 🟡 **Copy** — hardcoded marketing/static text (lower priority, but not localizable).
- 🔵 **Style** — colors/sizes that bypass `useThemeColors()` / `brand-*` tokens (violates CLAUDE.md styling rules).

---

## 🔴 Mock / placeholder DATA (should be API-driven or removed)

### `screens/my-schedule-screen/utils/mockScheduleData.ts`
- **L25–119** — `mockScheduleData`: a full month of fake bookings (provider names "Happy Paws Walking", pet names, "Central Park"/"Golden Gate Park" locations, fixed `2026-04-*` dates). Used as a **fallback** whenever live data isn't injected via `setLiveScheduleData()` — so any code path that reads the schedule before/without loading real bookings shows fake appointments.

### `screens/promotions-screen/containers/PromotionsScreen.tsx`
- **L53–86** — `PERFORMANCE_STATS`: hardcoded "Performance Overview" tiles ("2" Active Promotions, "20" Bookings from Promos, "$88" Total Spent, "$4.38" Cost per Booking). Pure mock — not derived from any data.
- **L44** — `usageCount: 0` (BACKEND-GAP, acknowledged in comment).

### `screens/promotions-screen/containers/PromotionAnalyticsScreen.tsx`
- **L16–24** — `dailyData`: hardcoded 7-day views/clicks/bookings series.
- **L45–46** — Title/description default to `'Spring Boost - Dog Walking'` / `'Premium Dog Walking in Golden Gate Park'`.
- **L51+** — `STAT_CARDS`: hardcoded "3,420 Total Views", "+12% vs last week", etc. The entire analytics screen is mock.

### `screens/promotions-screen/containers/EditPromotionScreen.tsx`
- **L63–73** — `FALLBACK` promotion: `'Spring Boost - Dog Walking'`, `'Premium Dog Walking in Golden Gate Park'`, `budgetSpent: 87.5`, `budgetTotal: 150`. Standalone-mode mock.

### `screens/account-screen/containers/AccountScreen.tsx`
- **L310–331** — "Payment Methods" card is fully mock (comment says so): hardcoded `VISA`, `•••• •••• •••• 4242`, `Expires 12/25`; the "+ Add Card" and "Remove" buttons have no handlers.

### `screens/review-booking-screen/components/BookingDetails.tsx`
- **L22, L31, L40** — Entire component is hardcoded: Date `December 15, 2024`, Time `2:00 PM`, Pickup `Yes - 123 Main St, San Francisco, CA`. **Appears to be dead code** — not imported anywhere (ReviewBookingScreen is API-wired). Candidate for deletion.

### `components/shared/ServiceDetailView.tsx`
- **L134** — Location hardcoded to `San Francisco, CA`. This shared component is rendered by `ServicePreviewScreen`, so the preview always shows the wrong city.

### `screens/provider-detail-screen/containers/ProviderDetailScreen.tsx`
- **L140–143** — "About" copy is mocked (BACKEND-GAP P3: provider DTO has no bio field). Note: this whole screen is **orphaned** per CLAUDE.md (nothing navigates to it).

### `screens/new-requests-screen/containers/NewRequestsScreen.tsx`
- **L82, L98, L102** — `clientPhone: ''`, `serviceLocation: ''`, `notesFromOwner: ''` — empty placeholders for fields the backend doesn't expose (BACKEND-GAP B1, documented).

---

## 🟠 Hardcoded CONFIG & external resources (should be env vars / constants)

### `context/AuthContext.tsx`
- **L37–39** — Google OAuth client IDs are placeholders: `'YOUR_ANDROID_CLIENT_ID'`, `'YOUR_IOS_CLIENT_ID'`, `'YOUR_WEB_CLIENT_ID'`. Google sign-in is non-functional until these move to env config.

### `hooks/useLocation.ts`
- **L15–17** — Default location hardcoded to Belgrade: `latitude: 44.8176`, `longitude: 20.4570`, `address: 'Belgrade, Serbia'`. (Intentional "Belgrade-first" default, but it's a magic constant.)

### `services/token-storage.ts`
- **L19–20** — Token TTLs hardcoded: `ACCESS_TOKEN_TTL_MS = 30 min`, `REFRESH_TOKEN_TTL_MS = 7 days`. Should ideally mirror the server's actual token lifetimes.

### Fallback images (Unsplash) — same magic URL in 3 places
- `screens/home-screen/containers/HomeScreen.tsx` **L21**
- `screens/search-screen/containers/SearchScreen.tsx` **L25**
- `screens/provider-detail-screen/containers/ProviderDetailScreen.tsx` **L19**
  - All three: `FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=600'`. Duplicated — should be one shared constant.

### External service URLs (CDNs / map / geocoding APIs)
- `components/shared/MapAddressPicker.web.tsx` **L99, L104, L111** — unpkg maplibre CSS/JS + `tiles.openfreemap.org`.
- `screens/search-screen/components/MapView.web.tsx` **L36, L56, L62** — same maplibre/openfreemap URLs.
- `components/shared/DirectionsModal.web.tsx` **L73, L78, L84, L95, L115** — unpkg leaflet, OSM tiles, OSRM router, Google Maps directions.
- `components/shared/DirectionsModal.tsx` **L49, L134** — OSRM router + Google Maps directions URLs.
- `services/geocoding.ts` **L45, L86** — Nominatim search/reverse endpoints (with `accept-language=sr-Latn` hardcoded).
- `components/shared/CountryFlag.tsx` **L23** — `https://flagcdn.com/48x36/${code}.png`.
  - These are pinned dependency/version URLs and third-party endpoints embedded in source; consider centralizing.

### Support contact info
- `screens/application-submitted-screen/components/NeedHelpCard.tsx` **L20, L26** — `partners@pawcare.com` and `(555) 123-4567` (fake US support number; also wrong brand, see below).

### Default country
- `components/shared/countries.ts` **L125** — phone defaults to Serbia (`RS`/`+381`). Intentional but hardcoded.

---

## ⚠️ Brand-name inconsistency — app is "PetBooker" but UI says "PawCare"

The product/repo is **PetBooker**, but user-facing strings say **PawCare**:
- `screens/home-screen/containers/HomeScreen.tsx` **L259** — header logo text `PawCare`.
- `screens/profile-screen/containers/ProfileScreen.tsx` **L173** — `PawCare v1.0.0` (version string also hardcoded).
- `screens/provider-detail-screen/containers/ProviderDetailScreen.tsx` **L141** — "...provider on PawCare".
- `screens/become-partner-screen/components/TestimonialCard.tsx` **L25** — "PawCare helped me turn my passion...".
- `screens/application-submitted-screen/components/NeedHelpCard.tsx` **L20** — `partners@pawcare.com`.

---

## 🟡 Hardcoded marketing / static COPY

### `screens/become-partner-screen/containers/BecomePartnerScreen.tsx`
- **L9–14** — `benefits` array (titles/descriptions/colors).
- **L16–20** — `howItWorks` steps ("within 24-48 hours").
- **L22–27** — `requirements` list.
- **L55, L61, L67** — stat card numbers: `10K+` Active Providers, `$2K` Avg Monthly Earnings, `4.8★` Provider Rating (fabricated marketing stats).

### `screens/become-partner-screen/components/TestimonialCard.tsx`
- **L21, L25** — hardcoded testimonial author "Dog Walker, San Francisco" + quote.

### `screens/application-submitted-screen/components/VerificationProgress.tsx`
- **L41–42** — Document-review progress bar hardcoded to `width: '60%'`; all four steps' statuses are static.

### `screens/application-submitted-screen/components/WhileYouWaitCard.tsx`
- **L10–14** — `tips` array (static guidance text).

### `screens/partner-hub-screen/containers/PartnerHubScreen.tsx`
- **L684** — "Growth Tip": "...get 40% more bookings." (static claim).

### `screens/partner-application-screen/components/ServiceInfoStep.tsx`
- **L5–12** — `serviceTypes` is a hardcoded list (Dog Walking, Grooming, Pet Sitting, Boarding, Training, Veterinary). Should source from `useEnums().serviceProviderType` (like `FilterModal` already does) — otherwise it can drift from the backend enum.

### Placeholder strings referencing real-world spots
- `screens/my-services-screen/containers/AddEditServiceScreen.tsx` **L437** — placeholder `"e.g., Premium Dog Walking in Central Park"`.
- `screens/partner-application-screen/components/PersonalInfoStep.tsx` **L195** — placeholder `"Belgrade"`.

---

## 🔵 Colors that bypass the theme system (CLAUDE.md violation)

CLAUDE.md requires going through `useThemeColors()` and `brand-*` tokens — *"never hardcode
green hex values."* In practice hex colors appear **~724 times across 91 files**. Most are
icon-background accent swatches (`#EEF2FF`, `#FEF3C7`, etc.) which CLAUDE.md tolerates as
"genuinely bespoke", but two classes are clear violations:

**1. The brand green `#00C870` hardcoded inline instead of the `brand-500` token** — appears in dozens of files, e.g.:
- `screens/partner-hub-screen/containers/PartnerHubScreen.tsx` — L356, L360, L687 (and the header bg).
- `screens/admin-dashboard-screen/containers/AdminDashboardScreen.tsx` — L211, L215, L266, L287, L319, L383, L389 (+ more).
- `screens/promotions-screen/containers/PromotionsScreen.tsx` **L187**, and most `color="#00C870"` icon usages app-wide.

**2. Color *data* defined as local constants instead of in the theme/Tailwind config:**
- `screens/my-schedule-screen/utils/mockScheduleData.ts` **L122–126** — `SERVICE_TYPE_COLORS` (walking/grooming/sitting palettes); **L200, L218** — inline workload thresholds (`#86EFAC`/`#FDE047`/`#FCA5A5`).
- `screens/admin-dashboard-screen/containers/AdminDashboardScreen.tsx` **L34–40** — `TYPE_COLORS` per ServiceProviderType.

> Note: an exhaustive per-line list of all 724 hex occurrences is omitted as noise; the
> systemic fix is to route brand/semantic colors through `useThemeColors()` /
> `tailwind.config.js` and keep only truly one-off accents inline.

---

## Quick reference — files with the most impactful hardcoding

| File | Type | What |
|---|---|---|
| `screens/my-schedule-screen/utils/mockScheduleData.ts` | 🔴 Data | Full mock schedule fallback |
| `screens/promotions-screen/containers/PromotionAnalyticsScreen.tsx` | 🔴 Data | Entire screen is mock |
| `screens/promotions-screen/containers/PromotionsScreen.tsx` | 🔴 Data | Mock performance stats |
| `screens/account-screen/containers/AccountScreen.tsx` | 🔴 Data | Mock saved card |
| `screens/review-booking-screen/components/BookingDetails.tsx` | 🔴 Data | Fully hardcoded (likely dead code) |
| `components/shared/ServiceDetailView.tsx` | 🔴 Data | "San Francisco, CA" location |
| `context/AuthContext.tsx` | 🟠 Config | Placeholder Google OAuth IDs |
| `hooks/useLocation.ts` | 🟠 Config | Belgrade default coords |
| Home/Search/ProviderDetail | 🟠 Config | Duplicated Unsplash fallback image |
| `screens/application-submitted-screen/components/NeedHelpCard.tsx` | 🟠 Config | Fake support email/phone |
| Multiple (HomeScreen, ProfileScreen, …) | ⚠️ Brand | "PawCare" vs "PetBooker" |
| `screens/partner-application-screen/components/ServiceInfoStep.tsx` | 🟡 Copy | Service types should use enums |
