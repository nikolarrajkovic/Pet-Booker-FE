import { Ionicons } from '@expo/vector-icons';
import type { TranslationKey } from '../i18n';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Which section of the sidebar an item belongs to.
 *
 * `primary` is the set the **mobile tab bar** shows — the app's top-level destinations. The other
 * three groups exist only in the web design: on a phone they are reached through the Profile and
 * Partner Hub menus, which is fine when navigation is a 5-icon bar, and pointless when there is a
 * whole column of space for them.
 */
export type NavGroup = 'primary' | 'manage' | 'partner' | 'admin';

export type NavItem = {
  /** The route to navigate to, and the one that marks this item selected. */
  route: string;
  /**
   * True when the route lives inside `MainTabs` rather than the root stack. The two need
   * different `navigate` calls from the sidebar (which sits at the root), and conflating them is
   * how a sidebar link silently no-ops.
   */
  isTab?: boolean;
  params?: Record<string, unknown>;
  labelKey: TranslationKey;
  icon: IoniconName;
  group: NavGroup;
  /** Role gate. Absent means everyone signed in sees it. */
  requires?: 'partner' | 'admin';
};

/**
 * Every navigation destination in the app, in one list.
 *
 * **This is the single source of truth for both designs.** `components/shared/TabBar.tsx` (the
 * phone's bottom bar) takes the `primary` items; `components/layout/SideNav.tsx` (the web
 * sidebar) takes all of them. Before this list existed the two would have been separate arrays,
 * and a destination added to one would have been missing from the other — silently, since neither
 * design is visible while you are looking at the other.
 *
 * Order within a group is the order rendered.
 */
export const NAV_ITEMS: NavItem[] = [
  // ── Primary — the tab bar on mobile, the top of the sidebar on web ──────────────────────────
  { route: 'Home', isTab: true, labelKey: 'tabs.home', icon: 'home', group: 'primary' },
  {
    route: 'Search',
    isTab: true,
    // Clearing both filters is what makes the tab mean "start a fresh search" rather than
    // "reopen the last one" — carried over from the phone tab bar, which has always done this.
    params: { serviceType: undefined, category: undefined },
    labelKey: 'tabs.search',
    icon: 'search',
    group: 'primary',
  },
  {
    route: 'PartnerHub',
    isTab: true,
    labelKey: 'tabs.partner',
    icon: 'briefcase-outline',
    group: 'primary',
    requires: 'partner',
  },
  {
    route: 'AdminDashboard',
    isTab: true,
    labelKey: 'tabs.admin',
    icon: 'shield-checkmark-outline',
    group: 'primary',
    requires: 'admin',
  },
  { route: 'Profile', isTab: true, labelKey: 'tabs.profile', icon: 'person', group: 'primary' },

  // ── Manage — the Profile menu, promoted to real navigation on web ───────────────────────────
  { route: 'MyBookings', labelKey: 'profile.bookings', icon: 'calendar-outline', group: 'manage' },
  { route: 'MyPets', labelKey: 'profile.pets', icon: 'paw-outline', group: 'manage' },
  { route: 'Messages', labelKey: 'messages.title', icon: 'chatbubbles-outline', group: 'manage' },
  {
    route: 'Notifications',
    labelKey: 'profile.notifications',
    icon: 'notifications-outline',
    group: 'manage',
  },
  { route: 'Settings', labelKey: 'profile.settings', icon: 'settings-outline', group: 'manage' },

  // ── Partner — the Partner Hub quick actions ─────────────────────────────────────────────────
  {
    route: 'MySchedule',
    labelKey: 'partnerHub.mySchedule',
    icon: 'today-outline',
    group: 'partner',
    requires: 'partner',
  },
  {
    route: 'NewRequests',
    labelKey: 'partnerHub.requests',
    icon: 'file-tray-full-outline',
    group: 'partner',
    requires: 'partner',
  },
  {
    route: 'MyServices',
    labelKey: 'partnerHub.myServices',
    icon: 'pricetags-outline',
    group: 'partner',
    requires: 'partner',
  },
  {
    route: 'Promotions',
    labelKey: 'partnerHub.promotions',
    icon: 'megaphone-outline',
    group: 'partner',
    requires: 'partner',
  },

  // ── Admin — the Admin Dashboard quick actions ───────────────────────────────────────────────
  {
    route: 'AdminNewRequests',
    labelKey: 'admin.newRequests',
    icon: 'documents-outline',
    group: 'admin',
    requires: 'admin',
  },
  {
    route: 'AdminPartners',
    labelKey: 'admin.partners',
    icon: 'people-outline',
    group: 'admin',
    requires: 'admin',
  },
  {
    route: 'AdminReviews',
    labelKey: 'admin.reviews',
    icon: 'star-outline',
    group: 'admin',
    requires: 'admin',
  },
];

/** Heading rendered above each sidebar group. `primary` needs none — it sits under the logo. */
export const GROUP_LABEL_KEYS: Record<Exclude<NavGroup, 'primary'>, TranslationKey> = {
  manage: 'nav.manage',
  partner: 'nav.partner',
  admin: 'nav.admin',
};

export type NavRoles = { isPartner: boolean; isAdmin: boolean };

/** The items a given account may see, in list order. */
export function visibleNavItems({ isPartner, isAdmin }: NavRoles): NavItem[] {
  return NAV_ITEMS.filter(
    (item) =>
      item.requires === undefined ||
      (item.requires === 'partner' && isPartner) ||
      (item.requires === 'admin' && isAdmin)
  );
}

/** The tab-bar set: the primary destinations this account may see. */
export function primaryNavItems(roles: NavRoles): NavItem[] {
  return visibleNavItems(roles).filter((item) => item.group === 'primary');
}

/** The sidebar's non-primary sections, in render order, with empty groups dropped. */
export function secondaryNavGroups(
  roles: NavRoles
): { group: Exclude<NavGroup, 'primary'>; items: NavItem[] }[] {
  const visible = visibleNavItems(roles);
  return (['manage', 'partner', 'admin'] as const)
    .map((group) => ({ group, items: visible.filter((item) => item.group === group) }))
    .filter(({ items }) => items.length > 0);
}
