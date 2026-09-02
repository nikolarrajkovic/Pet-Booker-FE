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

Verified live on 2026-08-06. Fixing any of these should also delete its row here.

| #   | What you will see                                                                                                     | Cause                                                                                                                                                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K3  | Login screen says **"Pet Booker"**, Home header says **"PawCare"**.                                                   | Brand strings never unified — see `HARDCODED_VALUES.md`.                                                                                                                                                                                        |
| K6  | BookService section numbers start at **2**.                                                                           | No step 1 rendered.                                                                                                                                                                                                                             |
| K7  | Idling ~30 min logs you out with "Session expired. Please log in again."                                              | Access-token TTL is a hardcoded 30-minute guess rather than the JWT's `exp`.                                                                                                                                                                    |
| K8  | Search's price / rating / add-on filters only match services already loaded — scroll further and more matches appear. | Those filters run client-side while the list pages server-side. The API filters `Name` and `Type` but not price/rating/add-ons, so a full fix needs server-side support for them. Notifications (single list, no client filters) is unaffected. |

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

## 2. Discovery (user)

| #   | Step                                     | Expected                                                                                                                                        |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | Home loads                               | Four rails render — Near You, Most Popular, Special Deals, Recently Booked. One failing rail must not blank the page                            |
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
| 9.11 | Card lists are a grid on the web design, not a single column of full-width rows |
| 9.12 | No horizontal scrollbar on the page body — the reliable sign of an unconstrained width |
| 9.13 | Text lines stay under ~90 characters — the `width` prop caps the column |
| 9.14 | Modals are centred dialogs on the web design, full-screen sheets on the phone one |
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
