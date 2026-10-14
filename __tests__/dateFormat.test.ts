import {
  formatBirthDate,
  formatFullDate,
  formatDayMonth,
  formatLongDate,
  formatMonthYear,
  formatShortDate,
  formatWeekdayDayMonth,
  registerDateLanguage,
} from '../i18n/dates';
import { bookingToViewModel } from '../services/bookings';
import { formatMoney } from '../services/currency';

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
    // In each language's own order and grammar — not the English pattern with translated words
    // ("Okt 3, 2026", "Sreda, Oktobar 14, 2026"), which is what Serbian and Russian used to get.
    registerDateLanguage('sr');
    expect(formatWeekdayDayMonth(saturday)).toBe('sub 3. okt');
    expect(formatShortDate(saturday)).toBe('3. okt 2026.');
    expect(formatLongDate(saturday)).toBe('3. oktobar 2026.');
    expect(formatFullDate(saturday)).toBe('subota, 3. oktobar 2026.');

    registerDateLanguage('ru');
    expect(formatShortDate(saturday)).toBe('3 окт. 2026 г.');
    // Russian inflects the month inside a date.
    expect(formatLongDate(saturday)).toBe('3 октября 2026 г.');
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
    expect(vm.date).toBe('3. okt 2026.');
  });
});

describe('number formatting', () => {
  afterEach(() => registerDateLanguage('en'));

  it("groups and punctuates money the reader's way", () => {
    expect(formatMoney(1250000, 'RSD')).toBe('1,250,000 RSD');
    expect(formatMoney(12.5, 'EUR')).toBe('12.50 €');

    registerDateLanguage('sr');
    expect(formatMoney(1250000, 'RSD')).toBe('1.250.000 RSD');
    expect(formatMoney(12.5, 'EUR')).toBe('12,50 €');
    expect(formatMoney(30, 'EUR')).toBe('30 €');
  });
});
