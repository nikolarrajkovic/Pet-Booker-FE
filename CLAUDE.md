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
  http.ts           # apiFetch + apiAuthFetch + getApiBaseUrl + parseApiError + getErrorMessage + extractPageItems + registerSessionExpiredHandler
  auth.ts           # Auth endpoints including token refresh
  token-storage.ts  # Token persistence with TTL
  enums.ts          # Enum/lookup data
  pets.ts           # Pet CRUD (get/create/update/delete) + bulk photo upload
  files.ts          # File/image upload utilities
  service-providers.ts  # ServiceProviderDto, ProviderViewModel, providerToViewModel, resolveImageUrl, getServiceProviders, getServiceProvider, createServiceProvider
  services.ts       # ServiceDto, getServices, getService, createService, updateService, deleteService
  service-schedules.ts  # ServiceScheduleDto CRUD + saveServiceSchedules (reconcile) — per-day working hours for AddEditService
  reviews.ts        # ReviewDto, getReviews, createReview
  bookings.ts       # BookingDto, BookingViewModel, bookingToViewModel, get/create/cancel/delete + state/status enums
  payment-methods.ts  # PaymentMethodDto, getPaymentMethods, createPaymentMethod, deletePaymentMethod
  admin.ts          # Admin-only actions: approve/declineServiceProvider, approve/declineCertificate
  service-discounts.ts  # ServiceDiscountDto, DiscountType (0=Percent,1=Fixed), getServiceDiscounts, create/update/deleteServiceDiscount. Write convention: Percent → type=0, amount=value, percentAmount=value; Fixed → type=1, amount=value, percentAmount=null. Powers the Promotions "offer" create/edit flow.
  notifications.ts  # UserNotificationSettingsDto, getNotificationSettings, saveNotificationSettings, defaultNotificationSettings (notification PREFERENCES)
  app-notifications.ts  # AppNotificationDto, NotificationType, getAppNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead, notificationBookingId (in-app notification INBOX)
  service-addons.ts # SERVICE_ADDON_DEFS catalog + getEnabledServiceAddons (single source of truth for service add-ons / DTO mapping)
  home.ts           # getMostPopular / getOnSale / getRecentlyBooked / getNearMe — per-row Home endpoints (/api/home/*) → ServiceDto[]
  users.ts          # UserDto, getUser(id), updateUser(user) — profile data (GET + PUT; NO PATCH — see note)
  geocoding.ts      # reverseGeocodeToAddress + forwardGeocode + getCurrentPosition + addressLabel (native: expo-location, web: Nominatim/navigator.geolocation)

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
  useAppNavigation.ts # Back-vs-Up navigation helpers: resetToTab/resetToScreen/resetToAuth/goUp (see Navigation)
  useReviewModal.ts   # "Leave a review" modal lifecycle: { target, submitting, open, close, submit } + createReview POST (pairs with components/shared/ReviewModal)
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
- **`getErrorMessage(error, fallback?)`** — Normalizes an unknown thrown value (from a `catch`) into a display string. Services throw `Error` (via `parseApiError`), so this is `error.message` in the common path, with a generic fallback otherwise. **Use this to feed any user-facing error display** (toast / inline) — `catch (e) { showError(getErrorMessage(e, 'Could not …')); }`.
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
- Type `CurrentUser`: `{ id, email, emailConfirmed, roles[], groups[], userName, firstName, lastName, serviceProviderId?, providerProfileId? }`. `serviceProviderId` (0 = none) is the partner's own provider — partner screens read it directly instead of fetching the provider list (P1).

### `services/token-storage.ts`
- `saveTokens(accessToken, refreshToken?)` — stores with TTL (access: 30 min, refresh: 7 days)
- `getAccessToken()` — returns null if expired
- `getRefreshToken()` — returns null if expired
- `clearTokens()` — wipes all stored tokens
- Native: `expo-secure-store` | Web: `localStorage`

### `services/enums.ts`
- `fetchEnums()` → GET `/enums` (auth) → `EnumsData`
- **Never call directly from screens** — always use `useEnums()` from EnumsContext.
- `EnumsData` keys: `paymentType`, `serviceProviderType`, `discountType`, `bookingStatusType`, `paymentStatus`, `sex`, `paymentMethodStatus`, `bookingState`, `providerProfileStatus`, `pushPlatform`, `emailTemplateType`, `petSpeciesType`
- Each key is `EnumEntry[] = { value: number, name: string }[]`
- **`petSpeciesType` is a FLAGS enum**: 0=None, 1=Dog, 2=Cat, 4=Parrot, 8=Turtle, 16=Fish, 32=Snake, 63=All. Other new enums (`ApprovalStatus`, `NotificationType`, `PricingUnit`, `PetWeightBracket`, `DayOfWeek`) exist in swagger but are NOT exposed via `/enums`.

### `services/pets.ts`
- `getPets(ownerUserId)` → GET `/api/pets?OwnerUserId={id}` (auth) → `PetResponse[]`
  - Handles paginated wrappers: plain array, `{ items }`, `{ data }`, `{ results }`
- `createPet(input)` → auto-uploads photos via `uploadFilesBulk()` first, then POST `/api/pets`
  - Sex mapping: "male" → 1, "female" → 2 (else 0). **Pet type is the `petSpeciesType` FLAGS enum**: Dog=1, Cat=2, Parrot=4, Turtle=8, Fish=16, Snake=32 — use the exported `PetSpecies` const, never sequential 1–6 (the old 1–6 mapping is wrong for everything past Cat).
  - Weight/height unit conversion (kg↔lbs, cm↔in) via geolocation
