# Backend Gaps

A running registry of **UI features that have no backend support** and are therefore
mocked / kept as local-only state in the app. Each entry notes where the gap is, what
the UI does today, and what the backend would need to fully support it.

> Convention: when you wire a screen to the API and hit a field the API can't store,
> **keep the UI**, mock/derive the value, and add a row here. Search the code for
> `BACKEND-GAP:` comments — each one points back to an entry in this file.

---

## Services (`/api/services`, `ServiceDto`)

The real `ServiceDto` (writable fields, post 2026-06 API update) is: `name`, `description`,
`type`, `isActive`, `pricing` (`basePrice`, `unit`, escrow fields, **plus the add-on
surcharges** `pickupPrice`/`petReturnPrice` (`LocationBasedPriceDto`: `baseFee`, `perKmFee`,
`freeDistanceKm`, `maxDistanceKm`) and `specialNeedsPrice` (flat)), `details`
(add-on on/off flags `isPickupProvided`, `isPetReturnProvided`, `isSpecialNeedsProvided`,
`canSpecialNeedsChange`, `supportsLiveTracking`, plus `acceptedSpecies`, `min/maxWeightKg`,
`min/maxDurationMinutes`, `leadTimeHours`, `maxConcurrentBookings`, `foodPricings`), `photos`.
**The 2026-06 update moved the add-on surcharge money out of `details` and into `pricing`,
and renamed the `supports*` flags to `is*Provided`.** GET also returns read-only `rating`,
`totalRatingNumber`, `price`, `about`, `imageUrl`, `basicServiceName`, `schedules[]`.

| # | UI location | Field / feature | Status | What the backend needs |
|---|---|---|---|---|
| S1 | AddEditService – "Pricing & Duration" | **Multiple pricing tiers** (duration→price rows) | **Partially mocked.** Only the **first** tier's price is persisted as `pricing.basePrice`. The duration label and any additional tiers are kept in the UI but **not saved** (lost on reload). The API now has a `pricing.unit` (PricingUnit) but still no tier collection. | A `pricingTiers[]` (duration + price) collection on the service. |
| S2 | AddEditService – "Working Hours" | **Per-day working hours / availability** | ✅ **Resolved on the write side (FE wired).** The "Working Hours" section now persists via `/api/service-schedules` (`services/service-schedules.ts`): on save, `saveServiceSchedules()` reconciles the form's enabled days against the service's existing `schedules[]` (POST new, PUT changed times, DELETE removed days — unchanged days make no call); edit mode prefills from `service.schedules[]` via `schedulesToWorkingHours()` (verified live). **Read side also wired:** BookServiceScreen now builds its `TimeSlotPicker` windows from `service.schedules` per weekday (unscheduled days are grayed out in the calendar and show no slots) — slots are no longer hardcoded. (The standalone `GET /api/services/{id}/availability` endpoint remains unused; schedules are read off the embedded `service.schedules`. The standalone WorkingHours screen + its PartnerHub entry were removed.) | — (optional: drive slot granularity from the availability endpoint). |
| S3 | AddEditService – "Additional Services" | **Add-on types (Pickup / Drop-off / Special Needs Care)** | ✅ **Resolved (2026-06 API update).** All three add-ons now persist via the catalog (`services/service-addons.ts`): the on/off flag → `details.is{Pickup,PetReturn,SpecialNeeds}Provided`, the surcharge money → `pricing.{pickupPrice,petReturnPrice}.baseFee` (`LocationBasedPriceDto`) / `pricing.specialNeedsPrice` (flat). Verified live: a PUT round-trips all three. Catalog read/write is the single source of truth — add-ons light up in the create form, edit prefill, **and** BookService automatically. **Still UI-only:** the per-km/distance fields of `LocationBasedPriceDto` (`perKmFee`, `freeDistanceKm`, `maxDistanceKm`) — the form captures only a flat `baseFee`; the others default to 0/null and round-trip on edit. | A form for the location-based per-km surcharge fields (optional). |
| S4 | AddEditService – "Service Type" picker | **Service type string** (e.g. "Dog Walking") | ✅ **Resolved (2026-06 API update).** `type` (ServiceProviderType) is writable on the service and the picker round-trips it via `uiToServiceDto`. | — |
| S5 | MyServices card | **Bookings count** ("342 bookings") | **Mocked (0).** Not exposed per-service. | A per-service bookings/transactions count. |
| S6 | HomeScreen rows | **Hide services of unapproved providers** | **Now backend-controlled.** Home rows come from dedicated endpoints (`/api/home/most-popular|on-sale|recently-booked|near-me`), so what shows is whatever those endpoints return — the FE no longer joins/filters. Approval filtering (if desired) belongs in those endpoints. | Ensure the `/api/home/*` endpoints exclude services of Pending/Declined providers. |

