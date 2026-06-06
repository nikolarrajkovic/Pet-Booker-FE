# PetBooker FE — Copilot Instructions

## Stack
- React Native + Expo SDK 54 (Android, iOS, Web)
- TypeScript, NativeWind (Tailwind CSS for RN), React Navigation v7
- No server-state cache library (no React Query / SWR) — all API data lives in component state
- API base URL (dev): `http://localhost:5161` — read from `process.env.EXPO_PUBLIC_API_BASE_URL`

---

## Project Layout

```
services/           # All API calls and storage utilities
  http.ts           # apiFetch + apiAuthFetch + registerSessionExpiredHandler
  auth.ts           # Auth endpoints including token refresh
  token-storage.ts  # Token persistence with TTL
  enums.ts          # Enum/lookup data
  pets.ts           # Pet CRUD + bulk photo upload
  files.ts          # File/image upload utilities
  service-providers.ts  # Partner application creation

context/
  AuthContext.tsx   # isLoggedIn, isAdmin, isPartner, currentUser, auth actions
  EnumsContext.tsx  # Fetch-once enum cache, cleared on logout
  ThemeContext.tsx  # isDarkMode, toggleDarkMode

components/shared/  # Reusable UI — ALWAYS check here first before creating a new component
components/         # One-off or screen-specific components

screens/<name>-screen/
  containers/   # Smart component: data fetching, state, navigation logic
  components/   # Dumb/presentational sub-components for that screen

hooks/          # Custom hooks (useLocation)
assets/         # Images, fonts
.github/        # copilot-instructions.md
```

---

## HTTP Layer — `services/http.ts`

- **`apiFetch(url, init?)`** — Unauthenticated. Use for public endpoints.
- **`apiAuthFetch(url, init?)`** — Automatically attaches `Authorization: Bearer <token>`. Use for all authenticated endpoints. Silently refreshes the access token if expired before making the request.
- **`registerSessionExpiredHandler(handler)`** — Registers a callback invoked when a token refresh fails. Called by AuthContext on mount. Do not call this elsewhere.
- **Rule**: Never call `fetch()` directly. Always use `apiFetch` or `apiAuthFetch`.
- FormData bodies: do NOT set `Content-Type` — the runtime must set it with the multipart boundary.
- In dev mode, all requests/responses are logged to console.

---

## Services

### `services/auth.ts`
- `loginWithEmailPassword(payload)` → POST `/auth/login` → `{ accessToken, refreshToken }`
- `refreshAccessToken(refreshToken)` → POST `/auth/refresh` → `{ accessToken, refreshToken? }`
- `registerUser(payload)` → POST `/auth/register`
- `getMe()` → GET `/auth/me` (auth) → `CurrentUser`
- `confirmEmail(email, code)` → POST `/auth/confirm-email`
- `resendConfirmation(email)` → POST `/auth/resend-confirmation`
- Type `CurrentUser`: `{ id, email, emailConfirmed, roles[], userName, firstName, lastName }`

### `services/token-storage.ts`
- `saveTokens(accessToken, refreshToken?)` — stores with TTL (access: 30 min, refresh: 7 days)
- `getAccessToken()` — returns null if expired
- `getRefreshToken()` — returns null if expired
- `clearTokens()` — wipes all stored tokens
- Native: `expo-secure-store` | Web: `localStorage`

### `services/enums.ts`
- `fetchEnums()` → GET `/enums` (auth) → `EnumsData`
- **Never call directly from screens** — always use `useEnums()` from EnumsContext.
- `EnumsData` keys: `paymentType`, `serviceProviderType`, `discountType`, `bookingStatusType`, `paymentStatus`, `sex`, `paymentMethodStatus`, `bookingState`, `providerProfileStatus`, `pushPlatform`, `emailTemplateType`
- Each key is `EnumEntry[] = { value: number, name: string }[]`

### `services/pets.ts`
- `getPets(ownerUserId)` → GET `/api/pets?OwnerUserId={id}` (auth) → `PetResponse[]`
  - Handles paginated wrappers: plain array, `{ items }`, `{ data }`, `{ results }`
- `createPet(input)` → auto-uploads photos via `uploadFilesBulk()` first, then POST `/api/pets`
  - Sex mapping: "male" → 1, "female" → 2
  - Weight/height unit conversion (kg↔lbs, cm↔in) via geolocation
