# Manual E2E testing guide

How to walk the app end to end against a live backend, by role, with the expected result at each
step. There is a small Jest suite (`npm test`) covering the shared machinery, but it renders to a
tree, not a browser — it cannot see an overlapping sidebar, a missing hover state or a map that is
20px tall. So this walkthrough is still the front end's regression net.

**The app renders two designs** — mobile below 768px and web at and above it. Every section below
is a *per-design* pass, and §9 is the layout pass that covers what only differs between them. See
[`WEB_LAYOUT.md`](WEB_LAYOUT.md) and [`WEB_LAYOUT_TESTING.md`](WEB_LAYOUT_TESTING.md).

The backend has a scripted suite that covers the API side — run it first, so a red screen here is
never mistaken for a backend fault:

```powershell
# in the PetBookerBackend repo
docker compose up -d --build authapi petbookerapi
.\scripts\e2e-all.ps1
```

See `PetBookerBackend/docs/e2e-testing-overview.md` for what that covers and which backend gaps
are already known.

## Setup

```bash
cp .env.example .env      # EXPO_PUBLIC_API_BASE_URL=http://localhost:5161
npm run web               # must be port 8081 - the Google Maps key is referrer-restricted to it
```

| Thing                                | Where                         |
| ------------------------------------ | ----------------------------- |
| App (web)                            | http://localhost:8081         |
| Backend + Swagger                    | http://localhost:5161/swagger |
| MailHog (confirmation + reset codes) | http://localhost:8025         |
| Seq (backend logs)                   | http://localhost:5341         |

Seeded admin: **`admin` / `Admin123`**. To seed browsable demo data, run
`PetBookerBackend/scripts/seed-fe-demo.ps1`.

**Registration needs MailHog** — the confirm code is emailed, never shown in the UI. Register →
open MailHog → copy the 4–8 digit code → paste into VerifyEmail.

## Known-broken — do not re-report

Fixing any of these should also delete its row here. **K6 and K8 were retired on 2026-09-16**:
BookService now renders step 1, and the browse filters are server-side (`Types`, `MinPrice`/
`MaxPrice`, `MinRating`, `AcceptedSpecies`, `AdditionalServiceNames`, `OnSaleOnly`, `SortBy` all
travel on the query string — confirmed on the wire).

Verified live on 2026-08-06:

| #   | What you will see                                                          | Cause                                                                       |
| --- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| K3  | Login screen says **"Pet Booker"**, the side-nav logo says **"PetBooker"**. | Brand strings never unified — see `HARDCODED_VALUES.md`. (The old "PawCare" is gone.) |
| K7  | Idling ~30 min logs you out with "Session expired. Please log in again."    | Access-token TTL is a hardcoded 30-minute guess rather than the JWT's `exp`. |

**Most of K9-K22 were fixed on 2026-09-17** and their rows are kept below only until the fixes
ship — each one is a live regression check. Two rows are new from that pass:

| #    | What you will see                                                                                           | Cause                                                                                                                                                                             |
| ---- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K23  | A provider's own **My Services** lists a flat extra under the SERVICE's name ("Full Grooming Package 500 RSD" where the customer sees "Nail polish 500 RSD"). | `AdditionalServiceEntry` deliberately carries no `name` — the partner editor derives one on save (`additionalServiceTitle`), so an extra created through the API or seeded with a real name is renamed in the provider's own view, and re-derived on the next save. Read surface and write model disagree. |
| K24  | The partner **Promotions** list shows a synthesized "Standard" pricing option for a service that defines none. | Cosmetic, but it invents a tier name the provider never created.                                                                                                                  |

Verified live on 2026-09-16 — full walkthrough, all four session kinds, both designs:

