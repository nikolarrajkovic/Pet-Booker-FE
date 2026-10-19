import {
  daySegments,
  hmsToMinutes,
  roomIn,
  startCandidates,
} from '../screens/book-service-screen/slotMath';

/**
 * The booking form offers a start every 30 minutes and checks each against the day's availability
 * segments — which the server splits at booking boundaries, so a half-hour start can span two of
 * them. These pin the rules that decide which starts are offered and which are greyed.
 */
describe('roomIn', () => {
  const at = (h: number, m = 0) => h * 60 + m;

  it('reads the room of the one segment that covers the range', () => {
    const windows = [{ from: '09:00:00', to: '17:00:00', remainingCapacity: 2 }];
    expect(roomIn(daySegments(windows), at(10, 30), at(11, 30))).toBe(2);
  });

  it('takes the tightest segment when a start spans two', () => {
    // A booking 11:00–12:00 on a capacity-2 service splits the day; 10:30–11:30 touches both sides.
    const windows = [
      { from: '09:00:00', to: '11:00:00', remainingCapacity: 2 },
      { from: '11:00:00', to: '12:00:00', remainingCapacity: 1 },
      { from: '12:00:00', to: '17:00:00', remainingCapacity: 2 },
    ];
    expect(roomIn(daySegments(windows), at(10, 30), at(11, 30))).toBe(1);
    expect(roomIn(daySegments(windows), at(12), at(13))).toBe(2);
  });

  it('reports a full segment as no room, not as not covered', () => {
    const windows = [
      { from: '09:00:00', to: '10:00:00', remainingCapacity: 0 },
      { from: '10:00:00', to: '17:00:00', remainingCapacity: 1 },
    ];
    expect(roomIn(daySegments(windows), at(9, 30), at(10, 30))).toBe(0);
  });

  it('refuses a range that runs past the working hours or across a gap', () => {
    const windows = [
      { from: '09:00:00', to: '12:00:00', remainingCapacity: 1 },
      { from: '13:00:00', to: '17:00:00', remainingCapacity: 1 },
    ];
    expect(roomIn(daySegments(windows), at(11, 30), at(12, 30))).toBeNull();
    expect(roomIn(daySegments(windows), at(16, 30), at(17, 30))).toBeNull();
    expect(roomIn(daySegments([]), at(10), at(11))).toBeNull();
  });

  it('treats the 23:59:59 end-of-day sentinel as midnight, so the last evening start fits', () => {
    const windows = [{ from: '18:00:00', to: '23:59:59', remainingCapacity: 1 }];
    expect(hmsToMinutes('23:59:59')).toBe(24 * 60);
    expect(roomIn(daySegments(windows), at(23), at(24))).toBe(1);
  });
});

describe('startCandidates', () => {
  const hhmm = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  it('offers a start every half hour, across the splits a booking makes', () => {
    // 09:00–17:00 split by a booking at 10:30–11:30. 10:00 and 11:00 cross the split and must
    // still be offered (they vanished when candidates stopped at each segment's own end).
    const windows = [
      { from: '09:00:00', to: '10:30:00', remainingCapacity: 3 },
      { from: '10:30:00', to: '11:30:00', remainingCapacity: 2 },
      { from: '11:30:00', to: '17:00:00', remainingCapacity: 3 },
    ];
    const starts = startCandidates(daySegments(windows), 60, 30).map(hhmm);
    expect(starts).toEqual(expect.arrayContaining(['09:00', '10:00', '10:30', '11:00', '16:00']));
    expect(starts).not.toContain('16:30'); // would end after the hours
  });

  it('aligns odd segment starts to the half hour', () => {
    const windows = [{ from: '10:45:00', to: '13:00:00', remainingCapacity: 1 }];
    expect(startCandidates(daySegments(windows), 60, 30).map(hhmm)).toEqual([
      '11:00',
      '11:30',
      '12:00',
    ]);
  });
});

describe('late starts across midnight', () => {
  const hhmm = (m: number) =>
    `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  it('offers 23:00 and 23:30 when the hours run on into the next day', () => {
    // Friday 20:00–02:00 arrives as Friday 20:00–24:00 and Saturday 00:00–02:00.
    const friday = [{ from: '20:00:00', to: '23:59:59', remainingCapacity: 1 }];
    const saturday = [{ from: '00:00:00', to: '02:00:00', remainingCapacity: 1 }];
    const segments = daySegments(friday, saturday);
    const starts = startCandidates(segments, 60, 30);
    expect(starts.map(hhmm)).toEqual([
      '20:00',
      '20:30',
      '21:00',
      '21:30',
      '22:00',
      '22:30',
      '23:00',
      '23:30',
    ]);
    expect(roomIn(segments, 23 * 60 + 30, 24 * 60 + 30)).toBe(1);
  });

  it('stops at midnight when the next day does not continue the hours', () => {
    const friday = [{ from: '20:00:00', to: '23:59:59', remainingCapacity: 1 }];
    const saturday = [{ from: '09:00:00', to: '17:00:00', remainingCapacity: 1 }];
    const segments = daySegments(friday, saturday);
    expect(roomIn(segments, 23 * 60 + 30, 24 * 60 + 30)).toBeNull();
    // Starts belong to the picked day only — Saturday's 09:00 is not one of Friday's.
    expect(startCandidates(segments, 60, 30).every((m) => m < 24 * 60)).toBe(true);
  });
});
