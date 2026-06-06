import { apiAuthFetch } from './http';
import { uploadFilesBulk } from './files';

function getApiBaseUrl() {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not set.');
  }
  return baseUrl.replace(/\/$/, '');
}

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
    id: string;
    name: string;
    src: string;
    alt: string;
    contentType: number;
    uploadedAt: string;
  }>;
};

export async function getPets(ownerUserId: number): Promise<PetResponse[]> {
  const url = `${getApiBaseUrl()}/api/pets?OwnerUserId=${ownerUserId}`;

  const response = await apiAuthFetch(url, { method: 'GET' });

  if (!response.ok) {
    const text = await response.text();
    let message = `Failed to load pets (${response.status}).`;
    try {
      const json = JSON.parse(text);
      message = json.message ?? json.detail ?? json.title ?? text ?? message;
    } catch {
      if (text) message = text;
    }
    console.error('[getPets] error', response.status, text);
    throw new Error(message);
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
    const text = await response.text();
    let message = `Failed to save pet (${response.status}).`;
    try {
      const json = JSON.parse(text);
      if (json.errors) {
        // ASP.NET validation errors: { errors: { Field: ["msg"] } }
        const fields = Object.entries(json.errors as Record<string, string[]>)
          .map(([field, msgs]) => `${field}: ${msgs.join(', ')}`)
          .join(' | ');
        message = fields || json.title || message;
      } else {
        message = json.message ?? json.detail ?? json.title ?? text ?? message;
      }
    } catch {
      if (text) message = text;
    }
    console.error('[createPet] error', response.status, text);
    throw new Error(message);
  }
}