- Type `PetResponse`: `{ id, name, type, petType, breed, sex, dateOfBirth, ageYears, weightKg, heightCm, dietaryNotes, favoriteFood, additionalNotes, photoUrl, isActive, photos[] }`

### `services/files.ts`
- `uploadFile(uri, fileName?, mimeType?)` → POST `/files/upload` (auth, multipart) → `UploadedFile`
- `uploadFilesBulk(files[])` → POST `/files/upload/bulk` (auth) → `UploadedFile[]`
- Type `UploadedFile`: `{ id, src, originalName, contentType, sizeBytes }`
- Web: handles base64 data URIs. Native: handles file system URIs.
- Prefer bulk upload over individual uploads.

### `services/service-providers.ts`
- `createServiceProvider(payload)` → POST `/api/service-providers` (auth)
  - Payload: `{ fullName, email, phone, address, selectedServices[], yearsOfExperience, aboutYou, certifications, availability }`

---

## Context Providers

### `useAuth()` — `context/AuthContext.tsx`
| Value | Type | Notes |
|---|---|---|
| `isLoggedIn` | boolean | |
| `isLoading` | boolean | True during session restore on app start |
| `isAdmin` | boolean | Derived from `currentUser.roles.includes('Admin')` |
| `isPartner` | boolean | Derived from `currentUser.roles.includes('Partner')` |
| `currentUser` | `CurrentUser \| null` | |
| `signIn(accessToken, refreshToken?)` | fn | Saves tokens + calls getMe() |
| `signInWithCredentials(email, password)` | fn | Calls loginWithEmailPassword + signIn |
| `signOut()` | fn | clearTokens() + reset state |
| `signInWithGoogle()` | fn | expo-auth-session Google OAuth (client IDs are placeholders) |

Auth flow:
1. On app start: check `getAccessToken()` → if valid, call `getMe()` → restore session
2. Login: `signInWithCredentials` → save tokens → `getMe()` → `isLoggedIn = true`
3. Register: POST `/auth/register` → VerifyEmail screen (pass email param) → `confirmEmail` → Login
4. Logout: `clearTokens()` + reset state → navigate to Login
5. Token refresh: handled automatically inside `apiAuthFetch` — if access token is expired, exchanges refresh token silently; if refresh also expired, fires session-expired handler → auto sign-out

### `useEnums()` — `context/EnumsContext.tsx`
| Value | Type |
|---|---|
| `enums` | `EnumsData \| null` |
| `isLoading` | boolean |
Fetched once per login session. Reset to null on logout.

### `useTheme()` — `context/ThemeContext.tsx`
| Value | Type |
|---|---|
| `isDarkMode` | boolean |
| `toggleDarkMode` | fn |
No persistence yet — resets to light mode on app restart.

---

## Hooks

### `useLocation()` — `hooks/useLocation.ts`
Returns `{ latitude, longitude, address, loading, error }`
- Default/fallback: Belgrade, Serbia (44.8176, 20.4570)
- Web: `navigator.geolocation.getCurrentPosition()`
- Native: `expo-location` + reverse geocode → `"[streetNumber], [street], [city]"`
- Used in AddPetScreen to determine metric vs. imperial units.

---

## Navigation (React Navigation v7)

Root: Stack navigator guarded by `isLoggedIn`.

**Public screens (unauthenticated):**
- `Login`, `Register`, `VerifyEmail`

**Authenticated root: MainTabs (bottom tab navigator) + stack screens**

Bottom tabs (see `components/shared/TabBar.tsx`):
- `Home`, `Search`, `Profile` — always visible
- `PartnerHub` — only if `isPartner`
- `AdminDashboard` — only if `isAdmin`

Stack screens (on top of tabs):
```
ProviderDetail, BookService, ReviewBooking, BookingConfirmed,
MyPets, AddPet, Settings, BecomePartner, PartnerApplication,
ApplicationSubmitted, Account, MyBookings, MySchedule, MyServices,
AddEditService, ServicePreview, Notifications, NewRequests, Promotions,
AdminNewRequests, ApplicationReview, AdminPartners, PartnerDetails, AdminAddPartner
```

Navigation patterns:
- `useNavigation()` for imperative navigation
- `useRoute()` with `RouteProp` for typed params
- Route params passed as objects: `navigate('ProviderDetail', { provider })`

