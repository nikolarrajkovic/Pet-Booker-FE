import { apiAuthFetch, getApiBaseUrl, parseApiError } from './http';
import type { ReviewDto } from './reviews';

/**
 * Dashboard statistics — GET /api/stats/* (auth; the admin group additionally
 * requires the Admin role server-side).
 *
 * These endpoints aggregate over the FULL dataset server-side and replace the
 * client-side roll-ups the dashboards used to do (fetching a capped page of
 * bookings/providers and summing in JS, which silently under-reported once the
 * platform outgrew the page size).
 *
 * NOTE: unlike every `/api/*` list endpoint, the stats endpoints return a plain
 * object/array — NOT a pagination wrapper — so `extractPageItems` does not apply.
 *
 * Money fields are in the `currency` reported alongside them (the provider's
 * currency, EUR by default); render them via `formatMoney` from `./bookings`
 * rather than assuming a symbol.
 */

/** GET /api/stats/admin/overview — platform-wide totals. */
export type AdminOverviewStats = {
  currency: string | null;
  /** All-time gross revenue. */
  totalRevenue: number;
  revenueThisMonth: number;
  /** Bookings currently scheduled (non-cancelled, upcoming). */
  servicesScheduled: number;
  newPartnersThisMonth: number;
  activePartners: number;
};

/**
 * GET /api/stats/admin/banner — headline activity counts.
 *
 * CAUTION (verified live 2026-07-27): these are ACTIVITY counts, not moderation
 * queues. `newReviews` still counted a review after it was approved, and
 * `newRequests` did not match the number of pending provider applications. Do
 * NOT use them for "N pending" badges that link to a moderation screen — query
 * the queue directly with the ApprovalStatus filter
 * (`getServiceProviders({ approvalStatus: Pending })` / `getReviews({ … })`),
 * as AdminDashboardScreen does.
 */
export type AdminBannerStats = {
  /** Recent booking requests across the platform (NOT pending applications). */
  newRequests: number;
  activePartners: number;
  /** Recently created reviews (NOT the pending-moderation count). */
  newReviews: number;
};

/** GET /api/stats/admin/revenue-by-service-type — one row per ServiceProviderType. */
export type RevenueByServiceType = {
  /** English enum name (e.g. "Groomer") — localize via tEnum('serviceProviderType', serviceTypeValue). */
  serviceType: string;
  /** ServiceProviderType value (0=Sitter … 5=Transporter). */
  serviceTypeValue: number;
  amount: number;
};

/** GET /api/stats/provider/overview — a partner's own numbers. */
export type ProviderOverviewStats = {
  currency: string | null;
  totalEarningsThisMonth: number;
  totalEarningsAllTime: number;
  totalClients: number;
  newClientsThisMonth: number;
  totalAppointments: number;
  appointmentsThisMonth: number;
  /** Confirmed, not-yet-started appointments. */
  upcomingAppointments: number;
  /** Bookings still in ServiceRequestedByUser (the NewRequests badge). */
  pendingRequests: number;
  /** Bookings in ServiceStarted — drives the "live session running" state. */
  inProgressAppointments: number;
  completedAppointments: number;
  averageRating: number;
  totalReviews: number;
  activeServices: number;
};

/** GET /api/stats/user/overview — a booker's own numbers. */
export type UserOverviewStats = {
  currency: string | null;
  spentThisMonth: number;
  totalSpent: number;
  totalBookings: number;
  upcomingAppointments: number;
  completedBookings: number;
  cancelledBookings: number;
  providersBooked: number;
  reviewsWritten: number;
  pets: number;
};

/**
 * One bucket of a monthly money series (provider earnings / user spending).
 * `month` is 1-based (1 = January). The server returns exactly `months` buckets,
 * oldest first, zero-filled for months with no activity.
 */
export type MonthlyAmount = {
  year: number;
  month: number;
  amount: number;
};

