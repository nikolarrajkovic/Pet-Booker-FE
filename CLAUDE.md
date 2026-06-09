# PetBooker FE — Claude Instructions

## Stack
- React Native + Expo SDK 54 (Android, iOS, Web)
- TypeScript, NativeWind (Tailwind CSS for RN), React Navigation v7
- No server-state cache library (no React Query / SWR) — all API data lives in component state
- API base URL (dev): `http://localhost:5161` — read from `process.env.EXPO_PUBLIC_API_BASE_URL`

---

## Project Layout

```
services/           # All API calls and storage utilities
  http.ts           # apiFetch + apiAuthFetch + getApiBaseUrl + parseApiError + extractPageItems + registerSessionExpiredHandler
  auth.ts           # Auth endpoints including token refresh
  token-storage.ts  # Token persistence with TTL
  enums.ts          # Enum/lookup data
  pets.ts           # Pet CRUD (get/create/update/delete) + bulk photo upload
  files.ts          # File/image upload utilities
  service-providers.ts  # ServiceProviderDto, ProviderViewModel, providerToViewModel, resolveImageUrl, getServiceProviders, getServiceProvider, createServiceProvider
  services.ts       # ServiceDto, getServices, getService, createService, updateService, deleteService
  reviews.ts        # ReviewDto, getReviews, createReview
  bookings.ts       # BookingDto, BookingViewModel, bookingToViewModel, get/create/cancel/delete + state/status enums
  payment-methods.ts  # PaymentMethodDto, getPaymentMethods, createPaymentMethod, deletePaymentMethod
  admin.ts          # Admin-only actions: approveServiceProvider, approveCertificate
  service-discounts.ts  # ServiceDiscountDto, DiscountType, getServiceDiscounts, create/update/deleteServiceDiscount
  notifications.ts  # UserNotificationSettingsDto, getNotificationSettings, saveNotificationSettings, defaultNotificationSettings

context/
  AuthContext.tsx   # isLoggedIn, isAdmin, isPartner, currentUser, auth actions
  EnumsContext.tsx  # Fetch-once enum cache, cleared on logout
  ThemeContext.tsx  # isDarkMode, toggleDarkMode

components/shared/  # Reusable UI — ALWAYS check here first before creating a new component
components/         # One-off or screen-specific components (e.g. FilterModal)

screens/<name>-screen/
  containers/   # Smart component: data fetching, state, navigation logic
  components/   # Dumb/presentational sub-components for that screen

hooks/          # Custom hooks
  useLocation.ts      # Geolocation + reverse geocode
  useThemeColors.ts   # Single source of truth for the dark/light palette (see Styling System)
assets/         # Images, fonts
CLAUDE.md       # This file — primary AI context. (.github/copilot-instructions.md is a legacy copy for GitHub Copilot)
```

---

## HTTP Layer — `services/http.ts`

- **`apiFetch(url, init?)`** — Unauthenticated. Use for public endpoints.
- **`apiAuthFetch(url, init?)`** — Automatically attaches `Authorization: Bearer <token>`. Use for all authenticated endpoints. Silently refreshes the access token if expired before making the request.
- **`getApiBaseUrl()`** — Returns `EXPO_PUBLIC_API_BASE_URL` with any trailing slash stripped (throws if unset). **Single source of truth** — every service builds URLs from this. Never re-implement it locally.
- **`parseApiError(response, fallback, context?)`** — Extracts a human-readable message from a failed `Response`. Resolution order: ASP.NET validation errors (`{ errors: { Field: ["msg"] } }`) → `{ message }` → `{ detail }` → `{ title }` → raw text → `fallback`. Pass a `context` tag (e.g. `'createPet'`) for the dev console log. **Use this in every `if (!response.ok)` block** instead of re-writing the parse logic.
- **`extractPageItems<T>(raw)`** — Extracts the items array from any paginated or plain list response. Handles plain array, `{ items }`, `{ data }`, `{ results }`, `{ value }`. **Always use this** instead of inline `Array.isArray` branching in service list functions.
- **`registerSessionExpiredHandler(handler)`** — Registers a callback invoked when a token refresh fails. Called by AuthContext on mount. Do not call this elsewhere.
- **Rule**: Never call `fetch()` directly. Always use `apiFetch` or `apiAuthFetch`.
- FormData bodies: do NOT set `Content-Type` — the runtime must set it with the multipart boundary.
- In dev mode, all requests/responses are logged to console.

