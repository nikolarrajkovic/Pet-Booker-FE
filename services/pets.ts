import { apiAuthFetch, getApiBaseUrl, parseApiError, extractPageItems } from './http';
import { uploadFilesBulk } from './files';

function formatDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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

// Friendly label for a PetSpeciesType flag value
export function petTypeLabel(type: number): string {
  switch (type) {
    case PetSpecies.Dog: return 'Dog';
    case PetSpecies.Cat: return 'Cat';
    case PetSpecies.Parrot: return 'Parrot';
    case PetSpecies.Turtle: return 'Turtle';
    case PetSpecies.Fish: return 'Fish';
    case PetSpecies.Snake: return 'Snake';
    default: return '';
  }
}

// Friendly label for a pet's `sex` value (createPet maps male→1, female→2).
export function petSexLabel(sex: number): string {
  switch (sex) {
    case 1: return 'Male';
    case 2: return 'Female';
    default: return '';
  }
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
  const url = `${getApiBaseUrl()}/api/pets?OwnerUserId=${ownerUserId}`;

  const response = await apiAuthFetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(await parseApiError(response, `Failed to load pets (${response.status}).`, 'getPets'));
  }

  const raw = await response.json();
  const items = extractPageItems<PetResponse>(raw);
  if (!items.length && !Array.isArray(raw)) {
    console.warn('[getPets] unexpected response shape', raw);
  }
  return items;
}

/**
 * Fetches a single pet with its full detail set. The booking GET only embeds a
 * shallow pet include (name/photos/id), so screens that need breed/age/weight/
 * notes (e.g. LiveSession) fetch the pet by id here.
 */
export async function getPet(petId: string | number): Promise<PetResponse> {
  const url = `${getApiBaseUrl()}/api/pets/${petId}`;

  const response = await apiAuthFetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to load pet.', 'getPet'));
  }

  return response.json();
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
  const url = `${getApiBaseUrl()}/api/pets`;

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

  console.log('[createPet] body', JSON.stringify(body, null, 2));

  const response = await apiAuthFetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, `Failed to save pet (${response.status}).`, 'createPet'));
  }
}

export type UpdatePetInput = CreatePetInput & {
  petId: string;
  originalPhotos?: PetResponse['photos'];
};

export async function updatePet(input: UpdatePetInput): Promise<void> {
  const base = getApiBaseUrl();
  const url = `${base}/api/pets/${input.petId}`;

  // Strip the app base URL from a resolved URI to get the relative path the backend stores
  const toRelative = (uri: string) =>
    uri.startsWith(base) ? uri.slice(base.length) : uri;

  // Separate already-uploaded photos (HTTP URLs) from new local photos
  const existingPhotos = input.petPhotos.filter(({ uri }) =>
    uri.startsWith('http://') || uri.startsWith('https://')
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

  console.log('[updatePet] body', JSON.stringify(body, null, 2));

  const response = await apiAuthFetch(url, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to save pet.', 'updatePet'));
  }
}

export async function deletePet(petId: string): Promise<void> {
  const url = `${getApiBaseUrl()}/api/pets/${petId}`;

  const response = await apiAuthFetch(url, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to delete pet.', 'deletePet'));
  }
}