## Service Provider (`/api/service-providers`)

| # | UI location | Field / feature | Status | What the backend needs |
|---|---|---|---|---|
| P1 | (various partner screens) | **Resolve the current user's own provider** | ✅ **Resolved.** `/auth/me` now returns `serviceProviderId` (and `providerProfileId`), so partner screens read `currentUser.serviceProviderId` directly (0 = none) instead of fetching the provider list. The old `getMyProvider(userId)` helper was removed. | — |
| P2 | ApplicationReview | Applicant **email / phone / bio / experience / availability** | **Partially resolved (2026-06).** `contactEmail` is on the provider DTO now (sent at apply time, shown in admin review). Phone/bio/experience/availability are still not carried. | The remaining fields surfaced on the provider/application DTO. |
| P3 | ProviderDetail "About" | **Provider about / bio text** | **Mocked** (generated from name + type). No about/bio on the provider DTO (providerProfile.bio is null for applications). | A bio/about field on the provider. |

## Bookings (`/api/bookings`)

| # | UI location | Field / feature | Status | What the backend needs |
|---|---|---|---|---|
| B1 | NewRequests / MySchedule | **Client (booker) name, email, phone** | **Mostly resolved (2026-06).** The booking GET now populates `user` (`id`, `userName`, `email`, `photos`) — name/email/avatar are real. **Phone is still not carried.** | A phone field on the booking's user include. |
| B2 | NewRequests / MySchedule | **Service location name, owner notes** | **Partly addressed.** Pickup/Drop-off addresses are captured at booking time and sent **inline** in the booking POST (`location.pickupAddress`/`leaveOverAddress`) — no `/api/addresses` call. **Backend caveat (verified live 2026-06-16): the booking does not currently persist/return the address** — POST 201s but `pickupAddress` reads back null for every payload shape (inline, `pickupAddressId`, top-level). Needs a backend fix to persist + return it. Also still not carried: a free-text service location label and owner notes. (Per-booking add-on selections → B5.) | Persist + return the booking's pickup/leave-over address; plus a location label + notes field. |
| B5 | BookService add-ons | **Per-booking add-on selections** | ✅ **Resolved (verified live 2026-06-18).** The booking write DTO carries `includePickup` / `includePetReturn` / `includeSpecialNeeds` (+ nullable `distanceKm`); **these flags — not the presence of an address — are what register an add-on** (a payload with `location.pickupAddress` but no `includePickup` reads back `includePickup=false`, `addOnsTotal=0`). The server then computes the surcharge from the service's `pricing` and returns the read-only breakdown (`pickupPrice` / `petReturnPrice` / `specialNeedsPrice` / `addOnsTotal` / `depositAmount`) — a client-sent `totalPrice` is **recomputed/overridden** server-side. `createBooking` now sets the flags from the selected add-ons and `toWritableBooking` round-trips them. | — (still missing: the captured pickup/drop-off **address** itself — see B2). |
| B3 | MySchedule | **Service type** (walking/grooming/sitting colour) | **Inferred from the service name.** The booking doesn't expose a type. | A `type` on the nested service. |
| B4 | `setBookingStatus` PUT transitions | **Status transition emails 500 on an invalid recipient email** | **Backend bug, mostly sidestepped.** PUTting `currentStatus` = 1 or 4 makes the backend send an email; an invalid recipient (seed `admin`) throws 500 — **the status still persists**. NewRequests now accepts via `POST /bookings/{id}/confirm`, which does **not** 500 on the same account (verified live 2026-06-12), so only remaining `setBookingStatus` callers (e.g. a future ServiceEnded flow) are exposed. | Validate/guard the recipient email, or make the notification non-fatal. |
| B6 | (latent — no UI caller) | **`DELETE /api/bookings/{id}` 500s after any status transition** | **Backend bug (verified live 2026-06-12).** Confirm/decline write `BookingStatuses` audit rows; deleting the booking then violates `FK_BookingStatuses_Bookings_BookingId`. Workaround: delete the `/api/booking-statuses?BookingId=` rows first. `deleteBooking()` exists in `services/bookings.ts` but no screen calls it. | Cascade delete (or soft-delete) on the audit rows. |
| B7 | LiveSession (partner + user) | **Live-session run-state: pickup/drop-off completion + `startedAt`** | **Partly local-only.** Start/End ARE wired to the real lifecycle via dedicated endpoints: `startBookingService` → `POST /bookings/{id}/start-service` (`currentStatus = ServiceStarted (3)`), `endBookingService` → `POST /bookings/{id}/complete-service` (`ServiceEnded (4)`). **No backend field records pickup/drop-off *completion*** (only the `includePickup`/`includePetReturn` selection flags exist), so the LiveSession "mark complete" checkboxes are **local-only** and just gate the End button — the booker's read-only view can't see the partner's real-time check state. **No `startedAt`/`endedAt` timestamp** either, so the countdown is driven off the scheduled `bookingTo`. End is also subject to the **B4** email-500 (the screen re-fetches to confirm the persisted `ServiceEnded`). | A pickup/drop-off completion flag (or a session task model) + `startedAt`/`endedAt` timestamps on the booking. |

