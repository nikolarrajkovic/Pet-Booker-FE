# Front-end review — 2026-10-14

A review of `main` @ `ac73d5e`, run against the local docker stack, with the backend on `master` @ `eda0a2e`.

> **Fix status (2026-10-14):** fixed on branches `claude/fe-code-review` (this repo) and
> `claude/fe-review-backend-fixes` (PetBookerBackend). See [Fix status](#fix-status-2026-10-14)
> at the end for each item. The findings below describe the code as it was reviewed. Every item marked **(reproduced)** was observed in the running app or against the live local API. The rest come from reading the code.

## How it was checked

| Check | Result |
|---|---|
| CI gates (`tsc --noEmit`, `eslint --max-warnings 0`, `prettier -c`, `jest --ci`) | All clean, 368/368 tests |
| **Contract check**: every `api*()` call in `services/*.ts` (110) against the API's `swagger.json` (124 paths), covering path, method and every query key | No mismatches. Dynamic paths were checked by hand |
| **Whole-app sweep**: 128 page loads = 3 roles (customer, partner, admin) × 1440 px and 390 px × every routed screen | 0 failed API calls, 0 page errors, 0 `undefined`/`[object Object]`/`NaN`/raw i18n keys on screen, 0 horizontal overflow, median load 1.9 s, no call over 1.5 s |
| Booking journey in the UI (service → book → review → confirm, with a deliberate double-click) | Works. The double-click sent **one** booking POST |
| Serbian + dark-mode pass over key phone screens | Fully translated. Date and number formats are off (U4) |
| Targeted reproductions | Session and refresh-token behaviour, approval, external photo URLs, security headers |

The contract and the per-screen basics are in good shape, which reflects the earlier audits. What remains is session handling, a handful of UX gaps on the web design, and some cross-cutting rules that live half in the backend.

---

## P1: fix first

### S1. Simultaneous token refreshes sign the user out (reproduced)
`apiAuthFetch` (`services/http.ts:369-389`) and the hubs' `getHubAccessToken` (`services/hub-connection.ts:22-34`) each refresh on their own. When the access token has expired, every request in flight at that moment runs its own `POST /auth/refresh` with the **same** refresh token.

The backend rotates refresh tokens: each refresh revokes the one it was given (`AuthAppService` refresh). The first refresh succeeds and every later one is refused. `apiAuthFetch`'s catch then clears the tokens and fires the session-expired handler.

- Reproduced: open Search after the access token expired. Two `/auth/refresh` calls went out. With the second delayed by 400 ms (ordinary mobile jitter) it got `401 Invalid refresh token`, both tokens were cleared, and the app landed on `/login`. With no delay both calls succeeded, leaving an orphaned extra session.
- The same catch also signs the user out when the refresh merely **failed to reach** the server (status 0, offline or API restarting).
- Three hubs reconnecting after an API restart, plus the REST calls, make the collision likely.

**Fix:**
1. One refresh in flight per app, shared by REST and the hubs: a module-level promise that concurrent callers await.
2. Clear the session only when `/auth/refresh` answers 400/401. Keep it on a network error.
3. Optionally on the backend, accept a just-rotated refresh token for a few seconds, returning the same new pair. This is a common grace window.

### S2. A reload after 30 minutes lands on the login screen (reproduced)
`AuthContext.checkAuthStatus` (`context/AuthContext.tsx:74`) restores the session only if `getAccessToken()` returns a token. That returns `null` once the 30-minute access token has expired, and nothing then tries the 7-day refresh token. The comment above it assumes the getter refreshes, but it doesn't.

Reproduced: an expired access token plus a valid refresh token in storage led to `/login` with **zero** refresh calls. So the effective session is 30 minutes across reloads and app restarts, not 7 days.

**Fix:** when the access token is missing but a refresh token exists, go through the shared refresh from S1 before `getMe()`.

### S3. An approved partner keeps the customer view until they sign in again (reproduced against the API)
When an admin approves an application, `/auth/me` with the applicant's **existing** token already returns `groups: [User, ServiceProvider]` and the new `serviceProviderId`. The token's role claims do not include the partner commands yet, so `POST /api/services` and `GET /api/stats/provider/overview` answer **401** until the token is refreshed. They return 200 right after a refresh.

The app does neither. The `ServiceProviderApproved` notification only invalidates cached lists (`services/notification-invalidation.ts:57`).

**Fix:** on `ServiceProviderApproved`, and on ban, unban or timeout, force a token refresh through the S1 path, then call `refreshUser()`.

The general version is "on a 401, refresh once and retry". That needs the backend to answer permission denials with **403**, keeping **401** for a bad token. Today both are 401 (backend review M8), which is why the FE can't tell them apart.

### S4. Logout ends every session on every device
`POST /auth/logout` sends no refresh token, and the backend's `LogoutAsync` revokes **all** of the user's refresh tokens and rotates the security stamp. Since each sign-in got its own session (backend #173), signing out on a phone now signs out the browser too.

**Fix:**
- Backend: revoke only the presented refresh token; make "sign out everywhere" a separate action.
- FE: send the refresh token with logout.

### S5. A photo can be any external URL (backend, reproduced through the public API)
Every photo validator reads `FileUploadId is null || <caller owns that file>` (e.g. `PetValidators.cs:57`), and `Src` is mapped straight from the client's DTO (`PhotoProfile`). A photo with no upload is therefore accepted with any `src`. A photo can also name the caller's own file to pass the ownership rule while displaying a different, external `src`.

The demo seed does exactly this through `POST /api/pets`, giving the pet a `placedog.net` picture. Such images skip the upload pipeline's checks, re-encoding and EXIF stripping, as well as moderation. On the web, each one tells an outside server the IP of whoever views it.

**Fix:**
- Backend: require `FileUploadId` on every photo write and derive `Src` from the `File`.
- FE: stop sending `src`.
- Data: rows with external `src` can stay or be cleaned up.

### S6. No security headers on the web app or the API (checked live on the sandbox)
`https://app.169.58.199.63.sslip.io/` and the API send none of the following:
- `Content-Security-Policy`
- `frame-ancestors` or `X-Frame-Options`
- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `Referrer-Policy`

Tokens live in `localStorage` on the web, so a CSP is the main defence against injected script, and without `frame-ancestors` the app can be framed by another site.

**Fix:** a `header` block in `docker/web.Caddyfile`, and the same essentials in the backend's `docker/Caddyfile`. Allow the API origin plus the Google Maps and OSM tile hosts in the CSP.

---

## P2: UX and correctness

| # | Where | Finding | Suggested change |
|---|---|---|---|
| U1 | ServiceDetail, BookingDetails (web design) | One full-width column across 1,200 px, drawn directly on the patterned background. **Book Now sits ~1,750 px down**, two screenfuls below the fold at 1440×900. Labels and values sit at opposite edges ("Monday … Open 24 hours"), and grey text on the pattern is hard to read. CLAUDE.md's own rule says a commitment screen keeps its action in reach, via a sticky aside on web. | `TwoColumn` with a sticky aside holding price + Book Now (or the booking's status/payment), `ContentContainer` width cap, card surfaces |
| U2 | Every screen opened with an object param: BookService, ReviewBooking, EditPromotion, PromotionAnalytics, ApplicationReview, PartnerDetails, AddEditService, ServicePreview | The address bar shows `/BookService?service=[object Object]` and `/ReviewBooking?service=[object Object]&appointments=[object Object]`. `navigation/linking.ts:18` says unmapped screens "don't change the address bar", but they do (reproduced). A reload falls back to Home, which is harmless. | Give BookService a real path (`services/:serviceId/book`) that refetches from the id, so a reload resumes the form. Keep the others out of the URL (e.g. `getPathFromState` returning the previous path) |
| U3 | BookService / ReviewBooking | The **Total does not include a selected extra** until a pet is chosen (showed 1,200 RSD with +400 picked). A disabled **Continue** gives no reason. ReviewBooking offers "Pay Online — Card or Wallet" but charges nothing then: payment happens on Booking Details after the provider confirms, and the screen doesn't say so. | Quote as soon as the date and time are set (the pet doesn't change the price). Say what's missing under the disabled button. One line on Review: "You'll pay after the provider confirms" |
| U4 | `services/currency.ts:154` + every date label | Money is `String(roundMoney(…))`: no thousands grouping ("8511 RSD", "125000 RSD") and an English decimal point in sr/ru ("12.5 €"). Dates in Serbian keep English order and capitals ("Okt 14, 2026", "Sreda, Oktobar 14, 2026"; Serbian writes "14. okt 2026.", "sreda, 14. oktobar 2026."). | `Intl.NumberFormat(language)` / `Intl.DateTimeFormat(language)` (Hermes supports both) behind the existing helpers |
| U5 | Home | Unrated services show **"★ 0.0 (0)"** (Search says "no reviews yet"). **Near You** fills with "Unavailable" services: 6 of the 8 nearest locally have no working hours, and the backend ranks near-me by distance only, while search puts bookable services first. The phone header reads "Pet Booker" (`i18n login.appName`), the brand "PetBooker". | Hide the stars when there are no reviews. Backend: rank near-me (and the other rails) bookable-first. One spelling |
| U6 | `screens/new-requests-screen/components/RequestCard.tsx:92` | A green "online" dot is hardcoded on every request's avatar. There is no presence feature. | Remove it, or drive it from the chat hub |
| U7 | Promotions | An **Ended** promotion offers **Resume** (`PromotionCard.tsx:123,269` checks only active / not active). Resuming re-enables a promotion whose window has passed, so nothing visible happens. **Analytics** opens a page saying performance isn't tracked. | Ended → "Extend dates" (opens Edit). Hide Analytics until there is data |
| U8 | Admin dashboard | The "1008 active" badge on Partners wraps onto two lines and covers the icon. | `999+` cap / no-wrap |
| U9 | Every address line | Addresses print their `state` ("Belgrade, **CS**"; elsewhere the city repeated or "-"). The backend **requires** `state`, which Serbian addresses don't have, so clients fill it with junk. | Backend: make `state` optional. FE: show `line1, postalCode city` |
| U10 | Theme | The app starts light whatever the system says (the browser asked for dark and got light). | Default to the system scheme until the user picks one |
| U11 | Booking details | Time shows only the start ("00:07"), not the booked window, and the pet appears twice (Pet row, then photo row). | "10:00 – 11:00"; merge the pet rows |
| U12 | Partner bookings | `POST /bookings/{id}/adjust-price` exists on the backend but has no UI, so a partner can't re-price a booking from the app. | An "Adjust price" action on the partner's booking view |