Standard service error pattern:
```ts
if (!response.ok) {
  throw new Error(await parseApiError(response, 'Failed to …', 'fnName'));
}
```

---

## Services

### `services/auth.ts`
- `loginWithEmailPassword(payload)` → POST `/auth/login` → `{ accessToken, refreshToken }`
- `refreshAccessToken(refreshToken)` → POST `/auth/refresh` → `{ accessToken, refreshToken? }`
- `registerUser(payload)` → POST `/auth/register`
- `getMe()` → GET `/auth/me` (auth) → `CurrentUser`
- `confirmEmail(email, code)` → POST `/auth/confirm-email`
- `resendConfirmation(email)` → POST `/auth/resend-confirmation`
- `updateProfile({ userName, firstName, lastName, phone, email })` → PUT `/auth/profile` (auth). **Email is read-only server-side** — sending a changed email returns 400 "Email cannot be changed via profile update"; send the current email unchanged. AccountScreen keeps the email field read-only.
- `changePassword({ currentPassword, newPassword, confirmPassword })` → POST `/auth/change-password` (auth)
- `forgotPassword(email)` → POST `/auth/forgot-password` (public)
- `resetPassword({ resetToken, newPassword, confirmPassword })` → POST `/auth/reset-password` (public)
- `logout()` → POST `/auth/logout` (auth). Called best-effort by `signOut()` before clearing tokens.
- Type `CurrentUser`: `{ id, email, emailConfirmed, roles[], groups[], userName, firstName, lastName }`

### `services/token-storage.ts`
- `saveTokens(accessToken, refreshToken?)` — stores with TTL (access: 30 min, refresh: 7 days)
- `getAccessToken()` — returns null if expired
- `getRefreshToken()` — returns null if expired
- `clearTokens()` — wipes all stored tokens
- Native: `expo-secure-store` | Web: `localStorage`

### `services/enums.ts`
- `fetchEnums()` → GET `/enums` (auth) → `EnumsData`
- **Never call directly from screens** — always use `useEnums()` from EnumsContext.
- `EnumsData` keys: `paymentType`, `serviceProviderType`, `discountType`, `bookingStatusType`, `paymentStatus`, `sex`, `paymentMethodStatus`, `bookingState`, `providerProfileStatus`, `pushPlatform`, `emailTemplateType`
- Each key is `EnumEntry[] = { value: number, name: string }[]`

### `services/pets.ts`
- `getPets(ownerUserId)` → GET `/api/pets?OwnerUserId={id}` (auth) → `PetResponse[]`
  - Handles paginated wrappers: plain array, `{ items }`, `{ data }`, `{ results }`
- `createPet(input)` → auto-uploads photos via `uploadFilesBulk()` first, then POST `/api/pets`
  - Sex mapping: "male" → 1, "female" → 2 (else 0). Pet type: dog=1, cat=2, parrot=3, turtle=4, fish=5, snake=6.
  - Weight/height unit conversion (kg↔lbs, cm↔in) via geolocation
- `updatePet(input)` → PUT `/api/pets/{petId}`. Takes `UpdatePetInput` (= `CreatePetInput` + `petId` + optional `originalPhotos`). Separates already-uploaded photos (http/https URIs) from new local photos, uploads only the new ones, and preserves existing photo metadata.
- `deletePet(petId)` → DELETE `/api/pets/{petId}`
- Type `PetResponse`: `{ id, ownerUserId, name, type, petType, breed, sex, dateOfBirth, ageYears, weightKg, heightCm, dietaryNotes, favoriteFood, additionalNotes, photoUrl, isActive, photos[] }`

### `services/files.ts`
- `uploadFile(uri, fileName?, mimeType?)` → POST `/files/upload` (auth, multipart) → `UploadedFile`
- `uploadFilesBulk(files[])` → POST `/files/upload/bulk` (auth) → `UploadedFile[]`
- Type `UploadedFile`: `{ id, src, originalName, contentType, sizeBytes }`
- Web: handles base64 data URIs. Native: handles file system URIs.
- Prefer bulk upload over individual uploads.

