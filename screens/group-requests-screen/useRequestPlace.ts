import { useEffect, useRef, useState } from 'react';
import { reverseGeocodeToAddress, type GeoPoint } from '../../services/geocoding';
import { ServiceProviderType, type AddressDto } from '../../services/service-providers';

/** Where a group request's service happens — which becomes the booking's pickup address. */
export type WhereChoice = 'none' | 'account' | 'current' | 'map';

/**
 * Service types that come to the pet: a walker, a sitter or a transporter starts at the owner's,
 * so the owner's own place is the natural default for "Where". Boarding, a pet hotel and a
 * groomer work at their own premises, so those default to "At the provider's".
 */
export const COMES_TO_THE_PET = new Set<number>([
  ServiceProviderType.Sitter,
  ServiceProviderType.Walker,
  ServiceProviderType.Transporter,
]);

/** The default: the owner's saved address, else where the device is, for a service that comes
 *  to the pet; the provider's place otherwise (or when the owner has no place to offer). */
export function preferredWhere(
  serviceType: number | null,
  accountAddress: AddressDto | null,
  currentPlace: AddressDto | null
): WhereChoice {
  if (serviceType != null && !COMES_TO_THE_PET.has(serviceType)) return 'none';
  if (accountAddress) return 'account';
  if (currentPlace) return 'current';
  return 'none';
}

export const pointOf = (a?: AddressDto | null): GeoPoint | null =>
  a?.location?.latitude != null && a?.location?.longitude != null
    ? { latitude: a.location.latitude, longitude: a.location.longitude }
    : null;

/** The API wants a non-empty state; a reverse-geocoded place does not always carry one. */
const withState = (a: AddressDto): AddressDto => ({
  ...a,
  id: undefined,
  state: a.state || a.city || a.country || '-',
});

type DeviceLocation = {
  latitude: number;
  longitude: number;
  loading: boolean;
  error: string | null;
};

/**
 * The "Where" of a group request: the choice, its default, the device's place as an address,
 * and the map picker's round trip.
 *
 * The default follows the service type until the owner chooses for themselves. The account
 * address is set by the caller, which loads it with the rest of the owner's profile.
 */
export function useRequestPlace(serviceType: number | null, device: DeviceLocation) {
  const [where, setWhere] = useState<WhereChoice>('none');
  const [touched, setTouched] = useState(false);
  const [accountAddress, setAccountAddress] = useState<AddressDto | null>(null);
  const [currentPlace, setCurrentPlace] = useState<AddressDto | null>(null);
  const [currentPlaceState, setCurrentPlaceState] = useState<'locating' | 'ready' | 'unavailable'>(
    'locating'
  );
  const [mapAddress, setMapAddress] = useState<AddressDto | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  // What "Where" was before the map opened, to go back to if the picker closes with no pin.
  const beforeMap = useRef<WhereChoice>('none');
  // The picker calls onSelect and then onClose in the same tick, so onClose would read the
  // render's stale `mapAddress` (still null on a first pick) and undo the pick just made.
  const mapAddressRef = useRef<AddressDto | null>(null);

  // Where the device is now, as an address — offered as "My current location".
  useEffect(() => {
    if (device.loading) return;
    if (device.error) {
      setCurrentPlaceState('unavailable');
      return;
    }
    let cancelled = false;
    reverseGeocodeToAddress({ latitude: device.latitude, longitude: device.longitude })
      .then((a) => {
        if (cancelled) return;
        if (a.line1 || a.city) {
          setCurrentPlace(a);
          setCurrentPlaceState('ready');
        } else {
          setCurrentPlaceState('unavailable');
        }
      })
      .catch(() => {
        if (!cancelled) setCurrentPlaceState('unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, [device.loading, device.error, device.latitude, device.longitude]);

  const preferred = preferredWhere(serviceType, accountAddress, currentPlace);
  useEffect(() => {
    if (!touched) setWhere(preferred);
  }, [preferred, touched]);

  /** The owner picks an option; "map" opens the picker. */
  const choose = (choice: WhereChoice) => {
    setTouched(true);
    if (choice === 'map') {
      if (where !== 'map') beforeMap.current = where;
      setPickerVisible(true);
    }
    setWhere(choice);
  };

  const onPickerSelect = (address: AddressDto) => {
    mapAddressRef.current = address;
    setMapAddress(address);
    setWhere('map');
  };

  const onPickerClose = () => {
    setPickerVisible(false);
    if (!mapAddressRef.current) setWhere(beforeMap.current);
  };

  /** The address the choice stands for; null for "At the provider's". */
  const chosen =
    where === 'account'
      ? accountAddress
      : where === 'current'
        ? currentPlace
        : where === 'map'
          ? mapAddress
          : null;

  /** Where the picker opens: a pin already dropped, else the chosen address, else the saved
   *  one, else the device's place — null lets the picker find the device itself. */
  const pickerStart =
    pointOf(mapAddress) ??
    (where === 'current' ? pointOf(currentPlace) : null) ??
    pointOf(accountAddress) ??
    pointOf(currentPlace);

  /**
   * The request's addressId. A saved address is referenced as it is; a place from the device or
   * the map is saved first, through `save` (the caller's createAddress).
   */
  const resolveAddressId = async (
    save: (a: AddressDto) => Promise<AddressDto>
  ): Promise<number | null> => {
    if (where === 'account') return accountAddress?.id ?? null;
    const placed = where === 'map' ? mapAddress : where === 'current' ? currentPlace : null;
    if (!placed) return null;
    const saved = await save(withState(placed));
    return saved.id ?? null;
  };

  return {
    where,
    choose,
    accountAddress,
    setAccountAddress,
    currentPlace,
    currentPlaceState,
    mapAddress,
    /** "Pick on the map" chosen but no pin dropped yet. */
    needsMapPin: where === 'map' && !mapAddress,
    chosen,
    picker: {
      visible: pickerVisible,
      start: pickerStart,
      onSelect: onPickerSelect,
      onClose: onPickerClose,
    },
    resolveAddressId,
  };
}
