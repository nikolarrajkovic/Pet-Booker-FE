// Schedule data source — real bookings only.
//
// MyScheduleScreen loads the caller's bookings on focus and injects them via setLiveScheduleData().
// Until that lands (and if it fails) the source is EMPTY. It used to fall back to a hardcoded map of
// invented appointments, so a failed fetch — or the moment before the first one resolved — showed a
// provider a month of services that did not exist, next to an error toast. An empty calendar is the
// honest answer to "we could not load your bookings"; the screen renders the failure separately.
import {
  BookingDto,
  BookingState,
  BookingStatusType,
  parseBookingDate,
} from '../../../services/bookings';
import { customerName } from '../../../services/users';
import { formatDayMonth } from '../../../i18n/dates';

export type ScheduleMode = 'partner' | 'user';

export interface ServiceItem {
  /** Unique per day: a stay is one item on each day it covers. */
  id: string;
  /** The booking this appointment is, for opening it. */
  bookingId: number;
  title: string;
  /** Who the appointment is with: the customer on a partner's schedule, the provider on a user's. */
  counterpart: string;
  petName: string;
  time: string;
  location: string;
  /** The colour group. */
  type: 'walking' | 'grooming' | 'sitting';
  /** The service's ServiceProviderType, labelled with tEnum; null for an older read without it. */
  serviceType: number | null;
  duration: number; // hours of this appointment that fall on this day
  isUserService: boolean; // true = user is booking this service for their pet
}

// ─── Service type colors ─────────────────────────────────────────────────────
export const SERVICE_TYPE_COLORS = {
  walking: { pastel: '#93C5FD', dark: '#60A5FA', hex: '#3B82F6', label: 'Walking' },
  grooming: { pastel: '#D8B4FE', dark: '#C084FC', hex: '#A855F7', label: 'Grooming' },
  sitting: { pastel: '#86EFAC', dark: '#4ADE80', hex: '#10B981', label: 'Sitting' },
} as const;

// ─── Live (API-backed) data source ───────────────────────────────────────────
// MyScheduleScreen populates this from real bookings on focus and clears it on blur.
let liveScheduleData: { [key: string]: ServiceItem[] } | null = null;
export const setLiveScheduleData = (map: { [key: string]: ServiceItem[] }) => {
  liveScheduleData = map;
};
export const clearLiveScheduleData = () => {
  liveScheduleData = null;
};
// Never fabricates: no live data means no appointments, not invented ones.
const scheduleSource = (): { [key: string]: ServiceItem[] } => liveScheduleData ?? {};

const pad2 = (n: number) => String(n).padStart(2, '0');
const dateKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/**
 * The colour group for a service: by its type (Walker and Transporter move, Groomer grooms, the
 * rest look after the pet). Guessed from the English name only for a read without the type: that
 * guess tagged a sitting service called "Deposit walk" as walking, and anything named in Serbian
 * as sitting (review 2026-11-13).
 */
function scheduleGroup(serviceType: number | null, name?: string | null): ServiceItem['type'] {
  if (serviceType === 1 || serviceType === 5) return 'walking';
  if (serviceType === 4) return 'grooming';
  if (serviceType != null) return 'sitting';
  const n = (name ?? '').toLowerCase();
  if (n.includes('walk')) return 'walking';
  if (n.includes('groom')) return 'grooming';
  return 'sitting';
}

const HOUR = 3600000;

/**
 * Builds the date-keyed schedule map from real bookings. Skips cancelled
 * bookings, and in partner mode also skips not-yet-accepted requests
 * (currentStatus = ServiceRequestedByUser) — those belong in New Requests and
 * only enter the schedule once the partner accepts. Users keep seeing their
 * own pending requests on their schedule.
 *
 * A booking that runs over several days (a stay) is listed on EVERY day it covers, with its
 * dates in the time and only that day's hours counted towards the day's workload. It used to be
 * filed under its start date alone, so the days after it looked free (review 2026-11-13).
 */