| #    | What you will see                                                                                                          | Cause                                                                                                                                                                                         |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K9   | A **managed ProviderProfile** login lands on a broken Home — "Couldn't load services — Missing permission for command 'HomeMostPopular'". My Services and Promotions are equally dead. | Every read a provider needs is `[UserGroupAuth(UserGroupType.User)]` only, while the matching write is `ServiceProvider`. See §4b and the backend gap register.                                 |
| K10  | **No way to cancel a booking** as a pet owner, on any screen, at any width.                                                 | `cancelBooking()` exists in `services/bookings.ts` but is called from nowhere. Step 3.11 cannot currently pass.                                                                                |
| K11  | Confirming your email drops you on **Login** instead of into the app.                                                       | `/auth/confirm-email` returns an access+refresh pair on purpose; `confirmEmail()` uses `apiVoid`, which never reads the body. Step 1.2 cannot currently pass.                                  |
| K12  | A username with an underscore (`mateja_test`) is rejected at registration.                                                  | FE regex `/^[A-Za-z][A-Za-z0-9.]{2,19}$/` vs backend `^[A-Za-z](?!.*[_.]{2})[A-Za-z0-9._]{2,19}$`. Mirror gap: the FE *accepts* `a..b`, which the backend rejects.                             |
| K13  | Picking a language in Settings applies it but **leaves the picker on screen**, and a second pick inside it does nothing.     | The lingering modal is inert — close and reopen to change again. Hits the first-run chooser too.                                                                                               |
| K14  | The currency picker previews every option as the same number: "1200 RSD / 1200 € / $1200".                                   | `CurrencyPicker.tsx` renders `formatMoney(1200, code)` per row with no conversion. Actual price display *is* converted correctly — only the preview lies.                                      |
| K15  | A service with pricing options lists "from 3500 RSD" on Home/Search but "3000 RSD starting from" on its detail page.         | `ServiceResultRow`/`ServiceCard` use `service.price ?? pricing.basePrice`; only ServiceDetail takes the cheapest option.                                                                       |
| K16  | BookService shows a **Total you cannot buy** until you pick a duration — 3500, when the options are 3000 and 4500.           | The initial total is the base price even though choosing an option is required.                                                                                                               |
| K17  | A slot inside the service's lead time is offered, and only fails at Confirm with a toast.                                    | The grid disables *past* slots but ignores `details.leadTimeHours` — which the detail screen already displays as "Book 2h ahead".                                                              |
| K18  | **A map that fails to load blocks the partner application**: Street Address is required and was settable only from the map picker. | The text-input fallback rendered only when *no* map handler was wired, so with one wired the map was the single way to satisfy a required field — and the sheet's "Search address or place" needs the same SDK. Anything that stops Maps loading (no key, quota, outage, blocked script) left the application impossible to finish. **FIXED 2026-09-17**: the field is always typeable, with the map as a shortcut beside it. |
| K19  | A pet whose photo 404s renders as a blank box — on My Pets the text is pushed right of dead space; on BookingDetails a stray unlabelled pet name floats between sections. | No missing-image fallback for pets. Service cards have a paw placeholder; pets do not.                                                                                                         |
| K20  | A burst of auth traffic from one IP logs you out on the next reload, and a login during it reports "Login failed. Please verify your credentials." | `/auth/me` and `/auth/refresh` share the 20/60s brute-force bucket with `/auth/login`; `AuthContext` treats *any* `/auth/me` failure as signed-out; and `loginWithEmailPassword` hardcodes a credentials message for every body-less error. |
| K21  | Add Pet demands Sex, Birth Date, Weight **and** Height; pressing Save with only the photo missing gives no visible feedback. | The backend requires only Name, Type, Breed and one photo. The form also does not scroll to an error that is off-screen — the photo field is at the top.                                       |
| K22  | "Booking Confirmed!" on a booking the provider has not seen yet, promising a confirmation email that never arrives.          | The booking is `ServiceRequestedByUser`/`Upcoming`; the owner is deliberately not emailed at creation (only the provider is). The wording also collides with the real `BookingConfirmed` notification sent later. |

---

## 1. Auth & session