---

## P3: efficiency and hygiene

| # | Finding | Suggested change |
|---|---|---|
| E1 | Search samples **100 full service rows (189 KB, ~0.5 s)** on every visit just to fill the filter options (`SearchScreen.tsx:119,226`); CreateGroupRequest does the same per type. The add-on chips come only from the 100 **most expensive** services, so extras offered only by cheaper ones never appear. | Backend `GET /api/services/facets` → `{ maxPrice, addOnNames[] }` |
| E2 | Partner Requests fetches its four tab counts **twice** on load. Messages fetches `/api/chat/unread-count` **3×**. Tab badges cost one request per tab everywhere. | De-dupe the mount/focus double fetch. Optionally one counts endpoint per list |
| E3 | Photos are uploaded at full resolution (`quality: 0.8`, base64 in memory: AccountScreen, AddPetScreen, BusinessProfileScreen), so a 12 MP photo is 3–5 MB. The backend shrinks to 1920 px anyway, and the partner application's bulk upload is capped at 50 MB. | Resize to 1920 px on the device (`expo-image-manipulator`), and pass the file URI on native instead of base64 |
| E4 | `apiFetch` clones every response even in production (`http.ts:347`; the clone is only read in `__DEV__`), and `parseApiError` logs `console.error` in production (`http.ts:182`). | Move both behind `__DEV__` |
| E5 | `clearCache()` empties `inFlight`, but a fetch already running still `put()`s its result afterwards (`cache.ts:171-178`), so the previous account's response can land in the cache after sign-out. | Generation counter: drop a result whose generation changed |
| E6 | Every page logs the same console noise, which buries real warnings: <ul><li>`expo-notifications` push listener on web</li><li>deprecated `shadow*`/`pointerEvents` props</li><li>a Reanimated false positive on `gutter.value` (a plain number named `.value`)</li><li>SignalR's "No client method `subscribedtoconversation`": the chat hub sends `SubscribedToConversation`, the FE never listens</li></ul> | Guard the listener on web, migrate the props, rename `gutter.value`, handle (or stop sending) the event |
| E7 | Token lifetimes are hardcoded (`token-storage.ts:23-24`, 30 min / 7 days) rather than read from the JWT's `exp`. | Decode `exp` |
| E8 | `tailwind.config.jscd` is an empty file tracked since the first commit. `README.md` is 15 bytes. | Delete it; a short README pointing at CLAUDE.md |