### `services/service-providers.ts`
- **Types**: `ServiceProviderDto`, `AddressDto`, `PhotoDto`, `ProviderViewModel`
- **`ProviderViewModel`** — canonical provider shape passed through navigation params across HomeScreen → SearchScreen → ProviderDetail → BookService → ReviewBooking. Fields not yet in the API (rating, reviews, distance, lat/lng) default to 0/''. Always use this type for the `provider` nav param.
- **`providerToViewModel(dto)`** — maps `ServiceProviderDto` → `ProviderViewModel`. Use in every screen that fetches a provider list.
- **`resolveImageUrl(src)`** — prepends `getApiBaseUrl()` to relative `/files/...` paths; returns absolute URLs as-is.
- `getServiceProviders(params?)` → GET `/api/service-providers` (auth) → `ServiceProviderDto[]`. Params: `name`, `city`, `type`, `page`, `perPage`. **No `isApproved` filter exists** — fetch all and filter client-side (admin screens do this).
- `getServiceProvider(id)` → GET `/api/service-providers/{id}` (auth) → `ServiceProviderDto`
- `deleteServiceProvider(id)` → DELETE `/api/service-providers/{id}` (auth). Used as the "reject application" action (there is no server-side rejected state).
- `providerTypeLabel(type)` → friendly label for a `ServiceProviderType` enum value.
- `createServiceProvider(payload)` → POST `/api/service-providers` (auth)
  - Payload (`CreateServiceProviderPayload`): `{ fullName, email, phone, streetAddress, city, state, zipCode, selectedServices[], yearsOfExperience, aboutYou, certifications, availability, profilePhoto, petPhotoFiles[], governmentIdFiles[], certificateFiles[], userId }`
  - Uploads all files (profile photo + pet photos + government IDs + certificates) in **one** `uploadFilesBulk()` call, then routes them into the DTO: profile + pet photos → `photos[]` (`isSelected`); government IDs → `governmentIdPhotos[]` (`isFront`); certificates → `certificates[]`, each referencing its upload via `fileIds: number[]`.
  - New applications post with top-level `isApproved: false` (and per-certificate `isApproved: false`) — an admin approves later. The DTO has no top-level `city`/`photoUrl`; city lives in `address`.

### `services/services.ts`
- **Type**: `ServiceDto` — `{ id?, serviceProviderId, name?, notes?, basePrice, escrowAmount, isEscrowPercentEnabled, escrowPercent?, pricing?, details?, photos? }`
- `details` contains: `{ supportsPickup, pickupPriceSurcharge?, supportsLeaveOver, leaveOverPriceSurcharge? }`
- `getServices(params?)` → GET `/api/services` (auth) → `ServiceDto[]`. Params: `serviceProviderId`, `name`, `supportsPickup`, `supportsLeaveOver`, `page`, `perPage`.
- `getService(id)` → GET `/api/services/{id}` (auth) → `ServiceDto`
- `createService(service)` → POST `/api/services` (auth) → `ServiceDto`
- `updateService(id, service)` → PUT `/api/services/{id}` (auth) → `ServiceDto`
- `deleteService(id)` → DELETE `/api/services/{id}` (auth)

### `services/reviews.ts`
- **Type**: `ReviewDto` — `{ id?, bookingId, userId, serviceProviderId, rating, title?, comment?, photos? }`
- `getReviews(params?)` → GET `/api/reviews` (auth) → `ReviewDto[]`. Params: `serviceProviderId`, `userId`, `bookingId`, `rating`, `page`, `perPage`.
- `createReview(review)` → POST `/api/reviews` (auth) → `ReviewDto`. **`bookingId` must reference a real, existing booking** — the API validates the FK and rejects otherwise. So reviews can only be created after a booking exists.

