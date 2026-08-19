# Staging testing — working agreement

How Claude tests the **deployed** app with you. The companion to
[`E2E_MANUAL_TESTING.md`](E2E_MANUAL_TESTING.md), which stays the source of truth for *what each
screen should do*; this file covers what is different when the target is a real server with real
email instead of localhost with MailHog, and how we split the work so you are interrupted once
rather than continuously.

Scenario order and coverage live in [`STAGING_TEST_PLAN.md`](STAGING_TEST_PLAN.md).

---

## Environment

| | |
|---|---|
| Web app | https://app.169.58.199.63.sslip.io |
| API + Swagger | https://169.58.199.63.sslip.io/swagger |
| Backend logs (Seq) | `ssh -L 5341:localhost:5341 root@169.58.199.63` → http://localhost:5341 |
| Database | `ssh -L 1433:localhost:1433 root@169.58.199.63` |
| Deployment runbook | [`WEB_DEPLOYMENT.md`](WEB_DEPLOYMENT.md) |

**Moving to a real domain later** changes only the two hostnames above. The full list of places a
hostname appears is the table at the end of `WEB_DEPLOYMENT.md` — update it there, then replace
both URLs here. Nothing else in this document depends on the address.

## How staging differs from local testing

`E2E_MANUAL_TESTING.md` assumes localhost, MailHog, and a disposable database. None of that holds
here, and three of the differences change how testing has to be sequenced:

| | Local | Staging |
|---|---|---|
| Confirmation codes | MailHog, self-serve | **Real inbox — only you can read them** |
| Demo data | `seed-fe-demo.ps1` | **None.** Everything is created by hand, in order |
| Resetting | `docker compose down -v` | **No reset.** Data is cumulative and permanent |
| Admin login | `admin` / `Admin123` | Seeded from the server's `.env` |
| Email | Captured, never sent | **Really sent** — bad addresses bounce for real |
| Maps | Key allows `localhost:8081` | Needs the deployed origin allowed (see below) |

The two that bite hardest:

**No reset means every run is additive.** A username or email can only be registered once, ever.
If we ever need a second round of accounts they get a new suffix (`owner1b`, not `owner1`) — do
not try to reuse a burnt alias, and do not assume a test can be re-run from a clean slate.

**Only you can read the inbox**, which is what the whole protocol below exists to work around.

## Known blockers

| | Status |
|---|---|
| **Google Maps** | Key is referrer-restricted to `localhost:8081`. Every map surface renders blank until the deployed origin is allowed and the web image is rebuilt. **Pass 12 is blocked; skip map steps everywhere else.** |
| Device push | Not available on web at all, by design. Notification testing is in-app + email only. |

---

## The 15-minute rule

**A confirmation code expires 15 minutes after it is issued** (`AuthApi/Services/AuthAppService.cs`
— hardcoded, not configurable). That window has to contain *all* of: my registration burst, your
inbox check, your message back, and my confirmation burst.

Comfortably achievable, but only if we do it **synchronously, once**. This is why the plan is not
"Claude registers accounts whenever, you send codes when convenient" — codes relayed an hour later
are all dead.

**A lapsed code is recoverable, not fatal.** `POST /auth/resend-confirmation` issues a fresh one,
so the cost is one more relay for that account, not a burnt alias.

### Phase 0 — the one interruption (~5 minutes of your time)

Everything in the entire test programme that needs you happens here.

1. **You:** open the mailbox and say you are ready. Do not start before this — the clock begins at
   step 2.
2. **Claude:** registers the five accounts marked *code* below, back to back (~60 seconds).
3. **You:** paste all five codes in one message. Gmail shows the alias in the `To:` header, so
   label them — the codes look interchangeable, and confirming the wrong account against the wrong
   alias wastes the window:

   ```
   owner1: 123456
   owner2: 654321
   partner1: 111111
   partner2: 222222
   partner3: 333333
   ```

4. **Claude:** confirms all five (~30 seconds), then verifies each can log in.

After this, **no further codes are needed for the rest of the programme.** Email confirmation
happens once per account at registration; every other account is admin-provisioned and login-ready
with no email round trip.

