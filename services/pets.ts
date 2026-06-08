import { apiAuthFetch, getApiBaseUrl, parseApiError } from './http';
import { uploadFilesBulk } from './files';

// Backend sex enum: 0 = Unspecified, 1 = Male, 2 = Female
function mapSex(sex: string): number {
  if (sex === 'male') return 1;
  if (sex === 'female') return 2;
  return 0;
}

// Backend pet type enum: 1=Dog, 2=Cat, 3=Parrot, 4=Turtle, 5=Fish, 6=Snake
function mapPetType(type: string): number {
  switch (type.toLowerCase()) {
    case 'dog': return 1;
    case 'cat': return 2;
    case 'parrot': return 3;
    case 'turtle': return 4;
    case 'fish': return 5;
    case 'snake': return 6;
    default: return 1;
  }
}

// Backend file content type enum: 0=Unknown, 1=JPEG, 2=PNG, 3=WebP
function mapContentType(mimeType: string): number {
  switch (mimeType.toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
      return 1;
    case 'image/png':
      return 2;
    case 'image/webp':
      return 3;
    default:
      return 0;
  }
}

function formatDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function calcAgeYears(birthDate: Date): number {
  return Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

function toKg(value: string, unit: string): number {
  const n = parseFloat(value) || 0;
  return unit === 'lbs' ? Math.round(n * 0.453592 * 100) / 100 : n;
}

function toCm(value: string, unit: string): number {
  const n = parseFloat(value) || 0;
  return unit === 'in' ? Math.round(n * 2.54 * 100) / 100 : n;
}

export type PetResponse = {
  id: string;
  ownerUserId: number;
  name: string;
  type: string;
  petType: number;
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
  isActive: boolean;
  photos: Array<{
    id: number;
    name: string;
    src: string;
    alt: string;
    contentType: number;
    uploadedAt: string;
    fileUploadId: number;
    isSelected: boolean;
  }>;
};

export async function getPets(ownerUserId: number): Promise<PetResponse[]> {
  const url = `${getApiBaseUrl()}/api/pets?OwnerUserId=${ownerUserId}`;

  const response = await apiAuthFetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(await parseApiError(response, `Failed to load pets (${response.status}).`, 'getPets'));
  }

  const raw = await response.json();
  console.log('[getPets] response', JSON.stringify(raw));

  // Handle both plain array and paginated wrapper ({ items, data, results, ... })
  if (Array.isArray(raw)) return raw as PetResponse[];
  if (Array.isArray(raw?.items)) return raw.items as PetResponse[];
  if (Array.isArray(raw?.data)) return raw.data as PetResponse[];
  if (Array.isArray(raw?.results)) return raw.results as PetResponse[];

  console.warn('[getPets] unexpected response shape', raw);
  return [];
}

export type CreatePetInput = {
  ownerUserId: number;
  petName: string;
  petType: string;
  breed: string;
  sex: string;
  birthDate: Date | null;
  weight: string;
  weightUnit: string;
  height: string;
  heightUnit: string;
  dietaryNotes: string;
  favoriteFood: string;
  additionalNotes: string;
  petPhotos: Array<{ uri: string; fileName?: string }>;
};

export async function createPet(input: CreatePetInput): Promise<void> {
  const url = `${getApiBaseUrl()}/api/pets`;

  // Upload all photos in a single bulk request
  const uploadedPhotos = input.petPhotos.length
    ? await uploadFilesBulk(input.petPhotos.map(({ uri, fileName }) => ({ uri, fileName })))
    : [];

  const body = {
    ownerUserId: input.ownerUserId,
    name: input.petName,
    type: mapPetType(input.petType),
    breed: input.breed,
    sex: mapSex(input.sex),
    dateOfBirth: input.birthDate ? formatDateOnly(input.birthDate) : null,
    weightKg: toKg(input.weight, input.weightUnit),
    heightCm: toCm(input.height, input.heightUnit),
    dietaryNotes: input.dietaryNotes,
    favoriteFood: input.favoriteFood,
    additionalNotes: input.additionalNotes,
    photoUrl: uploadedPhotos[0]?.src ?? '',
    isActive: true,
    photos: uploadedPhotos.map((photo, index) => ({
      id: 0,
      alt: photo.originalName,
      name: photo.originalName,
      src: photo.src,
      contentType: mapContentType(photo.contentType),
      fileUploadId: photo.id,
      isSelected: index === 0,
    })),
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
      contentType: original?.contentType ?? 0,
      fileUploadId: original?.fileUploadId ?? 0,
      isSelected: original?.isSelected ?? false,
    };
  });

  const newPhotoEntries = uploadedPhotos.map((photo, index) => ({
    id: 0,
    alt: photo.originalName,
    name: photo.originalName,
    src: photo.src,
    contentType: mapContentType(photo.contentType),
    fileUploadId: photo.id,
    isSelected: index === 0,
  }));

  const allPhotos = [...existingPhotoEntries, ...newPhotoEntries];
  // Mark first photo as selected
  if (allPhotos.length > 0) allPhotos[0].isSelected = true;

  const firstSrc = allPhotos[0]?.src ?? '';

  const body = {
    ownerUserId: input.ownerUserId,
    name: input.petName,
    type: mapPetType(input.petType),
    breed: input.breed,
    sex: mapSex(input.sex),
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
