// Maps between the rich MyServices/AddEditService UI shape and the minimal
// ServiceDto the API supports. UI features with no backend support are mocked
// here and documented in BACKEND_GAPS.md (search for BACKEND-GAP tags).
import { ServiceDto, ServiceScheduleDto, ServicePricingOptionDto } from '../../services/services';
import {
  AddressDto,
  resolveImageUrl,
  providerTypeLabel,
  providerTypeValue,
} from '../../services/service-providers';
import { createAddress } from '../../services/addresses';
import { uploadFilesBulk } from '../../services/files';
import { getApiBaseUrl } from '../../services/http';
import {
  AdditionalServiceChargeType,
  DistanceLeg,
  isPerDistance,
  type AdditionalServiceDto,
} from '../../services/service-addons';

export interface PricingTier {
  // The persisted ServicePricingOption id (edit mode) — undefined for a tier
  // the user just added; used by saveServicePricingOptions to diff POST/PUT/DELETE.
  id?: number | null;
  duration: string;
  price: string;
}

/**
 * One row in the form's "Additional Services" editor — an open list the provider adds to, no
 * longer three fixed rows from a hardcoded catalog. They configure how it bills; the name is
 * derived on save, so there's no name field.
 *
 * `chargeType` decides which price fields matter, and the API rejects a mismatch: a PerDistance
 * extra needs `baseFee`/`perKmFee` and a `distanceLeg`, a Flat one needs `price` and neither of
 * the others. Money/distance fields are strings because they're bound to text inputs; empty
 * means unset.
 */
export interface AdditionalServiceEntry {
  // The persisted AdditionalService id (edit mode) — undefined for a row the user just added.
  // The service write upserts by id, so keeping it is what stops an edit from churning the row
  // (and orphaning the bookings whose bill lines reference it).
  id?: number | null;
  // No `name`: the provider doesn't author one. It's derived on save — see
  // `entryToAdditionalServices` — so the editor has one less field to get wrong.
  description?: string;
  /** AdditionalServiceChargeType: 0 = Flat, 1 = PerDistance. */
  chargeType: number;
  /** Flat surcharge. Only used when chargeType is Flat. */
  price: string;
  /** DistanceLeg: 0 = Pickup, 1 = DropOff, 2 = RoundTrip. Required when PerDistance. */
  distanceLeg?: number | null;
  // Per-distance pricing (ignored for a flat extra).
  baseFee?: string;
  perKmFee?: string;
  freeDistanceKm?: string;
  maxDistanceKm?: string;
  /** Maps to isActive — a deactivated extra stays configured but can't be booked. */
  enabled: boolean;
}