export function buildScheduleFromBookings(
  bookings: BookingDto[],
  mode: ScheduleMode
): { [key: string]: ServiceItem[] } {
  const map: { [key: string]: ServiceItem[] } = {};
  const fmt = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  for (const b of bookings) {
    if (b.state === BookingState.Cancelled) continue;
    if (mode === 'partner' && b.currentStatus === BookingStatusType.ServiceRequestedByUser)
      continue;
    const from = parseBookingDate(b.bookingFrom);
    const parsedTo = parseBookingDate(b.bookingTo);
    if (isNaN(from.getTime())) continue;
    const to =
      !isNaN(parsedTo.getTime()) && parsedTo > from ? parsedTo : new Date(from.getTime() + HOUR);
    const multiDay = dateKey(from) !== dateKey(new Date(to.getTime() - 1));
    const time = multiDay
      ? `${formatDayMonth(from)} ${fmt(from)} – ${formatDayMonth(to)} ${fmt(to)}`
      : `${fmt(from)} - ${fmt(to)}`;
    const serviceType = b.service?.type ?? null;
    const base = {
      bookingId: b.id ?? 0,
      title: b.service?.name ?? 'Service',
      // A partner's schedule used to print the partner's own business name on every card.
      counterpart: mode === 'partner' ? customerName(b.user) : (b.serviceProvider?.name ?? ''),
      petName: b.pet?.name ?? '',
      time,
      location: '',
      type: scheduleGroup(serviceType, b.service?.name),
      serviceType,
      isUserService: mode === 'user',
    };
    // One entry per calendar day the booking touches, each counting its own hours.
    for (
      let day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
      day < to;
      day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
    ) {
      const nextDay = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
      const start = from > day ? from : day;
      const end = to < nextDay ? to : nextDay;
      const hours = Math.max(0, Math.round(((end.getTime() - start.getTime()) / HOUR) * 10) / 10);
      (map[dateKey(day)] ||= []).push({
        ...base,
        id: `${b.id ?? 0}-${dateKey(day)}`,
        duration: hours,
      });
    }
  }
  return map;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
export const getServicesForDate = (date: Date): ServiceItem[] => {
  return scheduleSource()[dateKey(date)] || [];
};

/** Calendar dot color for a given date and mode */
export const getDayColorInfo = (date: Date, mode: ScheduleMode = 'partner') => {
  const all = getServicesForDate(date);

  if (mode === 'user') {
    const services = all.filter((s) => s.isUserService);
    if (services.length === 0)
      return { color: 'transparent', totalHours: 0, hasData: false, type: undefined };
    const first = services[0];
    return {
      color: SERVICE_TYPE_COLORS[first.type].pastel,
      totalHours: services.reduce((s, i) => s + i.duration, 0),
      hasData: true,
      type: first.type,
    };
  }

  // partner mode – workload-based colours
  const services = all.filter((s) => !s.isUserService);
  if (services.length === 0)
    return { color: 'transparent', totalHours: 0, hasData: false, type: undefined };
  const totalHours = services.reduce((sum, s) => sum + s.duration, 0);
  let color = totalHours <= 3 ? '#86EFAC' : totalHours <= 6 ? '#FDE047' : '#FCA5A5';
  return { color, totalHours, hasData: true, type: undefined };
};

/** Darker pressed variant */
export const getDayColorPressed = (date: Date, mode: ScheduleMode = 'partner') => {
  const all = getServicesForDate(date);

  if (mode === 'user') {
    const services = all.filter((s) => s.isUserService);
    if (services.length === 0)
      return { color: 'transparent', totalHours: 0, hasData: false, type: undefined };
    const first = services[0];
    return {
      color: SERVICE_TYPE_COLORS[first.type].dark,
      totalHours: services.reduce((s, i) => s + i.duration, 0),
      hasData: true,
      type: first.type,
    };
  }

  const services = all.filter((s) => !s.isUserService);
  if (services.length === 0)
    return { color: 'transparent', totalHours: 0, hasData: false, type: undefined };
  const totalHours = services.reduce((sum, s) => sum + s.duration, 0);
  let color = totalHours <= 3 ? '#4ADE80' : totalHours <= 6 ? '#FBBF24' : '#F87171';
  return { color, totalHours, hasData: true, type: undefined };
};

/** Month stats, filtered by mode */
export const getMonthStats = (date: Date, mode: ScheduleMode = 'partner') => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let totalServices = 0,
    bookedDays = 0,
    totalHours = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const all = getServicesForDate(new Date(year, month, day));
    const services =
      mode === 'user' ? all.filter((s) => s.isUserService) : all.filter((s) => !s.isUserService);
    if (services.length > 0) {
      totalServices += services.length;
      bookedDays++;
      totalHours += services.reduce((sum, s) => sum + s.duration, 0);
    }
  }

  return { totalServices, bookedDays, avgPerWeek: Math.round(totalHours / 4) };
};
