# Backend Gaps

A running registry of **UI features that have no backend support** and are therefore
mocked / kept as local-only state in the app. Each entry notes where the gap is, what
the UI does today, and what the backend would need to fully support it.

> Convention: when you wire a screen to the API and hit a field the API can't store,
> **keep the UI**, mock/derive the value, and add a row here. Search the code for
> `BACKEND-GAP:` comments — each one points back to an entry in this file.
>
> Gap IDs are stable (referenced by `BACKEND-GAP:` code comments) — resolved entries are
> removed but IDs are never reused/renumbered.

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
| S1 | AddEditService – "Pricing & Duration" | **Multiple pricing tiers** (duration→price rows) | ✅ **Resolved (2026-07).** Tiers persist as **service pricing options** (`/api/service-pricing-options`, embedded read-only on the service GET as `pricingOptions[]`: `id`, `serviceId`, `name`, `description?`, `durationMinutes`, `price`). AddEditService reconciles them on save (`saveServicePricingOptions`, diff-by-id POST/PUT/DELETE); a service **with** options requires every booking to pick one (`pricingOptionId` — the server derives `bookingTo`/`basePrice` from it), one **without** keeps classic free-range booking. `pricing.basePrice` is written as the **cheapest** tier since the lean Home-rail `ServiceDto` (`/api/home/*`) has no `pricingOptions` — that keeps its "from" price correct. | (Optional) embed `pricingOptions` on the lean Home-rail DTO too. |
| S5 | MyServices card | **Bookings count** ("342 bookings") | **Mocked (0).** Not exposed per-service. | A per-service bookings/transactions count. |
| S6 | HomeScreen rows | **Hide services of unapproved providers** | **Now backend-controlled.** Home rows come from dedicated endpoints (`/api/home/most-popular|on-sale|recently-booked|near-me`), so what shows is whatever those endpoints return — the FE no longer joins/filters. Approval filtering (if desired) belongs in those endpoints. | Ensure the `/api/home/*` endpoints exclude services of Pending/Declined providers. |

## Service Provider (`/api/service-providers`)

| # | UI location | Field / feature | Status | What the backend needs |
|---|---|---|---|---|
| P2 | ApplicationReview | Applicant **email / phone / bio / experience / availability** | **Partially resolved (2026-06).** `contactEmail` is on the provider DTO now (sent at apply time, shown in admin review). Phone/bio are reachable via the nested `providerProfile` (`bio`/`phone`) but read back null for application-created providers; experience/availability are still not carried. | The remaining fields populated/surfaced on the provider/application DTO. |
| P3 | ProviderDetail "About" | **Provider about / bio text** | **Mocked** (generated from name + type). The `providerProfile.bio` field exists but is null for applications. | The bio/about field populated on the provider. |

## Bookings (`/api/bookings`)

