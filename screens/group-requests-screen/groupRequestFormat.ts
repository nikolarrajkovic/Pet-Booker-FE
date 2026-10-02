import { parseBookingDate } from '../../services/bookings';
import {
  GroupBookingStatus,
  type GroupBookingRequestDto,
  type GroupBookingStatusValue,
} from '../../services/group-booking-requests';
import { MONTH_SHORT_KEYS, DAY_SHORT_KEYS } from '../../i18n';

type TFn = (key: any, params?: Record<string, string | number>) => string;

const hhmm = (d: Date) =>
  d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

const day = (t: TFn, d: Date) =>
  `${t(DAY_SHORT_KEYS[d.getDay()])}, ${t(MONTH_SHORT_KEYS[d.getMonth()])} ${d.getDate()}`;

/**
 * "Tue, Oct 7 · 10:00–11:00", or "Tue, Oct 7 10:00 → Thu, Oct 9 10:00" across days. The values
 * are naive wall-clock like a booking's, so they go through `parseBookingDate`, never `new Date`.
 */
export function formatRequestWindow(t: TFn, fromIso: string, toIso: string): string {
  const from = parseBookingDate(fromIso);
  const to = parseBookingDate(toIso);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return '';
  if (from.toDateString() === to.toDateString()) {
    return `${day(t, from)} · ${hhmm(from)}–${hhmm(to)}`;
  }
  return `${day(t, from)} ${hhmm(from)} → ${day(t, to)} ${hhmm(to)}`;
}

/** Same for two local Dates still being edited in the form. */
export function formatDateWindow(t: TFn, from: Date, to: Date): string {
  if (from.toDateString() === to.toDateString()) {
    return `${day(t, from)} · ${hhmm(from)}–${hhmm(to)}`;
  }
  return `${day(t, from)} ${hhmm(from)} → ${day(t, to)} ${hhmm(to)}`;
}

/** Status pill text + colours (light-mode tints that also read on dark cards). */
export function statusStyle(
  t: TFn,
  status: GroupBookingStatusValue
): { label: string; fg: string; bg: string } {
  switch (status) {
    case GroupBookingStatus.Fulfilled:
      return { label: t('groupRequest.statusFulfilled'), fg: '#15803D', bg: '#DCFCE7' };
    case GroupBookingStatus.Cancelled:
      return { label: t('groupRequest.statusCancelled'), fg: '#B91C1C', bg: '#FEE2E2' };
    case GroupBookingStatus.Expired:
      return { label: t('groupRequest.statusExpired'), fg: '#4B5563', bg: '#E5E7EB' };
    default:
      return { label: t('groupRequest.statusOpen'), fg: '#A16207', bg: '#FEF9C3' };
  }
}

/** How long ago a request was sent — "today" / "3 days ago". `createdAt` is a true instant. */
export function sentAgo(t: TFn, request: GroupBookingRequestDto): string {
  const then = new Date(request.createdAt).getTime();
  if (isNaN(then)) return '';
  const days = Math.floor((Date.now() - then) / 86400000);
  return days <= 0 ? t('requests.today') : t('requests.daysAgo', { d: days });
}
