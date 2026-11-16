import { apiJson, apiList, apiVoid, getApiBaseUrl } from './http';
import { uploadFilesBulk } from './files';
import { formatDateOnly } from './date-only';

function toKg(value: string, unit: string): number {
  const n = parseFloat(value) || 0;
  return unit === 'lbs' ? Math.round(n * 0.453592 * 100) / 100 : n;
}

function toCm(value: string, unit: string): number {
  const n = parseFloat(value) || 0;
  return unit === 'in' ? Math.round(n * 2.54 * 100) / 100 : n;
}

// PetSpeciesType is a FLAGS enum (verified /enums): 0=None, 1=Dog, 2=Cat,
// 4=Parrot, 8=Turtle, 16=Fish, 32=Snake, 63=All. A pet carries a single flag;
// service.details.acceptedSpecies combines them bitwise.
export const PetSpecies = {
  Dog: 1,
  Cat: 2,
  Parrot: 4,
  Turtle: 8,
  Fish: 16,
  Snake: 32,
  All: 63,
} as const;

/**
 * Species the app does not offer for now: hidden from Add Pet, from a service's "pets this
 * service is for", from the search filter and from the species a service lists (product decision
 * 2026-10-15, app review G11). The API keeps the value, so nothing stored breaks; remove an entry
 * here to bring it back.
 */
const HIDDEN_SPECIES: readonly number[] = [PetSpecies.Fish];

/** Whether a species is offered in the app (see HIDDEN_SPECIES). */
export const isOfferedSpecies = (value: number): boolean => !HIDDEN_SPECIES.includes(value);

/**
 * Whether a service that takes `accepted` (FLAGS) can be booked for a pet of `petType`. Mirrors the
 * API's rule (Domain.PetSpeciesAcceptance): unknown on either side is not a refusal — a service
 * saved without species is unrestricted, and a pet whose species was never given can't be checked.
 */
export function speciesAccepted(
  accepted: number | null | undefined,
  petType: number | null | undefined
): boolean {
  if (!accepted || !petType) return true;
  return (accepted & petType) !== 0;
}

// Friendly label for a PetSpeciesType flag value
export function petTypeLabel(type: number): string {
  switch (type) {
    case PetSpecies.Dog:
      return 'Dog';
    case PetSpecies.Cat:
      return 'Cat';
    case PetSpecies.Parrot:
      return 'Parrot';
    case PetSpecies.Turtle:
      return 'Turtle';
    case PetSpecies.Fish:
      return 'Fish';
    case PetSpecies.Snake:
      return 'Snake';
    default:
      return '';
  }
}

// Friendly label for a pet's `sex` value (createPet maps male→1, female→2).
export function petSexLabel(sex: number): string {
  switch (sex) {
    case 1:
      return 'Male';
    case 2:
      return 'Female';
    default:
      return '';
  }
}

/**
 * A pet's age from its date of birth ("YYYY-MM-DD"): whole years and the months past them.
 * Null when the date is missing, malformed or in the future.
 */
export function petAge(
  dateOfBirth?: string | null,
  now: Date = new Date()
): { years: number; months: number } | null {
  if (!dateOfBirth) return null;
  const [y, m, d] = dateOfBirth.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  const months =
    (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m) - (now.getDate() < d ? 1 : 0);
  if (months < 0) return null;
  return { years: Math.floor(months / 12), months: months % 12 };
}

type PetFactsT = (key: any, params?: Record<string, string | number>) => string;
type PetFactsTEnum = (enumName: any, value: number | null | undefined, fallback?: string) => string;

/**
 * What a pet is, for the side that doesn't know it: species, breed, sex, age and weight, each
 * only when known. A partner reads this on a request before accepting it.
 */