---

## Backend items this review surfaced

For the backend's own report (`PetBookerBackend/docs/code-review-2026-10-08.md`):
- Refresh rotation with no reuse grace (S1).
- Logout revokes every session (S4).
- 401 used for permission denials (S3, backend M8).
- Photo `src` from the client (S5).
- `state` required on addresses (U9).
- Near-me ranking ignores bookability (U5).
- A facets endpoint (E1).
- The unhandled `SubscribedToConversation` event (E6).
- Notification amounts rendered invariant ("1200.00 RSD" in a Serbian refund notice).

## Not issues (checked)
- Every `api*()` path, method and query key matches swagger.
- Translations are complete in sr/ru (type-enforced). No hardcoded English was found in screens.
- Booking checkout is protected against a double submit.
- No `Alert.alert` left (the web alert host is used).
- The silent `.catch(() => {})` calls are all on optional side loads (counts, read receipts, hints), which the conventions allow.
- `getAllBookings` and the other capped reads are bounded by state or date filters.

---

## Fix status (2026-10-14)

| Item | Status | Where |
|---|---|---|
| S1 simultaneous refreshes | **Fixed.** One refresh in flight shared by REST and the hubs (`services/session.ts`), a Web Lock across tabs, and a session ended only by a refused refresh token. The backend honours a just-rotated refresh token for 60 s. Verified: one refresh with 400 ms jitter, and one across two tabs; the user stays signed in. | FE `eaaba0c`, BE `bdc4f5f` |
| S2 reload after 30 min | **Fixed.** Restore renews an expired access token. Verified: one refresh, then Home. | FE `eaaba0c` |
| S3 approval needs a new sign-in | **Fixed.** The approve, ban and unban notifications renew the token and re-read the user; a 401 on a token older than a minute renews once and retries. Verified: the celebration opens at once and the six partner stats calls answer 200. | FE `eaaba0c` |
| S4 logout ends every device | **Fixed.** Logout names this device's refresh token, and the backend ends only that session (`allDevices`, or a body-less call, ends all). Verified with two devices. | FE `eaaba0c`, BE `bdc4f5f` |
| S5 external photo URLs | **Fixed (backend).** Every photo must be the caller's own upload; the stored `src` comes from the file; `avatarUrl` must be an own upload or unchanged. | BE `1b6309e` |
| S6 security headers | **Fixed.** CSP and frame/nosniff/referrer on the web app (verified on the production export: 32 screens and the map, no refusal); HSTS/nosniff/referrer on every edge host and a locked-down CSP on the API. | FE `ca5779a`, BE `e15ec6b` |
| U1 desktop service/booking pages | **Fixed.** A sticky side panel holds price + Book Now (service) and the bill + payment + Cancel (booking). | FE `2abf785` |
| U2 `[object Object]` URLs | **Fixed.** Book Service is `/services/{id}/book` and reloads into the form; unmapped screens keep the URL beneath them. | FE `c2bfb7b` |
| U3 booking form | **Fixed.** "from" while extras are unpriced, the missing step under a disabled Continue, and "nothing is charged now" on Review. | FE `57f7774` |
| U4 dates and money formats | **Fixed.** `Intl` for Serbian/Russian dates; grouped, locale-punctuated money and counts. | FE `57f7774` |
| U5 Home cards / ranking / brand | **Fixed.** "no reviews yet", Home rails rank bookable services first (backend), "PetBooker". | FE `57f7774`, BE `e15ec6b` |
| U6 fake online dot | **Fixed** (removed). | FE `57f7774` |
| U7 ended promotion | **Fixed.** "Extend dates". Analytics left as is: it now says plainly that nothing is tracked. | FE `57f7774` |
| U8 admin badge | **Fixed.** At the tile corner, one line, grouped count. | FE `57f7774` |
| U9 address region | **Fixed.** `state` optional on the backend; `addressLabel` reads "Nemanjina 4, 11000 Belgrade". | FE `57f7774`, BE `e15ec6b` |
| U10 system theme | **Kept by design.** `ThemeContext` documents the decision: following the OS would change the app for every existing user on release. | — |
| U11 booking time / pet | **Fixed.** "10:00 – 11:00"; the pet photo sits in its row. | FE `57f7774` |
| U12 adjust price | **Built.** "Adjust price" on new requests in the partner inbox. | FE `2a85842` |
| E1 facets | **Fixed.** `GET /api/services/facets` (~1 KB) replaces the 100-row sample. | FE `0a869f2`, BE `e15ec6b` |
| E2 duplicate fetches | **Fixed for Requests** (counts once, not per page). Messages' unread count stays: three cheap indexed calls, the last after a real change. | FE `596cf95` |
| E3 resize photos on the device | **Open.** Needs a native module (`expo-image-manipulator`), a version bump and a new build. | — |
| E4 prod clone / console | **Fixed.** | FE `eaaba0c` |
| E5 cache across sign-out | **Fixed.** Generation counter. | FE `b5c9250` |
| E6 console noise | **Partly.** The web bundle no longer loads expo-notifications; the chat hub's acknowledgement has a handler. React-native-web's `shadow*`/`pointerEvents` deprecations and Reanimated's `gutter.value` false positive are dev-only and left (≈120 call sites for no runtime effect). | FE `536fa2c` |
| E7 token lifetimes | **Fixed.** Read from the JWT `exp`. | FE `eaaba0c` |
| E8 repo hygiene | **Fixed.** | FE `536fa2c` |
| Notification amounts (backend) | **Fixed.** A `DisplayMoney` token rendered in the reader's number format. | BE `e15ec6b` |