| # | UI location | Field / feature | Status | What the backend needs |
|---|---|---|---|---|
| B1 | NewRequests / MySchedule | **Client (booker) name, email, phone** | **Partly regressed (re-verified live 2026-06-22).** The booking GET still populates `user` but **`UserInfoReadDto` was slimmed to `id`/`userName`/`photos`** — **`email` is no longer returned** (it used to be), and phone was never carried. So name/avatar are real; **email + phone are both absent.** No UI breakage: RequestCard never rendered the email, BookingDetails doesn't show the booker's email, and AdminReviews already guards a blank email — all read it via `?? ''`. (Same slim `UserInfoReadDto` is shared by the review `user` include.) | An email + phone field on the booking/review `user` include. |
| B2 | NewRequests / MySchedule | **Pickup/Drop-off address persistence** | ✅ **Resolved (verified live 2026-06-22).** The inline `location.pickupAddress`/`leaveOverAddress` posted with a booking now **persists and round-trips** — a real `pickupAddressId` is created and the read DTO returns the address under **`location.pickupAddress` / `location.leaveOverAddress`** (the old top-level fields are gone). `services/bookings.ts` backfills the top-level fields from `location` via `withResolvedAddresses()` in `getBooking`/`getBookings`/`createBooking`, so BookingDetails + LiveSession read them unchanged. *Still not carried:* a free-text service location label + owner notes. | (Optional) a location label + notes field. |
| B3 | MySchedule | **Service type** (walking/grooming/sitting colour) | **Inferred from the service name.** The nested `service` include (`ServiceInfoReadDto`) exposes only `id`/`name`/`photos` — no type. | A `type` on the nested service. |
| B4 | `setBookingStatus` PUT transitions | **Status transition emails 500 on an invalid recipient email** | **Backend bug, mostly sidestepped (could not re-trigger 2026-06-22 — start/complete are now guarded, see below).** PUTting `currentStatus` = 1 or 4 makes the backend send an email; an invalid recipient (seed `admin`) throws 500 — **the status still persists**. NewRequests accepts via `POST /bookings/{id}/confirm` (no 500). **New backend guard:** `POST /bookings/{id}/start-service` now 422s `"A service can be started at most 30 minutes before its scheduled start time."` (window widened 15→30 min in 2026-07 as the live-tracking head-out lead), and `complete-service` requires status `ServiceStarted` — so LiveSession Start/End surface those validation messages (via `parseApiError`) when pressed outside the window. | Validate/guard the recipient email, or make the notification non-fatal. |
| B6 | (latent — no UI caller) | **`DELETE /api/bookings/{id}` after a status transition** | ✅ **Resolved (verified live 2026-06-22).** Deleting a confirmed/started booking now returns **204** (the `BookingStatuses` audit rows cascade-delete; previously 500 on `FK_BookingStatuses_Bookings_BookingId`). `deleteBooking()` exists in `services/bookings.ts` but still no screen calls it. | — |
| B7 | LiveSession (partner + user) | **Live-session run-state: pickup/drop-off completion + `startedAt`** | **Partly local-only.** Start/End wired to the real lifecycle: `startBookingService` → `POST /bookings/{id}/start-service` (`ServiceStarted (3)`, now guarded to ≤30 min before start), `endBookingService` → `POST /bookings/{id}/complete-service` (`ServiceEnded (4)`). **Still no backend field for pickup/drop-off *completion*** (only the `include*` selection flags), so the LiveSession checkboxes remain **local-only** and just gate End; the booker can't see the partner's real-time check state. **Still no `startedAt`/`endedAt` timestamp** — the countdown runs off the scheduled `bookingTo`. `GET /api/bookings/{bookingId}/live-location` (GPS trail: `{ sessionId, sessionStatus, isActive, latest, trail[] }`) is **wired as of 2026-07** — LiveSession shows the booker a live map fed by SignalR `/hubs/location` (`LocationUpdated` + `TrackingStarted`/`TrackingEnded` events; `services/live-location.ts`, `services/location-hub.ts`) with the REST endpoint as mount/reconnect backfill, and the partner device streams GPS via `PushLocation` (`useLocationSharing`). Still **not wired**: `POST /bookings/{id}/adjust-price` (provider re-prices a booking: `{ basePrice, discountAmount, pickupPrice, petReturnPrice, specialNeedsPrice }` → recomputed booking). | A pickup/drop-off completion flag (or a session task model) + `startedAt`/`endedAt` timestamps on the booking. |

> **Booking PUT note (not a gap, a client rule):** the booking GET returns nested
> read-only includes (`serviceProvider`/`service`/`pet`/`user`/addresses). PUTing
> those back 500s, so `setBookingStatus`/`cancelBooking` strip them and send only
> the writable scalar fields (`toWritableBooking`).

## Notifications (`/api/user-notification-settings`)

The DTO maps 1:1 to the screen toggles (`pushEnabled`, `emailEnabled`, `smsEnabled`,
`bookingUpdates`, `appointmentReminders`, `messages`, `promotionsOffers`,
`newServices`, `dndEnabled`, `dndStartTime`, `dndEndTime`, `timezone`).

| # | UI location | Field / feature | Status | What the backend needs |
|---|---|---|---|---|
| N1 | NotificationsScreen save | **Settings `id`/`userId` return as `0` (serialization bug)** | ✅ **Resolved (backend fix verified live 2026-07-16).** Root cause was the backend AutoMapper profile: `ReverseMap()` inverted the read map's `Id←UserId` member into `UserId←Id`, so writes stored `UserId = 0` (later a 500 on `FK_UserNotificationSettings_Users_UserId`). Fixed to map the entity key from `dto.UserId`. Verified: `POST` → 201 with real `id`/`userId` (= the user id, the row's PK), `GET ?UserId=` returns the row, `PUT /{userId}` round-trips every field incl. `preferredLanguage`. Client code already decides POST-vs-PUT on `id > 0`, so the screen works unchanged. | — |
| N2 | NotificationsScreen "Customize Schedule" | **Editing DND start/end times** | **Mock (no-op link).** `dndStartTime`/`dndEndTime` are loaded/saved from the record (defaults otherwise) but there's no time-picker UI to change them. | A time-picker UI (frontend TODO); the fields themselves are backed. |
| N3 | SettingsScreen | Push/Email/SMS switches | **Local-only (not wired).** Duplicate of the NotificationsScreen channels; could persist via the same service. | — |

