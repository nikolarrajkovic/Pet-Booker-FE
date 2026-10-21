import type { AvailabilityWindowDto } from '../../services/services';

const MINUTES_PER_DAY = 24 * 60;

// "HH:mm:ss" (or "HH:mm") → minutes since midnight, rounded to the nearest
// minute. Rounding lets the 23:59:59 end-of-day sentinel (= 24:00) read back as
// 1440 so a window ending at midnight still yields its final 23:00–24:00 slot.
export const hmsToMinutes = (t?: string | null): number => {
  if (!t) return 0;
  const [h, m, s] = t.split(':');
  const total = (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0) + (parseInt(s, 10) || 0) / 60;
  return Math.round(total);
};

/** One availability segment in minutes from the picked day's midnight (> 1440 = the next day). */
export type Segment = { from: number; to: number; room: number };

/**
 * A day's segments, followed by the NEXT day's shifted by 24 h.
 *
 * Working hours can run past midnight (Friday 20:00–02:00; the server reports it as Friday
 * 20:00–24:00 and Saturday 00:00–02:00), so a late start — 23:30 for an hour — needs the next
 * day's first segment to be judged at all. Without it every start after the last full hour before
 * midnight was simply missing, which is the "late hours for sitting" the feedback asked for.
 */
export function daySegments(
  today: AvailabilityWindowDto[],
  tomorrow: AvailabilityWindowDto[] = []
): Segment[] {
  const toSegments = (windows: AvailabilityWindowDto[], offset: number) =>
    windows.map((w) => ({
      from: hmsToMinutes(w.from) + offset,
      to: hmsToMinutes(w.to) + offset,
      room: w.remainingCapacity,
    }));
  return [...toSegments(today, 0), ...toSegments(tomorrow, MINUTES_PER_DAY)].sort(
    (a, b) => a.from - b.from
  );
}

/**
 * Room left for [startMin, endMin), or null when the segments don't cover the range end to end
 * (not bookable at that time at all).
 *
 * The availability endpoint splits each working window at booking boundaries, each segment with
 * its own `remainingCapacity`, so a start can span two segments (10:30–11:30 across a booking that
 * ends at 11:00) — or two days. The room is the tightest segment the range touches.
 */
export function roomIn(segments: Segment[], startMin: number, endMin: number): number | null {
  let cursor = startMin;
  let room = Number.POSITIVE_INFINITY;
  for (const seg of segments) {
    if (seg.to <= cursor) continue;
    if (seg.from > cursor) return null; // a gap before the range is covered
    room = Math.min(room, seg.room);
    cursor = seg.to;
    if (cursor >= endMin) return Math.max(0, room);
  }
  return null;
}

/**
 * Candidate start minutes on the picked day: every `step` minutes, aligned to the step, from each
 * of the day's own segment starts until midnight — and only where the appointment would end by the
 * last segment's end (the next day's included, for a late start).
 *
 * Not each segment's own end: the server splits the hours at every booking, and a start that
 * crosses a split (10:00–11:00 over a booking at 10:30 on a capacity-3 service) is still a real
 * time — `roomIn` judges it across the segments it spans, and drops it at a gap in the hours.
 * Generated per segment, 10:00 and 11:00 simply vanished from the grid the moment anyone booked
 * 10:30. Aligned, so a segment starting at 10:45 offers 11:00, 11:30… not quarter-past times.
 */
export function startCandidates(segments: Segment[], slotMinutes: number, step: number): number[] {
  return startCandidatesWithin(segments, step, slotMinutes);
}

/**
 * Room for a stay of `lengthMinutes` starting `startMin` minutes into the first of `days` (each
 * day's availability windows, from the start day on), judged the way the server judges a booking
 * across days (BookingValidators.IsWithinSchedule): the start inside the first day's hours, every
 * date the stay touches a working day — one with any availability — and the room the tightest
 * window it overlaps. Its nights are not working hours, and were never meant to be (boarding).
 *
 * Null when a date it touches has no availability: not a working day, booked out, or not loaded.
 */
export function stayRoom(
  days: (AvailabilityWindowDto[] | undefined)[],
  startMin: number,
  lengthMinutes: number
): number | null {
  const endMin = startMin + lengthMinutes;
  // The server checks every date from the start's to the end's, the end's included.
  const lastDay = Math.floor(endMin / MINUTES_PER_DAY);
  if (days.length <= lastDay) return null;
  const opensAtStart = (days[0] ?? []).some(
    (w) => hmsToMinutes(w.from) <= startMin && startMin < hmsToMinutes(w.to)
  );
  if (!opensAtStart) return null;
  let room = Number.POSITIVE_INFINITY;
  for (let d = 0; d <= lastDay; d++) {
    const windows = days[d];
    if (!windows || windows.length === 0) return null;
    for (const w of windows) {
      const from = hmsToMinutes(w.from) + d * MINUTES_PER_DAY;
      const to = hmsToMinutes(w.to) + d * MINUTES_PER_DAY;
      if (to > startMin && from < endMin) room = Math.min(room, w.remainingCapacity);
    }
  }
  return Math.max(0, room);
}

/** Starts for a stay: every `step` minutes inside the first day's own hours (drop-off time). */
export function stayStartCandidates(segments: Segment[], step: number): number[] {
  return startCandidatesWithin(segments, step, null);
}

function startCandidatesWithin(
  segments: Segment[],
  step: number,
  slotMinutes: number | null
): number[] {
  const own = segments.filter((s) => s.from < MINUTES_PER_DAY);
  if (own.length === 0) return [];
  const lastEnd = Math.max(...segments.map((s) => s.to));
  const starts = new Set<number>();
  for (const seg of own) {
    const first = Math.ceil(seg.from / step) * step;
    for (let m = first; m < MINUTES_PER_DAY; m += step) {
      if (slotMinutes == null ? m >= seg.to : m + slotMinutes > lastEnd) break;
      starts.add(m);
    }
  }
  return Array.from(starts).sort((a, b) => a - b);
}