- `updatePet(input)` → PUT `/api/pets/{petId}`. Takes `UpdatePetInput` (= `CreatePetInput` + `petId` + optional `originalPhotos`). Separates already-uploaded photos (http/https URIs) from new local photos, uploads only the new ones, and preserves existing photo metadata.
- `deletePet(petId)` → DELETE `/api/pets/{petId}`
- `petTypeLabel(type)` → friendly label for a `PetSpecies` flag value.
- Type `PetResponse`: `{ id, ownerUserId, name, type, breed, sex, dateOfBirth, ageYears, weightKg, heightCm, dietaryNotes, favoriteFood, additionalNotes, photoUrl, isActive, createdAt?, updatedAt?, ownerUser?, photos[] }`. GET also populates the read-only `ownerUser` include (`{ id, userName, email }`). Photo entries have no `contentType` (removed from the API's `PhotoDto`).

### `services/files.ts`
- `uploadFile(uri, fileName?, mimeType?)` → POST `/files/upload` (auth, multipart) → `UploadedFile`
- `uploadFilesBulk(files[])` → POST `/files/upload/bulk` (auth) → `UploadedFile[]`
- Type `UploadedFile`: `{ id, src, originalName, contentType, sizeBytes }`
- Web: handles base64 data URIs. Native: handles file system URIs.
- Prefer bulk upload over individual uploads.
- **`GET /files/{storedName}` is anonymous (verified live 2026-06-20)** — returns 200 without a Bearer token, so plain `<Image>`/`<img>` tags load relative `/files/...` photos fine. (The 2026-06 API update had briefly required auth on file GET, breaking every image; that's been reverted — old BACKEND_GAPS F1, now resolved.)

### `services/service-providers.ts`
- **Types**: `ServiceProviderDto`, `AddressDto`, `PhotoDto`, `CertificateDto`, `ProviderViewModel`. Exported const `ApprovalStatus` = { Pending: 0, Approved: 1, Declined: 2 } (shared by providers, certificates, and reviews).
- **`ProviderViewModel`** / **`providerToViewModel(dto)`** — provider display shape + mapper. **No longer used by any user screen** — the whole app is service-centric now: Home, Search, ProviderDetail(orphaned) → BookService → ReviewBooking → BookingConfirmed all pass the `ServiceDto` (which carries `serviceProviderId`), not a provider. These remain only for the orphaned ProviderDetailScreen; user screens never fetch providers. (Admin screens use `ServiceProviderDto` directly.)
- **`resolveImageUrl(src)`** — prepends `getApiBaseUrl()` to relative `/files/...` paths; returns absolute URLs as-is.
- `getServiceProviders(params?)` → GET `/api/service-providers` (auth) → `ServiceProviderDto[]`. Params: `name`, `city`, `type`, `isApproved`, `approvalStatus`, `page`, `perPage`. The **`IsApproved`/`ApprovalStatus` server filters exist (verified live)** — use them instead of fetching all and filtering. There is still no `UserId` filter, but a partner's own provider id is now on `/auth/me` as `currentUser.serviceProviderId` (P1 resolved) — read it directly; don't fetch the list to find your own provider.
- `getServiceProvider(id)` → GET `/api/service-providers/{id}` (auth) → `ServiceProviderDto`
- `deleteServiceProvider(id)` → DELETE `/api/service-providers/{id}` (auth). No longer used for rejection — admin reject now uses `declineServiceProvider()` (see `services/admin.ts`).
- `providerTypeLabel(type)` → friendly label for a `ServiceProviderType` enum value.
- Provider GET carries read-only `approvalStatus` (ApprovalStatus), `declineReason`, `isApproved` (legacy mirror), and writable `contactEmail` (the applicant's email).
- `createServiceProvider(payload)` → POST `/api/service-providers` (auth)
  - Payload (`CreateServiceProviderPayload`): `{ fullName, email, phone, streetAddress, city, state, zipCode, selectedServices[], yearsOfExperience, aboutYou, motivation, profilePhoto, petPhotoFiles[], governmentIdFiles[], certificateFiles[], userId }`
  - Uploads all files (profile photo + pet photos + government IDs + certificates) in **one** `uploadFilesBulk()` call, then routes them into the DTO: profile + pet photos → `photos[]` (`isSelected`); government IDs → `governmentIdPhotos[]` (`isFront`); certificates → `certificates[]`, each referencing its upload via `fileIds: number[]`.
  - The applicant's email is sent as `contactEmail`. Approval is server-controlled: new applications start Pending (`approvalStatus = 0`); an admin approves/declines later. Certificate `isApproved` is read-only too. The DTO has no top-level `city`/`photoUrl`; city lives in `address`.

### `services/services.ts`
- **Types**: `ServiceDto`, `ServiceScheduleDto`, `ServiceFoodPricingDto`, `ServicePricingOptionDto`
- **`ServiceDto`** — `{ id?, serviceProviderId, name?, description?, type?, isActive?, pricing?, details?, schedules?, photos? }`. There are **no top-level `notes`/`basePrice`/escrow fields** (removed from the API) — the description is `description` and all money fields live under `pricing`.
- `pricing` contains: `{ basePrice, unit? (PricingUnit 0–3), isEscrowPercentEnabled, escrowPercent?, escrowAmount, pickupPrice?, petReturnPrice?, specialNeedsPrice? }`. **The add-on SURCHARGE money lives here (2026-06 update moved it out of `details`)**: `pickupPrice`/`petReturnPrice` are `LocationBasedPriceDto` (`{ baseFee, perKmFee, freeDistanceKm?, maxDistanceKm? }`, `null` when the add-on is off); `specialNeedsPrice` is a flat `number | null`. The AddEditService form captures only a single flat fee → mapped to `baseFee` (perKmFee/distance default 0/null, round-trip on edit). Verified live: PUT persists all three.
- `details` contains: `{ isPickupProvided, isPetReturnProvided, isSpecialNeedsProvided, canSpecialNeedsChange, supportsLiveTracking, acceptedSpecies? (PetSpeciesType FLAGS, 63=All), minWeightKg?, maxWeightKg?, minDurationMinutes?, maxDurationMinutes?, leadTimeHours?, maxConcurrentBookings?, foodPricings? }`. The add-on **on/off flags are here** (`is*Provided`); the **money is under `pricing`** (above). The five booleans + `acceptedSpecies`/`maxConcurrentBookings` are **non-nullable server-side** — omitting any on a PUT resets it to false/0/None, so `uiToServiceDto(form, original)` round-trips them all from the original DTO (defaults: 63 / 1 on create). The add-on read/write mapping (flag→details, money→pricing) is centralized in `services/service-addons.ts`. Verified live: a PUT with this shape preserves all values.
- `schedules` — per-day working-hours windows (`{ serviceId, day (0=Sun…6=Sat), from, to }` with `from`/`to` as `"HH:mm:ss"`), embedded on GET and managed via `/api/service-schedules` CRUD. **Wired** for the AddEditService "Working Hours" section — see `services/service-schedules.ts` (write side) + `serviceModel.ts` (`schedulesToWorkingHours`/`workingHoursToSchedules`).
- `pricingOptions` — duration/price variants (`ServicePricingOptionDto`: `{ id?, serviceId, name, description?, durationMinutes, price }`), embedded read-only on GET and managed via `/api/service-pricing-options` CRUD (see `services/service-pricing-options.ts`). **Coexist rule (server-enforced): a service with ≥1 option requires every booking to send a `pricingOptionId`; an option-less service keeps classic free-range from/to booking.** The lean Home-rail `ServiceDto` (`/api/home/*`) does NOT include `pricingOptions` — `uiToServiceDto` writes `pricing.basePrice` = the cheapest tier so Home cards show a correct "from" price. `effectiveOptionPrice(svc, option)` mirrors the server's discount math for display (percent → `price * (1 - amt/100)`, fixed → `max(0, price - amt)`, from `appliedDiscountType`/`appliedDiscountAmount`).
- `type` is **writable** (ServiceProviderType) — the Service Type picker persists now (old gap S4 is closed).
- `getServices(params?)` → GET `/api/services` (auth) → `ServiceDto[]`. Params: `serviceProviderId`, `name`, `type`, `isActive`, `supportsPickup`, `supportsLeaveOver`, `supportsSpecialNeeds`, `page`, `perPage`. (Server filter names were renamed in the 2026-06 update — `IsProvidingPickup`/`IsProvidingReturn`/`IsProvidingSpecialNeeds`; the FE param names are kept stable and mapped internally.)
- `getService(id)` → GET `/api/services/{id}` (auth) → `ServiceDto`
- `createService(service)` → POST `/api/services` (auth) → `ServiceDto`
- `updateService(id, service)` → PUT `/api/services/{id}` (auth) → `ServiceDto`
- `deleteService(id)` → DELETE `/api/services/{id}` (auth)
- NEW (not yet wired): `GET /api/services/{id}/availability?from=&to=` → `{ serviceId, days: [{ date, windows[] }] }`. `from`/`to` must be **date-only** strings (`2026-06-12`) — full ISO datetimes 400. `windows` derives from the service's schedules.

### `services/service-schedules.ts`
- **Type**: `ServiceScheduleDto` (re-exported from `services.ts`) — `{ id?, serviceId, day (0=Sun…6=Sat, .NET DayOfWeek), from, to }`; `from`/`to` are `"HH:mm:ss"`.
- `getServiceSchedules(serviceId)` → GET `/api/service-schedules?ServiceId=` (auth, unwrapped) → `ServiceScheduleDto[]`. (Reads usually come from the embedded `service.schedules[]` instead.)
- `createServiceSchedule(s)` → POST, `updateServiceSchedule(id, s)` → PUT, `deleteServiceSchedule(id)` → DELETE.
- **`saveServiceSchedules(serviceId, desired, existing?)`** — the high-level entry point used on service save. Diffs `desired` (one row per enabled day) against `existing` (the service's current `schedules[]`) keyed by `day`: POST new days, PUT days whose times changed, DELETE removed days; unchanged days make no call. Runs the calls in parallel. Verified live against the seed backend.
- UI↔DTO translation lives in `screens/my-services-screen/serviceModel.ts`: `schedulesToWorkingHours(schedules)` (prefill, disabled-by-default Mon→Sun) and `workingHoursToSchedules(workingHours, serviceId)` (enabled days only). AddEditService calls `saveServiceSchedules` after `create`/`updateService` (best-effort: a schedule failure warns but doesn't block, since the service is already saved).

### `services/service-pricing-options.ts`
- **Type**: `ServicePricingOptionDto` (re-exported from `services.ts`).
- `getServicePricingOptions(serviceId)` → GET `/api/service-pricing-options?ServiceId=` (auth, unwrapped). (Reads usually come from the embedded `service.pricingOptions[]` instead.)
- `createServicePricingOption(o)` → POST, `updateServicePricingOption(id, o)` → PUT, `deleteServicePricingOption(id)` → DELETE. Write ownership is server-enforced (a provider can only manage options on their own services).
- **`saveServicePricingOptions(serviceId, desired, existing?)`** — the high-level entry point used on service save (mirrors `saveServiceSchedules`, but diffs **by id** since options have no natural key): desired without id → POST, desired with id + changed fields → PUT, existing id absent from desired → DELETE. Deleting every tier reverts the service to classic free-range booking.
- UI↔DTO translation lives in `screens/my-services-screen/serviceModel.ts`: `pricingTiersToOptions(tiers, serviceId)` (only tiers with a resolvable duration + parseable price become options; the duration label is the option `name`) and the shared duration label↔minutes map (`DURATION_OPTION_LABELS`, `minutesToDurationLabel`, `durationLabelToMinutes` — unmapped minutes decode as `"{n} min"`). AddEditService calls `saveServicePricingOptions` after `create`/`updateService` (best-effort, same pattern as schedules).

### `services/reviews.ts`
- **Type**: `ReviewDto` — `{ id?, bookingId, userId, serviceProviderId, rating, serviceQualityRating?, communicationRating?, timelinessRating?, valueRating?, title?, comment?, approvalStatus?, declineReason?, createdAt?, photos? }`. **GET also embeds read-only nested includes** `user` (booker: id/userName/photos — **no `email`**, slimmed 2026-06-22; AdminReviews guards a blank email), `serviceProvider` (id/name/photos), and `booking` (id/state/bookingFrom/bookingTo) — used by the admin moderation UI to render a review card from one list call. (Write DTO also accepts an optional `serviceId`.)
- The four **per-category sub-ratings are non-nullable server-side** — `createReview` defaults any missing one to the overall `rating`.
- **Reviews are admin-moderated**: read carries `approvalStatus` (ApprovalStatus 0=Pending, 1=Approved, 2=Declined) + `declineReason`. Public screens (ProviderDetail) fetch with `approvalStatus: Approved`. Admin moderation endpoints are **wired** via `services/admin.ts` (`approveReview`/`declineReview`/`approveReviews`) → AdminReviewsScreen: `POST /admin/reviews/{id}/approve` (verified live → 200), `/admin/reviews/{id}/decline` (`{ reason }`), `/admin/reviews/approve` (bulk `{ ids[] }`).
- `getReviews(params?)` → GET `/api/reviews` (auth) → `ReviewDto[]`. Params: `serviceProviderId`, `userId`, `bookingId`, `rating`, `approvalStatus`, `page`, `perPage`.
- `createReview(review)` → POST `/api/reviews` (auth) → `ReviewDto`. **`bookingId` must reference a real, existing booking** — the API validates the FK and rejects otherwise. So reviews can only be created after a booking exists.

### `services/bookings.ts`
- **Types**: `BookingDto`, `BookingViewModel`, `CreateBookingInput`. Exported enum maps: `BookingState` (0=Upcoming, 1=Completed, 2=Cancelled), `BookingStatusType` (0=ServiceRequestedByUser … 5=PostPayment, 6=DeclinedByProvider), `PaymentType` (0=Cash, 1=Card, 2=BankTransfer, 3=Wallet).
- **`bookingToViewModel(dto)`** — flattens a booking (with its nested `serviceProvider`/`service`/`pet`/`user` includes) into `BookingViewModel` for display. `statusLabel` ('upcoming'|'completed'|'cancelled') is derived from `state`; `clientName`/`clientEmail`/`clientAvatar` come from the populated `user`.
- `getBookings(params?)` → GET `/api/bookings`. Params: `userId`, `serviceProviderId`, `serviceId`, `petId`, `state`, `currentStatus`, `bookingFrom`, `bookingTo`, `page`, `perPage`. GET responses include populated nested `serviceProvider`, `service`, `pet`, **`user` (the booker: `id`/`userName`/`photos` only — `email` was removed from `UserInfoReadDto`, verified 2026-06-22; phone never carried, B1)**, `review`, and **`location`** (`{ pickupAddressId, leaveOverAddressId, pickupAddress, leaveOverAddress }` — the persisted pickup/drop-off addresses, **B2 resolved**). The old top-level `pickupAddress`/`leaveOverAddress` are gone; `getBooking`/`getBookings`/`createBooking` backfill them top-level from `location` via `withResolvedAddresses()` so existing consumers (BookingDetails, LiveSession) read them unchanged.
- **`bookingFrom`/`bookingTo` are range filters (verified live)**: passing a day's start/end ISO strings returns only bookings within that window — this is the building block for slot availability.
- **Slot windows come from `GET /api/services/{id}/availability` (server-derived).** BookServiceScreen fetches the selected day's windows (`getServiceAvailability`, date-only params) — each `{ from, to, remainingCapacity }` already factors in the provider's real bookings — and builds a back-to-back slot grid inside them: slot length **and** stride are the chosen pricing option's `durationMinutes` when the service defines options, else 1h. A slot is unavailable when it's in the past, or locally-added appointments have filled the window's `remainingCapacity`. The calendar grays out weekdays with no `schedules[]` entry (`schedules[].day` is .NET DayOfWeek 0=Sun…6=Sat, matching JS `getDay()`) via DatePicker's `isDateEnabled`, applied only when the service has ≥1 schedule. The server re-validates schedule fit + capacity on create (422 via `parseApiError`).
- `getBooking(id)`, `createBooking(input)`, `setBookingStatus(booking, currentStatus)`, `cancelBooking(booking, reason?)` (PUT with state=Cancelled — for cancelling already-accepted bookings), `deleteBooking(id)`.
- **Add-on selection is driven by flags, not addresses (verified live):** the write DTO carries `includePickup` / `includePetReturn` / `includeSpecialNeeds` (+ nullable `distanceKm`). **Sending `location.pickupAddress` alone does NOT register pickup** — the flag must be set, or it reads back `includePickup=false` / `addOnsTotal=0`. The server computes the surcharge from the service's `pricing` and returns the read-only breakdown (`pickupPrice` / `petReturnPrice` / `specialNeedsPrice` / `addOnsTotal` / `depositAmount`); a client-sent `totalPrice` is **recomputed server-side**. `createBooking` sets the flags from the selected add-ons (Pickup ↔ `pickupAddress` → `includePickup`; Drop-off ↔ `leaveOverAddress` → `includePetReturn`), and `toWritableBooking` round-trips them so a status/cancel PUT doesn't reset them. The **address now persists and round-trips** (BACKEND_GAPS B2 resolved 2026-06-22): the inline `location.pickupAddress`/`leaveOverAddress` are saved (a real `pickupAddressId` is created) and returned under `location.*` on GET — `withResolvedAddresses()` mirrors them back to top-level `pickupAddress`/`leaveOverAddress` for consumers.
- **`confirmBooking(id)` / `declineBooking(id, reason?)`** → `POST /bookings/{id}/confirm` / `/decline` — the provider accept/decline used by NewRequests. **Server-guarded (verified live): only bookings still in ServiceRequestedByUser can be confirmed/declined** (422 otherwise). Confirm sets currentStatus=1; decline sets state=Cancelled, currentStatus=6 (DeclinedByProvider) and stores the reason as `cancelReason`. Confirm does NOT hit the B4 email-500 quirk that `setBookingStatus` has.
- **`startBookingService(booking)` / `endBookingService(booking)`** — dedicated lifecycle endpoints for the LiveSession screen (POST, id-only, no body — same shape as confirm/decline): Start → `POST /bookings/{id}/start-service` (→ `currentStatus = ServiceStarted (3)`), End → `POST /bookings/{id}/complete-service` (→ `ServiceEnded (4)`). Both are preferred over the generic `setBookingStatus` PUT. **New server guards (verified 2026-06-22):** start 422s `"A service can be started at most 15 minutes before its scheduled start time."` and complete requires status `ServiceStarted` — LiveSession surfaces those messages via `parseApiError`. End can still 500 on the completion email for an invalid recipient like the seed `admin` (BACKEND_GAPS B4) but the status persists — LiveSession re-fetches on error to confirm. Pickup/drop-off *completion* is local-only (no backend field — BACKEND_GAPS B7). Related but **not yet wired**: `POST /bookings/{id}/adjust-price` (`{ basePrice, discountAmount, pickupPrice, petReturnPrice, specialNeedsPrice }` → recomputed booking) and `GET /api/bookings/{bookingId}/live-location` (GPS trail).
- **Pricing options on bookings (2026-07):** the write DTO carries a nullable **`pricingOptionId`** and the read DTO echoes it plus a nested `pricingOption`. **Required when the booked service defines `pricingOptions`** (422 `"This service defines pricing options; PricingOptionId is required."` otherwise — and the coexist rule runs on PUT too, so `toWritableBooking` round-trips `pricingOptionId`); must reference an option **of the booked service**. With an option set the server **derives `bookingTo` (= `bookingFrom` + `durationMinutes`) and `basePrice` (= option price, active discount applied) itself** — the client-sent values are ignored. BookService requires an option pick when the service has any (slot length + stride follow the option's duration instead of the 1h grid); ReviewBooking sends `pricingOptionId` per appointment.
- **Request-vs-schedule rule**: a booking with `currentStatus = ServiceRequestedByUser` is a *pending request*, not an appointment. `buildScheduleFromBookings` (my-schedule utils) excludes those in partner mode — they only appear on the partner's schedule after Accept. Users still see their own pending requests in user mode.
- **`deleteBooking` (BACKEND_GAPS B6 resolved 2026-06-22)**: deleting a transitioned booking now returns 204 — the `BookingStatuses` audit rows cascade-delete (previously 500 on `FK_BookingStatuses_Bookings_BookingId`). No UI currently calls it.
- **Booking PUT must send only writable scalar fields** — the GET returns nested read-only includes (`serviceProvider`/`service`/`pet`/`user`/addresses) and PUTing those back 500s. `setBookingStatus`/`cancelBooking` strip them via `toWritableBooking`.
- **`bookingFrom`/`bookingTo` are naive wall-clock, not UTC** — the API serializes them with a `+00:00` suffix (e.g. `"2026-06-18T13:00:00+00:00"`) but the value means 13:00 **local**, not 13:00 UTC. **Never `new Date(booking.bookingFrom)` directly** — that converts from UTC and shifts the time by the device offset. Read every booking time with **`parseBookingDate(iso)`** (drops the offset → local wall-clock) and write/serialize one with **`formatBookingDate(date)`** (local `Date` → naive `"YYYY-MM-DDTHH:mm:ss"`, no offset) so created bookings round-trip. Both are exported from `services/bookings.ts`; applied across BookService (slots/overlap/day-filter/create), ReviewBooking, NewRequests, LiveSession (+ CountdownTimer), my-schedule, and `bookingToViewModel`.
- **Backend quirk (BACKEND_GAPS B4)**: transitioning `currentStatus` via the generic PUT (`setBookingStatus`) to 1 (ServiceConfirmedByProvider) or 4 (ServiceEnded) sends an email; if the recipient's address is invalid (e.g. the seed `admin` account, email = `admin`) the API returns 500 `"...not in the form required for an e-mail address"` **but the status still persists**. The dedicated `confirmBooking` endpoint does not exhibit this (verified live with the seed admin). Real users with valid emails are fine either way.

### `services/payment-methods.ts`
- **Type**: `PaymentMethodDto`. Enum `PaymentMethodStatus` (0=Active, 1=Removed).
- `getPaymentMethods(userId)` → GET `/api/payment-methods?UserId=` — **filters to Active only**.
- `createPaymentMethod(method)`, `deletePaymentMethod(id)`.
- **`providerPaymentMethodId` is required** on create (non-empty) — 422 otherwise.
- ReviewBookingScreen auto-creates a default placeholder payment method (synthetic `providerPaymentMethodId`) when the user has none, so bookings can be created before a real gateway exists.

### `services/admin.ts`
- Admin-only (Admin role enforced server-side via the Bearer token).
- `approveServiceProvider(id)` → POST `/admin/service-providers/{id}/approve` — sets the provider's `approvalStatus` to Approved.
- `declineServiceProvider(id, reason?)` → POST `/admin/service-providers/{id}/decline` (`{ reason }`) — sets `approvalStatus` to Declined and stores `declineReason`. **This is the admin "Reject" action** (it keeps the record; the old delete-as-reject workaround is gone). The admin Rejected tab shows providers with `approvalStatus === 2`.
- `approveCertificate(certificateId)` → POST `/admin/certificates/{id}/approve`.
- `declineCertificate(certificateId, reason?)` → POST `/admin/certificates/{id}/decline`.
- `approveReview(id)` → POST `/admin/reviews/{id}/approve`; `declineReview(id, reason?)` → POST `/admin/reviews/{id}/decline` (`{ reason }`); `approveReviews(ids[])` → POST `/admin/reviews/approve` (bulk `{ ids }`). These power AdminReviewsScreen (review moderation).

### Verified API behaviors (tested against live backend 2026-06-12)
These are confirmed quirks of the real API — keep them in mind when building DTOs/payloads:
- **All `/api/*` list endpoints return a pagination wrapper**: `{ totalItems, totalPages, currentPage, itemsPerPage, items }`. Always unwrap with `extractPageItems()`. List endpoints also accept a `Paginate` bool param.
- **Read/write DTO split**: every entity has a `*ReadDto` (GET) and a plain write DTO. Read-only includes/fields must not be PUT back (see the booking `toWritableBooking` rule).
- **Service Provider XOR constraint**: the API enforces *"Exactly one of UserId or ProviderProfileId must be provided, not both and not neither."* Backed by the `CK_ServiceProvider_OwnerXor` DB CHECK constraint. Sending `0` counts as "provided" → 500. For the partner-application flow, send `userId` and `providerProfileId: null`.
- **Approval is server-controlled** (`approvalStatus`: 0=Pending, 1=Approved, 2=Declined): new providers always start Pending. Admin transitions via `POST /admin/service-providers/{id}/approve` / `/decline`. Same model on certificates and reviews.
- **Provider GET returns more than the write DTO**: also includes `approvalStatus`, `declineReason`, `isApproved`, `ratingAvg` (null until reviews exist), `isApplicationPartner`, `addressId`, `createdAt`, `updatedAt`, `bookings[]`, `providerProfile`. `providerToViewModel()` maps `ratingAvg` → `rating`.
- **Service GET returns more than the write DTO**: also includes `rating`, `totalRatingNumber`, `price` (effective price after discount — prefer over `pricing.basePrice` for display), `about` (read-only mirror of `description`), `imageUrl`, `basicServiceName`, `appliedDiscountType`, `appliedDiscountAmount`, `discounts[]`, `schedules[]`. These extra fields are typed as optional on `ServiceDto`.
- **Non-nullable service details reset if omitted on PUT**: `details.acceptedSpecies` (FLAGS) and `details.maxConcurrentBookings` must always be sent — `uiToServiceDto(form, original)` round-trips them (verified live: PUT with the full shape preserves all values).
- **Creating a booking REQUIRES a valid `paymentMethodId`** referencing an existing PaymentMethod for the user. Posting with `null`/`0`/missing → 422 ("must not be empty" + "must reference a real one"). So the booking flow has a hard prerequisite: the user must have a saved payment method. Picking the Pickup / Drop-off add-on is registered by the `includePickup` / `includePetReturn` flags (see the bookings.ts section) — the server computes the surcharge. `location` (write DTO: `BookingLocationDto`) is sent **inline** under `location.pickupAddress` / `location.leaveOverAddress`, and the create path now **persists it** (verified live 2026-06-22): the POST creates a real address row and the booking GET returns it under `location.pickupAddress` / `location.leaveOverAddress` (BACKEND_GAPS B2 resolved). (`/api/addresses` still exists standalone but requires a non-empty `state`; the booking flow uses the inline shape.)
- **Creating a pet REQUIRES at least one photo** — `'Request Photos' must not be empty`. `createPet()`/`AddPetScreen` must enforce ≥1 photo before POST (currently it does not — a photoless pet 422s).
- **Booking GET includes populated nested objects**: `serviceProvider` (with photos), `service`, `pet`, `user` (the booker — `id`/`userName`/`photos` only, **no `email`** as of 2026-06-22), `review`, and `location` (with the persisted `pickupAddress`/`leaveOverAddress` — B2 resolved) — enough to render a booking card from a single list call.
- **Verified enum names** (`GET /enums`): `serviceProviderType` = 0:Sitter, 1:Walker, 2:Boarder, 3:PetHotel, 4:Groomer. `bookingState` = 0:Upcoming, 1:Completed, 2:Cancelled. `petSpeciesType` (FLAGS) = 0:None, 1:Dog, 2:Cat, 4:Parrot, 8:Turtle, 16:Fish, 32:Snake, 63:All. `paymentType` = 0:Cash, 1:Card, 2:BankTransfer, 3:Wallet.

### New backend endpoints not yet wired in the FE (added in the 2026-06 API update)
Candidates for future phases — they exist and are documented in swagger:
- `GET /api/services/{id}/availability?from=&to=` (date-only params) — schedule-driven slot windows for BookServiceScreen.
- ~~`GET/POST/PUT/DELETE /api/service-schedules`~~ — **now wired** (per-day working hours for the AddEditService "Working Hours" section) via `services/service-schedules.ts`. The standalone WorkingHours screen was removed.
- **Payments (replaced the old `checkout-session` endpoints, verified 2026-06-22):** `GET /payments/bookings/{bookingId}/summary` → `{ bookingId, currency, totalPrice, depositAmount, amountPaid, balanceDue, payments[] }` (live ledger), `POST /payments/bookings/{bookingId}/pay` (`{ phase: 0|1, paymentMethodId }`), and `GET /api/booking-payments` (records, read-only). Not yet wired — stored-card management still doesn't exist (AU2).
- `POST /bookings/{id}/adjust-price` (`{ basePrice, discountAmount, pickupPrice, petReturnPrice, specialNeedsPrice }`) — provider re-prices a booking, returns the recomputed booking. `GET /api/bookings/{bookingId}/live-location` — GPS trail (`{ sessionId, sessionStatus, isActive, latest, trail[] }`) for LiveSession (B7). Neither is wired.
- `GET /enums/{enumName}` — single-enum getter (only the 12 registered enums; `PricingUnit`/`NotificationType` 404). `GET /api/requests` — CQRS introspection (lists available queries/commands per group); dev-only, not user-facing.
- ~~`GET /api/app-notifications` (+ mark-as-read PUT)~~ — **now wired** (in-app notification inbox) via `services/app-notifications.ts` → NotificationsScreen. Read-only on the collection (no POST in swagger — notifications are created server-side by booking/account events); `GET /{id}`, `PUT /{id}` (write DTO is only `{ id, isRead }` — server stamps `readAt`), `DELETE /{id}`. List filters: `UserId`, `IsRead`, `Type`, `Page`/`PerPage`/`Paginate`. `NotificationType` (0..10) is a swagger enum NOT exposed via `/enums` — names verified from live data and mirrored in `app-notifications.ts`. `GET/POST /api/user-push-devices` (push token registration) is still not wired.
- ~~`POST /admin/reviews/{id}/approve|decline`, `POST /admin/reviews/approve` (bulk)~~ — **now wired** (review moderation) via `services/admin.ts` → AdminReviewsScreen.
- `POST /auth/provider-profiles/register` (`{ providerProfileId, password }`) — create a login account from a provider profile.

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

### `useToast()` — `context/ToastContext.tsx`
App-wide transient-message host. `ToastProvider` is mounted in `App.tsx` directly under `ThemeProvider` (so the toast can read the theme) and above `AuthProvider`/`EnumsProvider` (so every screen **and** those contexts can call it). Renders a top overlay (`components/shared/Toast.tsx`, themed, auto-dismiss + tap-to-dismiss, stacks up to 3, de-dupes identical messages).
| Value | Type | Notes |
|---|---|---|
| `showError(message)` | fn | Red toast — the primary API-failure entry point |
| `showSuccess(message)` | fn | Green toast |
| `showInfo(message)` | fn | Blue toast |
| `showToast(message, variant?)` | fn | Generic (defaults to 'error') |
**Convention:** action/mutation failures (save/submit/delete/approve/etc.) → `showError(getErrorMessage(e, '…'))`; fetch-on-mount failures → an inline error view in the screen body (don't also toast). See Error handling below.

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
ProviderDetail, ServiceDetail, BookService, ReviewBooking, BookingConfirmed,
MyPets, AddPet, Settings, BecomePartner, PartnerApplication,
ApplicationSubmitted, Account, MyBookings, BookingDetails, MySchedule, MyServices,
AddEditService, ServicePreview, Notifications, NotificationSettings, NewRequests, LiveSession,
Promotions, CreatePromotion, EditPromotion, PromotionAnalytics,
AdminNewRequests, ApplicationReview, AdminPartners, AdminReviews,
PartnerDetails, AdminAddPartner
```

Navigation patterns:
- `useNavigation()` for imperative navigation
- `useRoute()` with `RouteProp` for typed params
- Route params passed as objects: `navigate('ProviderDetail', { provider })`

**Back vs. Up — use `useAppNavigation()` (`hooks/useAppNavigation.ts`):** the app is one flat stack, so bare `goBack()` follows push *history*, which can re-enter a completed flow. Distinguish the two intents:
- **Back (history)** — linear drill-downs (Home → Detail → Book) use `goBack()`. `AppHeader`'s default back already guards with `canGoBack()` and falls back to Home, so it never no-ops.
- **Done / Up (hierarchy)** — terminal screens must NOT `navigate()` back to a tab (that leaves the finished flow in history). Use `resetToTab(tab)` / `resetToScreen(route, params, tab)` to wipe the stack so back can't re-enter. Auth completion uses `navigation.reset({ index: 0, routes: [{ name: 'Login' }] })` (or `resetToAuth()`). Already applied to BookingConfirmed, ApplicationSubmitted, VerifyEmail, ForgotPassword.

Implementation notes (`App.tsx`):
- The whole stack is gated on `isLoggedIn`; while `isLoading` (session restore), a full-screen `ActivityIndicator` is shown.
- `MainTabs` registers all five tabs (`Home`, `Search`, `PartnerHub`, `AdminDashboard`, `Profile`) but the native tab bar is hidden (`tabBarStyle: { display: 'none' }`). The visible bar is the custom `components/shared/TabBar.tsx`, which role-gates `PartnerHub`/`AdminDashboard` via `useAuth()`.
- Tabs use `unmountOnBlur: true` — screens remount on each focus (do data fetching in `useFocusEffect`, not just `useEffect`, when you need fresh data on return; see `MyPetsScreen`).

---

## Screens Reference

| Screen | Container | Purpose |
|---|---|---|
| HomeScreen | `screens/home-screen/containers/HomeScreen.tsx` | **API-wired** — each row is its own backend endpoint (`services/home.ts`): Near You → `getNearMe({lat,lng})`, Most Popular → `getMostPopular()`, Recently Booked → `getRecentlyBooked()`, Special Deals → `getOnSale()`, all fetched in parallel in `useFocusEffect` (each wrapped so one failing row doesn't blank the page; re-runs when location resolves). Each returns a **leaner `ServiceDto[]`** (no precomputed `rating`/`price`/`imageUrl`/`appliedDiscountAmount` — cards fall back to `pricing.basePrice`, photos, 0-rating). **Card tap → ServiceDetail for that specific service** (service-centric — no provider step; the booker reads the full service before BookService); pills match `serviceProviderType` enum labels. |
| SearchScreen | `screens/search-screen/` | **API-wired (service-centric)** — `getServices({ isActive: true })`; client-side filter (type/price/rating); list/map toggle; **card tap → ServiceDetail for that service** (no provider step). ListView/MapView take `services: ServiceSearchItem[]`. |
| PartnerHubScreen | `screens/partner-hub-screen/containers/` | Partner dashboard (partner-only) |
| AdminDashboardScreen | `screens/admin-dashboard-screen/containers/` | Admin panel (admin-only) |
| ProfileScreen | `screens/profile-screen/containers/` | **API-wired** — header shows the real avatar (`getUser(currentUser.id).avatarUrl` → `resolveImageUrl`, initials fallback on error/none) + first/last name + email, loaded on focus; + settings menu |
| ProviderDetailScreen | `screens/provider-detail-screen/containers/` | **ORPHANED** — still registered in `App.tsx` but no longer reachable: Home and Search now go to ServiceDetail (→ BookService), so nothing navigates here. (`providerToViewModel`/`ProviderViewModel` are unused by user screens as a result.) Kept for now in case a "view provider profile" entry is wanted; safe to delete otherwise. |
| ServiceDetailScreen | `screens/service-detail-screen/containers/ServiceDetailScreen.tsx` | **API-wired — the pre-booking read-everything step** (route `ServiceDetail`, param `{ service: ServiceDto }`). Home/Search cards now land here first (not straight on BookService). On mount fetches the FULL service (`getService(id)`), its provider (`getServiceProvider`), and the provider's **approved** reviews (`getReviews({ approvalStatus: Approved })`) in parallel, each fail-soft. Renders hero image, name/type, rating + effective/struck price, About, provider (name/avatar/address/verified), additional services (`getEnabledServiceAddons`), accepted pets (`details.acceptedSpecies` FLAGS), "Good to Know" facts (duration/weight/live-tracking/lead-time), working hours (`schedulesToWorkingHours`), and the approved reviews. A sticky **Book Now** CTA is the only path forward → `navigate('BookService', { service })` with the full DTO. |
| BookServiceScreen | `screens/book-service-screen/containers/` | **API-wired** — books **one specific service passed in as a route param** (`{ service }`, a `ServiceDto`, from ServiceDetail's Book Now); `serviceProviderId` is read off the service. There is **no "Choose Service" step** — Step 1 shows the fixed service. Add-ons come from the service's own config (`getEnabledServiceAddons` — Pickup/Drop-off only); selecting **Pickup or Drop-off requires picking a location on a map** (`MapAddressPicker`) before continuing — the dropped pin is reverse-geocoded into an `AddressDto` via `services/geocoding.ts` and carried on the appointment as `pickupAddress`/`leaveOverAddress`. Real pets + shared DatePicker for the date (unscheduled weekdays grayed out via `isDateEnabled`). Time is picked via `TimeSlotPicker` (hourly 1h slots **derived from `service.schedules`** per weekday — a day with no schedule shows no slots; availability also factors the provider's real bookings for that day; see `services/bookings.ts` notes). Passes `{ service, appointments }` to ReviewBooking. |
| ReviewBookingScreen | `screens/review-booking-screen/` | **API-wired** — takes `{ service, appointments }`; shows the **service** (name/type/image), not a provider. Confirm resolves a payment method (auto-creates a default if none) and POSTs a real booking via `createBooking()` (`serviceProviderId` from the service). Payment selector is still UI-only (online/cash → Card/Cash). |
| BookingConfirmedScreen | `screens/booking-confirmed-screen/containers/` | Post-booking confirmation — takes `{ serviceName }` |
| MyPetsScreen | `screens/my-pets-screen/containers/` | User's pets list |
| AddPetScreen | `screens/add-pet-screen/containers/` | Create/edit pet + bulk photo upload. Tap a photo to pick the **profile photo** (`isSelected` + `photoUrl`); defaults to the first |
| SettingsScreen | `screens/settings-screen/` | App settings |
| BecomePartnerScreen | `screens/become-partner-screen/containers/` | Partner signup info |
| PartnerApplicationScreen | `screens/partner-application-screen/containers/` | Multi-step partner application form |
| ApplicationSubmittedScreen | `screens/application-submitted-screen/containers/` | Post-application confirmation |
| AccountScreen | `screens/account-screen/containers/` | **API-wired** — loads `getUser(currentUser.id)`; edits first/last name, phone, avatar, address. Save: upload new photo via `uploadFile` → `avatarUrl`; picked address sent **inline** in the user body (`address` with `id:0` — backend creates + links it, verified); then `updateUser({ ...original, ...edits })` (**PUT** — no PATCH; full record round-tripped so passwordHash/salt survive) + `refreshUser()`. Address uses `MapAddressPicker` (opens on current location). Email read-only; payment card is mock |
| ChangePasswordScreen | `screens/change-password-screen/containers/` | **API-wired** — `changePassword()` (current/new/confirm); reached from Settings |
| ForgotPasswordScreen | `screens/forgot-password-screen/containers/` | **API-wired** — 2-step: `forgotPassword(email)` → `resetPassword(token,…)`; reached from Login |
| MyBookingsScreen | `screens/my-bookings-screen/containers/` | **API-wired** — `getBookings({ userId })` in `useFocusEffect`; Upcoming/Past tabs from `bookingState`. Each card's **View Details → BookingDetails** (`{ bookingId }`). Completed cards with no review yet show a **Leave a Review** action → `ReviewModal` (`useReviewModal`); on submit, the list reloads so the new rating replaces the CTA. |
| BookingDetailsScreen | `screens/booking-details-screen/containers/` | **API-wired** — `getBooking(bookingId)`; read-only recap (service/provider, status, date/time, pet, pickup/drop-off addresses, payment method + price breakdown). For completed bookings: shows the existing review's stars, or a **Leave a Review** CTA → `ReviewModal` (re-fetches the booking on submit). |
| MyScheduleScreen | `screens/my-schedule-screen/containers/` | **API-wired** — loads bookings (partner: by provider, user: by userId) into the schedule source on focus; partner mode excludes pending requests (`currentStatus = ServiceRequestedByUser`) — they enter the schedule only after Accept in NewRequests; day/week/month views unchanged |
| MyServicesScreen | `screens/my-services-screen/containers/` | Partner's listed services. Add/Edit Service (`AddEditServiceScreen`) lets the partner tap a service image to pick the **profile photo** (`isSelected`, round-trips in edit). The **"Working Hours"** section now persists via `/api/service-schedules` (`saveServiceSchedules` after create/update; edit prefills from `service.schedules[]`) |
| ServicePreviewScreen | `screens/service-preview-screen/` | Preview service before publish |
| NotificationsScreen | `screens/notifications-screen/containers/NotificationsScreen.tsx` | **API-wired — the in-app notification INBOX** (route `Notifications`). `getAppNotifications({ userId })` on focus; rows show a per-`type` icon (`NotificationItem`), title/message, relative time, and an unread dot + brand tint. Tap → marks read (optimistic, `markNotificationRead`) and deep-links to BookingDetails when `dataJson` carries a `bookingId`. **`ServiceCompleted` (type 2) notifications open a `ReviewModal` instead** (via `useReviewModal`): tapping one — or, if left unread, the newest such notification **auto-pops** on the next load — resolves its booking (`getBooking`) and prompts for a 1–5 star + comment review. Opening it (clicked or auto) marks it read; if the booking is already reviewed (`booking.review` set) the modal is suppressed (falls back to BookingDetails), so a reviewed prompt never reopens. "Mark all read" header action (`markAllNotificationsRead`); pull-to-refresh; empty/error states. Reached from the Home bell, the AppHeader bell (default `onNotificationPress`), and the Profile "Notifications" menu item. The Home bell shows an unread badge from `getUnreadNotificationCount` (refreshed on focus). |
| NotificationSettingsScreen | `screens/notifications-screen/containers/NotificationSettingsScreen.tsx` | **API-wired — notification PREFERENCES** (route `NotificationSettings`, header "Notification Settings"). Formerly the `Notifications` screen; renamed/moved here. `getNotificationSettings` on focus; each toggle persists via `saveNotificationSettings` (POST/PUT). Save FK-fails for the seed admin (BACKEND_GAPS N1) → applies locally + shows a notice. Reached from the Profile "Notifications settings" menu item. |
| NewRequestsScreen | `screens/new-requests-screen/containers/` | **API-wired** — partner's bookings via `getBookings({ serviceProviderId })`; New/Accepted/Declined from state+currentStatus; accept → `confirmBooking` (POST /bookings/{id}/confirm), decline → a reason-input modal → `declineBooking(id, reason)` (POST /bookings/{id}/decline; reason stored as `cancelReason`, blank falls back to a generic reason); client name/email/avatar from the booking's populated `user` include; each card lists the booker's selected add-ons (Pickup/Drop-off/Special Needs) from the `include*` flags |
| LiveSessionScreen | `screens/live-session-screen/containers/` | **API-wired** — real-time run of the current booking, route param `{ mode: 'partner' \| 'user' }`. Selects the active booking on focus (partner: `getBookings({ serviceProviderId })` → in-progress `ServiceStarted` first, else soonest confirmed; user: in-progress booking they booked). Shows service/pet/counterparty + scheduled window + included add-ons. **Partner:** Start → `startBookingService` (currentStatus→3), then a `CountdownTimer` to `bookingTo` + a pickup/drop-off completion checklist (`AddOnChecklist`, local-only gate) + End → `endBookingService` (currentStatus→4, re-fetch-verifies past the B4 email-500). **User:** read-only tracking. Entry points: PartnerHub "Live Session" card + live banner; Profile menu item (shown only while a booking of theirs is in progress). Caveats: BACKEND_GAPS B7. |
| PromotionsScreen | `screens/promotions-screen/containers/` | **API-wired (offers only)** — loads `service-discounts` as offer cards (+ mock boost/featured); pause/resume toggles `isEnabled`. Both **Percent and Fixed** discounts render (`formatOfferAmount` → "20% OFF" / "$10 OFF"). **CreatePromotion** is a real offer form (pick a provider service → Percentage/Fixed toggle → amount → start + optional end date via `DatePicker` → `createServiceDiscount`). **EditPromotion** edits a backed offer's type/amount/date-range (`updateServiceDiscount`) or deletes it. boost/featured/analytics are mock (BACKEND_GAPS PR1–PR4) |
| AdminNewRequestsScreen | `screens/admin-new-requests-screen/containers/` | **API-wired** — `getServiceProviders()` in `useFocusEffect`; pending/approved/rejected tabs split on `approvalStatus`; approve → `approveServiceProvider()` (+ certs), reject → `declineServiceProvider()` (record kept, shows in Rejected tab); applicant email from `contactEmail` |
| ApplicationReviewScreen | (within admin-new-requests) | **API-wired** — approve → `approveServiceProvider()` (+ certs), reject → `declineServiceProvider()`, then `goBack()` (list refetches on focus) |
| AdminPartnersScreen | `screens/admin-partners-screen/containers/` | Admin partner management list |
| AdminReviewsScreen | `screens/admin-reviews-screen/containers/` | **API-wired** — review moderation. `getReviews({ perPage: 200 })` on focus (uses the embedded `user`/`serviceProvider` includes to render each card); Pending/Approved/Declined tabs split on `approvalStatus`. Approve → `approveReview()` (POST /admin/reviews/{id}/approve), decline → a reason-input modal → `declineReview(id, reason)`. Reached from the AdminDashboard "Reviews" quick action. |
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
| `MapAddressPicker` | `visible`, `title`, `initialRegion`, `isDarkMode`, `onClose`, `onSelect(address, label)` | Full-screen map location picker — type an address to jump to it (`forwardGeocode`), or pan the map under a fixed centre pin; opens on the user's current location, with a "locate me" button. On confirm, the centre is reverse-geocoded to an `AddressDto` via `services/geocoding.ts`. Platform-split: `.tsx` (react-native-maps) / `.web.tsx` (Leaflet iframe). Used for booking pickup/drop-off. |
| `ReviewModal` | `visible`, `serviceName?`, `submitting?`, `onClose`, `onSubmit(rating, comment)` | Centered "rate your experience" dialog — tappable 1–5 stars (live Poor→Excellent label) + optional comment + Submit. Presentational; the parent owns the `createReview` call. Driven by the **`useReviewModal(onSubmitted?)`** hook (`hooks/useReviewModal.ts`), which owns the `{ target, submitting, open, close, submit }` lifecycle + the POST. Entry points: the in-app "Service completed" notification (auto-pops/on-tap), and the **Leave a Review** CTA on completed bookings in MyBookings + BookingDetails. |
| `Toast` (`Toast.tsx`) | `toast`, `isDarkMode`, `onDismiss` | Single presentational toast row (icon + message + dismiss) for the global overlay. **Don't render directly** — use `useToast()` (`context/ToastContext.tsx`) to show app-wide error/success/info toasts. See Context Providers. |

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
- **Every API call must surface its failure to the user — never swallow with a bare `console.warn`/`.catch(() => {})`.** Two display channels:
  - **Action/mutation errors** (create/update/delete/approve/confirm/submit, etc.) → `useToast().showError(getErrorMessage(e, '…'))`. Don't use `Alert.alert` for API errors (reserve `Alert` for confirmations, validation, permission prompts, and success dialogs that drive navigation).
  - **Fetch-on-mount (load) errors** → an inline error view in the screen body (icon + message), e.g. the pattern in `MyBookingsScreen`. Don't also toast.
  - **Exception — genuinely fail-soft secondary fetches** with a working fallback (Profile avatar, Home unread-count badge, an optimistic mark-as-read) may stay silent; primary data and user-triggered loads must not.



### Loading states
- `isLoading` boolean per screen/component
- Show `ActivityIndicator` while loading
- Disable submit buttons while loading

### Forms
- Touched state: only show field errors after user has interacted with the field
- Visual feedback: red border (error), green border (valid), default (untouched)
- **Always use `DatePicker` (from `components/shared/DatePicker.tsx`) for any date input** — never use a plain `TextInput` for dates. Pass `isDarkMode`, `value`, `onChange`, and `onClose` props. For time inputs, use `TimePicker` from the same folder — **except booking start times**, which use `TimeSlotPicker` (`screens/book-service-screen/components/`) so unavailable slots are disabled based on existing bookings.

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
