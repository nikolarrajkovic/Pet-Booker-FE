# Responsive layout — one codebase, two designs

PetBooker ships from a single React Native + Expo codebase to Android, iOS and the browser. Until
now the browser got the *phone* design stretched across a monitor: a 390px-wide column of cards
centred in 1920px of empty space, a bottom tab bar 900px below where anyone would look for
navigation, and full-screen modals covering a desktop display to ask one question.

This document describes the **two layouts** the app now renders, what decides which one you get,
and the rules for building a screen that works in both. Read it before touching any screen.

- Build/deploy of the web target: [`WEB_DEPLOYMENT.md`](WEB_DEPLOYMENT.md)
- How the two layouts are tested: [`WEB_LAYOUT_TESTING.md`](WEB_LAYOUT_TESTING.md)
- Everything else about the front end: [`CLAUDE.md`](CLAUDE.md)

---

## The two designs

| | **Mobile design** | **Web design** |
|---|---|---|
| Navigation | Bottom `TabBar`, 3–5 icons | Left `SideNav` (primary + secondary links) |
| Chrome | Green `AppHeader` block, rounded content sheet pulled up over it | Slim `TopBar` (search, bell, messages, account) + plain `PageHeader` in the content |
| Content width | Full bleed, one column | Centred, capped (`max-w` per screen shape) |
| Card lists | Vertical stack / horizontal rail | Multi-column grid |
| Detail & form screens | One column, top to bottom | Two columns — main content + sticky aside |
| Modals | Full-screen sheets | Centred dialogs on a scrim |
| Primary CTA | `StickyFooter` pinned over the scroll | In the flow, or in the sticky aside |
| Back | Header back arrow + gesture | Breadcrumb / back link; browser Back also works (`linking.ts`) |

Both are the **same components**. There is no `HomeScreen.web.tsx`. A screen branches on layout
mode at the points where the two designs genuinely differ, and shares everything else — which is
what stops the web version drifting into a stale fork of the mobile one.

---

## What decides which design you get

**Window width, not platform.** `hooks/useResponsive.ts` is the single source of truth.

```
        <768px          768–1023px            >=1024px
        mobile          tablet                desktop
        bottom TabBar   collapsed icon rail   full sidebar + top bar
        1 column        2 columns             3–4 columns
```

- A **phone browser** gets the mobile design. People open shared booking links on phones; a
  sidebar at 390px would be unusable.
- A **desktop browser** gets the web design, and switching to it live as the window is dragged
  narrower is free — the hook is driven by `useWindowDimensions()`. (That reads react-native-web's
  `Dimensions`, which listens on **`window.visualViewport`** — a real drag fires it, but a
  *scripted* viewport change does not. See the trap note in
  [`WEB_LAYOUT_TESTING.md`](WEB_LAYOUT_TESTING.md) before concluding the layout is stuck.)
- **Native is always mobile**, whatever the device width. This is a deliberate one-line gate
  (`RESPONSIVE_ON_NATIVE` in `useResponsive.ts`), not an assumption spread through the code: flip
  it to `true` the day an iPad build wants the two-column design, and every screen follows.

```tsx
const { isMobile, isTablet, isDesktop, isWebLayout, mode, width } = useResponsive();
```

`isWebLayout` (= tablet **or** desktop) is the one to branch on for "is this the web design?".
Reach for `isDesktop` only when tablet genuinely needs the mobile treatment.

**Never branch on `Platform.OS === 'web'` for layout.** That is for *capability* differences —
`SecureStore` vs `localStorage`, `react-native-maps` vs the Maps JS API — and those already live
behind `.web.tsx` files and the service layer. Using it for layout is what produces a sidebar on
a phone browser.

---

## The shell

```
App.tsx
└── NavigationContainer
    └── AppShell                  ← persistent; renders children bare on mobile
        ├── SideNav               ← web only
        ├── TopBar                ← web only
        └── Stack.Navigator       ← the screens
            └── ScreenLayout      ← per screen: page header + content container
```

**`components/layout/AppShell.tsx`** wraps the navigator, so the sidebar and top bar are mounted
once and survive navigation. Rendering them per-screen (the way `TabBar` is rendered today) would
paint a second sidebar over the first during every stack transition.

**`navigation/navItems.ts`** is the single source of truth for destinations. `TabBar` and
`SideNav` both read it, so a new destination is added once and appears in both designs with the
right role gating (`isPartner` / `isAdmin`). The mobile bar takes the `primary` items only; the
sidebar takes primary **plus** the secondary groups that have nowhere to live on a phone but the
Profile menu.

**`TabBar` renders `null` unless the layout is mobile.** Screens keep passing
`footer={<TabBar />}` unchanged — there was no reason to edit five screens to say the same thing.

