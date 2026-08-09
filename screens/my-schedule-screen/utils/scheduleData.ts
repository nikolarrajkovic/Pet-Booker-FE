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

export type ScheduleMode = 'partner' | 'user';

export interface ServiceItem {
  id: string;
  title: string;
  provider: string;
  petName: string;
  time: string;
  location: string;
  type: 'walking' | 'grooming' | 'sitting';
  duration: number; // in hours
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

// BACKEND-GAP: bookings don't carry a service "type", so it's inferred from the name.
function inferScheduleType(name?: string | null): ServiceItem['type'] {
  const n = (name ?? '').toLowerCase();
  if (n.includes('walk')) return 'walking';
  if (n.includes('groom')) return 'grooming';
  return 'sitting';
}

/**
 * Builds the date-keyed schedule map from real bookings. Skips cancelled
 * bookings, and in partner mode also skips not-yet-accepted requests
 * (currentStatus = ServiceRequestedByUser) — those belong in New Requests and
 * only enter the schedule once the partner accepts. Users keep seeing their
 * own pending requests on their schedule.
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
    const to = parseBookingDate(b.bookingTo);
    if (isNaN(from.getTime())) continue;
    const hours = !isNaN(to.getTime())
      ? Math.max(0, Math.round(((to.getTime() - from.getTime()) / 3600000) * 10) / 10)
      : 1;
    const item: ServiceItem = {
      id: String(b.id ?? 0),
      title: b.service?.name ?? 'Service',
      provider: b.serviceProvider?.name ?? '',
      petName: b.pet?.name ?? '',
      time: isNaN(to.getTime()) ? fmt(from) : `${fmt(from)} - ${fmt(to)}`,
      location: '', // BACKEND-GAP: no location name on booking
      type: inferScheduleType(b.service?.name),
      duration: hours,
      isUserService: mode === 'user',
    };
    (map[dateKey(from)] ||= []).push(item);
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
