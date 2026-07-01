// Schedule data source. Real bookings are injected at runtime via
// setLiveScheduleData(); until then the mock map below is used as a fallback.
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

// Mock services data - key is date in format YYYY-MM-DD
export const mockScheduleData: { [key: string]: ServiceItem[] } = {
  // Partner-provided services
  '2026-04-01': [
    { id: '1',  title: 'Dog Walking',  provider: 'Happy Paws Walking', petName: 'Luna',    time: '08:30 AM - 11:00 AM', location: 'Central Park',        type: 'walking',  duration: 2.5, isUserService: false },
    { id: '2',  title: 'Pet Grooming', provider: 'Pampered Paws',      petName: 'Mochi',   time: '11:00 AM - 02:00 PM', location: 'Downtown Grooming',   type: 'grooming', duration: 3,   isUserService: false },
    { id: '3',  title: 'Pet Sitting',  provider: 'Pet Care Plus',      petName: 'Buddy',   time: '03:00 PM - 05:00 PM', location: 'Client Home',         type: 'sitting',  duration: 2,   isUserService: false },
  ],
  '2026-04-02': [
    { id: '4',  title: 'Dog Walking',  provider: 'Happy Paws Walking', petName: 'Rex',     time: '09:00 AM - 11:30 AM', location: 'Riverside Park',      type: 'walking',  duration: 2.5, isUserService: false },
    { id: '5',  title: 'Pet Grooming', provider: 'Pets & Co',          petName: 'Chloe',   time: '12:00 PM - 03:00 PM', location: 'Uptown Spa',          type: 'grooming', duration: 3,   isUserService: false },
  ],
  '2026-04-03': [
    { id: '6',  title: 'Dog Training', provider: 'K9 Academy',         petName: 'Duke',    time: '10:00 AM - 04:00 PM', location: 'Training Center',     type: 'sitting',  duration: 6,   isUserService: false },
  ],
  '2026-04-05': [
    { id: '8',  title: 'Pet Grooming', provider: 'Spa Paws',           petName: 'Bella',   time: '02:00 PM - 04:00 PM', location: 'Pet Spa',             type: 'grooming', duration: 2,   isUserService: false },
  ],
  '2026-04-06': [
    { id: '9',  title: 'Dog Daycare',  provider: 'Playful Paws',       petName: 'Rocky',   time: '08:00 AM - 05:00 PM', location: 'Daycare Center',      type: 'sitting',  duration: 9,   isUserService: false },
  ],
  '2026-04-07': [
    { id: '10', title: 'Dog Walking',  provider: 'Active Paws',        petName: 'Charlie', time: '09:00 AM - 11:00 AM', location: 'Beach Walk',          type: 'walking',  duration: 2,   isUserService: false },
    { id: '11', title: 'Pet Sitting',  provider: 'Home Pet Care',      petName: 'Daisy',   time: '01:00 PM - 04:00 PM', location: 'Client Home',         type: 'sitting',  duration: 3,   isUserService: false },
  ],
  '2026-04-08': [
    { id: '12',  title: 'Full Day Care', provider: 'Premium Pet Care',  petName: 'Zeus',   time: '07:00 AM - 04:00 PM', location: 'Care Center',         type: 'sitting',  duration: 9,   isUserService: false },
    { id: 'u2',  title: 'Pet Grooming',  provider: 'Glamour Paws',      petName: 'Max',    time: '02:00 PM - 04:00 PM', location: 'Glamour Paws Salon',  type: 'grooming', duration: 2,   isUserService: true  },
  ],
  '2026-04-09': [
    { id: '13', title: 'Dog Training', provider: 'Obedience School',   petName: 'Luna',    time: '10:00 AM - 03:00 PM', location: 'Training Field',      type: 'sitting',  duration: 5,   isUserService: false },
  ],
  '2026-04-10': [
    { id: '14', title: 'Morning Walk', provider: 'Walk & Play',        petName: 'Max',     time: '08:00 AM - 10:30 AM', location: 'Park Trail',          type: 'walking',  duration: 2.5, isUserService: false },
  ],
  '2026-04-13': [
    { id: '15', title: 'Dog Walking',  provider: 'Happy Paws Walking', petName: 'Rex',     time: '09:00 AM - 11:30 AM', location: 'Riverside Park',      type: 'walking',  duration: 2.5, isUserService: false },
    { id: '16', title: 'Pet Sitting',  provider: 'Cozy Paws',          petName: 'Mochi',   time: '01:00 PM - 07:00 PM', location: 'Client Home',         type: 'sitting',  duration: 6,   isUserService: false },
  ],
  '2026-04-15': [
    { id: '17', title: 'Pet Grooming', provider: 'Premium Grooming',   petName: 'Zeus',    time: '10:00 AM - 01:00 PM', location: 'Downtown Studio',     type: 'grooming', duration: 3,   isUserService: false },
    { id: '18', title: 'Dog Walking',  provider: 'Walk & Play',        petName: 'Buddy',   time: '02:00 PM - 04:30 PM', location: 'Ocean Trail',         type: 'walking',  duration: 2.5, isUserService: false },
    { id: '19', title: 'Pet Sitting',  provider: 'Night Paws',         petName: 'Charlie', time: '05:00 PM - 09:00 PM', location: 'Client Home',         type: 'sitting',  duration: 4,   isUserService: false },
  ],
  '2026-04-16': [
    { id: '20', title: 'Dog Walking',  provider: 'Active Paws',        petName: 'Luna',    time: '08:00 AM - 10:00 AM', location: 'Beach Walk',          type: 'walking',  duration: 2,   isUserService: false },
  ],
  '2026-04-18': [
    { id: '21', title: 'Full Day Care',provider: 'Premium Pet Care',   petName: 'Daisy',   time: '07:00 AM - 05:00 PM', location: 'Care Center',         type: 'sitting',  duration: 10,  isUserService: false },
  ],
  '2026-04-20': [
    { id: 'u6', title: 'Dog Walking',  provider: 'Walk & Play',        petName: 'Max',     time: '07:30 AM - 09:00 AM', location: 'Ocean Beach Trail',   type: 'walking',  duration: 1.5, isUserService: true  },
    { id: '20b',title: 'Dog Walking',  provider: 'Happy Paws Walking', petName: 'Luna',    time: '10:00 AM - 12:30 PM', location: 'Golden Gate Park',    type: 'walking',  duration: 2.5, isUserService: false },
  ],
  '2026-04-22': [
    { id: '22', title: 'Dog Walking',  provider: 'Happy Paws Walking', petName: 'Rocky',   time: '09:00 AM - 11:00 AM', location: 'Golden Gate Park',    type: 'walking',  duration: 2,   isUserService: false },
    { id: '23', title: 'Pet Grooming', provider: 'Pampered Paws',      petName: 'Rex',     time: '12:00 PM - 02:30 PM', location: 'Downtown Grooming',   type: 'grooming', duration: 2.5, isUserService: false },
    { id: '24', title: 'Pet Sitting',  provider: 'Playful Paws',       petName: 'Duke',    time: '03:00 PM - 07:00 PM', location: 'Daycare Center',      type: 'sitting',  duration: 4,   isUserService: false },
  ],
  '2026-04-24': [
    { id: '25', title: 'Dog Training', provider: 'K9 Academy',         petName: 'Charlie', time: '10:00 AM - 12:00 PM', location: 'Training Field',      type: 'sitting',  duration: 2,   isUserService: false },
  ],
  '2026-04-28': [
    { id: '26', title: 'Dog Walking',  provider: 'Walk & Play',        petName: 'Buddy',   time: '08:00 AM - 10:30 AM', location: 'Riverside Park',      type: 'walking',  duration: 2.5, isUserService: false },
    { id: '27', title: 'Pet Grooming', provider: 'Spa Paws',           petName: 'Chloe',   time: '11:00 AM - 01:00 PM', location: 'Pet Spa',             type: 'grooming', duration: 2,   isUserService: false },
    { id: '28', title: 'Pet Sitting',  provider: 'Home Pet Care',      petName: 'Luna',    time: '02:00 PM - 08:00 PM', location: 'Client Home',         type: 'sitting',  duration: 6,   isUserService: false },
  ],
  '2026-04-30': [
    { id: '29', title: 'Dog Walking',  provider: 'Active Paws',        petName: 'Zeus',    time: '09:00 AM - 11:30 AM', location: 'Beach Walk',          type: 'walking',  duration: 2.5, isUserService: false },
    { id: '30', title: 'Pet Grooming', provider: 'Glamour Paws',       petName: 'Max',     time: '01:00 PM - 04:00 PM', location: 'Glamour Salon',       type: 'grooming', duration: 3,   isUserService: false },
    { id: '31', title: 'Pet Sitting',  provider: 'Night Paws',         petName: 'Bella',   time: '04:00 PM - 10:00 PM', location: 'Client Home',         type: 'sitting',  duration: 6,   isUserService: false },
  ],

  // User-booked services (isUserService: true)
  '2026-04-04': [
    { id: 'u1', title: 'Dog Walking',           provider: 'Happy Paws Walking',   petName: 'Max', time: '10:00 AM - 12:30 PM', location: 'Golden Gate Park',          type: 'walking',  duration: 2.5, isUserService: true },
  ],
  '2026-04-11': [
    { id: 'u3', title: 'Dog Walking',           provider: 'Paws on the Move',     petName: 'Max', time: '09:00 AM - 10:30 AM', location: 'Riverside Park',            type: 'walking',  duration: 1.5, isUserService: true },
  ],
  '2026-04-14': [
    { id: 'u4', title: 'Pet Sitting',           provider: 'Home Pet Care Plus',   petName: 'Max', time: '08:00 AM - 06:00 PM', location: 'Your Home',                 type: 'sitting',  duration: 10,  isUserService: true },
  ],
  '2026-04-17': [
    { id: 'u5', title: 'Full Grooming Session', provider: 'Pampered Paws Salon',  petName: 'Max', time: '11:00 AM - 01:00 PM', location: 'Downtown Grooming Studio',  type: 'grooming', duration: 2,   isUserService: true },
  ],
  '2026-04-23': [
    { id: 'u7', title: 'Pet Grooming',          provider: 'Spa Paws',             petName: 'Max', time: '01:00 PM - 03:00 PM', location: 'Uptown Pet Spa',            type: 'grooming', duration: 2,   isUserService: true },
  ],
  '2026-04-26': [
    { id: 'u8', title: 'Pet Sitting',           provider: 'Cozy Paws Sitting',    petName: 'Max', time: '09:00 AM - 05:00 PM', location: 'Your Home',                 type: 'sitting',  duration: 8,   isUserService: true },
  ],
  '2026-04-29': [
    { id: 'u9', title: 'Dog Walking',           provider: 'Active Paws',          petName: 'Max', time: '08:00 AM - 09:30 AM', location: 'Park Trail',                type: 'walking',  duration: 1.5, isUserService: true },
  ],
};