| #   | Step                                                    | Expected                                                                                         |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1.1 | Register a new account                                  | Redirects to VerifyEmail; a code arrives in MailHog                                              |
| 1.2 | Enter the code                                          | Auto-logs in and lands on Home (no separate login step)                                          |
| 1.3 | Enter a wrong code                                      | Inline error, stays on the screen                                                                |
| 1.4 | Log out → log in with **username**, then with **email** | Both work (`identifier` accepts either)                                                          |
| 1.5 | Log in with a wrong password 5+ times                   | Lockout message naming a retry time                                                              |
| 1.6 | Forgot Password → submit email                          | Reset token arrives in MailHog; step 2 accepts it pasted (no deep link — K7-adjacent, by design) |
| 1.7 | Settings → Change Password, then re-login               | New password works, old one rejected                                                             |
| 1.8 | Hard-refresh the browser while logged in                | Session survives (tokens in localStorage on web)                                                 |
| 1.9 | Hammer the auth endpoints from the same IP (e.g. run `scripts\e2e-all.ps1` in the background), then reload the app | Session survives. Today (K20) `/auth/me` shares the login rate-limit bucket, gets a 429, and `AuthContext`'s `catch` signs you out while valid tokens stay in localStorage |
| 1.10 | Log in while that bucket is exhausted                  | A "too many attempts, try again shortly" message. Today (K20) it reads "Login failed. Please verify your credentials." — the 429 body is empty and carries no `Retry-After`, so the hardcoded fallback wins |
| 1.11 | Click "Continue with Google" with popups blocked       | A visible error. Today the rejection is an uncaught promise and the button appears to do nothing; the client IDs are also still `YOUR_*_CLIENT_ID` placeholders |

## 2. Discovery (user)

| #   | Step                                     | Expected                                                                                                                                        |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | Home loads                               | Up to four rails render — Near You, Most Popular, Special Deals, Recently Booked. A rail with no data (empty **or** failed) is absent entirely, not a placeholder; one failing rail must not blank the page |
| 2.1b | Home with no data anywhere at all       | Exactly one placeholder, in the Near You rail — "couldn't load" + Retry (reloads every row) after a failure, "nothing near you yet" otherwise. No greeting/tagline card above the pills |
| 2.2 | Deny location permission, reload         | Near You falls back to the Belgrade default rather than spinning                                                                                |
| 2.3 | Tap a service card                       | **ServiceDetail** (not a provider screen) — hero, rating, price, About, provider block, add-ons, accepted pets, working hours, approved reviews |
| 2.4 | Check the reviews list                   | Only `Approved` reviews appear (the embed carries all statuses; filtering is client-side)                                                       |
| 2.5 | Search → type a query                    | Results filter; type/price/rating filters apply                                                                                                 |
| 2.6 | Search → Map view                        | Pins only for services with a resolvable address; **no 0,0 markers**                                                                            |
| 2.7 | Open a service whose provider is Pending | Should not be reachable from Home/Search at all                                                                                                 |

## 3. Booking (user)

| #    | Step                                       | Expected                                                                                                                                               |
| ---- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3.1  | ServiceDetail → Book Now                   | BookService with the service fixed (no "choose service" step)                                                                                          |
| 3.2  | Pick a date on an unscheduled weekday      | Greyed out / unselectable                                                                                                                              |
| 3.3  | Pick a scheduled weekday                   | Time slots appear, derived from `service.schedules`; already-booked slots disabled                                                                     |
| 3.4  | Select a **Pickup** or **Drop-off** add-on | Forces a map location pick before Continue                                                                                                             |
| 3.5  | Select a flat add-on                       | Total updates immediately                                                                                                                              |
| 3.6  | Continue with no pet                       | Blocked, prompts to add a pet                                                                                                                          |
| 3.7  | Review screen                              | `PriceBreakdown` lists service, discount, each add-on; per-km add-ons show Start fee / Distance / Free-distance credit reconciling to the add-on total |
| 3.8  | Confirm                                    | Booking created; BookingConfirmed screen                                                                                                               |
| 3.9  | MyBookings                                 | New booking under **Upcoming**                                                                                                                         |
| 3.10 | Open it → BookingDetails                   | Service, provider, status, date/time, pet, addresses, price breakdown all match what was booked                                                        |
| 3.11 | Cancel an upcoming booking                 | Moves to cancelled; provider sees it                                                                                                                   |

**Cross-check the money.** Before confirming, compare the FE total against
`POST /api/bookings/quote` in Swagger with the same selections — the quote is the same code path
that charges the booking, so any difference is a front-end pricing bug.

## 4. Partner

Become a partner: BecomePartner → PartnerApplication → submit, then approve it as admin (§5.1).