**`components/layout/AuthLayout.tsx`** is the shell for the signed-out screens (Login, Register,
Verify Email), which are the only ones with no `AppShell` around them — there is no navigation to
offer someone who is not signed in, so a sidebar there would be a column of dead links. It draws
the green brand band itself (its shape differs per design: the rounded bottom edge exists to sit
against the top of a phone screen, and inside a card it reads as a detached panel) and centres the
whole thing in a 440px card on web.

---

## Screen anatomy

`ScreenLayout` stays the root of every screen and dispatches on the layout mode:

```tsx
<ScreenLayout headerTitle="My Bookings" showBackButton width="wide">
  {/* body */}
</ScreenLayout>
```

- **Mobile** → today's markup, unchanged: `SafeAreaView` → `KeyboardAvoidingView` → green
  `AppHeader` → rounded content sheet → footer.
- **Web** → `PageHeader` (title, subtitle, back link, right action) inside a
  `ContentContainer`; no green block, no rounded sheet, no safe-area padding, and
  `showNotificationButton` is ignored because the bell lives in the `TopBar`.

New `ScreenLayout` props, all optional and all mobile-inert:

| Prop | Effect on web |
|---|---|
| `width` | `'narrow'` (720px — forms, auth), `'default'` (1120px), `'wide'` (1400px — dashboards, maps), `'full'` (no cap) |
| `aside` | Right-hand column, sticky, collapses **below** the main content on mobile |
| `webHeaderRight` | Actions rendered beside the page title instead of in the mobile header row |

---

## Responsive primitives

Build a screen out of these rather than hand-rolling breakpoint arithmetic — four screens each
inventing their own column count is how a "responsive" app ends up with four different gutters.
All live in `components/shared/`.

| Component | What it does |
|---|---|
| `ContentContainer` | Centred max-width column + the horizontal padding for the current mode. |
| `ResponsiveGrid` | Lays children out in 1/2/3/4 columns by breakpoint, via `columns={{ mobile: 1, tablet: 2, desktop: 3 }}`. Pass **`rowGap={0}`** for a list whose cards already carry their own bottom margin from the phone design — those cards are presentational (theme via props, no hooks), and making them width-aware just to drop a margin would push a hook into every one of them. |
| `ResponsiveModal` | Full-screen sheet on mobile, centred dialog with a scrim + Esc-to-close on web. `mobilePresentation="centered"` for a short prompt that should be a card on both. Used by the decline-reason dialogs; reach for it first when adding a dialog. |
| `TwoColumn` | Main + aside, stacking on mobile. What `ScreenLayout`'s `aside` prop is built on. |
| `PageHeader` | The web title block: title, subtitle, back link, actions. |
| `Rail` | A horizontal card rail on mobile that becomes a grid section (with a "See all" link) on web — the Home rails' shape. |

**Forms get `hooks/useFormChain.ts`**, which is not a layout primitive but belongs to the same
problem: a mobile form is driven by thumbs, so its return key does nothing, and a browser user who
types and presses Enter concludes the form is broken. The hook wires the inputs into a chain —
**Enter advances, and submits from the last field** — using the same handler the button calls, so
the two paths cannot validate differently. Both designs benefit: on a phone the return key becomes
a working **Next**.

```tsx
const form = useFormChain(['identifier', 'password'], handleSignIn);
<TextInput {...form.field('identifier')} … />
<TextInput {...form.field('password')} … />
```

Mark a text area as `{ name: 'notes', multiline: true }` — in one of those Enter means *newline*,
and an unmarked one submits the form instead of starting a paragraph. Keep pickers, date fields
and composite controls out of the chain entirely.

**Dialogs get `hooks/useEscapeToClose.ts`.** `<Modal onRequestClose>` fires for Android's back
button and nothing else, so without it every dialog ignores the first key a desktop user reaches
for. Keyed on the **platform**, not the width — a narrow browser window still has a keyboard.
`ResponsiveModal` calls it for you; a hand-rolled `<Modal>` must call it itself, and pass `false`
for anything that must not be dismissed by accident (a mid-submit dialog, the first-run language
chooser).

`StickyFooter` also became mode-aware: on web it stops being an `absolute bottom-0` overlay
across the viewport and renders inside the content column (or the aside), because a full-width
bar pinned to the bottom of a 1440px window is a mobile artefact, not a desktop pattern.

---

## Rules for new work

1. **`ScreenLayout` is still the root of every screen.** A screen that opts out gets neither
   design.
2. **Branch on `useResponsive()`, never on `Platform.OS`, for anything about layout.**
3. **A card list is a `ResponsiveGrid`.** Not a `ScrollView` of full-width rows that happens to
   look fine on a phone.
4. **A new dialog is a `ResponsiveModal`.** A raw `<Modal>` covers a 27" display to ask for a
   decline reason. The existing ones were adapted in place rather than rewritten — each has its
   own bespoke body, and 16 mechanical rewrites would have risked more than they fixed — so a
   raw `<Modal>` that stays must call `useEscapeToClose` and cap its own width. The conformance
   suite enforces the Esc half; the width is on you.