> **Booking PUT note (not a gap, a client rule):** the booking GET returns nested
> read-only includes (`serviceProvider`/`service`/`pet`/`user`/addresses). PUTing
> those back 500s, so `setBookingStatus`/`cancelBooking` strip them and send only
> the writable scalar fields (`toWritableBooking`).

## Files (`/files/{src}`)

| # | UI location | Field / feature | Status | What the backend needs |
|---|---|---|---|---|
| F1 | All screens rendering `/files/...` photos (provider/service/pet images, admin docs) | **Image loading** | **Broken by the 2026-06 API update (verified live 2026-06-12).** `GET /files/{src}` now returns 401 without a Bearer token. RN `<Image>` / web `<img>` requests cannot attach Authorization headers, so every relative `/files/...` photo fails to load. (Bonus: some seed file records 404 even with auth.) | Anonymous GET for uploaded files (or signed/expiring URLs). FE workaround would be auth-fetching to blob/object URLs — invasive, touches every image usage. |

## Notifications (`/api/user-notification-settings`)

The DTO maps 1:1 to the screen toggles (`pushEnabled`, `emailEnabled`, `smsEnabled`,
`bookingUpdates`, `appointmentReminders`, `messages`, `promotionsOffers`,
`newServices`, `dndEnabled`, `dndStartTime`, `dndEndTime`, `timezone`).

| # | UI location | Field / feature | Status | What the backend needs |
|---|---|---|---|---|
| N1 | NotificationsScreen save | **Settings `id`/`userId` return as `0` (serialization bug)** | **Backend bug — write path unverifiable.** `POST` persists a row (GET-all shows it), but the API serializes `id` and `userId` as `0` in every response. Consequences: `GET ?UserId=1` returns nothing (stored/returned userId reads 0), and a create→update flow can't capture a real id to `PUT` (so it would keep POSTing duplicates). Earlier a transient `500` FK error (`FK_UserNotificationSettings_Users_UserId`) was also seen for the seed `admin`. GET is structurally fine. Client code matches the DTO and decides POST-vs-PUT on `id > 0`, so it works once the backend returns real ids. The screen applies changes locally and shows a notice on save failure. | Return the real `id`/`userId` on POST/GET (and ensure the auth user has a domain `Users` row). |
| N2 | NotificationsScreen "Customize Schedule" | **Editing DND start/end times** | **Mock (no-op link).** `dndStartTime`/`dndEndTime` are loaded/saved from the record (defaults otherwise) but there's no time-picker UI to change them. | A time-picker UI (frontend TODO); the fields themselves are backed. |
| N3 | SettingsScreen | Push/Email/SMS switches | **Local-only (not wired).** Duplicate of the NotificationsScreen channels; could persist via the same service. | — |

