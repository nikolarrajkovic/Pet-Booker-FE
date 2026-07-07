// Maps between the rich MyServices/AddEditService UI shape and the minimal
// ServiceDto the API supports. UI features with no backend support are mocked
// here and documented in BACKEND_GAPS.md (search for BACKEND-GAP tags).
import { ServiceDto, ServiceScheduleDto, ServicePricingOptionDto } from '../../services/services';
import {
  resolveImageUrl,
  providerTypeLabel,
  providerTypeValue,
} from '../../services/service-providers';
import { uploadFilesBulk } from '../../services/files';
import { getApiBaseUrl } from '../../services/http';
import { SERVICE_ADDON_DEFS } from '../../services/service-addons';

export interface PricingTier {
  // The persisted ServicePricingOption id (edit mode) — undefined for a tier
  // the user just added; used by saveServicePricingOptions to diff POST/PUT/DELETE.
  id?: number | null;
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
  maxConcurrentBookings: number; // "Maximum pet capacity" — details.maxConcurrentBookings
  images: string[];
  selectedImageIndex: number; // index in `images` of the profile (isSelected) photo
  pricingTiers: PricingTier[];
  additionalServices: AdditionalServiceEntry[];
  workingHours: WorkingHours;
}

export const DEFAULT_WORKING_HOURS: WorkingHours = {
  Monday: { enabled: true, startTime: '08:00', endTime: '18:00' },
  Tuesday: { enabled: true, startTime: '08:00', endTime: '18:00' },
  Wednesday: { enabled: true, startTime: '08:00', endTime: '18:00' },
  Thursday: { enabled: true, startTime: '08:00', endTime: '18:00' },
  Friday: { enabled: true, startTime: '08:00', endTime: '18:00' },
  Saturday: { enabled: true, startTime: '08:00', endTime: '18:00' },
  Sunday: { enabled: false, startTime: '08:00', endTime: '18:00' },
};

// The add-on catalog (names + DTO read/write mapping) is the single source of
// truth in services/service-addons.ts. Re-export the name list for convenience.
export { ALL_ADDITIONAL_SERVICE_NAMES } from '../../services/service-addons';

// --- Pricing tiers <-> service pricing options ----------------------------
// The form keeps tiers as { duration label, price string }; the API stores them
// as ServicePricingOption rows (name + durationMinutes + price) managed via
// /api/service-pricing-options. A tier's duration label doubles as the option
// name. Single source of truth for the duration dropdown (AddEditServiceScreen
// imports DURATION_OPTION_LABELS from here).
const DURATION_LABEL_MINUTES: Record<string, number> = {
  '30 minutes': 30,
  '1 hour': 60,
  '1.5 hours': 90,
  '2 hours': 120,
  '3 hours': 180,
  '4 hours': 240,
  'Full day': 480,
  Overnight: 720,
};

export const DURATION_OPTION_LABELS = Object.keys(DURATION_LABEL_MINUTES);

/** 60 → "1 hour"; unmapped values (options created via the API) → "{n} min". */
export function minutesToDurationLabel(minutes: number): string {
  const match = Object.entries(DURATION_LABEL_MINUTES).find(([, m]) => m === minutes);
  return match ? match[0] : `${minutes} min`;
}

