import {
  formatBirthDate,
  formatDayMonth,
  formatLongDate,
  formatMonthYear,
  formatShortDate,
  formatWeekdayDayMonth,
  registerDateLanguage,
} from '../i18n/dates';
import { bookingToViewModel } from '../services/bookings';

// Dates follow the APP's language, not the device's: a Serbian session on an English-locale
// phone used to read "Oct 3, 2026" and "Sat, Oct 3" beside Serbian labels.
describe('date formatting', () => {
  const saturday = new Date(2026, 9, 3, 14, 0); // Sat 3 Oct 2026, local time

  afterEach(() => registerDateLanguage('en'));

  it('formats in English by default', () => {
    expect(formatShortDate(saturday)).toBe('Oct 3, 2026');
    expect(formatDayMonth(saturday)).toBe('Oct 3');
    expect(formatWeekdayDayMonth(saturday)).toBe('Sat, Oct 3');
    expect(formatMonthYear(saturday)).toBe('Oct 2026');
    expect(formatLongDate(saturday)).toBe('October 3, 2026');
    expect(formatBirthDate(saturday)).toBe('03 October 2026');
  });

  it('follows the registered app language, whatever the device locale', () => {
    registerDateLanguage('sr');
    expect(formatWeekdayDayMonth(saturday)).toBe('Sub, Okt 3');
    expect(formatShortDate(saturday)).toBe('Okt 3, 2026');

    registerDateLanguage('ru');
    expect(formatShortDate(saturday)).not.toContain('Oct');
  });

  it('an explicit language wins over the registered one', () => {
    registerDateLanguage('sr');
    expect(formatDayMonth(saturday, 'en')).toBe('Oct 3');
  });

  it('booking cards built outside React use it too', () => {
    registerDateLanguage('sr');
    const vm = bookingToViewModel({
      id: 1,
      serviceProviderId: 1,
      serviceId: 1,
      petId: 1,
      userId: 1,
      bookingFrom: '2026-10-03T04:00:00',
      bookingTo: '2026-10-03T05:00:00',
      state: 1,
    } as any);
    expect(vm.date).toBe('Okt 3, 2026');
  });
});