### `services/bookings.ts`
- **Types**: `BookingDto`, `BookingViewModel`, `CreateBookingInput`. Exported enum maps: `BookingState` (0=Upcoming, 1=Completed, 2=Cancelled), `BookingStatusType` (0=ServiceRequestedByUser … 5=PostPayment), `PaymentType` (0=Cash, 1=Card, 2=BankTransfer, 3=Wallet).
- **`bookingToViewModel(dto)`** — flattens a booking (with its nested `serviceProvider`/`service`/`pet` includes) into `BookingViewModel` for display. `statusLabel` ('upcoming'|'completed'|'cancelled') is derived from `state`.
- `getBookings(params?)` → GET `/api/bookings`. Params: `userId`, `serviceProviderId`, `serviceId`, `petId`, `state`, `currentStatus`, `bookingFrom`, `bookingTo`, `page`, `perPage`. GET responses include populated nested `serviceProvider`, `service`, `pet`.
- `getBooking(id)`, `createBooking(input)`, `setBookingStatus(booking, currentStatus)` (provider accept → ServiceConfirmedByProvider), `cancelBooking(booking, reason?)` (PUT with state=Cancelled), `deleteBooking(id)`.
- **Booking PUT must send only writable scalar fields** — the GET returns nested read-only includes (`serviceProvider`/`service`/`pet`/`user`/addresses) and PUTing those back 500s. `setBookingStatus`/`cancelBooking` strip them via `toWritableBooking`.
- **Backend quirk (BACKEND_GAPS B4)**: transitioning `currentStatus` → 1 (ServiceConfirmedByProvider) or 4 (ServiceEnded) sends an email; if the recipient's address is invalid (e.g. the seed `admin` account, email = `admin`) the API returns 500 `"...not in the form required for an e-mail address"` **but the status still persists**. Real users with valid emails are fine.

### `services/payment-methods.ts`
- **Type**: `PaymentMethodDto`. Enum `PaymentMethodStatus` (0=Active, 1=Removed).
- `getPaymentMethods(userId)` → GET `/api/payment-methods?UserId=` — **filters to Active only**.
- `createPaymentMethod(method)`, `deletePaymentMethod(id)`.
- **`providerPaymentMethodId` is required** on create (non-empty) — 422 otherwise.
- ReviewBookingScreen auto-creates a default placeholder payment method (synthetic `providerPaymentMethodId`) when the user has none, so bookings can be created before a real gateway exists.

### `services/admin.ts`
- Admin-only (Admin role enforced server-side via the Bearer token).
- `approveServiceProvider(id)` → POST `/admin/service-providers/{id}/approve` — flips the provider's `isApproved` to true.
- `approveCertificate(certificateId)` → POST `/admin/certificates/{id}/approve`.
- **No reject endpoint exists.** "Reject" in the admin UI = `deleteServiceProvider(id)` (removes the application record). The `bookingState`-style rejected tab is therefore always empty for real data.

### Verified API behaviors (tested against live backend 2026-06-08)
These are confirmed quirks of the real API — keep them in mind when building DTOs/payloads:
- **All `/api/*` list endpoints return a pagination wrapper**: `{ totalItems, totalPages, currentPage, itemsPerPage, items }`. Always unwrap with `extractPageItems()`.
- **Service Provider XOR constraint**: the API enforces *"Exactly one of UserId or ProviderProfileId must be provided, not both and not neither."* Backed by the `CK_ServiceProvider_OwnerXor` DB CHECK constraint. Sending `0` counts as "provided" → 500. For the partner-application flow, send `userId` and `providerProfileId: null`.
- **`isApproved` is server-controlled**: POSTing a provider with `isApproved: true` is ignored — it's always saved as `false`. An admin must approve via `POST /admin/service-providers/{id}/approve`.
- **Provider GET returns more than the swagger DTO**: also includes `ratingAvg` (real average rating, null until reviews exist), `isApplicationPartner`, `addressId`, `createdAt`, `updatedAt`, `bookings[]`, `providerProfile`. `providerToViewModel()` maps `ratingAvg` → `rating`.
- **Service GET returns more than the swagger DTO**: also includes `rating`, `totalRatingNumber`, `price` (effective price after discount — prefer over `basePrice` for display), `about` (long description), `imageUrl`, `basicServiceName`, `appliedDiscountType`, `appliedDiscountAmount`. These extra fields are typed as optional on `ServiceDto`.
- **Creating a booking REQUIRES a valid `paymentMethodId`** referencing an existing PaymentMethod for the user. Posting with `null`/`0`/missing → 422 ("must not be empty" + "must reference a real one"). So the booking flow has a hard prerequisite: the user must have a saved payment method. `location` is optional, but if sent must have at least one address (`pickupAddressId` or `leaveOverAddressId`).
- **Creating a pet REQUIRES at least one photo** — `'Request Photos' must not be empty`. `createPet()`/`AddPetScreen` must enforce ≥1 photo before POST (currently it does not — a photoless pet 422s).
- **Booking GET includes populated nested objects**: `serviceProvider` (with photos), `service`, `pet` — enough to render a booking card from a single list call.
- **Verified enum names** (`GET /enums`): `serviceProviderType` = 0:Sitter, 1:Walker, 2:Boarder, 3:PetHotel, 4:Groomer. `bookingState` = 0:Upcoming, 1:Completed, 2:Cancelled. `petType` = 1:Dog, 2:Cat, 3:Parrot, 4:Turtle, 5:Fish, 6:Snake. `paymentType` = 0:Cash, 1:Card, 2:BankTransfer, 3:Wallet.