| #     | Step                                                                    | Expected                                                                                                                               |
| ----- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1   | PartnerHub                                                              | Earnings, clients, upcoming, rating (only when reviews > 0), pending count, activity feed                                              |
| 4.2   | MyServices → Add Service                                                | Saves with pricing, details, photos                                                                                                    |
| 4.3   | Add **Working Hours**, save, reopen                                     | Schedules persist and prefill                                                                                                          |
| 4.4   | Set **Service Location** via map pin, then via "Use my profile address" | Both save; the profile shortcut copies fields, never the address id                                                                    |
| 4.5   | Add pricing options (duration/price tiers)                              | Round-trip; bookings then require choosing one                                                                                         |
| 4.6   | Add a **PerDistance** add-on with no `distanceLeg`                      | Rejected (422) with a message naming the rule                                                                                          |
| 4.7   | NewRequests → Accept                                                    | Booking confirmed; appears in MySchedule                                                                                               |
| 4.8   | NewRequests → Decline with a reason                                     | Declined; reason stored                                                                                                                |
| 4.9   | MySchedule day/week/month                                               | Only real bookings. Kill the backend and reopen it: an **inline error**, never invented appointments                                   |
| 4.10  | Promotions → Create offer (Percent)                                     | Card reads "20% OFF"                                                                                                                   |
| 4.10b | Home → Special Deals for a discounted service                           | Badge shows the real cut ("15% OFF"), never "0 OFF" — legacy rows labelled Fixed but carrying a percent still render as the percentage |
| 4.11  | Promotions → Create offer (Fixed)                                       | Card reads "10 RSD OFF" (or the symbol for your display currency) — never "$"                                                          |
| 4.12  | Pause/resume an offer                                                   | Toggles `isEnabled`; the service's effective price follows                                                                             |

## 4b. Managed provider accounts (ProviderProfile)

**There are two kinds of provider and they are not interchangeable.** §4 covers the first; this
section covers the second, which was untested until 2026-09-16 and is where most provider bugs live.

| Kind | How it exists | Session shape |
| --- | --- | --- |
| **User-partner** | A pet owner who went through BecomePartner and was approved | Has a `Domain.User` *and* a `ServiceProvider`. Groups: `User` + `ServiceProvider`. `isPartner` true, `isProviderProfile` false |
| **Managed ProviderProfile** | Created by an admin via AdminAddPartner / `POST /admin/accounts` with `accountType: "ProviderProfile"` | Has **no** `Domain.User` at all. Group: `ServiceProvider` only. `/auth/me` returns a non-zero `providerProfileId`, so `useAuth().isProviderProfile` is true |

Seed one from the backend repo — it prints the login and is ready immediately, with no
email-confirm round trip:

```powershell
. .\scripts\e2e-bootstrap.ps1
$admin = Connect-Admin
New-ApprovedProviderAccount -AdminToken $admin -Type 4   # 0 Sitter 1 Walker 2 Boarder 3 PetHotel 4 Groomer 5 Transporter
```

| #    | Step                                                                | Expected                                                                                                                              |
| ---- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 4b.1 | First login                                                         | PartnerWelcome tour → Partner Hub. Tour is one-time; a later login must not replay it                                                  |
| 4b.2 | Partner Hub tiles                                                   | Earnings, clients, appointments, rating — these are `ServiceProvider`-gated stats queries and **do** work                              |
| 4b.3 | Open **My Services**                                                | Their own services list. **Currently K9**: 401 "Missing permission for command 'SearchServices'"                                        |
| 4b.4 | Open **Promotions** for a provider with a live discount             | The discount is listed and the counters are non-zero. **Currently K9**: a silent "No promotions yet" with all-zero tiles — worse than the visible error, because the provider believes they have no promotion running |
| 4b.5 | Tap the **Home** and **Search** tabs                                | Either they browse normally, or they are not shown at all. **Currently K9**: both error, and Home is the default landing tab           |
| 4b.6 | Look at the sidebar / tab bar                                       | **No** My Pets, My Bookings or Notification settings — this account has no user row, so all three 401. `NavRoles` has no `isProviderProfile` dimension, so today they are all offered |
| 4b.7 | Open My Pets anyway                                                 | Never the raw command name. Today: "Missing permission for command 'SearchPets'."                                                      |
| 4b.8 | Requests → Accept a booking, then Messages                          | Both work — `SearchBookings` and chat are correctly `ServiceProvider`-gated                                                             |
| 4b.9 | Notifications                                                       | `BookingRequested` and `ServiceProviderApproved` arrive and render                                                                     |