## Regression run (2026-10-14, after the fixes)

Every role was driven through the UI in a real browser at 390 px and 1440 px against the local stack (backend branch `claude/fe-review-backend-fixes`):

- **Customer (17 steps).** Home rails, search by text and by type, the map, booking a service end to end, My Bookings, cancelling with a reason, adding a pet with an uploaded photo and deleting it, editing the account, adding and removing a card, chat, switching to Serbian and back, marking notifications read, a group request to every matching walker, and logout.
- **One booking through all three roles (8 steps).** The partner accepts it, the customer pays with a saved card, the partner starts and completes it from Live Session, the customer reviews it, the admin approves the review, and the review shows on the service.
- **Partner (11 steps).** The hub, schedule day/week/month, declining a request with a reason, accepting one group request and declining another, creating, pausing and deleting a promotion, the business profile, editing a service, and replying in chat.
- **Admin (7 steps).** The dashboard, an application's details, approving one, rejecting one with a reason (on a phone the card offers Approve only, so Reject is on the details page), opening a partner, declining a review with a reason, and inviting a partner (the invite email arrives).

All steps pass at both widths, with no 5xx and no page errors. A sweep of every route (128 pages, three roles, 1440 and 390) has no failed request and no page error; its console holds only the dev-only deprecations noted under E6, plus old local rows whose photos point at `cdn.example.com` (saved before the own-upload rule; the photo component draws its placeholder). The backend e2e suite passes too (24 scripts, 0 failures), as do the visual suite (34) and jest (386).