### Test login
- Dev/seed admin account: identifier `admin` / password `admin` (use for live API testing via curl).

---

## Context Providers

### `useAuth()` — `context/AuthContext.tsx`
| Value | Type | Notes |
|---|---|---|
| `isLoggedIn` | boolean | |
| `isLoading` | boolean | True during session restore on app start |
| `isAdmin` | boolean | Derived from `currentUser.roles.includes('Admin')` |
| `isPartner` | boolean | Derived from `currentUser.roles.includes('Partner')` |
| `currentUser` | `CurrentUser \| null` | |
| `signIn(accessToken, refreshToken?)` | fn | Saves tokens + calls getMe() |
| `signInWithCredentials(email, password)` | fn | Calls loginWithEmailPassword + signIn |
| `signOut()` | fn | clearTokens() + reset state |
| `signInWithGoogle()` | fn | expo-auth-session Google OAuth (client IDs are placeholders) |
| `refreshUser()` | fn | Re-fetches `getMe()` and updates `currentUser` (used after profile edits) |

Auth flow:
1. On app start: check `getAccessToken()` → if valid, call `getMe()` → restore session
2. Login: `signInWithCredentials` → save tokens → `getMe()` → `isLoggedIn = true`
3. Register: POST `/auth/register` → VerifyEmail screen (pass email param) → `confirmEmail` → Login
4. Logout: `clearTokens()` + reset state → navigate to Login
5. Token refresh: handled automatically inside `apiAuthFetch` — if access token is expired, exchanges refresh token silently; if refresh also expired, fires session-expired handler → auto sign-out

### `useEnums()` — `context/EnumsContext.tsx`
| Value | Type |
|---|---|
| `enums` | `EnumsData \| null` |
| `isLoading` | boolean |
Fetched once per login session. Reset to null on logout.

### `useTheme()` — `context/ThemeContext.tsx`
| Value | Type |
|---|---|
| `isDarkMode` | boolean |
| `toggleDarkMode` | fn |
No persistence yet — resets to light mode on app restart.

---

## Hooks

### `useLocation()` — `hooks/useLocation.ts`
Returns `{ latitude, longitude, address, loading, error }`
- Default/fallback: Belgrade, Serbia (44.8176, 20.4570)
- Web: `navigator.geolocation.getCurrentPosition()`
- Native: `expo-location` + reverse geocode → `"[streetNumber], [street], [city]"`
- Used in AddPetScreen to determine metric vs. imperial units.

---

## Navigation (React Navigation v7)

Root: Stack navigator guarded by `isLoggedIn`.

**Public screens (unauthenticated):**
- `Login`, `Register`, `VerifyEmail`, `ForgotPassword`

**Authenticated root: MainTabs (bottom tab navigator) + stack screens**

Bottom tabs (see `components/shared/TabBar.tsx`):
- `Home`, `Search`, `Profile` — always visible
- `PartnerHub` — only if `isPartner`
- `AdminDashboard` — only if `isAdmin`

Stack screens (on top of tabs):
```
ProviderDetail, BookService, ReviewBooking, BookingConfirmed,
MyPets, AddPet, Settings, BecomePartner, PartnerApplication,
ApplicationSubmitted, Account, MyBookings, MySchedule, MyServices,
AddEditService, ServicePreview, Notifications, NewRequests, Promotions,
AdminNewRequests, ApplicationReview, AdminPartners, PartnerDetails, AdminAddPartner
```

Navigation patterns:
- `useNavigation()` for imperative navigation
- `useRoute()` with `RouteProp` for typed params
- Route params passed as objects: `navigate('ProviderDetail', { provider })`