**Per-type matrix.** Live tracking is the only behaviour that varies by provider type — enforced
by `Domain.LocationTracking.EligibleTypes`. Seed one of each and check the Add/Edit Service form:

| Type | `supportsLiveTracking` toggle | LiveSession |
| --- | --- | --- |
| Sitter, Boarder, PetHotel, Groomer | Rejected (422) if set | Never offered |
| Walker, Transporter | Accepted | Offered on a confirmed booking within 30 min of its start |

## 5. Admin

| #   | Step                                   | Expected                                                                                            |
| --- | -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 5.1 | AdminNewRequests → approve a partner   | Moves to Approved; their services become browsable                                                  |
| 5.2 | Reject a partner with a reason         | Moves to Rejected; record kept                                                                      |
| 5.3 | AdminDashboard tiles                   | Revenue all-time / this month, services scheduled, new + active partners; bar chart by service type |
| 5.4 | AdminReviews → approve / decline       | Approved reviews appear on the service; declined do not                                             |
| 5.5 | AdminAddPartner                        | Creates a login-ready account (no email-confirm round trip)                                         |
| 5.6 | Log in as that new account immediately | Works first try                                                                                     |

**Revenue sanity check.** Dashboard figures are RSD converted to your display currency. A figure
~117× larger than expected means the currency conversion regressed — that exact bug shipped once.

## 6. Live location

Needs a service with `supportsLiveTracking` (only **Walker** / **Transporter** types) and a
confirmed booking starting within 30 minutes.

| #   | Step                                                    | Expected                                                                                                                          |
| --- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 6.1 | Partner: LiveSession → Start earlier than 30 min before | Refused: "A service can be started at most 30 minutes before its scheduled start time."                                           |
| 6.2 | Partner: Start inside the window                        | Status → ServiceStarted; "Sharing live location" chip; countdown runs                                                             |
| 6.3 | User (second browser): open LiveSession                 | Provider marker moves; trail draws; ETA card shows minutes + km                                                                   |
| 6.4 | Deny location permission on the partner device          | Map falls back to the service address; on total failure shows "Can't access your location" + Retry — **never an endless spinner** |
| 6.5 | Partner: End                                            | Both sides flip to ended via the `TrackingEnded` hub event                                                                        |
| 6.6 | User: kill and reopen LiveSession mid-run               | Backfills from `GET /api/bookings/{id}/live-location`                                                                             |

## 7. Notifications

| #   | Step                                              | Expected                                                                  |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------- |
| 7.1 | Trigger a booking status change                   | In-app notification arrives live (no refetch); Home bell badge increments |
| 7.2 | Tap a booking notification                        | Marks read, deep-links to BookingDetails                                  |
| 7.3 | Complete a booking as partner                     | User gets a `ServiceCompleted` notification that opens a ReviewModal      |
| 7.4 | Submit the review, reopen the notification        | Modal suppressed (already reviewed) — falls back to BookingDetails        |
| 7.5 | Mark all read                                     | Badge clears                                                              |
| 7.6 | NotificationSettings → toggle each switch, reload | All persist                                                               |

## 8. Cross-cutting

### Currency

Fixed 2026-08-06 (see `HARDCODED_VALUES.md`). Re-test after any pricing change — this is the area
that regresses silently, because a wrong symbol still renders a plausible-looking number.

| #   | Step                                                                                                                                                   | Expected                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 8.1 | Settings → Currency = RSD                                                                                                                              | Prices read **`100 RSD`** — never a `$` anywhere                                               |
| 8.2 | Switch to EUR, revisit Home / Search (list **and** map) / ServiceDetail / BookService / Review / MyBookings / PartnerHub / AdminDashboard / Promotions | Amounts convert **and** the symbol follows on every screen (100 RSD → **€0.85**)               |
| 8.3 | Compare a converted figure against the raw API                                                                                                         | Matches the DTO's `currency` + amount                                                          |
| 8.4 | Switch language to Srpski / Русский with a Fixed discount active                                                                                       | The offer title shows the amount with its real currency — no `$` leaks in from the translation |
| 8.4b | Open Settings → Currency and read the three preview amounts                                                                                           | Each shows the *same money* in its own currency (1200 RSD ≈ €10.22 ≈ $11.40). Today (K14) all three read "1200" |

