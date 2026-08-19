# Staging test plan

What gets tested on the deployed app, in the order it has to happen. Protocol, accounts and the
confirmation-code window are in [`STAGING_TESTING.md`](STAGING_TESTING.md) — read that first.

**This file does not restate what each screen should do.** `E2E_MANUAL_TESTING.md` already holds
the step-by-step expectations by role, and two copies of that would drift within a month. What is
here instead is the part that document cannot cover: the order, the data dependencies, and the
things that are only wrong on a real deployment.

## Why the order is fixed

Staging has no seed script and no reset, so the passes form a dependency chain. Running them out
of order does not fail loudly — it silently tests nothing, because the data is not there yet.

```
Pass 0  environment          (no accounts)
Pass 1  data foundation      → everything below depends on this
Pass 2  auth & session       (Owner A, Unconfirmed)
Pass 3  owner surfaces       (Owner A, Owner C)
Pass 4  partner surfaces     (Partner A, B, C)
Pass 5  discovery            needs Pass 1 services
Pass 6  booking + payments   needs Pass 5
Pass 7  chat                 needs a booking, and deliberately one pair without
Pass 8  reviews + moderation needs a completed booking
Pass 9  notifications        observed throughout, verified here
Pass 10 authorization/IDOR   needs two owners with real data
Pass 11 cross-cutting        currency, paging, i18n, errors, theming
Pass 12 maps                 BLOCKED — key restricted to localhost:8081
```

---

## Pass 0 — Environment

No login. Confirms the deployment itself before any failure can be blamed on the app.

| Check | Expected |
|---|---|
| Load the app | Login screen, no console errors |
| Refresh on a deep link (`/services/1`) | Same page, not a 404 — the SPA fallback |
| Browser Back after navigating | Goes back a screen, not out of the app |
| `http://` → | 308 to `https://` |
| Certificate | Valid, no warning |
| API from the app's origin | Reachable (cross-origin CORS is configured) |
| DevTools → Network | No mixed content, no blocked requests |

A failure here is a deployment fault, not an app fault — see `WEB_DEPLOYMENT.md`.

## Pass 1 — Data foundation

**No user involvement. Claude does this alone after the Phase 0 code relay.** This is not a test
pass; it builds the world every later pass reads. Doing it deliberately, rather than accumulating
data as a side effect, is what stops Pass 6 discovering that no bookable service exists.

Provision, in this order:

1. **Owner C** and **Managed partner** — via admin (`POST /admin/accounts` and the Add Partner
   screen). No codes; both are login-ready immediately.
2. **Partner A and B apply** to become partners, with photos, certificates and government-ID
   uploads. **Admin approves both.**
3. **Partner C applies. Admin declines**, with a reason. Leave it declined — that state is the
   test in Pass 4.
4. **Partner A creates two services**, deliberately different so later passes have contrast:
   - **Walker**, `supportsLiveTracking` on, free-range booking (no pricing options), one flat
     add-on and one **per-distance** add-on with a distance leg. Live tracking is only legal on
     Walker/Transporter, so this is the service Pass 9 needs.
   - **Groomer**, **with pricing options** (2–3 duration/price tiers), an active discount, weekly
     schedules, photos and a service address. The coexist rule means bookings against it *must*
     pick an option — that difference is the point.
5. **Partner B creates one service** — enough to prove search returns more than one provider and
   to give Pass 10 a foreign resource to attempt.
6. **Owner A adds two pets** with photos, one marked as the profile picture.
7. **Owner C: create nothing.** Its value is being empty.

Record every created id in `STAGING_FINDINGS.md` under a *Fixtures* heading. Without that, a later
session cannot tell Partner A's service from Partner B's, and IDOR tests in Pass 10 become
guesswork.

## Pass 2 — Auth & session

Accounts: Owner A, Unconfirmed. Covers `E2E_MANUAL_TESTING.md` §1, plus staging-only rows:

| Check | Expected |
|---|---|
| Log in as **Unconfirmed** | Refused, with a message naming email confirmation |
| Wrong password ×5 | Lockout naming a retry time — do this on Unconfirmed, never on an account a later pass needs |
| Log in by username, then by email | Both work |
| Reload mid-session | Still signed in; the token survives in `localStorage` |
| Log out | Returns to Login; Back does not re-enter the app |
| **Password reset** | Emails a code — see the note about batching this into the Phase 0 window |
| Idle ~30 min | Session-expiry message (known: K7) |

## Pass 3 — Owner surfaces

Accounts: Owner A (populated), Owner C (empty).

Profile edit, email read-only, change password, pets CRUD with photo upload, notification
settings, language and currency preferences. Then **the same screens as Owner C** — Home, My Pets,
My Bookings, Notifications — checking every empty state renders something deliberate rather than a
spinner, a blank panel, or a crash. Empty states are the most commonly missed UI work and Owner C
is the only account that can prove them.

