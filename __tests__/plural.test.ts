import { pluralForm } from '../i18n/plural';
import { translate } from '../i18n';

// Serbian and Russian decline a counted word three ways. The app had a singular for 1 and one
// plural for the rest: "2 отзывов", "1 aktivnih", "1 bookings".
describe('plural forms', () => {
  it('follows the one/few/many rules of Serbian and Russian', () => {
    for (const lang of ['sr', 'ru'] as const) {
      expect([1, 21, 101].map((n) => pluralForm(lang, n))).toEqual(['one', 'one', 'one']);
      expect([2, 3, 4, 22, 34].map((n) => pluralForm(lang, n))).toEqual(Array(5).fill('few'));
      expect([0, 5, 11, 12, 14, 25, 111].map((n) => pluralForm(lang, n))).toEqual(
        Array(7).fill('many')
      );
    }
    expect([1, 2, 5, 21].map((n) => pluralForm('en', n))).toEqual(['one', 'many', 'many', 'many']);
  });

  it('every counted key has all three forms in every language', () => {
    const forms = (one: string, few: string, many: string) =>
      (['en', 'sr', 'ru'] as const).map((lang) =>
        [one, few, many].map((key) => translate(lang, key as any, { n: 2, count: 2 }))
      );
    for (const row of forms('card.reviewCountOne', 'card.reviewCountFew', 'card.reviewCount'))
      for (const text of row) expect(text).toMatch(/2/);
    expect(translate('ru', 'card.reviewCountFew' as any, { count: 2 })).toBe('2 отзыва');
    expect(translate('sr', 'myServices.activeFew' as any, { count: 3 })).toBe('3 aktivne usluge');
  });
});