// ─── Service type colors ─────────────────────────────────────────────────────
export const SERVICE_TYPE_COLORS = {
  walking:  { pastel: '#93C5FD', dark: '#60A5FA', hex: '#3B82F6', label: 'Walking'  },
  grooming: { pastel: '#D8B4FE', dark: '#C084FC', hex: '#A855F7', label: 'Grooming' },
  sitting:  { pastel: '#86EFAC', dark: '#4ADE80', hex: '#10B981', label: 'Sitting'  },
} as const;

// ─── Live (API-backed) data source ───────────────────────────────────────────
// When set, replaces the mock map above. MyScheduleScreen populates this from
// real bookings on focus and clears it on blur.
let liveScheduleData: { [key: string]: ServiceItem[] } | null = null;
export const setLiveScheduleData = (map: { [key: string]: ServiceItem[] }) => { liveScheduleData = map; };
export const clearLiveScheduleData = () => { liveScheduleData = null; };
const scheduleSource = (): { [key: string]: ServiceItem[] } => liveScheduleData ?? mockScheduleData;

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
export function buildScheduleFromBookings(bookings: BookingDto[], mode: ScheduleMode): { [key: string]: ServiceItem[] } {
  const map: { [key: string]: ServiceItem[] } = {};
  const fmt = (d: Date) => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  for (const b of bookings) {
    if (b.state === BookingState.Cancelled) continue;
    if (mode === 'partner' && b.currentStatus === BookingStatusType.ServiceRequestedByUser) continue;
    const from = parseBookingDate(b.bookingFrom);
    const to = parseBookingDate(b.bookingTo);
    if (isNaN(from.getTime())) continue;
    const hours = !isNaN(to.getTime()) ? Math.max(0, Math.round(((to.getTime() - from.getTime()) / 3600000) * 10) / 10) : 1;
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
    const services = all.filter(s => s.isUserService);
    if (services.length === 0) return { color: 'transparent', totalHours: 0, hasData: false, type: undefined };
    const first = services[0];
    return { color: SERVICE_TYPE_COLORS[first.type].pastel, totalHours: services.reduce((s, i) => s + i.duration, 0), hasData: true, type: first.type };
  }

  // partner mode – workload-based colours
  const services = all.filter(s => !s.isUserService);
  if (services.length === 0) return { color: 'transparent', totalHours: 0, hasData: false, type: undefined };
  const totalHours = services.reduce((sum, s) => sum + s.duration, 0);
  let color = totalHours <= 3 ? '#86EFAC' : totalHours <= 6 ? '#FDE047' : '#FCA5A5';
  return { color, totalHours, hasData: true, type: undefined };
};