## Pass 4 — Partner surfaces

Accounts: Partner A (approved), Partner C (declined), Managed partner.

Partner hub, my services, add/edit service, schedule, promotions, incoming requests. Specifically:

- **Partner C** sees its declined state and the reason — not a dead end or a blank hub.
- **Managed partner** signs in and reaches its provider screens. It has no `Domain.User`, so
  confirm the owner-only surfaces (pets) are absent rather than broken.
- Editing a service **preserves** what the form does not show — `acceptedSpecies` and
  `maxConcurrentBookings` reset to 0/None if a PUT omits them, so a round-trip through the editor
  must not quietly wipe them.

## Pass 5 — Discovery

Account: Owner A. Home rails (most popular, on sale, recently booked, near me), search with
filters, service detail, the availability calendar.

Watch for: the price shown on a card matching the detail page; the discount badge matching the
actual discounted price; availability reflecting real bookings once Pass 6 has made some. Filter
behaviour has a known client-side limitation (K8) — do not re-report it.

## Pass 6 — Booking and payments

Accounts: Owner A ↔ Partner A. The longest pass and where money is involved.

1. **Quote before booking** — the preview must equal what the booking is then charged. A mismatch
   here is the highest-value bug in the app.
2. Book the **Groomer** (must pick a pricing option; `BookingTo` is derived server-side).
3. Book the **Walker** (free-range, add-ons selected — including the per-distance one, whose
   price depends on measured trip distance).
4. Partner A: **confirm**, **adjust price**, **start service**, **complete service**.
5. Owner A: **pay deposit**, then **balance**. Amounts are computed server-side; a client cannot
   price its own booking, so try editing the total and confirm it is ignored.
6. **Cancel** a separate booking before start.
7. Edit a booking's schedule/pet/extras while still editable.

Every transition should produce a notification for the *other* party (Pass 9).

## Pass 7 — Chat

Accounts: Owner A ↔ Partner A (has a booking), Owner B ↔ Partner B (no booking).

The interesting half is Owner B, who has **never booked**: the channel falls back to a bounded
enquiry capped at 3 unanswered messages, counting down in the composer. The cap is one-sided — the
provider's reply lifts it. Owner A, with a live booking, has an uncapped channel. Also confirm a
closed window is **read-only, not deleted** — history stays visible.

## Pass 8 — Reviews and moderation

Owner A reviews the completed booking → admin approves → it appears on the service and in the
provider's rating. Then a second review → admin **declines** → author is notified and it does not
appear publicly.

## Pass 9 — Notifications

Verified here, but watched throughout. In-app feed plus live SignalR delivery (two browser
sessions side by side: act as Partner A in one, watch Owner A's badge move in the other, no
refresh). Email lands in the shared inbox — worth one look to confirm formatting and language.

Chat notifications are deliberately **excluded from the feed list** while still being delivered —
that is intended, not a bug.

## Pass 10 — Authorization and IDOR

Accounts: Owner B against Owner A's data. The security pass, and the one most worth doing on a
real deployment because it is the one a real user could attempt.

| Attempt | Expected |
|---|---|
| Open Owner A's booking by id as Owner B | Denied |
| Open Owner A's pet by id | 404 (ids stay non-enumerable) |
| List pets — check the response | Only Owner B's own, even if a filter says otherwise |
| Partner B acts on Partner A's booking | Denied |
| Partner B edits Partner A's service | Denied |
| Owner A reaches any `/admin` screen | Denied |
| Provider contact email in a browse response | Absent for non-owners |
| Government-ID photos in search results | Never present |

Check the **network response**, not just the UI. A screen that hides a button while the API still
returns the data is the bug this pass exists to find.

## Pass 11 — Cross-cutting

Currency (display currency switches; amounts convert; no hardcoded `$`), pagination, localisation
across **en / sr / ru** (including server-generated validation messages and notification text —
`Accept-Language` is forwarded), error handling (a 422 renders one rule per line, never a raw JSON
blob), theming and responsive layout at 375 / 768 / 1280.

Localisation is worth real attention here: staging is the first environment where emails and
notifications are generated by a server configured like production.

## Pass 12 — Maps · BLOCKED

Search map, address picker, directions modal, live-session map. **Do not run until** the Maps web
key allows `https://app.169.58.199.63.sslip.io/*` and the web image is rebuilt
(`WEB_DEPLOYMENT.md`). Until then every map is blank and every finding is the same finding.

Once unblocked this also completes **live location tracking**: Partner A starts the Walker service
and Owner A watches the position move in a second session.

---

## Picking this up cold

1. Read `STAGING_TESTING.md`, then `staging-accounts.local.md` for the real credentials.
2. Check `STAGING_FINDINGS.md` — the *Fixtures* section says what already exists, so nothing is
   created twice and no pass is run against data that was never built.
3. Confirm the deployment is up (Pass 0) before concluding anything is broken.
