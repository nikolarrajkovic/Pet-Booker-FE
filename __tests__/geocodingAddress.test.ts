import { cityOf, streetLine } from '../services/geocoding';

// What a map pick stores as the address (review 2026-11-13, finding 9).
describe('streetLine', () => {
  it('writes the street before the number', () => {
    expect(streetLine('Bulevar kralja Aleksandra', '73')).toBe('Bulevar kralja Aleksandra 73');
  });
  it('keeps whichever part there is', () => {
    expect(streetLine('Knez Mihailova', undefined)).toBe('Knez Mihailova');
    expect(streetLine(null, '5')).toBe('5');
    expect(streetLine('', '')).toBe('');
  });
});

describe('cityOf', () => {
  it('takes the city from the county when Nominatim puts a municipality in city', () => {
    expect(
      cityOf({ city: 'Gradska opština Vračar', county: 'Grad Beograd', suburb: 'Beograd (Vračar)' })
    ).toBe('Beograd');
    expect(cityOf({ city: 'Градска општина Звездара', county: 'Град Београд' })).toBe('Београд');
  });
  it('keeps a real city name', () => {
    expect(cityOf({ city: 'Novi Sad', county: 'Južnobački upravni okrug' })).toBe('Novi Sad');
    expect(cityOf({ town: 'Pančevo' })).toBe('Pančevo');
  });
  it('falls back to the county city when nothing else names it', () => {
    expect(cityOf({ county: 'Grad Niš' })).toBe('Niš');
  });
});
