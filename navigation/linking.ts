import type { LinkingOptions } from '@react-navigation/native';

/**
 * URL scheme for the app.
 *
 * On web this is what makes the address bar mean something: without it every screen shared the
 * single URL `/`, so the browser Back button left the app instead of going back a screen, a
 * refresh dumped you on Home, and no page could be bookmarked or shared. On native the same
 * config powers `petbooker://` deep links (the scheme is declared in app.json).
 *
 * ## What is mapped, and what deliberately isn't
 *
 * A screen only gets a path if arriving at it **cold** — a refresh, a pasted link — produces
 * something sensible. That means the screen needs either no params, optional ones, or an id it can
 * refetch from.
 *
 * Screens driven by an in-flight object are left out on purpose: `BookService` and `ReviewBooking`
 * carry a half-built booking, `AddEditService` an unsaved draft, `ApplicationReview` the
 * application being moderated. A URL cannot carry any of that, so giving them a path would trade
 * today's harmless "refresh goes Home" for a crash on reload. Unmapped screens simply don't change
 * the address bar — Back from one still works, because it pops to the last URL that did.
 *
 * The exception worth having is the pair users actually link to: a service and a booking, both
 * identified by an id the screen can fetch. See ServiceDetailScreen, which accepts either the
 * whole service (fast path from a list) or just `serviceId` (deep link).
 */
export const linking: LinkingOptions<ReactNavigation.RootParamList> = {
  // Static, so this module pulls in no runtime dependency. `petbooker://` is the scheme declared
  // in app.json. Expo's own `Linking.createURL('/')` would additionally cover the `exp://` URL
  // Expo Go uses in development — add it here (and depend on `expo-linking`) if native deep links
  // need to be exercised from Expo Go; on web, prefixes are not consulted at all.
  prefixes: ['petbooker://'],
  config: {
    screens: {
      // ── Tabs ──────────────────────────────────────────────────────────────────────────────
      // Nested under the tab navigator, so Home owns the root path.
      MainTabs: {
        screens: {
          Home: '',
          Search: 'search',
          PartnerHub: 'partner',
          AdminDashboard: 'admin',
          Profile: 'profile',
        },
      },

      // ── Deep-linkable detail pages ────────────────────────────────────────────────────────
      // Both take an id and refetch, so a pasted link rebuilds the page from scratch.
      // `parse` is required: a path segment arrives as a string, and both screens compare
      // their id numerically.
      ServiceDetail: {
        path: 'services/:serviceId',
        parse: { serviceId: Number },
        stringify: { serviceId: (id: number) => String(id) },
      },
      BookingDetails: {
        path: 'bookings/:bookingId',
        parse: { bookingId: Number },
        stringify: { bookingId: (id: number) => String(id) },
      },

      // ── Account ───────────────────────────────────────────────────────────────────────────
      MyPets: 'pets',
      AddPet: 'pets/new',
      MyBookings: 'bookings',
      Account: 'account',
      ChangePassword: 'account/password',
      Settings: 'settings',
      Notifications: 'notifications',
      NotificationSettings: 'notifications/settings',

      // ── Becoming / being a partner ────────────────────────────────────────────────────────
      BecomePartner: 'become-partner',
      PartnerApplication: 'become-partner/apply',
      MySchedule: 'partner/schedule',
      MyServices: 'partner/services',
      NewRequests: 'partner/requests',
      Promotions: 'partner/promotions',
      CreatePromotion: 'partner/promotions/new',
      LiveSession: 'partner/live-session',

      // ── Admin ─────────────────────────────────────────────────────────────────────────────
      AdminNewRequests: 'admin/requests',
      AdminPartners: 'admin/partners',
      AdminReviews: 'admin/reviews',
      AdminAddPartner: 'admin/partners/new',

      // ── Signed out ────────────────────────────────────────────────────────────────────────
      // Registered alongside the rest: only one of the two stacks is mounted at a time, and
      // React Navigation matches whichever screens exist.
      Login: 'login',
      Register: 'register',
      VerifyEmail: 'verify-email',
      ForgotPassword: 'forgot-password',
    },
  },
};
