import {
  resolveServiceAddressForSave,
  uiToServiceDto,
  type WorkingHours,
} from '../screens/my-services-screen/serviceModel';
import { PetSpecies, speciesAccepted } from '../services/pets';
import type { AddressDto } from '../services/service-providers';

/**
 * Two things a partner now says per service: which pets it takes (so dog and cat boarding can be
 * priced apart) and, only when it differs, where it happens — otherwise it is where the partner's
 * business is. Both mirror rules the API enforces (Domain.PetSpeciesAcceptance and
 * Domain.ServiceLocation), so the app and the server can't disagree about them.
 */

const week = (): WorkingHours => {
  const h: WorkingHours = {};
  for (const d of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) {
    h[d] = { enabled: d === 'Monday', startTime: '09:00', endTime: '17:00' };
  }
  return h;
};

const form = {
  serviceProviderId: 7,
  serviceType: 'Boarder',
  serviceName: 'Cat boarding',
  description: 'd',
  pricingTiers: [{ duration: '', price: '1500' }],
  additionalServices: [],
  workingHours: week(),
  photos: [],
};

const saved: AddressDto = {
  id: 31,
  line1: 'Park Gate 5',
  city: 'Belgrade',
  state: '',
  postalCode: '11000',
  country: 'RS',
};

describe('which pets a service takes', () => {
  it('sends the species the partner picked', () => {
    const dto = uiToServiceDto({ ...form, acceptedSpecies: PetSpecies.Cat });
    expect(dto.details?.acceptedSpecies).toBe(PetSpecies.Cat);
  });

  it('replaces what was stored when the partner changes it', () => {
    const dto = uiToServiceDto(
      { ...form, acceptedSpecies: PetSpecies.Dog | PetSpecies.Cat },
      {
        id: 3,
        serviceProviderId: 7,
        name: 'x',
        details: { supportsLiveTracking: false, acceptedSpecies: PetSpecies.All },
      }
    );
    expect(dto.details?.acceptedSpecies).toBe(PetSpecies.Dog | PetSpecies.Cat);
  });

  it.each([
    [PetSpecies.Dog, PetSpecies.Cat, false],
    [PetSpecies.Dog | PetSpecies.Cat, PetSpecies.Cat, true],
    [PetSpecies.All, PetSpecies.Snake, true],
    // Unknown on either side is not a refusal, as on the server.
    [0, PetSpecies.Cat, true],
    [PetSpecies.Dog, null, true],
  ])('a service taking %i can be booked for a pet of %p: %p', (accepted, pet, expected) => {
    expect(speciesAccepted(accepted, pet)).toBe(expected);
  });
});

describe('where a service is', () => {
  it('keeps the saved address when nothing changed', () => {
    expect(resolveServiceAddressForSave(null, saved, false)).toBe(saved);
  });

  it('sends null to go back to the business location', () => {
    expect(resolveServiceAddressForSave(null, saved, true)).toBeNull();
  });

  it('sends a new pick inline as id 0, never linking another row by id', () => {
    // Even a pick that carries an id (e.g. one copied from another address) goes as a new value:
    // the server updates the service's own row or creates one.
    const picked = { ...saved, id: 99, line1: 'River Rd 1', state: '' };
    const sent = resolveServiceAddressForSave(picked, saved, false);
    expect(sent).toMatchObject({ id: 0, line1: 'River Rd 1', state: 'Belgrade' });
  });

  it('a service without its own address sends none', () => {
    const dto = uiToServiceDto({
      ...form,
      acceptedSpecies: PetSpecies.Cat,
      address: resolveServiceAddressForSave(null, null, false),
    });
    expect(dto.address).toBeNull();
  });
});
