/**
 * A pet's weight and height take a number and nothing else, whatever keyboard typed it: the web
 * form accepted letters, and the save quietly turned them into 0.
 */
import { decimalInput } from '../services/decimal-input';

describe('decimalInput', () => {
  it('keeps digits and drops everything else', () => {
    expect(decimalInput('12')).toBe('12');
    expect(decimalInput('abc')).toBe('');
    expect(decimalInput('1a2 kg')).toBe('12');
    expect(decimalInput('-5')).toBe('5');
  });

  it('takes a comma as the decimal separator and shows a point', () => {
    expect(decimalInput('4,5')).toBe('4.5');
    expect(decimalInput('0,35')).toBe('0.35');
  });

  it('keeps one separator and at most two decimals', () => {
    expect(decimalInput('4.5.6')).toBe('4.56');
    expect(decimalInput('4.567')).toBe('4.56');
    expect(decimalInput('4.')).toBe('4.');
  });

  it('gives a leading separator its zero', () => {
    expect(decimalInput('.5')).toBe('0.5');
    expect(decimalInput(',')).toBe('0.');
  });

  it('caps the whole part at three digits', () => {
    expect(decimalInput('2332')).toBe('233');
    expect(decimalInput('2332.5')).toBe('233.5');
  });
});