5. **Cap the width.** Text lines longer than ~90 characters are unreadable; pick the `width` prop
   that matches the screen's shape rather than letting it run to the window edge.
6. **Everything reachable by mouse needs a hover state** and a `cursor: pointer`. `TouchableOpacity`
   gives neither on web; use the `Pressable` + hover helpers rather than adding one-off styles.
7. **Every form is a `useFormChain`.** A form whose Enter key does nothing is the most obvious
   possible sign that a page was built for a phone.
8. **Test both.** See [`WEB_LAYOUT_TESTING.md`](WEB_LAYOUT_TESTING.md) — the per-screen behaviour
   differences are enumerated there, and that list is the checklist.

Rules 1, 2, 4 and the two-nav-bars invariant are **enforced by
`__tests__/responsive/conventions.test.ts`**, which scans the source and fails with a message
naming the file and what to do. Each has a small allowlist for the genuinely exempt cases, with a
reason beside every entry — adding one should be a decision, not a way to quiet the test.

---

## Behaviour differences between the two designs

These are the places where the *behaviour* differs, not just the pixels. Each one is a thing that
can be right in one design and broken in the other, so each one is a test case.

| # | Concern | Mobile | Web |
|---|---|---|---|
| B1 | Primary navigation | `TabBar` navigates within `MainTabs` | `SideNav` navigates the root stack, including screens that are not tabs |
| B2 | Back | Header arrow + swipe gesture | Header back link + **browser Back**, which follows `linking.ts` URLs |
| B3 | Notifications bell | Per-screen `AppHeader` button | Once, in `TopBar` — `showNotificationButton` is ignored |
| B4 | Modals | Full-screen sheet; dismissed by the header X | Centred dialog; dismissed by X or scrim click. **Esc** is keyed on the *platform*, not the width — a narrow browser window draws the sheet but still honours Esc, and native attaches no key listener at all |
| B5 | Keyboard avoidance | `KeyboardAvoidingView` shrinks the body | No on-screen keyboard; the avoidance path is inert |
| B6 | `StickyFooter` | Pinned overlay, unmounts while the keyboard is up | In-flow inside the content column; no keyboard behaviour |
| B7 | Maps | `react-native-maps` | Maps JS API via `services/google-maps.ts` (`.web.tsx`) |
| B8 | Location permission | OS prompt via `expo-location` | Browser prompt via `navigator.geolocation`; denial resolves `null` |
| B9 | Pull-to-refresh | `RefreshControl` | Not available — every list that refreshes needs a visible refresh affordance on web |
| B10 | File & photo picking | `expo-image-picker` / `expo-document-picker` | Browser file input |
| B11 | Push notifications | Expo push, device token registered | Not supported — the registration path is skipped |
| B12 | Card lists | Vertical stack / horizontal rail | Grid; item count per row changes what "load more" should fetch |
| B13 | Tab screen state | Tab screens stay mounted; refresh via `useFocusEffect` | Same, but a browser refresh remounts everything from the URL |
| B14 | Hover / focus | No hover; touch feedback only | Hover states and keyboard focus rings are required |
| B15 | Deep links | `petbooker://` | Real URLs; any screen reachable by URL must survive a cold load |
| B16 | Keyboard form submission | Return key advances fields (was: did nothing) | **Enter advances, and submits from the last field** — the convention a browser user assumes. Without it a form reads as broken. See `hooks/useFormChain.ts` |

---

## Staging

The work lands in reviewable stages, each one leaving the app working on both targets.

| Stage | Contents |
|---|---|
| 1 | `useResponsive`, `navItems`, `AppShell` + `SideNav` + `TopBar`, `ScreenLayout` split, the primitives |
| 2 | The five tab screens: Home, Search, Profile, PartnerHub, AdminDashboard |
| 3 | Booking flow + detail screens: ServiceDetail, BookService, ReviewBooking, BookingConfirmed, MyBookings, BookingDetails |
| 4 | Partner + admin screens: MyServices, AddEditService, MySchedule, NewRequests, Promotions, LiveSession, the four admin screens |
| 5 | Forms, modals and auth: Account, AddPet, Settings, PartnerApplication, Login/Register/VerifyEmail/ForgotPassword, every `<Modal>` → `ResponsiveModal` |
| 6 | Conformance suite, docs reconciled, the test pass |

All six stages are complete. What changed against the original plan, and why:
- **Modals were adapted in place** rather than all moved to `ResponsiveModal` — see rule 4 above.
- **`rowGap`** was added to `ResponsiveGrid` mid-way, so a list of cards that already carry a
  bottom margin does not need its card component made width-aware. Those cards are presentational
  — theme via props, no hooks — and that convention was worth keeping.
- **Four screens** (`ChatScreen`, `ServicePreview`, `PartnerWelcome`, plus the orphaned
  `ProviderDetail`) were missed by the per-stage sweeps and caught by the conformance suite. Three
  are fixed; the orphan is allowlisted.