Implementation notes (`App.tsx`):
- The whole stack is gated on `isLoggedIn`; while `isLoading` (session restore), a full-screen `ActivityIndicator` is shown.
- `MainTabs` registers all five tabs (`Home`, `Search`, `PartnerHub`, `AdminDashboard`, `Profile`) but the native tab bar is hidden (`tabBarStyle: { display: 'none' }`). The visible bar is the custom `components/shared/TabBar.tsx`, which role-gates `PartnerHub`/`AdminDashboard` via `useAuth()`.
- Tabs use `unmountOnBlur: true` — screens remount on each focus (do data fetching in `useFocusEffect`, not just `useEffect`, when you need fresh data on return; see `MyPetsScreen`).

---

## Screens Reference

| Screen | Container | Purpose |
|---|---|---|
| HomeScreen | `screens/home-screen/containers/HomeScreen.tsx` | **API-wired** — `getServiceProviders()` in `useFocusEffect`; sections, skeletons, empty state |
| SearchScreen | `screens/search-screen/` | **API-wired** — `getServiceProviders()`; client-side filter; map/list toggle |
| PartnerHubScreen | `screens/partner-hub-screen/containers/` | Partner dashboard (partner-only) |
| AdminDashboardScreen | `screens/admin-dashboard-screen/containers/` | Admin panel (admin-only) |
| ProfileScreen | `screens/profile-screen/containers/` | User profile + settings menu |
| ProviderDetailScreen | `screens/provider-detail-screen/containers/` | **API-wired** — fetches real services + reviews; computed rating + starting price |
| BookServiceScreen | `screens/book-service-screen/containers/` | **API-wired** — real services + real pets + shared DatePicker/TimePicker. Single booking (default +1h duration). Passes a `booking` draft to ReviewBooking. |
| ReviewBookingScreen | `screens/review-booking-screen/` | **API-wired** — Confirm resolves a payment method (auto-creates a default if none) and POSTs a real booking via `createBooking()`. Payment selector is still UI-only (online/cash → Card/Cash). |
| BookingConfirmedScreen | `screens/booking-confirmed-screen/containers/` | Post-booking confirmation |
| MyPetsScreen | `screens/my-pets-screen/containers/` | User's pets list |
| AddPetScreen | `screens/add-pet-screen/containers/` | Create/edit pet + bulk photo upload |
| SettingsScreen | `screens/settings-screen/` | App settings |
| BecomePartnerScreen | `screens/become-partner-screen/containers/` | Partner signup info |
| PartnerApplicationScreen | `screens/partner-application-screen/containers/` | Multi-step partner application form |
| ApplicationSubmittedScreen | `screens/application-submitted-screen/containers/` | Post-application confirmation |
| AccountScreen | `screens/account-screen/containers/` | **API-wired** — prefills from `currentUser`; Save → `updateProfile()` + `refreshUser()`. Email read-only (API rejects changes); address/photo + payment card are mock (no backend fields) |
| ChangePasswordScreen | `screens/change-password-screen/containers/` | **API-wired** — `changePassword()` (current/new/confirm); reached from Settings |
| ForgotPasswordScreen | `screens/forgot-password-screen/containers/` | **API-wired** — 2-step: `forgotPassword(email)` → `resetPassword(token,…)`; reached from Login |
| MyBookingsScreen | `screens/my-bookings-screen/containers/` | **API-wired** — `getBookings({ userId })` in `useFocusEffect`; Upcoming/Past tabs from `bookingState` |
| MyScheduleScreen | `screens/my-schedule-screen/containers/` | **API-wired** — loads bookings (partner: by provider, user: by userId) into the schedule source on focus; day/week/month views unchanged |
| MyServicesScreen | `screens/my-services-screen/containers/` | Partner's listed services |
| ServicePreviewScreen | `screens/service-preview-screen/` | Preview service before publish |
| NotificationsScreen | `screens/notifications-screen/containers/` | **API-wired** — `getNotificationSettings` on focus; each toggle persists via `saveNotificationSettings` (POST/PUT). Save FK-fails for the seed admin (BACKEND_GAPS N1) → applies locally + shows a notice |
| NewRequestsScreen | `screens/new-requests-screen/containers/` | **API-wired** — partner's bookings via `getBookings({ serviceProviderId })`; New/Accepted/Declined from state+currentStatus; accept → `setBookingStatus`, decline → `cancelBooking` |
| PromotionsScreen | `screens/promotions-screen/containers/` | **API-wired (offers only)** — loads `service-discounts` as offer cards (+ mock boost/featured); pause/resume toggles `isEnabled`. EditPromotion saves/deletes real offers. boost/featured/analytics are mock (BACKEND_GAPS PR1–PR5) |
| AdminNewRequestsScreen | `screens/admin-new-requests-screen/containers/` | **API-wired** — `getServiceProviders()` in `useFocusEffect`, client-side pending/approved split; approve → `approveServiceProvider()` (+ certs), reject → `deleteServiceProvider()` |
| ApplicationReviewScreen | (within admin-new-requests) | **API-wired** — approve/reject call the real admin endpoints, then `goBack()` (list refetches on focus) |
| AdminPartnersScreen | `screens/admin-partners-screen/containers/` | Admin partner management list |
| AdminAddPartnerScreen | `screens/admin-add-partner-screen/containers/` | Admin manually adds partner |
| LoginScreen | `screens/login-screen/containers/` | Email/username + password + Google OAuth |
| RegisterScreen | `screens/register-screen/` | New user registration |
| VerifyEmailScreen | `screens/verify-email-screen/` | Email code verification |