export function petFacts(
  t: PetFactsT,
  tEnum: PetFactsTEnum,
  pet:
    | {
        type?: number | null;
        breed?: string | null;
        sex?: number | null;
        dateOfBirth?: string | null;
        weightKg?: number | null;
      }
    | null
    | undefined,
  now: Date = new Date()
): string[] {
  if (!pet) return [];
  const age = petAge(pet.dateOfBirth, now);
  return [
    pet.type ? tEnum('petSpeciesType', pet.type, '') : '',
    pet.breed?.trim() ?? '',
    pet.sex === 1 || pet.sex === 2 ? tEnum('sex', pet.sex, '') : '',
    age == null
      ? ''
      : age.years >= 1
        ? t(age.years === 1 ? 'liveSession.yearOne' : 'liveSession.yearsMany', { n: age.years })
        : t('pets.ageMonths', { n: Math.max(1, age.months) }),
    pet.weightKg ? `${pet.weightKg} kg` : '',
  ].filter(Boolean);
}

/** The owner's care notes on a pet, labelled, only the ones written. */
export function petCareNotes(
  t: PetFactsT,
  pet:
    | {
        dietaryNotes?: string | null;
        favoriteFood?: string | null;
        additionalNotes?: string | null;
      }
    | null
    | undefined
): { label: string; value: string }[] {
  if (!pet) return [];
  return [
    { label: t('liveSession.dietaryNotes'), value: pet.dietaryNotes?.trim() ?? '' },
    { label: t('liveSession.favoriteFood'), value: pet.favoriteFood?.trim() ?? '' },
    { label: t('liveSession.additionalNotes'), value: pet.additionalNotes?.trim() ?? '' },
  ].filter((note) => note.value);
}

export type PetResponse = {
  id: string;
  ownerUserId: number;
  name: string;
  // PetSpeciesType flag (see PetSpecies): 1=Dog, 2=Cat, 4=Parrot, 8=Turtle, 16=Fish, 32=Snake
  type: number;
  breed: string;
  sex: number;
  dateOfBirth: string | null;
  ageYears: number;
  weightKg: number;
  heightCm: number;
  dietaryNotes: string;
  favoriteFood: string;
  additionalNotes: string;
  photoUrl: string;
  hasSpecialNeeds?: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  // Populated on GET (read-only include)
  ownerUser?: { id: number; userName: string; email: string } | null;
  photos: {
    id: number;
    name: string;
    src: string;
    alt: string;
    uploadedAt: string;
    fileUploadId: number | null;
    isSelected: boolean;
  }[];
};

export async function getPets(ownerUserId: number): Promise<PetResponse[]> {
  return apiList<PetResponse>('/api/pets', {
    query: { OwnerUserId: ownerUserId },
    fallback: 'Failed to load pets.',
    context: 'getPets',
  });
}

/**
 * Fetches a single pet with its full detail set. The booking GET only embeds a
 * shallow pet include (name/photos/id), so screens that need breed/age/weight/
 * notes (e.g. LiveSession) fetch the pet by id here.
 */
export function getPet(petId: string | number): Promise<PetResponse> {
  return apiJson<PetResponse>(`/api/pets/${petId}`, {
    fallback: 'Failed to load pet.',
    context: 'getPet',
  });
}

export type CreatePetInput = {
  ownerUserId: number;
  petName: string;
  // PetSpeciesType flag (see PetSpecies)
  petType: number;
  breed: string;
  sex: number;
  birthDate: Date | null;
  weight: string;
  weightUnit: string;
  height: string;
  heightUnit: string;
  dietaryNotes: string;
  favoriteFood: string;
  additionalNotes: string;
  // `isSelected` marks the profile photo (the one the user picked as main).
  petPhotos: { uri: string; fileName?: string; isSelected?: boolean }[];
};