/** A blank row for the "add additional service" button — flat by default, the simpler of the two. */
export function newAdditionalServiceEntry(): AdditionalServiceEntry {
  return {
    chargeType: AdditionalServiceChargeType.Flat,
    price: '',
    enabled: true,
  };
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

// The charge-type and leg enums are re-exported so the form can build its pickers without
// importing the service layer. Extra NAMES aren't a catalog and aren't typed either — see
// entryToAdditionalServices for how they're derived.
export { AdditionalServiceChargeType, DistanceLeg } from '../../services/service-addons';

/** Options for the "how does this bill?" picker in the add-on editor. */
export const CHARGE_TYPE_OPTIONS = [
  { value: AdditionalServiceChargeType.Flat, label: 'Flat fee' },
  { value: AdditionalServiceChargeType.PerDistance, label: 'Per distance' },
] as const;

/**
 * Options for the "which journey?" picker, shown only for a per-distance extra. This is what lets
 * a pickup and a return charge different amounts on the same booking — each bills the leg it
 * actually performs.
 */
export const DISTANCE_LEG_OPTIONS = [
  { value: DistanceLeg.Pickup, label: 'Pickup (collect the pet)' },
  { value: DistanceLeg.DropOff, label: 'Drop-off (return the pet)' },
  { value: DistanceLeg.RoundTrip, label: 'Round trip (both)' },
] as const;

// --- Additional services <-> DTO ------------------------------------------

const numOrNull = (v?: string): number | null => {
  const n = parseFloat(v ?? '');
  return Number.isFinite(n) ? n : null;
};

/** DTO → form row. The stored `name` is dropped: it's re-derived on save. */
export function additionalServiceToEntry(dto: AdditionalServiceDto): AdditionalServiceEntry {
  const perDistance = isPerDistance(dto);
  return {
    id: dto.id ?? undefined,
    description: dto.description ?? '',
    chargeType: dto.chargeType ?? AdditionalServiceChargeType.Flat,
    price: perDistance ? '' : String(dto.price ?? 0),
    distanceLeg: perDistance ? (dto.distanceLeg ?? DistanceLeg.Pickup) : null,
    baseFee: perDistance ? String(dto.distancePrice?.baseFee ?? 0) : '',
    perKmFee: perDistance ? String(dto.distancePrice?.perKmFee ?? 0) : '',
    freeDistanceKm:
      dto.distancePrice?.freeDistanceKm != null ? String(dto.distancePrice.freeDistanceKm) : '',
    maxDistanceKm:
      dto.distancePrice?.maxDistanceKm != null ? String(dto.distancePrice.maxDistanceKm) : '',
    enabled: dto.isActive !== false,
  };
}

/**
 * Wire names for the two journeys. These are DATA, not display copy — they travel to the API,
 * are frozen onto a booking's bill lines, and come back as backend free text, so they stay
 * English exactly like the day/duration keys elsewhere in this file. The editor renders its own
 * translated titles (see `addEditService.legTitle*`) and never shows these.
 */
const ADDON_NAME_BY_LEG: Record<number, string> = {
  [DistanceLeg.Pickup]: 'Pickup',
  [DistanceLeg.DropOff]: 'Drop-off',
};

/** Falls back when a flat extra is configured before the service itself has been named. */
const UNNAMED_SERVICE_ADDON = 'Additional service';

/**
 * Form row → DTO(s). Returns an ARRAY because one row can produce two extras: a round trip is
 * stored as a Pickup and a Drop-off sharing the same fees, since the API prices each leg against
 * its own measured distance and a booking's collection and return can differ in length.
 *
 * The provider no longer names an extra. A per-distance one is named for the journey it performs
 * and a flat one takes the service's own name, which keeps every bill line self-explaining without
 * a field to fill in. Only the fields the row's charge type allows are sent — a PerDistance entry
 * carrying a bare `price`, or a Flat one carrying a `distancePrice`, is a 422.
 *
 * `id` is preserved so the write updates the row in place rather than churning it (and orphaning
 * the bookings whose bill lines reference it). On a split only the first leg can inherit it — the
 * second is necessarily a new row.
 */
export function entryToAdditionalServices(
  entry: AdditionalServiceEntry,
  serviceName: string
): AdditionalServiceDto[] {
  const base = {
    description: entry.description?.trim() || null,
    chargeType: entry.chargeType,
    isActive: entry.enabled,
  };

  if (entry.chargeType !== AdditionalServiceChargeType.PerDistance) {
    return [
      {
        ...base,
        id: entry.id ?? undefined,
        name: serviceName.trim() || UNNAMED_SERVICE_ADDON,
        price: parseFloat(entry.price) || 0,
      },
    ];
  }

  const distancePrice = {
    baseFee: parseFloat(entry.baseFee ?? '') || 0,
    perKmFee: parseFloat(entry.perKmFee ?? '') || 0,
    freeDistanceKm: numOrNull(entry.freeDistanceKm),
    maxDistanceKm: numOrNull(entry.maxDistanceKm),
  };
  const leg = entry.distanceLeg ?? DistanceLeg.Pickup;
  const legs = leg === DistanceLeg.RoundTrip ? [DistanceLeg.Pickup, DistanceLeg.DropOff] : [leg];

  return legs.map((each, i) => ({
    ...base,
    id: i === 0 ? (entry.id ?? undefined) : undefined,
    name: ADDON_NAME_BY_LEG[each],
    distanceLeg: each,
    // A fresh object per leg: they're independent rows server-side and must not alias.
    distancePrice: { ...distancePrice },
  }));
}

/**
 * On-screen title for an extra, mirroring the wire-name derivation above so the editor, the
 * service card and the preview all agree with what actually gets saved. Translated, unlike the
 * wire names — those are data. A round trip reads as both legs, since that's what saving creates.
 */
export function additionalServiceTitle(
  t: (key: any, params?: Record<string, string | number>) => string,
  entry: Pick<AdditionalServiceEntry, 'chargeType' | 'distanceLeg'>,
  serviceName: string
): string {
  if (entry.chargeType !== AdditionalServiceChargeType.PerDistance) {
    return serviceName.trim() || t('addEditService.extraUnnamedService');
  }
  switch (entry.distanceLeg) {
    case DistanceLeg.DropOff:
      return t('addEditService.legTitleDropOff');
    case DistanceLeg.RoundTrip:
      return t('addEditService.legTitleRoundTrip');
    default:
      return t('addEditService.legTitlePickup');
  }
}

/**
 * Keeps every extra on a service distinctly named.
 *
 * Necessary because names are derived now, so collisions are easy to produce without noticing —
 * two flat extras both take the service's name, and a Pickup extra alongside a round trip both
 * yield "Pickup". A duplicate is not just cosmetic: ReviewBookingScreen keys its price breakdown
 * by name, so two same-named lines would silently merge into one on the customer's bill.
 */
function ensureUniqueNames(addons: AdditionalServiceDto[]): AdditionalServiceDto[] {
  const seen = new Map<string, number>();
  return addons.map((addon) => {
    const count = (seen.get(addon.name) ?? 0) + 1;
    seen.set(addon.name, count);
    return count === 1 ? addon : { ...addon, name: `${addon.name} ${count}` };
  });
}

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

// English data label → translation key for DISPLAY. The stored value (option
// name / tier duration) always stays the English data key — see the i18n
// "data keys stay English" rule.
const DURATION_LABEL_TRANSLATION_KEYS: Record<string, string> = {
  '30 minutes': 'durations.min30',
  '1 hour': 'durations.hour1',
  '1.5 hours': 'durations.hour1_5',
  '2 hours': 'durations.hour2',
  '3 hours': 'durations.hour3',
  '4 hours': 'durations.hour4',
  'Full day': 'durations.fullDay',
  Overnight: 'durations.overnight',
};

/**
 * Localized display for a duration label / pricing-option name (which the
 * backend stores in English). Translates the known duration catalog and the
 * "{n} min" fallback; anything else (a custom API-created name) displays as-is.
 */
export function durationDisplayLabel(
  t: (key: any, params?: Record<string, string | number>) => string,
  label: string
): string {
  const key = DURATION_LABEL_TRANSLATION_KEYS[label];
  if (key) return t(key);
  const minMatch = /^(\d+)\s*min$/.exec(label);
  if (minMatch) return t('durations.nMin', { n: minMatch[1] });
  return label;
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
    // Whatever extras this service actually offers — an open-ended list the provider owns, not a
    // fixed catalog. A service with none starts the editor empty.
    additionalServices: (dto.additionalServices ?? []).map(additionalServiceToEntry),
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
  // The full desired set of extras. Same row shape the editor binds to; unnamed rows are
  // dropped on the way to the DTO. Previously this was a fixed three-row list with an
  // `expanded` flag doubling as "enabled" — now it's an open list with an explicit `enabled`.
  additionalServices: AdditionalServiceEntry[];
  // Ready-to-send photos array — build with buildServicePhotos()
  photos?: ServiceDto['photos'];
  // Ready-to-send address (id already resolved) — build with
  // resolveServiceAddressForSave(). Omit to keep the original's address.
  address?: AddressDto | null;
};

/**
 * Resolves the address the user picked (map pin or profile copy) into the shape
 * the service POST/PUT accepts (contract verified live 2026-07-19):
 * - POST takes a new address inline (id 0 → row created + linked).
 * - PUT only accepts the service's EXISTING address id (updates it in place);
 *   a new inline address 500s — so an edit that ADDS a location creates the row
 *   standalone (POST /api/addresses) first and sends its real id instead.
 * The standalone create requires a non-empty `state` — falls back to
 * city/country. Nothing picked → the original address (or null) unchanged.
 */
export async function resolveServiceAddressForSave(
  picked: AddressDto | null,
  original: AddressDto | null | undefined,
  isEdit: boolean
): Promise<AddressDto | null> {
  if (!picked) return original ?? null;
  const normalized = {
    ...picked,
    state: picked.state || picked.city || picked.country || '-',
  };
  if (original?.id) return { ...normalized, id: original.id };
  if (isEdit) return createAddress(normalized);
  return { ...normalized, id: 0 };
}

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
    // Non-nullable booleans with no UI yet — round-trip from the original so a
    // PUT doesn't reset them (default false on create).
    supportsLiveTracking: original?.details?.supportsLiveTracking ?? false,
    // FLAGS: 63 = all species accepted; new services default to accepting all
    acceptedSpecies: original?.details?.acceptedSpecies ?? 63,
    maxConcurrentBookings: form.maxPetCapacity ?? original?.details?.maxConcurrentBookings ?? 1,
  };

  // `pricing` prices the service itself; add-on money lives on each extra's own row.
  const pricing: NonNullable<ServiceDto['pricing']> = {
    basePrice,
    unit: original?.pricing?.unit ?? 0,
    isEscrowPercentEnabled: original?.pricing?.isEscrowPercentEnabled ?? false,
    escrowPercent: original?.pricing?.escrowPercent ?? null,
    escrowAmount: original?.pricing?.escrowAmount ?? 0,
  };

  // The extras go over as one array, which the server treats as the desired FULL set: rows keep
  // their id and are updated in place, id-less rows are created, and anything the form dropped is
  // removed. `flatMap` because a round-trip row expands into a Pickup and a Drop-off. Nothing is
  // filtered out any more — every row is nameable by derivation, so none can be silently lost.
  const additionalServices = ensureUniqueNames(
    form.additionalServices.flatMap((e) => entryToAdditionalServices(e, form.serviceName))
  );

  return {
    id: form.id ?? 0,
    serviceProviderId: form.serviceProviderId,
    // Declares which currency the amounts above are in. The form was prefilled from
    // `original`, which the server had already converted into the viewer's display
    // currency, so echoing that code back is what keeps an unchanged save a no-op.
    // Left undefined on create — `createService` falls back to the display preference,
    // which is what the price inputs were labelled with. See declaredWriteCurrency.
    currency: original?.currency ?? undefined,
    name: form.serviceName,
    description: form.description,
    type: providerTypeValue(form.serviceType) ?? 0,
    isActive: true,
    pricing,
    details,
    additionalServices,
    photos: form.photos ?? [],
    // Round-trip the stored address when the form didn't touch it (omitting it
    // on PUT also keeps it — this is just explicit).
    address: form.address !== undefined ? form.address : (original?.address ?? null),
  };
}
