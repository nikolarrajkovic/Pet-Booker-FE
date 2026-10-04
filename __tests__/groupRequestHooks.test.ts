import { act, renderHook, waitFor } from '@testing-library/react-native';
import { preferredWhere, useRequestPlace } from '../screens/group-requests-screen/useRequestPlace';
import { useProviderSelection } from '../screens/group-requests-screen/useProviderSelection';
import { ServiceProviderType, type AddressDto } from '../services/service-providers';
import type { ServiceSearchItem } from '../screens/search-screen/components/ListView';

jest.mock('../services/geocoding', () => ({
  reverseGeocodeToAddress: jest.fn(async (p: { latitude: number; longitude: number }) => ({
    line1: 'Trg slobode 4',
    city: 'Novi Sad',
    location: p,
  })),
}));

const HOME: AddressDto = {
  id: 7,
  line1: 'Pešački prolaz Atina',
  city: 'Beograd',
  location: { latitude: 44.8125, longitude: 20.4612 },
};
const DEVICE = { latitude: 45.2551, longitude: 19.8452, loading: false, error: null };

describe('preferredWhere', () => {
  it('a service that comes to the pet defaults to the saved address, then the device', () => {
    expect(preferredWhere(ServiceProviderType.Walker, HOME, null)).toBe('account');
    expect(preferredWhere(ServiceProviderType.Sitter, null, HOME)).toBe('current');
    expect(preferredWhere(ServiceProviderType.Transporter, null, null)).toBe('none');
  });

  it("a service at the provider's premises defaults to the provider's place", () => {
    expect(preferredWhere(ServiceProviderType.Boarder, HOME, HOME)).toBe('none');
    expect(preferredWhere(ServiceProviderType.Groomer, HOME, HOME)).toBe('none');
  });

  it("before a type is chosen, the owner's own place leads", () => {
    expect(preferredWhere(null, HOME, null)).toBe('account');
  });
});

describe('useRequestPlace', () => {
  const setup = (type: number | null) =>
    renderHook<ReturnType<typeof useRequestPlace>, { t: number | null }>(
      ({ t }) => useRequestPlace(t, DEVICE),
      { initialProps: { t: type } }
    );

  it('follows the type until the owner chooses, then keeps their choice', async () => {
    const { result, rerender } = setup(ServiceProviderType.Walker);
    await waitFor(() => expect(result.current.currentPlaceState).toBe('ready'));
    expect(result.current.where).toBe('current');

    act(() => result.current.setAccountAddress(HOME));
    expect(result.current.where).toBe('account');

    rerender({ t: ServiceProviderType.Boarder });
    expect(result.current.where).toBe('none');

    act(() => result.current.choose('current'));
    rerender({ t: ServiceProviderType.Walker });
    expect(result.current.where).toBe('current'); // chosen, so the type no longer moves it
  });

  it('a pin dropped on the map sticks, though the picker closes in the same tick', async () => {
    const { result } = setup(ServiceProviderType.Walker);
    await waitFor(() => expect(result.current.currentPlaceState).toBe('ready'));

    act(() => result.current.choose('map'));
    expect(result.current.picker.visible).toBe(true);
    expect(result.current.needsMapPin).toBe(true);

    const pin: AddressDto = {
      line1: 'Knez Mihailova 1',
      city: 'Beograd',
      location: { latitude: 44.81, longitude: 20.45 },
    };
    act(() => {
      result.current.picker.onSelect(pin);
      result.current.picker.onClose(); // what the picker does on confirm
    });
    expect(result.current.where).toBe('map');
    expect(result.current.chosen).toEqual(pin);
    expect(result.current.picker.start).toEqual({ latitude: 44.81, longitude: 20.45 });
  });

  it('closing the map without a pin goes back to what was chosen before', async () => {
    const { result } = setup(ServiceProviderType.Walker);
    await waitFor(() => expect(result.current.currentPlaceState).toBe('ready'));
    act(() => result.current.choose('map'));
    act(() => result.current.picker.onClose());
    expect(result.current.where).toBe('current');
  });

  it('the map opens on the saved address rather than the device', async () => {
    const { result } = setup(ServiceProviderType.Walker);
    await waitFor(() => expect(result.current.currentPlaceState).toBe('ready'));
    act(() => result.current.setAccountAddress(HOME));
    expect(result.current.picker.start).toEqual({ latitude: 44.8125, longitude: 20.4612 });
  });

  it('a saved address is referenced; a place from the device is saved first', async () => {
    const { result } = setup(ServiceProviderType.Walker);
    await waitFor(() => expect(result.current.currentPlaceState).toBe('ready'));
    const save = jest.fn(async (a: AddressDto) => ({ ...a, id: 99 }));

    expect(await result.current.resolveAddressId(save)).toBe(99);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ city: 'Novi Sad', state: 'Novi Sad' })
    );

    act(() => result.current.setAccountAddress(HOME));
    save.mockClear();
    expect(await result.current.resolveAddressId(save)).toBe(7);
    expect(save).not.toHaveBeenCalled();
  });
});

describe('useProviderSelection', () => {
  const row = (id: number, providerId: number): ServiceSearchItem =>
    ({
      id,
      name: `Svc ${id}`,
      dto: { id, serviceProviderId: providerId },
    }) as unknown as ServiceSearchItem;
  const a1 = row(1, 10);
  const a2 = row(2, 10); // a second service of the same provider
  const b = row(3, 20);

  it('hand-picking counts providers, not services', () => {
    const { result } = renderHook(() => useProviderSelection(ServiceProviderType.Walker));
    act(() => result.current.toggle(a1));
    act(() => result.current.toggle(a2));
    act(() => result.current.toggle(b));
    expect(result.current.pickedProviderCount).toBe(2);
    expect(result.current.providers).toHaveLength(3);
    expect(result.current.excludedProviderIds).toEqual([]);
  });

  it('"every matching" ticks everyone; unticking a row leaves its whole provider out', () => {
    const { result } = renderHook(() => useProviderSelection(ServiceProviderType.Walker));
    act(() => result.current.toggleAnyMatching());
    expect([a1, a2, b].every(result.current.isTicked)).toBe(true);

    act(() => result.current.toggle(a1));
    expect(result.current.isTicked(a1)).toBe(false);
    expect(result.current.isTicked(a2)).toBe(false); // same provider
    expect(result.current.isTicked(b)).toBe(true);
    expect(result.current.excludedProviderIds).toEqual([10]);
    expect(result.current.providers).toEqual([]);

    act(() => result.current.toggle(a2)); // ticking any of their services brings them back
    expect(result.current.excludedProviderIds).toEqual([]);
  });

  it('turning "every matching" on starts from everyone again', () => {
    const { result } = renderHook(() => useProviderSelection(ServiceProviderType.Walker));
    act(() => result.current.toggleAnyMatching());
    act(() => result.current.toggle(b));
    act(() => result.current.toggleAnyMatching()); // off
    act(() => result.current.toggleAnyMatching()); // on again
    expect(result.current.excludedCount).toBe(0);
  });

  it('a new service type clears picks and exclusions', () => {
    const { result, rerender } = renderHook<
      ReturnType<typeof useProviderSelection>,
      { t: number | null }
    >(({ t }) => useProviderSelection(t), {
      initialProps: { t: ServiceProviderType.Walker as number },
    });
    act(() => result.current.toggle(a1));
    rerender({ t: ServiceProviderType.Groomer });
    expect(result.current.pickedProviderCount).toBe(0);
  });
});