The one exception is the password-reset flow (Pass 2), which emails its own code. Cheapest is to
run it at the *end* of the same window while you are still at the inbox — otherwise it costs one
extra relay whenever we reach it.

### Phase 0b — no interruption

Claude does all of this alone, immediately afterwards: admin-provisioned accounts, the
become-partner applications, the approve/decline decisions, and the services, pets and bookings
that later passes depend on. See Pass 1 of the test plan.

---

## Accounts

One mailbox, one alias per persona. Gmail delivers `you+anything@gmail.com` to `you@gmail.com`, so
every account below is real and distinct to the backend while landing in a single inbox.

**Real values are not in this repo — it is public.** The mailbox, the shared password and the
admin credentials live in `staging-accounts.local.md` (gitignored). This table is the shape.

| Alias | Persona | Purpose | Provisioned by | Code? |
|---|---|---|---|---|
| *(seeded)* | **Admin** | Approvals, moderation, admin dashboards | Already on the server | — |
| `+owner1` | **Owner A** | The main journey: pets, search, booking, payment, chat, review | UI registration | **code** |
| `+owner2` | **Owner B** | The other party: authorization/IDOR checks, chat counterpart, enquiry cap | UI registration | **code** |
| `+owner3` | **Owner C** | Untouched account — first-run and empty states, which exist only once | `POST /admin/accounts` | — |
| `+partner1` | **Partner A** | Approved provider: services, incoming bookings, live tracking | UI registration → applies → admin approves | **code** |
| `+partner2` | **Partner B** | Second provider: search variety, cross-provider authorization | UI registration → applies → admin approves | **code** |
| `+partner3` | **Partner C** | Application **declined** — the decline path and its notification | UI registration → applies → admin declines | **code** |
| `+profile1` | **Managed partner** | `ProviderProfile` account — no `Domain.User`, so no pets and no push | Admin → Add Partner screen | — |
| `+unconfirmed` | **Unconfirmed** | Proves an unconfirmed account cannot log in | UI registration, code **discarded** | — |

Notes that matter when using them:

- **Owner C must stay untouched.** Empty states (no pets, no bookings, no notifications) are
  testable exactly once per account. Spending them early is the most common way a plan like this
  quietly loses coverage.
- **Partner accounts are Users first.** A provider is a `User` who applies and is approved, so
  `+partner1` needs a code like any owner. Only `+profile1` is a managed account.
- **One shared password** across all test accounts, recorded in the local file. Fine for throwaway
  staging data; never reuse it anywhere real.
- **Phone must match `^\+381[0-9]{8,9}$`** — e.g. `+38160123456`. No spaces or dashes; the backend
  rejects them.
- Registration also asks for first name, last name and date of birth. Any plausible values.

## Rate limits to respect during the burst

`/auth/*` allows **20 requests per 60 seconds per client IP** (`RateLimiting:Auth`). Five
registrations plus five confirmations is ten — comfortably inside it, but only if nothing retries
in a loop. On a `429`, wait a full minute rather than retrying immediately.

Separately, **five wrong passwords locks an account out** with a timed message. That is a step in
Pass 2; just do not trip it accidentally on an account a later pass needs.

---

## Reporting

Findings go in `STAGING_FINDINGS.md` (created on the first run), newest first:

```
### S1 — Booking confirm silently no-ops on the second attempt
Pass 6 · Owner A + Partner A · 2026-08-20 · Chrome 1280x720
Steps:    1. ...  2. ...  3. ...
Expected: ...
Actual:   ...
Evidence: console error / network 500 / screenshot
Verdict:  FE bug | BE bug | already known (K7) | works as intended
```

Before filing, check the **Known-broken** table in `E2E_MANUAL_TESTING.md` and the gap register in
`PetBookerBackend/docs/e2e-testing-overview.md`. Re-reporting a known gap costs more than it looks:
it makes the list untrustworthy, and an untrusted list stops being read. A confirmed backend fault
belongs in `BACKEND_GAPS.md`.
