import {
  depositOf,
  uiToServiceDto,
  type WorkingHours,
} from '../screens/my-services-screen/serviceModel';
import { serviceByline, serviceDeposit, type ServiceDto } from '../services/services';
import { petAge, petCareNotes, petFacts } from '../services/pets';

/**
 * The service settings the API always had and the editor never set (app review 2026-11-13,
 * findings 12–16): a deposit, live tracking, booking notice, the pet sizes taken, and pausing.
 * The form sent `isActive: true` and round-tripped the rest, so a service made in the app could
 * have none of them, and saving a paused service switched it back on.
 */

const everyDay = (): WorkingHours => {
  const h: WorkingHours = {};
  for (const d of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) {
    h[d] = { enabled: true, startTime: '09:00', endTime: '17:00' };
  }
  return h;
};

const form = {
  serviceProviderId: 42,
  serviceType: 'Walker',
  serviceName: 'Morning walks',
  description: 'd',
  maxPetCapacity: 2,
  additionalServices: [],
  photos: [],
  address: null,
  pricingTiers: [{ duration: '30 min', price: '10' }],
  workingHours: everyDay(),
};

const stored = {
  id: 7,
  serviceProviderId: 42,
  name: 'Morning walks',
  type: 1,
  isActive: false,
  pricing: { basePrice: 10, isEscrowPercentEnabled: true, escrowPercent: 20, escrowAmount: 0 },
  details: {
    supportsLiveTracking: true,
    leadTimeHours: 12,
    minWeightKg: 2,
    maxWeightKg: 30,
    maxConcurrentBookings: 2,
    acceptedSpecies: 1,
  },
} as unknown as ServiceDto;

describe('the deposit: one choice on the form, two fields on the API', () => {
  it('sends a percentage as the percent switch and its share', () => {
    const dto = uiToServiceDto({ ...form, deposit: { kind: 'percent', value: 25 } });
    expect(dto.pricing).toMatchObject({
      isEscrowPercentEnabled: true,
      escrowPercent: 25,
      escrowAmount: 0,
    });
  });

  it('sends a fixed amount with the percent switch off', () => {
    const dto = uiToServiceDto({ ...form, deposit: { kind: 'fixed', value: 300 } });
    expect(dto.pricing).toMatchObject({
      isEscrowPercentEnabled: false,
      escrowPercent: null,
      escrowAmount: 300,
    });
  });

  it('clears a stored deposit when the partner chooses none', () => {
    const dto = uiToServiceDto({ ...form, deposit: { kind: 'none' } }, stored);
    expect(dto.pricing).toMatchObject({
      isEscrowPercentEnabled: false,
      escrowPercent: null,
      escrowAmount: 0,
    });
  });

  it('reads a stored deposit back into the form', () => {
    expect(depositOf(stored.pricing)).toEqual({ kind: 'percent', value: 20 });
    expect(depositOf({ basePrice: 10, isEscrowPercentEnabled: false, escrowAmount: 300 })).toEqual({
      kind: 'fixed',
      value: 300,
    });
    expect(depositOf({ basePrice: 10, isEscrowPercentEnabled: false, escrowAmount: 0 })).toEqual({
      kind: 'none',
    });
    expect(depositOf(null)).toEqual({ kind: 'none' });
  });
});