## Promotions (`/api/service-discounts`)

Only the **"offer"** promotion type maps to the API (a `ServiceDiscount`: percent/fixed
amount on a service, with a date range + enabled flag). Everything else is mock.

| # | UI location | Field / feature | Status | What the backend needs |
|---|---|---|---|---|
| PR1 | Promotions / Edit | **`boost`, `featured`, `ad` promotion types** | **Mock-only.** Kept as cards (negative ids) for UI completeness; not persisted. Pause/resume toggles them locally. | A promotions/campaigns model beyond service discounts. |
| PR2 | Promotions "Performance Overview" | **Analytics: views, clicks, budget spent, bookings-from-promos, cost-per-booking** | **Mock (static numbers).** | Impression/click/conversion + spend tracking. |
| PR3 | Promotion card (offer) | **`usageCount` ("8 uses")** | **Mock (0).** Not tracked per discount. | A redemption count on the discount. |
| PR4 | PromotionAnalytics screen | Entire analytics screen | **Mock.** | As PR2. |
| PR5 | CreatePromotionScreen | **Creating a promotion** | **Mock (not wired).** A real discount needs `serviceId` + type + date range, which the create form doesn't capture. Edit/list/toggle/delete of existing offers ARE wired to the API. | A create form with service + type + date-range pickers (then `createServiceDiscount`). |
| PR6 | EditPromotion dates | **Start/End date inputs are free-text** (not `DatePicker`) | Parsed best-effort with `new Date(str)`; falls back to the existing value. | Use the shared `DatePicker` (frontend TODO, not a backend gap). |

## Auth / Account (`/auth/*`)

| # | UI location | Field / feature | Status | What the backend needs |
|---|---|---|---|---|
| AU1 | AccountScreen email | **Email change** | **Not supported.** `PUT /auth/profile` returns 400 "Email cannot be changed via profile update". The email field is read-only and sent unchanged. | An email-change flow (likely with re-verification). |
| AU2 | AccountScreen / ProfileScreen | **Address + profile photo** | ✅ **Resolved (via `/api/users/{id}`).** Account loads `getUser(id)` and saves name/phone/avatar/address through `updateUser` (avatar uploaded then set as `avatarUrl`; address sent **inline** in the user PUT body with `id:0` — backend creates + links it, returns the new `addressId`; verified live). Profile header shows the real avatar + name. (Saved VISA card is still mock — real cards need the Stripe gateway, deferred.) | A payment-method UI on a real gateway. |
| AU5 | `/api/users/{id}` update | **No PATCH; password hashes in the DTO** | **Worked around.** `PATCH` 405s — only `PUT` exists, and it takes the full `UserDto` **including `passwordHash`/`passwordSalt`/`passwordHashAlgorithm`, which GET returns populated**. `updateUser` round-trips the full record (edits merged) so the password survives. | A partial-update (PATCH) endpoint and/or omitting password hashes from the user read/write DTO. |
| AU3 | AccountScreen (admin) | **Profile update 500** | **Seed account issue.** Updating the seed `admin` 500s ("Exception was thrown by handler"), tied to its invalid email (`admin`). A normal user with a valid email updates fine. Endpoint validates correctly otherwise. | Valid email on the account. |
| AU4 | ForgotPasswordScreen | **Reset token delivery** | **Manual paste.** `reset-password` needs the token from the reset email; there's no deep-linking, so the user pastes the code into step 2. | Deep-link handling for the reset link (frontend). |

## Partner applications (admin)

| # | UI location | Field / feature | Status | What the backend needs |
|---|---|---|---|---|
| A1 | AdminNewRequests | **"Rejected" status** | ✅ **Resolved (2026-06).** Providers carry `approvalStatus` (0=Pending, 1=Approved, 2=Declined) + `declineReason`; reject calls `POST /admin/service-providers/{id}/decline` and the record shows in the Rejected tab. | — |