The run found six problems, all now fixed (R6 in the backend):

| # | Problem | Fix |
|---|---|---|
| R1 | Accepting a group request opens Booking Details, which assumed the viewer was the customer. The partner saw "Provider: <their own business>", a **Cancel booking** button the API refuses them, and, once completed, "Leave a Review" on their own work. | The screen asks `isCustomer`. A partner sees a **Customer** row, no Cancel or review call to action, and "Customer's Review". The payment panel already checked this. |
| R2 | The partner's schedule printed the partner's own business name on every appointment, and an empty location row with only an icon. | It names the customer (the provider on a user's schedule) and omits the place row when there is no place (`scheduleCounterpart.test.ts`). |
| R3 | Create Offer, Add Partner and Change Password closed with `goBack()`. Opened from their own URL (a reload, a link), there was nothing to pop, so the saved form stayed on screen and invited a duplicate save. | `useAppNavigation().leaveTo(parent)` goes back when there is history and otherwise replaces the form with its list, as Add Pet already did. |
| R5 | **Editing a service during a promotion lowered its real price.** The editor took its price from `price`, which is what a customer pays today with the offer applied, and saved it back as the base price. Each save during a 15% offer cut another 15%; the run caught 1,200 RSD stored as 1,020. | The editor starts from `pricing.basePrice` (`serviceAggregateWrite.test.ts`). A flow step now edits a service while an offer is live and checks the stored price. The affected local service was restored. |
| R6 | An expired booking (confirmed, never started before its end) showed "Still to pay" for the whole price, and the pay endpoint accepted money for it, because expiry is derived and the stored status still reads as payable. | Backend: pay refuses it (`Error_ExpiredBookingNotPayable`) and `BalanceDue` is 0 (BE `10ce50a`). |
| R4 | Icon-only buttons had no accessible name: a pet card's edit and delete, the five review stars, and a promotion's edit pencil. A screen reader announced "button". | Labels in en/sr/ru: "Edit Bela", "Delete Bela", "5 of 5 stars: Excellent", "Edit 15% Off — …". |

## Follow-ups (2026-10-14, after deploy)

| Item | Fix |
|---|---|
| Search showed the previous search after a type was picked on Home | `usePagedList` reports loading from the render that changes the query; Search applies a navigated type at once. Verified: the dog loader from the first frame (it used to show the old results for ~200 ms, longer on a slow network). |
| Partners saw customers as a username | `displayName` ("Ana P.") from the API through `customerName()`: Requests, schedule, Live Session, Booking Details, admin lists. |
| 27 more icon-only buttons without a screen-reader name | Labelled (en/sr/ru); a scan for icon-only `TouchableOpacity`/`Pressable` without `accessibilityLabel` now finds none. |
| My Schedule floated on the page pattern; the web month's rows were ~220 px | Card panels with a shared header, compact web month (84 px cells), tab switch as its own card, dog loader. |
| An expired paid booking kept the money (backend) | A 10-minute sweep refunds it, with its own "did not take place" notice. |
| Mark all read left everything past the first page unread | One `POST /api/app-notifications/read-all` over the whole feed (backend + app). |