describe('the settings a save used to overwrite or never send', () => {
  it('keeps a paused service paused when the form says nothing', () => {
    expect(uiToServiceDto(form, stored).isActive).toBe(false);
  });

  it('pauses and resumes from the form', () => {
    expect(uiToServiceDto({ ...form, isActive: false }).isActive).toBe(false);
    expect(uiToServiceDto({ ...form, isActive: true }, stored).isActive).toBe(true);
  });

  it('a new service takes bookings unless told otherwise', () => {
    expect(uiToServiceDto(form).isActive).toBe(true);
  });

  it('sends the notice and the pet sizes, and null clears them', () => {
    const set = uiToServiceDto({ ...form, leadTimeHours: 24, minWeightKg: 5, maxWeightKg: 40 });
    expect(set.details).toMatchObject({ leadTimeHours: 24, minWeightKg: 5, maxWeightKg: 40 });

    const cleared = uiToServiceDto(
      { ...form, leadTimeHours: null, minWeightKg: null, maxWeightKg: null },
      stored
    );
    expect(cleared.details).toMatchObject({
      leadTimeHours: null,
      minWeightKg: null,
      maxWeightKg: null,
    });
  });

  it('keeps what is stored when the form leaves a setting out', () => {
    expect(uiToServiceDto(form, stored).details).toMatchObject({
      leadTimeHours: 12,
      minWeightKg: 2,
      maxWeightKg: 30,
      supportsLiveTracking: true,
    });
  });

  it('takes live tracking from the form, only for the kinds that move', () => {
    expect(
      uiToServiceDto({ ...form, supportsLiveTracking: true }).details?.supportsLiveTracking
    ).toBe(true);
    expect(
      uiToServiceDto({ ...form, supportsLiveTracking: false }, stored).details?.supportsLiveTracking
    ).toBe(false);
    // The API refuses it on any other type, so the form's value is not sent there.
    expect(
      uiToServiceDto({ ...form, serviceType: 'Groomer', supportsLiveTracking: true }).details
        ?.supportsLiveTracking
    ).toBe(false);
  });
});

describe('what a card and the checkout say about a service', () => {
  const percent = { pricing: { basePrice: 1000, isEscrowPercentEnabled: true, escrowPercent: 20 } };
  const fixed = { pricing: { basePrice: 1000, isEscrowPercentEnabled: false, escrowAmount: 300 } };

  it('works out the deposit the way the server does', () => {
    expect(serviceDeposit(percent as ServiceDto, 1500)).toBe(300);
    expect(serviceDeposit(fixed as ServiceDto, 1500)).toBe(300);
    // Never more than the bill.
    expect(serviceDeposit(fixed as ServiceDto, 200)).toBe(200);
    expect(serviceDeposit({ pricing: null } as unknown as ServiceDto, 1500)).toBe(0);
    expect(serviceDeposit(percent as ServiceDto, 0)).toBe(0);
  });

  it('names the partner under the service, unless the service is named after them', () => {
    expect(
      serviceByline('Walker', { name: 'Evening walk', serviceProviderName: 'Belgrade Pets' })
    ).toBe('Walker · Belgrade Pets');
    expect(
      serviceByline('Walker', { name: 'Belgrade Pets', serviceProviderName: 'belgrade pets ' })
    ).toBe('Walker');
    expect(serviceByline('Walker', { name: 'Evening walk' })).toBe('Walker');
  });
});

describe("the booked pet, for the side that doesn't know it", () => {
  const t = (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${Object.values(params).join(',')}` : key;
  const tEnum = (name: string, value: number | null | undefined) => `${name}#${value}`;
  const now = new Date(2026, 10, 16); // 16 Nov 2026

  it('counts whole years, and months under a year', () => {
    expect(petAge('2020-05-01', now)).toEqual({ years: 6, months: 6 });
    // The birthday is tomorrow: still five.
    expect(petAge('2020-11-17', now)).toEqual({ years: 5, months: 11 });
    expect(petAge('2026-08-10', now)).toEqual({ years: 0, months: 3 });
    expect(petAge('2027-01-01', now)).toBeNull();
    expect(petAge(null, now)).toBeNull();
    expect(petAge('not a date', now)).toBeNull();
  });

  it('lists species, breed, sex, age and weight, the ones known', () => {
    expect(
      petFacts(
        t,
        tEnum,
        { type: 1, breed: 'Labrador', sex: 1, dateOfBirth: '2020-05-01', weightKg: 32 },
        now
      )
    ).toEqual(['petSpeciesType#1', 'Labrador', 'sex#1', 'liveSession.yearsMany:6', '32 kg']);
    expect(petFacts(t, tEnum, { type: 2, sex: 3, dateOfBirth: '2026-08-10' }, now)).toEqual([
      'petSpeciesType#2',
      'pets.ageMonths:3',
    ]);
    expect(petFacts(t, tEnum, null, now)).toEqual([]);
  });

  it("carries the owner's care notes, only the ones written", () => {
    expect(
      petCareNotes(t, { dietaryNotes: ' No chicken ', favoriteFood: '', additionalNotes: null })
    ).toEqual([{ label: 'liveSession.dietaryNotes', value: 'No chicken' }]);
    expect(petCareNotes(t, undefined)).toEqual([]);
  });
});
