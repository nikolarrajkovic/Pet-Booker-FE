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
import { formatDateOnly, parseDateOnly } from '../services/date-only';
import { certificateDates } from '../services/certificate-dates';
import { translate } from '../i18n';
import { formatKm } from '../i18n/numbers';

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

  // Trip legs and ETAs went out through toFixed(): "1.15 км" beside Russian text.
  it("writes distances with the reader's decimal mark", () => {
    expect(formatKm(1.149, 2)).toBe('1.15');
    registerDateLanguage('sr');
    expect(formatKm(1.149, 2)).toBe('1,15');
    expect(formatKm(5, 1)).toBe('5,0');
  });
});

// A picked calendar date goes to the API as the local "YYYY-MM-DD". Sign-up used toISOString(),
// which is the previous day in UTC for anyone east of Greenwich: a birthday picked in Belgrade
// (local midnight = 22:00 or 23:00 UTC the day before) was stored a day early.
describe('formatDateOnly', () => {
  it('keeps the local calendar day, where toISOString would roll back east of UTC', () => {
    const picked = new Date(1995, 5, 16); // local midnight, 16 June 1995
    expect(formatDateOnly(picked)).toBe('1995-06-16');
    expect(formatDateOnly(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01');
  });
});

// A certificate's dates in the admin view (app review G12): the expiry is optional, and one already
// past reads "Expired".
describe('certificate dates', () => {
  const t = (key: string, params?: Record<string, string | number>) =>
    translate('en', key as any, params);
  const today = new Date(2026, 9, 15);

  it('reads a date-only string as that local day', () => {
    expect(parseDateOnly('2026-10-15')?.getDate()).toBe(15);
    expect(parseDateOnly('')).toBeNull();
  });

  it('says issued and expires, or nothing', () => {
    expect(certificateDates(t, { issuedOn: '2024-10-03', expiresOn: '2027-10-03' }, today)).toBe(
      'Issued Oct 3, 2024 · Expires Oct 3, 2027'
    );
    expect(certificateDates(t, { expiresOn: '2026-01-01' }, today)).toBe('Expired Jan 1, 2026');
    expect(certificateDates(t, {}, today)).toBe('');
  });
});