---

## Screens Reference

| Screen | Container | Purpose |
|---|---|---|
| HomeScreen | `screens/home-screen/containers/HomeScreen.tsx` | Dashboard: recent, nearby, popular, deals, service type pills |
| SearchScreen | `screens/search-screen/` | Search providers, filter, map/list toggle |
| PartnerHubScreen | `screens/partner-hub-screen/containers/` | Partner dashboard (partner-only) |
| AdminDashboardScreen | `screens/admin-dashboard-screen/containers/` | Admin panel (admin-only) |
| ProfileScreen | `screens/profile-screen/containers/` | User profile + settings menu |
| ProviderDetailScreen | `screens/provider-detail-screen/containers/` | Service provider detail |
| BookServiceScreen | `screens/book-service-screen/containers/` | Multi-step booking (pet, date, time) |
| ReviewBookingScreen | `screens/review-booking-screen/` | Final review + payment method (UI only, no gateway yet) |
| BookingConfirmedScreen | `screens/booking-confirmed-screen/containers/` | Post-booking confirmation |
| MyPetsScreen | `screens/my-pets-screen/containers/` | User's pets list |
| AddPetScreen | `screens/add-pet-screen/containers/` | Create/edit pet + bulk photo upload |
| SettingsScreen | `screens/settings-screen/` | App settings |
| BecomePartnerScreen | `screens/become-partner-screen/containers/` | Partner signup info |
| PartnerApplicationScreen | `screens/partner-application-screen/containers/` | Multi-step partner application form |
| ApplicationSubmittedScreen | `screens/application-submitted-screen/containers/` | Post-application confirmation |
| AccountScreen | `screens/account-screen/containers/` | Account settings |
| MyBookingsScreen | `screens/my-bookings-screen/containers/` | User's bookings |
| MyScheduleScreen | `screens/my-schedule-screen/containers/` | Partner schedule (day/week/month) |
| MyServicesScreen | `screens/my-services-screen/containers/` | Partner's listed services |
| ServicePreviewScreen | `screens/service-preview-screen/` | Preview service before publish |
| NotificationsScreen | `screens/notifications-screen/containers/` | Notification center + preferences |
| NewRequestsScreen | `screens/new-requests-screen/containers/` | Partner's service request queue |
| PromotionsScreen | `screens/promotions-screen/containers/` | Promotions management |
| AdminNewRequestsScreen | `screens/admin-new-requests-screen/containers/` | Admin partner application queue |
| ApplicationReviewScreen | (within admin-new-requests) | Review individual partner application |
| AdminPartnersScreen | `screens/admin-partners-screen/containers/` | Admin partner management list |
| AdminAddPartnerScreen | `screens/admin-add-partner-screen/containers/` | Admin manually adds partner |
| LoginScreen | `screens/login-screen/containers/` | Email/username + password + Google OAuth |
| RegisterScreen | `screens/register-screen/` | New user registration |
| VerifyEmailScreen | `screens/verify-email-screen/` | Email code verification |

---

## Shared Components — `components/shared/`

Always check this folder before creating a new component. If a new component is similar to an existing one, extend it or generalise it and add it here.

| Component | Key Props | Purpose |
|---|---|---|
| `Button` | `text?`, `children?`, `onPress`, `variant?` ('primary'\|'secondary'\|'outline'\|'ghost'), `icon?`, `iconPosition?`, `disabled?`, `className?` | Primary CTA button |
| `AppHeader` | `variant?` ('large'\|'standard'\|'compact'), `title?`, `subtitle?`, `showBackButton?`, `onBackPress?`, `showNotificationButton?`, `rightAction?`, `rounded?` | Navigation header, safe-area aware |
| `ScreenLayout` | `headerVariant?`, `headerTitle?`, `showBackButton?`, `onBackPress?`, `children`, `footer?`, `contentRounded?`, `safeAreaBg?`, `contentBg?` | Wraps SafeAreaView + AppHeader + content area. Use this as the root of every screen. |
| `TabBar` | (none) | Bottom tab bar — reads context for role-based visibility |
| `ServiceCard` | `image`, `name`, `service`, `rating`, `reviews`, `price`, `distance?`, `badge?` ('popular'\|'deal'), `onPress` | 200px-wide provider card |
| `SeeMoreCard` | `onPress` | Trailing card in horizontal lists |
| `ServiceBubble` | `label`, `bg?`, `icon?`, `onPress?` | Circular icon + label (service type pill) |
| `Banner` | `title`, `description`, `image`, `color?` ('emerald'\|'pink'\|'red'\|'yellow'), `size?` | Colorful info banner |
| `DatePicker` | `value`, `onChange`, `onClose`, `isDarkMode`, `minDate?`, `maxDate?` | Calendar month picker |
| `TimePicker` | `value`, `onChange`, `onClose`, `isDarkMode`, `minDate?` | Spinner hour/minute/AM-PM picker |
| `ServiceDetailView` | `service`, `isDarkMode`, `showBookButton?`, `onBookPress?` | Full service detail layout |

