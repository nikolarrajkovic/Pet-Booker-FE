import type { PetResponse } from '../../services/pets';
import { resolveImageUrl } from '../../services/service-providers';

/**
 * What the pet form starts from when it edits a pet: the stored values, held the way the form's
 * fields hold them (weight and height as text, the type and sex as their enum numbers).
 */
export type PetFormValues = {
  id: string;
  name: string;
  petTypeNum?: number;
  sexNum?: number;
  breed: string;
  dateOfBirth?: string;
  weight: string;
  height: string;
  dietaryNotes?: string;
  favoriteFood?: string;
  additionalNotes?: string;
  /** The profile photo, used only when the pet has no gallery. */
  image: string | null;
  photos?: PetResponse['photos'];
};

/**
 * A pet as the API returns it → the form's starting values. One mapping for both ways into Edit
 * Pet: My Pets hands it over in memory, and `/pets/{id}/edit` loads the pet and maps it here.
 */
export function toPetFormValues(pet: PetResponse): PetFormValues {
  return {
    id: String(pet.id),
    name: pet.name ?? '',
    petTypeNum: pet.type,
    sexNum: pet.sex,
    breed: pet.breed ?? '',
    dateOfBirth: pet.dateOfBirth ?? undefined,
    weight: pet.weightKg ? String(pet.weightKg) : '',
    height: pet.heightCm ? String(pet.heightCm) : '',
    dietaryNotes: pet.dietaryNotes ?? '',
    favoriteFood: pet.favoriteFood ?? '',
    additionalNotes: pet.additionalNotes ?? '',
    image: resolveImageUrl(pet.photoUrl) || null,
    photos: pet.photos,
  };
}
