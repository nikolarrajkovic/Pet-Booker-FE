# Testing the two layouts

The app renders two designs from one set of components (see [`WEB_LAYOUT.md`](WEB_LAYOUT.md)). The
risk that creates is specific: **a change that is correct in one design silently breaks the
other**, and nobody notices because the person who made it only looked at one window width.

This document is the plan for catching that. Three layers, cheapest first.

| Layer | Catches | Cost | When |
|---|---|---|---|
| 1. Type + lint | Prop misuse, dead branches | seconds | Every change |
| 2. Jest at two widths | Behaviour differences (B1–B15) | seconds | Every change to a shared component or a screen |
| 3. Manual dual-width walkthrough | Visual regressions, real maps/pickers/keyboards | ~40 min | Before merging a stage |

---

## Layer 1 — the gates that already exist

```bash
npx tsc --noEmit
npm run lint
```

`ScreenLayout`'s new props are typed as a union (`width: 'narrow' | 'default' | 'wide' | 'full'`),
so a typo is a compile error rather than a screen that silently renders full-bleed.

---

## Layer 2 — Jest, rendered at both widths

There is a real suite (`__tests__/`, `jest-expo` + React Native Testing Library, run with
`npm test`). It is the right level for the behaviour differences, because those are assertions
about *what renders and what happens on press* — not about pixels.

### The mechanism

`useResponsive()` reads `useWindowDimensions()`, so a test picks its layout by controlling that
one value. `__tests__/test-utils.tsx` gains two helpers:

```tsx
renderMobile(<HomeScreen />);   // 390 × 844  → mobile design
renderDesktop(<HomeScreen />);  // 1440 × 900 → web design

// and, for the tests that are about the difference itself:
describeBothLayouts('MyBookings', ({ renderScreen, isWeb }) => { ... });
```

`describeBothLayouts` runs the same body twice, once per design, which is what makes "this
assertion should hold in both" cheap enough to actually write. Assertions that hold in only one
design branch on `isWeb` inside the body, so the *difference* is written down in the test rather
than being an untested assumption.

### What gets a test

Not every screen — that would be 45 tests asserting the same three things. The suite covers the
**shared layout machinery** (once, thoroughly) and the **behaviour differences** (one test each),
plus the handful of screens whose two designs differ structurally.

**The machinery** — `__tests__/responsive/`:

| Test | Asserts |
|---|---|
| `useResponsive.test.ts` | Breakpoint boundaries exactly: 767→mobile, 768→tablet, 1023→tablet, 1024→desktop. Native stays mobile at 1440 while `RESPONSIVE_ON_NATIVE` is false. |
| `AppShell.test.tsx` | Sidebar + top bar render on desktop and not on mobile; children render in both; nothing renders for a signed-out user. |
| `SideNav.test.tsx` | Role gating matches `TabBar` — `PartnerHub` only for `isPartner`, `AdminDashboard` only for `isAdmin` — driven from the same `navItems` fixture, so the two bars cannot drift. |
| `TabBar.test.tsx` | Renders on mobile, renders **nothing** on desktop (the regression that would put two navigations on screen at once). |
| `ScreenLayout.test.tsx` | Mobile renders `AppHeader`; web renders `PageHeader` and no green header; `width` caps; `aside` renders after main content on mobile and beside it on web. |
| `ResponsiveGrid.test.tsx` | Column counts per breakpoint; every child renders at every width (a grid that drops the last item is the classic bug). |
| `ResponsiveModal.test.tsx` | Full-screen on mobile; dialog + scrim on web; Esc closes on web only; `onClose` fires exactly once per dismissal route. |
| `useFormChain.test.tsx` | The keyboard chain: advance vs. submit, `returnKeyType`/`blurOnSubmit`, the multiline opt-out, a re-ordered field list (multi-step forms), no stale submit handler, and that an unknown field name does **not** submit. |
| `auth.test.tsx` | `AuthLayout` renders the brand band and form in both designs, caps the card at 440px on web and not at all on mobile; `useEscapeToClose` fires on Esc only, respects its `enabled` gate, attaches nothing on native, and detaches on unmount. |
| `conventions.test.ts` | **Conformance, not behaviour**: scans the source and fails when a screen renders its own root without `useResponsive`, when `Platform.OS` is used outside the allowlisted capability cases, when a raw `<Modal>` has no Esc handling, when `TabBar`/`SideNav` stop sharing `navItems`, or when `RESPONSIVE_ON_NATIVE` moves or flips. Every allowlist entry carries its reason. |

**The behaviour differences** — one test per row of the B-table in `WEB_LAYOUT.md`, in
`__tests__/responsive/behaviour.test.tsx`, named for its id so a failure points straight at the
documented rule:

| Id | Test |
|---|---|
| B1 | Sidebar item navigates to the root-stack route; tab item navigates within `MainTabs` |
| B3 | `showNotificationButton` renders a bell on mobile and **not** on web (the `TopBar` owns it) — otherwise two bells |
| B4 | Esc closes a `ResponsiveModal` on web, does nothing on mobile |
| B6 | `StickyFooter` is absolutely positioned on mobile, in-flow on web; unmounts on keyboard only on mobile |
| B9 | A list screen exposes a refresh affordance on web (no pull-to-refresh there) |
| B12 | "Load more" fetches a page that fills whole grid rows on web |
| B16 | Enter advances to the next field and submits from the last; a multiline field gets no submit handler, so Enter inserts a newline; an unknown field name submits **nothing** |