export async function createPet(input: CreatePetInput): Promise<void> {
  // The API requires at least one photo (422 "'Request Photos' must not be empty." otherwise)
  if (!input.petPhotos.length) {
    throw new Error('At least one pet photo is required.');
  }

  // Upload all photos in a single bulk request
  const uploadedPhotos = input.petPhotos.length
    ? await uploadFilesBulk(input.petPhotos.map(({ uri, fileName }) => ({ uri, fileName })))
    : [];

  // uploadedPhotos[i] corresponds to input.petPhotos[i] — carry the picked
  // profile photo through as isSelected (defaulting to the first if none picked).
  const photos = uploadedPhotos.map((photo, index) => ({
    id: 0,
    alt: photo.originalName,
    name: photo.originalName,
    src: photo.src,
    fileUploadId: photo.id,
    isSelected: !!input.petPhotos[index]?.isSelected,
  }));
  if (photos.length && !photos.some((p) => p.isSelected)) photos[0].isSelected = true;
  const selectedSrc = (photos.find((p) => p.isSelected) ?? photos[0])?.src ?? '';

  const body = {
    ownerUserId: input.ownerUserId,
    name: input.petName,
    type: input.petType,
    breed: input.breed,
    sex: input.sex,
    dateOfBirth: input.birthDate ? formatDateOnly(input.birthDate) : null,
    weightKg: toKg(input.weight, input.weightUnit),
    heightCm: toCm(input.height, input.heightUnit),
    dietaryNotes: input.dietaryNotes,
    favoriteFood: input.favoriteFood,
    additionalNotes: input.additionalNotes,
    photoUrl: selectedSrc,
    isActive: true,
    photos,
  };

  await apiVoid('/api/pets', {
    method: 'POST',
    body,
    fallback: 'Failed to save pet.',
    context: 'createPet',
  });
}

export type UpdatePetInput = CreatePetInput & {
  petId: string;
  originalPhotos?: PetResponse['photos'];
};

export async function updatePet(input: UpdatePetInput): Promise<void> {
  const base = getApiBaseUrl();

  // Strip the app base URL from a resolved URI to get the relative path the backend stores
  const toRelative = (uri: string) => (uri.startsWith(base) ? uri.slice(base.length) : uri);

  // Separate already-uploaded photos (HTTP URLs) from new local photos
  const existingPhotos = input.petPhotos.filter(
    ({ uri }) => uri.startsWith('http://') || uri.startsWith('https://')
  );
  const newPhotos = input.petPhotos.filter(
    ({ uri }) => !uri.startsWith('http://') && !uri.startsWith('https://')
  );

  const uploadedPhotos = newPhotos.length
    ? await uploadFilesBulk(newPhotos.map(({ uri, fileName }) => ({ uri, fileName })))
    : [];

  const existingPhotoEntries = existingPhotos.map((p) => {
    const relativeSrc = toRelative(p.uri);
    const original = input.originalPhotos?.find((op) => op.src === relativeSrc);
    return {
      id: original?.id ?? 0,
      alt: original?.alt ?? '',
      name: original?.name ?? '',
      src: relativeSrc,
      fileUploadId: original?.fileUploadId ?? 0,
      isSelected: !!p.isSelected,
    };
  });

  const newPhotoEntries = uploadedPhotos.map((photo, index) => ({
    id: 0,
    alt: photo.originalName,
    name: photo.originalName,
    src: photo.src,
    fileUploadId: photo.id,
    isSelected: !!newPhotos[index]?.isSelected,
  }));

  const allPhotos = [...existingPhotoEntries, ...newPhotoEntries];

  // The API requires at least one photo (422 "'Request Photos' must not be empty." otherwise)
  if (allPhotos.length === 0) {
    throw new Error('At least one pet photo is required.');
  }

  // Keep the user's picked profile photo (default to the first if none).
  if (!allPhotos.some((p) => p.isSelected)) allPhotos[0].isSelected = true;
  const firstSrc = (allPhotos.find((p) => p.isSelected) ?? allPhotos[0])?.src ?? '';

  const body = {
    ownerUserId: input.ownerUserId,
    name: input.petName,
    type: input.petType,
    breed: input.breed,
    sex: input.sex,
    dateOfBirth: input.birthDate ? formatDateOnly(input.birthDate) : null,
    weightKg: toKg(input.weight, input.weightUnit),
    heightCm: toCm(input.height, input.heightUnit),
    dietaryNotes: input.dietaryNotes,
    favoriteFood: input.favoriteFood,
    additionalNotes: input.additionalNotes,
    photoUrl: firstSrc,
    isActive: true,
    photos: allPhotos,
  };

  await apiVoid(`/api/pets/${input.petId}`, {
    method: 'PUT',
    body,
    fallback: 'Failed to save pet.',
    context: 'updatePet',
  });
}

export function deletePet(petId: string): Promise<void> {
  return apiVoid(`/api/pets/${petId}`, {
    method: 'DELETE',
    fallback: 'Failed to delete pet.',
    context: 'deletePet',
  });
}