## Promotions (`/api/service-discounts`)

Only the **"offer"** promotion type maps to the API (a `ServiceDiscount`: percent/fixed
amount on a service, with a date range + enabled flag). Everything else is mock.

| # | UI location | Field / feature | Status | What the backend needs |
|---|---|---|---|---|
| PR1 | Promotions / Edit | **`boost`, `featured`, `ad` promotion types** | **Mock-only.** Kept as cards (negative ids) for UI completeness; not persisted. Pause/resume toggles them locally. | A promotions/campaigns model beyond service discounts. |
| PR2 | Promotions "Performance Overview" | **Analytics: views, clicks, budget spent, bookings-from-promos, cost-per-booking** | **Mock (static numbers).** | Impression/click/conversion + spend tracking. |
| PR3 | Promotion card (offer) | **`usageCount` ("8 uses")** | **Mock (0).** Not tracked per discount (`ServiceDiscountReadDto` has no redemption count). | A redemption count on the discount. |
| PR4 | PromotionAnalytics screen | Entire analytics screen | **Mock.** | As PR2. |
| PR5 | CreatePromotionScreen | **Creating a promotion** | ✅ **Wired.** The screen is now a real offer form: pick one of the provider's services, choose Percentage/Fixed, enter the amount, set a start + optional open-ended end date (`DatePicker`), then `createServiceDiscount`. | — |
| PR6 | Create/EditPromotion dates | **Start/End date inputs** | ✅ **Resolved.** Both screens now use the shared `DatePicker` (end date is clearable → open-ended). | — |

## Auth / Account (`/auth/*`)

| # | UI location | Field / feature | Status | What the backend needs |
|---|---|---|---|---|
| AU1 | AccountScreen email | **Email change** | **Not supported.** `PUT /auth/profile` returns 400 "Email cannot be changed via profile update". The email field is read-only and sent unchanged. | An email-change flow (likely with re-verification). |
| AU2 | AccountScreen / ProfileScreen | **Saved payment card** | **Mock.** Address + profile photo are resolved (loaded via `getUser(id)` and saved through `updateUser`). The saved VISA card is still mock — real cards need a payment gateway. Note: a **per-booking payment ledger now exists and is verified live (2026-06-22)** — `GET /payments/bookings/{bookingId}/summary` → `{ bookingId, currency, totalPrice, depositAmount, amountPaid, balanceDue, payments[] }`, `POST /payments/bookings/{bookingId}/pay` (`{ phase, paymentMethodId }`, `phase`=0/1), and `GET /api/booking-payments` (records; empty until a payment is made). None are wired in the FE yet, and stored-card management still does not exist. | A payment-method UI on a real gateway (card storage); optionally wire the per-booking payment ledger above. |
| AU5 | `/api/users/{id}` update | **No PATCH; password hashes in the DTO** | **Worked around.** `PATCH` 405s — only `PUT` exists, and it takes the full `UserDto` **including `passwordHash`/`passwordSalt`/`passwordHashAlgorithm`, which GET returns populated**. `updateUser` round-trips the full record (edits merged) so the password survives. | A partial-update (PATCH) endpoint and/or omitting password hashes from the user read/write DTO. |
| AU3 | AccountScreen (admin) | **Profile update 500** | **Seed account issue.** Updating the seed `admin` 500s ("Exception was thrown by handler"), tied to its invalid email (`admin`). A normal user with a valid email updates fine. Endpoint validates correctly otherwise. | Valid email on the account. |
| AU4 | ForgotPasswordScreen | **Reset token delivery** | **Manual paste.** `reset-password` needs the token from the reset email; there's no deep-linking, so the user pastes the code into step 2. | Deep-link handling for the reset link (frontend). |