Only money converts — ratings, counts, distances and durations must not. The search **map pin** is a
deliberate exception: it shows the bare number (no room in a 40px circle); the card carries the currency.

### Pagination

Lists page 25 rows at a time. Phone-first: the next page loads as you near the bottom, with a
**Load more** button as the manual fallback, and a "Showing X of Y" line so a truncated list is
never silent.

| #    | Step                                               | Expected                                                   |
| ---- | -------------------------------------------------- | ---------------------------------------------------------- |
| 8.P1 | Notifications with >25 rows — scroll to the bottom | Next page appends automatically; "Showing 50 of 60"        |
| 8.P2 | Keep scrolling to the end                          | All rows load, footer disappears, **no duplicate rows**    |
| 8.P3 | Tap **Load more** instead of scrolling             | Same result                                                |
| 8.P4 | Leave and re-enter the screen                      | Resets to page 1                                           |
| 8.P5 | Search → scroll the results list                   | "N services found" and "Showing N of TOTAL" both climb     |
| 8.P6 | Pull-to-refresh mid-way through paging             | Returns to page 1; no rows from the abandoned pages linger |

### Localisation

| #   | Step                                        | Expected                                                                          |
| --- | ------------------------------------------- | --------------------------------------------------------------------------------- |
| 8.4 | Settings → language en / sr / ru            | UI strings switch                                                                 |
| 8.5 | Trigger a validation error in each language | Error text localises (backend maps 422 `ErrorMessage` through its resource table) |
| 8.6 | Register in `sr`                            | Confirmation email arrives in Serbian                                             |
| 8.6b | Pick a language in Settings, then immediately pick a different one without closing the sheet | Both apply. Today (K13) the sheet stays open after the first pick and the second is ignored |
| 8.6c | Do the same on the **first-run** chooser over the login screen | Same — today it also stays up after the first choice |

### Error handling

Per `CLAUDE.md`, **every** API call must surface its failure.

| #   | Step                                         | Expected                                                                                       |
| --- | -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 8.7 | Stop the backend, then open each main screen | Inline error view in the body (icon + message), not a blank screen or a silent console warning |
| 8.8 | Stop the backend, then submit a form         | Toast via `showError` — not `Alert.alert`                                                      |
| 8.9 | Restart the backend and retry                | Recovers without a reload                                                                      |

### Theming & responsive

| #    | Step                             | Expected                                                |
| ---- | -------------------------------- | ------------------------------------------------------- |
| 8.10 | Toggle dark mode on every screen | No unreadable text; no hardcoded light-only backgrounds |
| 8.11 | Resize to mobile width           | No horizontal scroll; no clipped CTAs                   |

---

## 9. Layout pass — the two designs

Run this after any change to a shared component, `ScreenLayout`, the shell, or a screen's body.
The whole risk of two designs from one tree is a change that is right in the one you were looking
at, so **every check here is done at more than one width.**

Resize with Chrome's device toolbar (Ctrl+Shift+M), or just drag the window.

| Width | What it is | Expected design |
| --- | --- | --- |
| 390 × 844 | Phone browser (iPhone 14) | **Mobile** — bottom tab bar, one column, full-screen sheets |
| 820 × 1180 | Tablet portrait | **Tablet** — collapsed icon rail, two columns |
| 1280 × 800 | Laptop | **Desktop** — full sidebar + top bar |
| 1920 × 1080 | Monitor | **Desktop**, content capped and centred, not stretched |

### 9a. The shell

