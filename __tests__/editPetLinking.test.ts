import { getPathFromState, getStateFromPath } from '@react-navigation/native';
import { linking } from '../navigation/linking';
import { toPetFormValues } from '../screens/add-pet-screen/petForm';
import type { PetResponse } from '../services/pets';

const pet = {
  id: '7',
  ownerUserId: 3,
  name: 'Bobi',
  type: 1,
  breed: 'Beagle',
  sex: 1,
  dateOfBirth: '2021-05-01',
  ageYears: 5,
  weightKg: 4.5,
  heightCm: 0,
  dietaryNotes: 'No chicken',
  favoriteFood: '',
  additionalNotes: '',
  photoUrl: '/files/bobi.png',
  isActive: true,
  photos: [],
} as unknown as PetResponse;

// Edit Pet used to be AddPet with the whole pet as a param: the address bar read
// `/pets/new?pet=%5Bobject%20Object%5D`, and a reload handed the form that string — an empty form.
describe('Edit Pet URL', () => {
  const config = linking.config as any;

  it('is /pets/{id}/edit, with the pet values kept out of the query string', () => {
    const path = getPathFromState(
      { routes: [{ name: 'EditPet', params: { petId: pet.id, pet: toPetFormValues(pet) } }] } as any,
      config
    );
    expect(path).toBe('/pets/7/edit');
  });

  it('parses back to the id the screen loads the pet by', () => {
    const state = getStateFromPath('/pets/7/edit', config) as any;
    const route = state.routes[state.routes.length - 1];
    expect(route.name).toBe('EditPet');
    expect(route.params).toEqual({ petId: 7 });
  });

  it('leaves Add Pet at /pets/new', () => {
    const state = getStateFromPath('/pets/new', config) as any;
    expect(state.routes[state.routes.length - 1].name).toBe('AddPet');
  });
});

describe('toPetFormValues', () => {
  it('holds the stored values the way the form fields do', () => {
    const values = toPetFormValues(pet);
    expect(values).toMatchObject({
      id: '7',
      name: 'Bobi',
      petTypeNum: 1,
      sexNum: 1,
      breed: 'Beagle',
      dateOfBirth: '2021-05-01',
      weight: '4.5',
      // 0 is "not given", as the form shows it: an empty field, not "0".
      height: '',
      dietaryNotes: 'No chicken',
    });
    expect(values.image).toMatch(/\/files\/bobi\.png$/);
  });
});