**Screens whose designs differ structurally** get their own test — Home (rails → grid sections),
Search (list/map toggle vs. side-by-side), BookService (stepper vs. two-column), and the
dashboards. The other ~35 screens are covered by the machinery tests plus Layer 3.

### Rules for writing them

- **Mock `useWindowDimensions`, never `useResponsive`.** Mocking the hook under test asserts
  nothing about the breakpoints.
- **Keep the locale/auth context values stable across renders** — the existing suite already hit
  the loop this causes (see the note in `NewRequestsScreen.test.tsx`).
- **Assert on behaviour, not class names.** `className` strings are NativeWind implementation
  detail; assert that the bell is absent, not that a `div` lost a padding class.

---

## Layer 3 — the manual dual-width walkthrough

Jest renders to a tree, not a browser: it cannot tell you that the sidebar overlaps the content at
1100px, that a hover state is missing, or that the Google map is 20px tall. That needs eyes.

[`E2E_MANUAL_TESTING.md`](E2E_MANUAL_TESTING.md) gains a **Layout pass** run at four widths:

| Width | What it is | Expected design |
|---|---|---|
| 390 × 844 | Phone browser (Chrome device toolbar, iPhone 14) | Mobile |
| 820 × 1180 | Tablet portrait | Tablet — icon rail |
| 1280 × 800 | Laptop | Desktop |
| 1920 × 1080 | Monitor | Desktop, content capped and centred |

> **Trap — a scripted viewport change does not re-lay-out.** `useWindowDimensions` is backed by
> react-native-web's `Dimensions`, which listens on **`window.visualViewport`'s** resize event, not
> `window`'s. Dragging a real window fires both, so live resizing works for a user. But a CDP
> viewport override — Playwright's `setViewportSize`, Puppeteer, a programmatically driven device
> toolbar — changes `window.innerWidth` **without** firing it, so the page keeps whatever layout it
> had and the responsive design looks broken when it is not. Verified here: at 900px the page still
> showed the mobile design until the event was dispatched by hand.
>
> After resizing in a script, do one of:
> ```js
> await page.reload();                                              // simplest
> await page.evaluate(() => window.visualViewport.dispatchEvent(new Event('resize')));
> ```
> Resizing by hand needs neither.

Plus **native unchanged**: the same walkthrough on an Android device must look exactly as it did
before this work. That is the single most important check in the whole plan — the mobile design is
the shipped product, and this change touches its root layout component.

For each width, per stage:

1. Every screen the stage touched — does it use the width, or is it a stretched phone?
2. Resize the window live across 768 and 1024 — does it switch designs without a crash, without
   losing scroll position, without a stuck modal?
3. Sidebar: every link goes somewhere, the active item is marked, role-gated items appear only for
   the right role.
4. Browser Back after 3 navigations lands where it should (`linking.ts`).
5. Reload on a deep-linked URL (`/services/12`, `/bookings/7`) rebuilds the page.
6. Both themes — dark and light — at the widest width, where a missed background shows most.
7. Keyboard only: Tab through the screen, confirm focus is visible and ordered.

### The scripted part

`npm run web` serves the app; the layout pass is driven in the browser.

Some of what was proposed for a browser script turned out to be cheaper as **source conformance**
(`conventions.test.ts`, above): "did someone build a phone-only screen?" and "does this dialog
handle Esc?" are answerable by reading the code, run in milliseconds, and fail with the file name.
That covers the drift that would otherwise accumulate silently.

What still genuinely needs a browser is what a tree cannot show: overlap, contrast, hover, a map
that renders 20px tall. A Playwright script walking `linking.ts`'s route table and failing on any
console error or on a horizontal scrollbar (the reliable signal of an unconstrained width) would
automate the shallowest layer of that. It is **not written** — it needs a signed-in session, which
is the same thing blocking the manual pass below.

---

### Known gap: none of this has been seen signed in

The suite renders to a tree, and the browser checks so far cover only the signed-out screens (the
auth card was verified at 390px and 1280px, and a layout bug in it was found and fixed that way —
which is the argument for doing the rest).

**~24 signed-in screens have been tested but not looked at.** The five that hand-roll their own
root rather than going through `ScreenLayout` are the ones to open first, because their header and
background logic was rewritten by hand:

- `PartnerHubScreen`, `AdminDashboardScreen`, `AdminPartnersScreen`,
  `ApplicationReviewScreen`, `PartnerDetailsScreen`

## What "done" means for a stage

- `npx tsc --noEmit` and `npm run lint` clean
- `npm test` green, including the new responsive tests for anything the stage touched
- Manual pass at all four widths for the stage's screens, both themes
- Native Android build spot-checked on the same screens — unchanged
- The behaviour-difference table in `WEB_LAYOUT.md` updated if the stage introduced a new one