| # | Step | Expected |
| --- | --- | --- |
| 9.1 | Sign in at 1280px | Sidebar left, top bar above the content. **No bottom tab bar anywhere** |
| 9.2 | Narrow the window past 768px without reloading | Switches to the mobile design live — bottom bar appears, sidebar goes. No crash, no blank frame |
| 9.3 | Widen it back past 1024px | Switches back. Scroll position and any open modal survive |
| 9.4 | Click every sidebar link | Each navigates; the active item is highlighted; **none is a dead link** (a tab route addressed wrongly no-ops silently — see B1) |
| 9.5 | As a plain user | No Partner and no Admin group, and no empty group headings left behind |
| 9.6 | As a partner, then as an admin | The matching group appears, and only that one |
| 9.7 | Top bar: bell, messages, account menu | Badges match the counts; the menu opens, closes on outside click, and Account/Settings/Logout all work |
| 9.8 | Any screen at 1280px | Exactly **one** notification bell on the page (the top bar's) — see B3 |
| 9.9 | Sign out | Auth screens render full-page with **no** sidebar or top bar at any width |

### 9b. Per screen

For each screen the change touched, at 390 and at 1440:

| # | Check |
| --- | --- |
| 9.10 | Does it **use** the width, or is it a stretched phone screen with 1000px of empty space? |
| 9.10b | **Form screens have a max-width container.** At 1440 no single-line input should span the whole content area — check Settings (the Dark Mode switch ends up ~1380px from its label) and the partner application (a ZIP field over 1000px wide) |
| 9.11 | Card lists are a grid on the web design, not a single column of full-width rows |
| 9.12 | No horizontal scrollbar on the page body — the reliable sign of an unconstrained width |
| 9.13 | Text lines stay under ~90 characters — the `width` prop caps the column |
| 9.14 | Modals are centred dialogs on the web design, full-screen sheets on the phone one |
| 9.14b | **A modal's primary action is inside the viewport at 1440x900.** Open the address picker (Partner application → Street Address, AdminAddPartner, BookService pickup/drop-off) and confirm "Confirm location" is reachable without scrolling the page behind it. **Measure this in a VISIBLE tab**: react-native-web animates the sheet in with a 250ms CSS slide, and a browser pauses animations in a hidden or backgrounded tab — the sheet then sits frozen at its start frame, `translateY(viewportHeight)`, and every automated measurement reads the footer as ~1750px down a 900px window. That is the harness, not the app. Confirm with `document.hidden` and `el.getAnimations()[0].currentTime` before filing anything |
| 9.14c | **Kill the Maps key** (blank `EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY`) and reopen the picker. Every field the map fills must still be typeable by hand — the map is a convenience, never the only way in. Today Street Address has no text input when a map handler is wired, and the sheet's "Search address or place" needs the same dead SDK |
| 9.15 | The primary CTA is reachable without hunting: pinned on mobile, in the flow or in a sticky aside on web |
| 9.16 | Hover states on everything clickable, and a visible focus ring when tabbing |
| 9.16b | **Type into a form and press Enter**: focus moves to the next field, and from the last field the form submits (running the same validation the button does). In a description/notes box Enter starts a new line instead |
| 9.17 | Both themes — switch to dark at 1920px, where a missed background shows most |

### 9c. Navigation and URLs

| # | Step | Expected |
| --- | --- | --- |
| 9.18 | Navigate 3 screens deep, press **browser Back** | Goes back one screen, not out of the app (B2) |
| 9.19 | Reload on `/services/12` and `/bookings/7` | The page rebuilds from the id, signed-in state intact (B15) |
| 9.20 | Deep-link to a screen `linking.ts` does **not** map, then reload | Lands on Home rather than crashing — by design |
| 9.21 | Read the **browser tab title** on a few screens | A human title. Today it is the raw route name — `MyPets`, `BookService`, `AdminNewRequests`, `MainTabs` — which is what lands in tabs, bookmarks and history |
| 9.22 | Fill half a form, then drag the window across the 768px breakpoint | Entered values survive. Today the design switch remounts the screen and clears them |

### 9d. Native must be unchanged

**The most important check here.** The mobile design is the shipped product and this work touches
its root layout component. Run §§1–8 on a real Android device and confirm nothing moved: header
spacing, safe areas, the keyboard shrinking the body, tab switches still instant.

---

## Reporting

- **A backend fault** (wrong data, 4xx/5xx, an authorization hole) → add it to `BACKEND_GAPS.md`
  and, if it is API-assertable, add a `Check`/`Gap` to the backend suite so it is caught next time.
- **Fake or placeholder data on screen** → `HARDCODED_VALUES.md`.
- **A front-end defect** → fix it, or add a row to _Known-broken_ above with the cause, so the next
  tester does not re-file it.