/** Darker pressed variant */
export const getDayColorPressed = (date: Date, mode: ScheduleMode = 'partner') => {
  const all = getServicesForDate(date);

  if (mode === 'user') {
    const services = all.filter(s => s.isUserService);
    if (services.length === 0) return { color: 'transparent', totalHours: 0, hasData: false, type: undefined };
    const first = services[0];
    return { color: SERVICE_TYPE_COLORS[first.type].dark, totalHours: services.reduce((s, i) => s + i.duration, 0), hasData: true, type: first.type };
  }

  const services = all.filter(s => !s.isUserService);
  if (services.length === 0) return { color: 'transparent', totalHours: 0, hasData: false, type: undefined };
  const totalHours = services.reduce((sum, s) => sum + s.duration, 0);
  let color = totalHours <= 3 ? '#4ADE80' : totalHours <= 6 ? '#FBBF24' : '#F87171';
  return { color, totalHours, hasData: true, type: undefined };
};

/** Month stats, filtered by mode */
export const getMonthStats = (date: Date, mode: ScheduleMode = 'partner') => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let totalServices = 0, bookedDays = 0, totalHours = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const all = getServicesForDate(new Date(year, month, day));
    const services = mode === 'user' ? all.filter(s => s.isUserService) : all.filter(s => !s.isUserService);
    if (services.length > 0) {
      totalServices += services.length;
      bookedDays++;
      totalHours += services.reduce((sum, s) => sum + s.duration, 0);
    }
  }

  return { totalServices, bookedDays, avgPerWeek: Math.round(totalHours / 4) };
};