---

## Styling System

**NativeWind (Tailwind) — `tailwind.config.js`**

Custom brand palette (green):
| Token | Hex | Usage |
|---|---|---|
| `brand-500` | `#00C870` | Primary green, main CTAs |
| `brand-400` | `#2CE07F` | Hover / lighter accents |
| `brand-600` | `#00A85A` | Active / pressed states |
| `brand-50` | `#E6FAF0` | Light backgrounds |
| `brand-900` | `#003822` | Dark text on brand |

Dark mode implementation:
- `isDarkMode` from `useTheme()` — pass down to components as a prop
- Background: `#0f1621` (screen bg), `#1a2332` (card), `#243447` (input)
- Light mode: `white` (screen bg), standard Tailwind grays for cards/inputs
- Pattern: `const bgColor = isDarkMode ? 'bg-[#0f1621]' : 'bg-white';`

**UI Consistency Rules:**
- Colors, fonts, and backgrounds must be consistent across the entire app
- Use `brand-*` tokens for all green/primary colors — never hardcode green hex values
- Use `ScreenLayout` as the root wrapper for every screen (provides consistent header + safe area)
- Use shared components from `components/shared/` whenever they fit — do not duplicate
- If a new component is needed and it could be reused elsewhere, add it to `components/shared/`

**Platform-specific files:**
- `.web.tsx` suffix = web-only (e.g. `WebDatePicker.web.tsx`, `MapView.web.tsx`)
- Metro bundler picks the right variant automatically — no manual platform checks needed for these

---

## Key Conventions

### API calls
- Public endpoints → `apiFetch`
- Authenticated endpoints → `apiAuthFetch`
- Never call `fetch()` directly

### Screen structure
- Every screen: `containers/` (smart) + optional `components/` (dumb)
- Data fetching lives in containers, never in presentational components

### State management
- No Redux/Zustand — all state is React component state + Context
- Data fetching: `useEffect` → async call → `setState`
- Unmount cancellation: `let cancelled = false` + `return () => { cancelled = true; }`

### Role checks
- Use `isAdmin` / `isPartner` booleans from `useAuth()` — never check `currentUser.roles` array directly

### Tokens
- Never read/write tokens directly — always go through `services/token-storage.ts`
- Token refresh is automatic inside `apiAuthFetch` — no manual refresh needed anywhere

### Enums/lookups
- Always use `useEnums()` from `EnumsContext` — never call `fetchEnums()` directly

### Error handling
- Try-catch with specific messages
- Parse API error order: `{ message }` → `{ detail }` → `{ title }` → response text
- ASP.NET validation errors: `{ errors: { Field: ["msg"] } }`

### Loading states
- `isLoading` boolean per screen/component
- Show `ActivityIndicator` while loading
- Disable submit buttons while loading

### Forms
- Touched state: only show field errors after user has interacted with the field
- Visual feedback: red border (error), green border (valid), default (untouched)

### File uploads
- Always use `uploadFilesBulk()` for multiple files — more efficient than individual uploads
- Upload files before creating the entity (pet, service, etc.)

### Payments
- Payment method selection in ReviewBookingScreen is UI only — no gateway integrated yet
- Real payment processing is planned for a future date

---

## Build & Run

```bash
expo start           # Dev server (scan QR for device)
expo start --web     # Web in browser
expo run:android     # Android emulator/device
expo run:ios         # iOS simulator/device
npm run lint         # ESLint + Prettier check
npm run format       # ESLint + Prettier auto-fix
```

Environment: copy `.env.example` → `.env`, set `EXPO_PUBLIC_API_BASE_URL=http://localhost:5161`
