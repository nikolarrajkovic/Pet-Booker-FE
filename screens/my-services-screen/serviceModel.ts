// Maps between the rich MyServices/AddEditService UI shape and the minimal
// ServiceDto the API supports. UI features with no backend support are mocked
// here and documented in BACKEND_GAPS.md (search for BACKEND-GAP tags).
import { ServiceDto } from '../../services/services';
import { resolveImageUrl } from '../../services/service-providers';

export interface PricingTier {
  duration: string;
  price: string;
}

export interface AdditionalServiceEntry {
  name: string;
  price: string;
  enabled: boolean;
}

export interface WorkingHours {
  [day: string]: { enabled: boolean; startTime: string; endTime: string };
}

export interface UiService {
  id: string;
  serviceProviderId: number;
  type: string;
  name: string;
  description: string;
  rating: number;
  reviews: number;
  bookings: number;
  images: string[];
  pricingTiers: PricingTier[];
  additionalServices: AdditionalServiceEntry[];
  workingHours: WorkingHours;
}

export const DEFAULT_WORKING_HOURS: WorkingHours = {
  Monday: { enabled: true, startTime: '08:00 AM', endTime: '06:00 PM' },
  Tuesday: { enabled: true, startTime: '08:00 AM', endTime: '06:00 PM' },
  Wednesday: { enabled: true, startTime: '08:00 AM', endTime: '06:00 PM' },
  Thursday: { enabled: true, startTime: '08:00 AM', endTime: '06:00 PM' },
  Friday: { enabled: true, startTime: '08:00 AM', endTime: '06:00 PM' },
  Saturday: { enabled: true, startTime: '08:00 AM', endTime: '06:00 PM' },
  Sunday: { enabled: false, startTime: '08:00 AM', endTime: '06:00 PM' },
};

// The two add-ons the API can persist (via service.details), plus mock-only extras.
export const PICKUP = 'Pickup';
export const DROPOFF = 'Drop-off';
export const ALL_ADDITIONAL_SERVICE_NAMES = [
  PICKUP,        // → details.supportsPickup / pickupPriceSurcharge
  DROPOFF,       // → details.supportsLeaveOver / leaveOverPriceSurcharge
  'Photo Updates',          // BACKEND-GAP S3 (mock only)
  'Medication Administration', // BACKEND-GAP S3 (mock only)
  'Special Needs Care',     // BACKEND-GAP S3 (mock only)
];

/** ServiceDto (GET) → rich UI shape for cards and the edit form. */
export function serviceDtoToUi(dto: ServiceDto): UiService {
  const price = String(dto.price ?? dto.basePrice ?? 0);
  return {
    id: String(dto.id ?? 0),
    serviceProviderId: dto.serviceProviderId,
    type: dto.basicServiceName ?? '', // BACKEND-GAP S4: read-only, derived
    name: dto.name ?? '',
    description: dto.about ?? dto.notes ?? '',
    rating: dto.rating ?? 0,
    reviews: dto.totalRatingNumber ?? 0,
    bookings: 0, // BACKEND-GAP S5: not exposed per service
    images: (dto.photos ?? []).map((p) => resolveImageUrl(p.src)).filter(Boolean),
    // BACKEND-GAP S1: API has a single basePrice, not duration tiers
    pricingTiers: [{ duration: 'Standard', price }],
    additionalServices: [
      { name: PICKUP, price: String(dto.details?.pickupPriceSurcharge ?? 0), enabled: !!dto.details?.supportsPickup },
      { name: DROPOFF, price: String(dto.details?.leaveOverPriceSurcharge ?? 0), enabled: !!dto.details?.supportsLeaveOver },
    ],
    workingHours: DEFAULT_WORKING_HOURS, // BACKEND-GAP S2: not stored server-side
  };
}

export type ServiceFormInput = {
  serviceProviderId: number;
  id?: number;
  serviceName: string;
  description: string;
  pricingTiers: PricingTier[];
  additionalServices: { name: string; price: string; expanded: boolean }[];
  // photos preserved from the original DTO (no image picker wired yet)
  existingPhotos?: ServiceDto['photos'];
};

/** Rich form state → ServiceDto for create/update. Only API-backed fields persist. */
export function uiToServiceDto(form: ServiceFormInput): ServiceDto {
  const findAddon = (name: string) => form.additionalServices.find((a) => a.name === name);
  const pickup = findAddon(PICKUP);
  const dropoff = findAddon(DROPOFF);
  // BACKEND-GAP S1: only the first tier's price maps to basePrice
  const basePrice = parseFloat(form.pricingTiers[0]?.price) || 0;

  return {
    id: form.id ?? 0,
    serviceProviderId: form.serviceProviderId,
    name: form.serviceName,
    notes: form.description,
    basePrice,
    escrowAmount: 0,
    isEscrowPercentEnabled: false,
    details: {
      supportsPickup: !!pickup?.expanded,
      pickupPriceSurcharge: pickup?.expanded ? parseFloat(pickup.price) || 0 : undefined,
      supportsLeaveOver: !!dropoff?.expanded,
      leaveOverPriceSurcharge: dropoff?.expanded ? parseFloat(dropoff.price) || 0 : undefined,
    },
    photos: form.existingPhotos ?? [],
  };
}
