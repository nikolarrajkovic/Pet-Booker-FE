/**
 * Which kinds of extra the editor offers for a type of service.
 *
 * The table comes from the API (`/enums` → `serviceProviderType[].additionalServiceKinds`, the rule
 * its validators enforce). The app kept its own copy until 2026-10-29, and a copy can drift: the
 * menu then offers a kind the save refuses. These pin that the app reads the published mask, and
 * that it narrows nothing (rather than everything) before the enums arrive.
 */
import { kindFitsType, kindsForType, offeredKindsMask } from '../services/service-addons';
import { AdditionalServiceKind } from '../services/services';
import type { EnumEntry } from '../services/enums';

const { Pickup, DropOff, PetTaxi, Treats, Bath } = AdditionalServiceKind;

// A made-up mask on purpose: the app must use whatever the API sends, not a table of its own.
const SERVICE_TYPES: EnumEntry[] = [
  { value: 0, name: 'Sitter', additionalServiceKinds: Pickup | Bath },
  { value: 1, name: 'Walker', additionalServiceKinds: Pickup | DropOff | Treats },
];

describe('the kinds of extra a type of service offers', () => {
  it('is the mask the API publishes for that type', () => {
    expect(offeredKindsMask(SERVICE_TYPES, 1)).toBe(Pickup | DropOff | Treats);
    expect(kindsForType(offeredKindsMask(SERVICE_TYPES, 1))).toEqual([Pickup, DropOff, Treats]);
    expect(kindFitsType(Bath, offeredKindsMask(SERVICE_TYPES, 1))).toBe(false);
    expect(kindFitsType(Bath, offeredKindsMask(SERVICE_TYPES, 0))).toBe(true);
  });

  it('narrows nothing before the enums arrive or a type is chosen, and never offers None', () => {
    expect(offeredKindsMask(null, 1)).toBeNull();
    expect(offeredKindsMask(SERVICE_TYPES, null)).toBeNull();
    expect(kindFitsType(PetTaxi, null)).toBe(true);
    expect(kindsForType(null)).toContain(PetTaxi);
    expect(kindFitsType(0, null)).toBe(false);
  });
});