---

## Shared Components — `components/shared/`

Always check this folder before creating a new component. If a new component is similar to an existing one, extend it or generalise it and add it here.

| Component | Key Props | Purpose |
|---|---|---|
| `Button` | `text?`, `children?`, `onPress`, `variant?` ('primary'\|'secondary'\|'outline'\|'ghost'), `icon?`, `iconPosition?`, `disabled?`, `className?` | Primary CTA button |
| `AppHeader` | `variant?` ('large'\|'standard'\|'compact'), `title?`, `subtitle?`, `showBackButton?`, `onBackPress?`, `showNotificationButton?`, `rightAction?`, `rounded?` | Navigation header, safe-area aware |
| `ScreenLayout` | `headerVariant?`, `headerTitle?`, `showBackButton?`, `onBackPress?`, `children`, `footer?`, `contentRounded?`, `safeAreaBg?`, `contentBg?` | Wraps SafeAreaView + AppHeader + content area. Use this as the root of every screen. |
| `TabBar` | (none) | Bottom tab bar — reads context for role-based visibility |
| `ServiceCard` | `image`, `name`, `service`, `rating`, `reviews`, `price`, `distance?`, `badge?` ('popular'\|'deal'), `onPress` | 200px-wide provider card |
| `SeeMoreCard` | `onPress` | Trailing card in horizontal lists |
| `ServiceBubble` | `label`, `bg?`, `icon?`, `onPress?` | Circular icon + label (service type pill) |
| `Banner` | `title`, `description`, `image`, `color?` ('emerald'\|'pink'\|'red'\|'yellow'), `size?` | Colorful info banner |
| `DatePicker` | `value`, `onChange`, `onClose`, `isDarkMode`, `minDate?`, `maxDate?` | Calendar month picker |
| `TimePicker` | `value`, `onChange`, `onClose`, `isDarkMode`, `minDate?` | Spinner hour/minute/AM-PM picker |
| `ServiceDetailView` | `service`, `isDarkMode`, `showBookButton?`, `onBookPress?` | Full service detail layout |

---

## Styling System

**NativeWind (Tailwind) — `tailwind.config.js`**

Custom brand palette (green):
| Token | Hex | Usage |
|---|---|---|
| `brand-500` | `#00C870` | Primary green, main CTAs |
| `brand-400` | `#2CE07F` | Hover / lighter accents |
| `brand-600` | `#00A85A` | Active / pressed states |
| `brand-50` | `#E6FAF0` | Light backgrounds |
| `brand-900` | `#003822` | Dark text on brand |

**Dark mode — `hooks/useThemeColors.ts` is the single source of truth.**

Do NOT redefine `const cardBg = isDarkMode ? ... : ...` blocks inline. Get the palette from the hook:
```tsx
const { isDarkMode, bgColor, cardBg, textColor, subtextColor, inputBg, inputText, borderColor, placeholderColor } =
  useThemeColors();
```
- **Smart components / screens** → `useThemeColors()` (reads `ThemeContext` internally).
- **Dumb components that receive `isDarkMode` as a prop** (e.g. `ServiceDetailView`, `DatePicker`, schedule views) → `themeColors(isDarkMode)` — the pure, hook-free variant exported from the same file.

