# Backend Gaps

A running registry of **UI features that have no backend support** and are therefore
mocked / kept as local-only state in the app. Each entry notes where the gap is, what
the UI does today, and what the backend would need to fully support it.

> Convention: when you wire a screen to the API and hit a field the API can't store,
> **keep the UI**, mock/derive the value, and add a row here. Search the code for
> `BACKEND-GAP:` comments — each one points back to an entry in this file.

---

## Services (`/api/services`, `ServiceDto`)

The real `ServiceDto` (writable fields) is: `name`, `notes`, `basePrice`, `escrowAmount`,
`isEscrowPercentEnabled`, `escrowPercent`, `pricing`, `details` (`supportsPickup`,
`pickupPriceSurcharge`, `supportsLeaveOver`, `leaveOverPriceSurcharge`, `foodPricings`),
`photos`. GET also returns read-only `rating`, `totalRatingNumber`, `price`, `about`,
`imageUrl`, `basicServiceName`.

| # | UI location | Field / feature | Status | What the backend needs |
|---|---|---|---|---|
| S1 | AddEditService – "Pricing & Duration" | **Multiple pricing tiers** (duration→price rows) | **Partially mocked.** Only the **first** tier's price is persisted as `basePrice`. The duration label and any additional tiers are kept in the UI but **not saved** (lost on reload). | A `pricingTiers[]` (duration + price) collection on the service. |
| S2 | AddEditService – "Working Hours" | **Per-day working hours / availability** | **Mocked (local only).** Collected in the UI, never sent; defaults shown on reload. | An availability/working-hours model on the service (or provider). |
| S3 | AddEditService – "Additional Services" | **Add-on types beyond Pickup / Drop-off** (Photo Updates, Medication Administration, Special Needs Care) | **Mocked (local only).** Only "Pickup" → `details.supportsPickup`/`pickupPriceSurcharge` and "Drop-off" → `details.supportsLeaveOver`/`leaveOverPriceSurcharge` are persisted. The rest are kept in the UI but not saved. | A generic `addOns[]` (name + price + enabled) collection. |
| S4 | AddEditService – "Service Type" picker | **Service type string** (e.g. "Dog Walking") | **Mocked / derived.** The service itself has no writable `type`; on GET the read-only `basicServiceName` is shown instead. The picker selection is not persisted. | A writable `type` on the service (today type lives on the parent ServiceProvider). |
| S5 | MyServices card | **Bookings count** ("342 bookings") | **Mocked (0).** Not exposed per-service. | A per-service bookings/transactions count. |

## Service Provider (`/api/service-providers`)

| # | UI location | Field / feature | Status | What the backend needs |
|---|---|---|---|---|
| P1 | (various partner screens) | **Resolve the current user's own provider** | **Worked around.** No `userId` filter on `GET /api/service-providers`; `getMyProvider(userId)` fetches all and filters client-side. | A `UserId` query param (or a `/auth/me`-embedded providerId). |
| P2 | ApplicationReview | Applicant **email / phone / bio / experience / availability** | **Blank.** The provider DTO doesn't carry these (collected at apply time but not returned). | These fields surfaced on the provider/application DTO. |
| P3 | ProviderDetail "About" | **Provider about / bio text** | **Mocked** (generated from name + type). No about/bio on the provider DTO (providerProfile.bio is null for applications). | A bio/about field on the provider. |

## Bookings (`/api/bookings`)

| # | UI location | Field / feature | Status | What the backend needs |
|---|---|---|---|---|
| B1 | NewRequests / MySchedule | **Client (booker) name, email, phone** | **Blank / "Client".** The booking GET does not populate the `user` object. | `user` populated on the booking GET (or contact fields on the DTO). |
| B2 | NewRequests / MySchedule | **Service location name, owner notes, selected add-ons** | **Blank.** Not carried on the booking. | Location label, notes, and per-booking add-on selections on the booking DTO. |
| B5 | BookService add-ons | **"Photo Updates" / "Detailed Report" add-ons** | **Mock-priced, not persisted.** Pickup/Drop-off use the service's real pickup/leave-over surcharges; the other two are mock and only affect the displayed total. Multi-appointment creates one real booking per appointment, but the add-on breakdown isn't stored (only `totalPrice`). | Per-booking add-on line items. |
| B3 | MySchedule | **Service type** (walking/grooming/sitting colour) | **Inferred from the service name.** The booking doesn't expose a type. | A `type` on the nested service. |
| B4 | NewRequests "Accept" (and any confirm) | **Status transition emails 500 on an invalid recipient email** | **Backend bug, surfaced as an error.** Setting `currentStatus` = 1 (ServiceConfirmedByProvider) or 4 (ServiceEnded) makes the backend send an email; if the recipient's address is invalid (e.g. the seed `admin` account whose email is literally `admin`) it throws `500: "The specified string is not in the form required for an e-mail address."` — **the status still persists**. Real users with valid emails are unaffected. Client payload is correct (writable fields only). | Validate/guard the recipient email before sending, or make the notification non-fatal to the status update. |

> **Booking PUT note (not a gap, a client rule):** the booking GET returns nested
> read-only includes (`serviceProvider`/`service`/`pet`/`user`/addresses). PUTing
> those back 500s, so `setBookingStatus`/`cancelBooking` strip them and send only
> the writable scalar fields (`toWritableBooking`).

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

## Partner applications (admin)

| # | UI location | Field / feature | Status | What the backend needs |
|---|---|---|---|---|
| A1 | AdminNewRequests | **"Rejected" status** | **Mocked tab (always empty for real data).** No server rejected state — "reject" deletes the provider record. | An explicit application status enum (pending/approved/rejected). |