/**
 * One booking lifecycle event, for the recent-activity feeds.
 *
 * `otherPartyName` is the counterparty from the caller's perspective: the booker
 * for the provider feed, the provider for the user feed. `description` is a
 * server-composed English summary ("Booking confirmed", "Service started") — it
 * is backend free text, so it is NOT localized (see the i18n rules in CLAUDE.md);
 * prefer deriving display copy from `status`/`state` where a translation exists.
 *
 * `occurredAt` is a TRUE UTC instant (unlike booking `bookingFrom`/`bookingTo`,
 * which are naive wall-clock) — read it with `new Date()`, never `parseBookingDate`.
 */
export type ActivityEntry = {
  bookingId: number;
  serviceId: number;
  serviceName: string | null;
  otherPartyId: number | null;
  otherPartyName: string | null;
  /** BookingStatusType */
  status: number;
  /** BookingState */
  state: number;
  description: string | null;
  occurredAt: string;
};

async function getStats<T>(path: string, params?: Record<string, number | undefined>): Promise<T> {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null) query.set(k, String(v));
  }
  const qs = query.toString();
  const url = `${getApiBaseUrl()}/api/stats/${path}${qs ? `?${qs}` : ''}`;
  const response = await apiAuthFetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to load statistics.', `stats/${path}`));
  }

  return response.json();
}

// ─── Admin (Admin role required) ────────────────────────────────────────────

/** GET /api/stats/admin/overview */
export const getAdminOverviewStats = () => getStats<AdminOverviewStats>('admin/overview');

/** GET /api/stats/admin/banner */
export const getAdminBannerStats = () => getStats<AdminBannerStats>('admin/banner');

/**
 * GET /api/stats/admin/revenue-by-service-type — returns a row for EVERY
 * ServiceProviderType, including zero-amount ones; filter before charting.
 */
export const getAdminRevenueByServiceType = () =>
  getStats<RevenueByServiceType[]>('admin/revenue-by-service-type');

// ─── Provider ───────────────────────────────────────────────────────────────

/** GET /api/stats/provider/overview */
export const getProviderOverviewStats = (serviceProviderId: number) =>
  getStats<ProviderOverviewStats>('provider/overview', { serviceProviderId });

/** GET /api/stats/provider/earnings — monthly series, oldest first. */
export const getProviderEarnings = (serviceProviderId: number, months = 6) =>
  getStats<MonthlyAmount[]>('provider/earnings', { serviceProviderId, months });

/**
 * GET /api/stats/provider/latest-reviews — the provider's most recent APPROVED
 * reviews (pending/declined ones are excluded), newest first. Same shape as
 * `/api/reviews`, including the nested `user`/`serviceProvider`/`booking`.
 */
export const getProviderLatestReviews = (serviceProviderId: number, take = 5) =>
  getStats<ReviewDto[]>('provider/latest-reviews', { serviceProviderId, take });

/** GET /api/stats/provider/recent-activity — newest first. */
export const getProviderRecentActivity = (serviceProviderId: number, take = 10) =>
  getStats<ActivityEntry[]>('provider/recent-activity', { serviceProviderId, take });

// ─── User ───────────────────────────────────────────────────────────────────

/** GET /api/stats/user/overview */
export const getUserOverviewStats = (userId: number) =>
  getStats<UserOverviewStats>('user/overview', { userId });

/** GET /api/stats/user/spending — monthly series, oldest first. */
export const getUserSpending = (userId: number, months = 6) =>
  getStats<MonthlyAmount[]>('user/spending', { userId, months });

/** GET /api/stats/user/recent-activity — newest first. */
export const getUserRecentActivity = (userId: number, take = 10) =>
  getStats<ActivityEntry[]>('user/recent-activity', { userId, take });

/**
 * Month-over-month change (%) from a monthly series: the last bucket vs the one
 * before it. Returns null when there is no prior month or it was zero (no
 * meaningful base to compare against), matching how the dashboards hide the badge.
 */
export function monthOverMonthChangePct(series: MonthlyAmount[]): number | null {
  if (series.length < 2) return null;
  const current = series[series.length - 1]?.amount ?? 0;
  const previous = series[series.length - 2]?.amount ?? 0;
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}