What the hook returns:
- **NativeWind class tokens** (for `className`): `bgColor`, `cardBg`, `textColor`, `subtextColor`, `inputBg`, `inputText`, `borderColor`.
- **`placeholderColor`** — raw hex, for `placeholderTextColor=`.
- **`hex`** — raw hex object (`bg`, `card`, `text`, `subtext`, `border`, `inputBg`) for `style={}` props / native components that can't take Tailwind classes (admin screens, pickers, maps).
- **`isDarkMode`** — so you don't need a second `useTheme()` call.

Canonical values: screen bg `#0f1621`/`white`, card `#1a2332`/`white`, input `#243447`/`gray-50`, text `white`/`gray-900`, subtext `gray-400`/`gray-600`, border `gray-700`/`gray-200`.

Genuinely bespoke colors stay inline (sourced from the hook's `isDarkMode`): e.g. the brand-green header bg (`bg-brand-500`), `AppHeader`, `Banner` tiles, the `#F5F7FA` promotions/requests content bg. Screens with a brand header keep a local `bgColor = isDarkMode ? 'bg-[#1a2332]' : 'bg-brand-500'` and pull the canonical content bg as `bgColor: contentBg` from the hook.

**UI Consistency Rules:**
- Colors, fonts, and backgrounds must be consistent across the entire app — go through `useThemeColors()`
- Use `brand-*` tokens for all green/primary colors — never hardcode green hex values
- Use `ScreenLayout` as the root wrapper for every screen (provides consistent header + safe area)
- Use shared components from `components/shared/` whenever they fit — do not duplicate
- If a new component is needed and it could be reused elsewhere, add it to `components/shared/`

**Platform-specific files:**
- `.web.tsx` suffix = web-only (e.g. `WebDatePicker.web.tsx`, `MapView.web.tsx`)
- Metro bundler picks the right variant automatically — no manual platform checks needed for these

---

## Key Conventions

### API calls
- Public endpoints → `apiFetch`
- Authenticated endpoints → `apiAuthFetch`
- Never call `fetch()` directly

### Screen structure
- Every screen: `containers/` (smart) + optional `components/` (dumb)
- Data fetching lives in containers, never in presentational components

### State management
- No Redux/Zustand — all state is React component state + Context
- Data fetching: `useEffect` → async call → `setState`
- Unmount cancellation: `let cancelled = false` + `return () => { cancelled = true; }`

### Role checks
- Use `isAdmin` / `isPartner` booleans from `useAuth()` — never check `currentUser.roles` array directly

### Tokens
- Never read/write tokens directly — always go through `services/token-storage.ts`
- Token refresh is automatic inside `apiAuthFetch` — no manual refresh needed anywhere

### Enums/lookups
- Always use `useEnums()` from `EnumsContext` — never call `fetchEnums()` directly

### Error handling
- Try-catch with specific messages
- Parse API error order: `{ message }` → `{ detail }` → `{ title }` → response text
- ASP.NET validation errors: `{ errors: { Field: ["msg"] } }`

### Loading states
- `isLoading` boolean per screen/component
- Show `ActivityIndicator` while loading
- Disable submit buttons while loading

### Forms
- Touched state: only show field errors after user has interacted with the field
- Visual feedback: red border (error), green border (valid), default (untouched)
- **Always use `DatePicker` (from `components/shared/DatePicker.tsx`) for any date input** — never use a plain `TextInput` for dates. Pass `isDarkMode`, `value`, `onChange`, and `onClose` props. For time inputs, use `TimePicker` from the same folder.

### File uploads
- Always use `uploadFilesBulk()` for multiple files — more efficient than individual uploads
- Upload files before creating the entity (pet, service, etc.)

### Payments
- Payment method selection in ReviewBookingScreen is UI only — no gateway integrated yet
- Real payment processing is planned for a future date

---

## Build & Run

```bash
npm start            # Expo dev server (scan QR for device)
npm run web          # Web in browser
npm run android      # Android emulator/device
npm run ios          # iOS simulator/device
npm run lint         # ESLint + Prettier check
npm run format       # ESLint + Prettier auto-fix
npx tsc --noEmit     # Type-check only (no test suite is configured)
```

Environment: copy `.env.example` → `.env`, set `EXPO_PUBLIC_API_BASE_URL=http://localhost:5161`

After non-trivial edits, run `npx tsc --noEmit` (and `npm run format`) before considering the work done.