/** "1 hour" → 60; also decodes the "{n} min" fallback; unknown labels → null. */
export function durationLabelToMinutes(label: string): number | null {
  const mapped = DURATION_LABEL_MINUTES[label];
  if (mapped != null) return mapped;
  const parsed = parseInt(label, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * The form's pricing tiers → ServicePricingOption rows to persist. Only tiers
 * with a resolvable duration AND a parseable price become options — so a lone
 * duration-less tier stays a classic basePrice-only service (no options, free-
 * range booking). Persist the result with saveServicePricingOptions().
 */
export function pricingTiersToOptions(
  tiers: PricingTier[],
  serviceId: number
): ServicePricingOptionDto[] {
  const out: ServicePricingOptionDto[] = [];
  for (const tier of tiers) {
    const durationMinutes = tier.duration ? durationLabelToMinutes(tier.duration) : null;
    const price = parseFloat(tier.price);
    if (durationMinutes == null || !Number.isFinite(price)) continue;
    out.push({
      id: tier.id ?? undefined,
      serviceId,
      name: tier.duration,
      durationMinutes,
      price,
    });
  }
  return out;
}

// --- Working hours <-> service schedules ---------------------------------
// The form keeps hours per day name with 24h display times ("HH:mm"); the API
// stores them as ServiceScheduleDto rows keyed by .NET DayOfWeek (Sun=0…Sat=6)
// with "HH:mm:ss" times. These helpers translate between the two (see services/
// service-schedules.ts for the CRUD that persists the result).
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const UI_DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** "08:00" | "18:30" → "HH:mm:ss" (the API's time format). Also tolerates a
 *  legacy 12h "08:00 AM" suffix for safety. 24:00 (end of day) can't be stored
 *  as a TimeOnly, so it maps to the 23:59:59 sentinel (decoded back by hmsToUiTime). */
function uiTimeToHms(display: string): string {
  const [time, period] = display.trim().split(/\s+/);
  const [hStr, mStr] = (time ?? '').split(':');
  let h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  const p = (period ?? '').toUpperCase();
  if (p === 'PM' && h !== 12) h += 12;
  else if (p === 'AM' && h === 12) h = 0;
  if (h >= 24) return '23:59:59'; // 24:00 → TimeOnly-safe end-of-day sentinel
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

/** "17:00:00" → "17:00" (the form's 24h display format). The 23:59:59 end-of-day
 *  sentinel decodes back to "24:00". */
function hmsToUiTime(hms: string): string {
  const [hStr, mStr, sStr] = (hms ?? '').split(':');
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  const s = parseInt(sStr, 10) || 0;
  if (h === 23 && m === 59 && s === 59) return '24:00';
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Service schedules (embedded on the service GET) → the form's WorkingHours. */
export function schedulesToWorkingHours(schedules?: ServiceScheduleDto[] | null): WorkingHours {
  const hours: WorkingHours = {};
  // Disabled-by-default in UI order so unset days render Mon→Sun, off.
  for (const day of UI_DAY_ORDER) {
    hours[day] = { enabled: false, startTime: '09:00', endTime: '17:00' };
  }
  for (const s of schedules ?? []) {
    const name = DAY_NAMES[s.day];
    if (name && hours[name]) {
      hours[name] = { enabled: true, startTime: hmsToUiTime(s.from), endTime: hmsToUiTime(s.to) };
    }
  }
  return hours;
}

/** The form's WorkingHours → ServiceScheduleDto[] (enabled days only). */
export function workingHoursToSchedules(
  workingHours: WorkingHours,
  serviceId: number
): ServiceScheduleDto[] {
  const out: ServiceScheduleDto[] = [];
  for (const [name, h] of Object.entries(workingHours)) {
    if (!h.enabled) continue;
    const day = DAY_NAMES.indexOf(name);
    if (day < 0) continue;
    out.push({ serviceId, day, from: uiTimeToHms(h.startTime), to: uiTimeToHms(h.endTime) });
  }
  return out;
}

/** ServiceDto (GET) → rich UI shape for cards and the edit form. */
export function serviceDtoToUi(dto: ServiceDto): UiService {
  const price = String(dto.price ?? dto.pricing?.basePrice ?? 0);
  // Resolve photos once so the profile (isSelected) index lines up with `images`.
  const photoList = (dto.photos ?? [])
    .map((p) => ({ uri: resolveImageUrl(p.src), isSelected: !!p.isSelected }))
    .filter((p) => p.uri);
  return {
    id: String(dto.id ?? 0),
    serviceProviderId: dto.serviceProviderId,
    // Prefill the dropdown from the numeric `type` enum so the selected label
    // round-trips back to the same value on save; fall back to the derived name.
    type: dto.type != null ? providerTypeLabel(dto.type) : (dto.basicServiceName ?? ''),
    name: dto.name ?? '',
    description: dto.description ?? dto.about ?? '',
    rating: dto.rating ?? 0,
    reviews: dto.totalRatingNumber ?? 0,
    bookings: 0, // BACKEND-GAP S5: not exposed per service
    maxConcurrentBookings: dto.details?.maxConcurrentBookings ?? 1,
    images: photoList.map((p) => p.uri),
    selectedImageIndex: Math.max(
      0,
      photoList.findIndex((p) => p.isSelected)
    ),
    // Real duration/price tiers from the service's pricing options (S1 now
    // wired); an option-less service keeps the single price-only tier.
    pricingTiers: dto.pricingOptions?.length
      ? dto.pricingOptions.map((o) => ({
          id: o.id,
          duration: minutesToDurationLabel(o.durationMinutes),
          price: String(o.price),
        }))
      : [{ duration: 'Standard', price }],
    // Prefill every catalog add-on from the DTO; not-yet-persisted ones read back
    // as disabled/0 until the backend supports them (see services/service-addons.ts).
    additionalServices: SERVICE_ADDON_DEFS.map((def) => {
      const r = def.read(dto);
      return { name: def.name, price: String(r?.price ?? 0), enabled: !!r?.enabled };
    }),
    // Real per-day working hours from the service's schedules (S2 now wired).
    workingHours: schedulesToWorkingHours(dto.schedules),
  };
}

export type ServiceImageInput = { uri: string; fileName?: string; isSelected?: boolean };

/**
 * Builds the `photos` array for a service POST/PUT from the form's image list.
 * Already-uploaded images (http/https URIs) keep their original metadata from
 * the service DTO; new local images are bulk-uploaded first and mapped from the
 * upload response. Mirrors the pet photo convention in services/pets.ts.
 */
export async function buildServicePhotos(
  images: ServiceImageInput[],
  originalPhotos?: ServiceDto['photos']
): Promise<NonNullable<ServiceDto['photos']>> {
  const base = getApiBaseUrl();
  // Strip the app base URL from a resolved URI to get the relative path the backend stores
  const toRelative = (uri: string) => (uri.startsWith(base) ? uri.slice(base.length) : uri);
  const isRemote = ({ uri }: ServiceImageInput) =>
    uri.startsWith('http://') || uri.startsWith('https://');

  const existingImages = images.filter(isRemote);
  const newImages = images.filter((img) => !isRemote(img));

  // Only hit the upload endpoint when the user actually picked new photos;
  // otherwise we just re-send the existing photo metadata with the update.
  let uploaded: Awaited<ReturnType<typeof uploadFilesBulk>> = [];
  if (newImages.length) {
    if (__DEV__)
      console.log(`[buildServicePhotos] uploading ${newImages.length} new photo(s) before save`);
    uploaded = await uploadFilesBulk(newImages.map(({ uri, fileName }) => ({ uri, fileName })));
  } else if (__DEV__) {
    console.log('[buildServicePhotos] no new photos — skipping bulk upload');
  }

  const existingEntries = existingImages.map((img) => {
    const relativeSrc = toRelative(img.uri);
    const original = originalPhotos?.find((p) => p.src === relativeSrc);
    return {
      id: original?.id ?? 0,
      alt: original?.alt ?? '',
      name: original?.name ?? '',
      src: relativeSrc,
      fileUploadId: original?.fileUploadId ?? 0,
      // Honor the user's picked profile photo (carried on the input).
      isSelected: !!img.isSelected,
    };
  });

  // uploaded[i] corresponds to newImages[i] — carry its isSelected flag through.
  const newEntries = uploaded.map((photo, i) => ({
    id: 0,
    alt: photo.originalName,
    name: photo.originalName,
    src: photo.src,
    fileUploadId: Number(photo.id) || 0,
    isSelected: !!newImages[i]?.isSelected,
  }));

  const all = [...existingEntries, ...newEntries];
  // Exactly one selected: default the first if none, drop extras if multiple.
  if (all.length > 0 && !all.some((p) => p.isSelected)) all[0].isSelected = true;
  let seenSelected = false;
  for (const p of all) {
    if (p.isSelected) {
      if (seenSelected) p.isSelected = false;
      else seenSelected = true;
    }
  }
  return all;
}

export type ServiceFormInput = {
  serviceProviderId: number;
  id?: number;
  serviceType: string; // friendly label from the Service Type dropdown
  serviceName: string;
  description: string;
  pricingTiers: PricingTier[];
  maxPetCapacity?: number; // → details.maxConcurrentBookings
  additionalServices: { name: string; price: string; expanded: boolean }[];
  // Ready-to-send photos array — build with buildServicePhotos()
  photos?: ServiceDto['photos'];
};

/**
 * Rich form state → ServiceDto for create/update. Only API-backed fields persist.
 * Pass the original DTO in edit mode: details/pricing fields the form doesn't
 * capture (acceptedSpecies, weight/duration limits, capacity, escrow, unit) are
 * non-nullable server-side and would reset to 0/None if omitted from a PUT.
 */
export function uiToServiceDto(form: ServiceFormInput, original?: ServiceDto): ServiceDto {
  // basePrice = the cheapest tier. Duration tiers persist separately as pricing
  // options (pricingTiersToOptions + saveServicePricingOptions); basePrice keeps
  // the lean Home-rail DTO (which has no pricingOptions) showing a correct
  // "from" price.
  const tierPrices = form.pricingTiers
    .map((t) => parseFloat(t.price))
    .filter((p) => Number.isFinite(p));
  const basePrice = tierPrices.length ? Math.min(...tierPrices) : 0;

  const details: NonNullable<ServiceDto['details']> = {
    ...original?.details,
    // Add-on on/off flags — seeded here, then set per-add-on by the loop below.
    isPickupProvided: original?.details?.isPickupProvided ?? false,
    isPetReturnProvided: original?.details?.isPetReturnProvided ?? false,
    isSpecialNeedsProvided: original?.details?.isSpecialNeedsProvided ?? false,
    // Non-nullable booleans with no UI yet — round-trip from the original so a
    // PUT doesn't reset them (default false on create).
    canSpecialNeedsChange: original?.details?.canSpecialNeedsChange ?? false,
    supportsLiveTracking: original?.details?.supportsLiveTracking ?? false,
    // FLAGS: 63 = all species accepted; new services default to accepting all
    acceptedSpecies: original?.details?.acceptedSpecies ?? 63,
    maxConcurrentBookings: form.maxPetCapacity ?? original?.details?.maxConcurrentBookings ?? 1,
  };

  // Surcharge money lives under `pricing` now. Seed each surcharge from the
  // original so an add-on's write() can preserve its per-km/distance config;
  // the loop below sets/clears each one based on the form.
  const pricing: NonNullable<ServiceDto['pricing']> = {
    basePrice,
    unit: original?.pricing?.unit ?? 0,
    isEscrowPercentEnabled: original?.pricing?.isEscrowPercentEnabled ?? false,
    escrowPercent: original?.pricing?.escrowPercent ?? null,
    escrowAmount: original?.pricing?.escrowAmount ?? 0,
    pickupPrice: original?.pricing?.pickupPrice ?? null,
    petReturnPrice: original?.pricing?.petReturnPrice ?? null,
    specialNeedsPrice: original?.pricing?.specialNeedsPrice ?? null,
  };

  // Persist each add-on via the catalog: on/off flag → details, surcharge money
  // → pricing. A single draft carries both so each write() targets the right one.
  for (const def of SERVICE_ADDON_DEFS) {
    const entry = form.additionalServices.find((a) => a.name === def.name);
    def.write({ details, pricing }, !!entry?.expanded, parseFloat(entry?.price ?? '') || 0);
  }

  return {
    id: form.id ?? 0,
    serviceProviderId: form.serviceProviderId,
    name: form.serviceName,
    description: form.description,
    type: providerTypeValue(form.serviceType) ?? 0,
    isActive: true,
    pricing,
    details,
    photos: form.photos ?? [],
  };
}
