// Maps between the rich MyServices/AddEditService UI shape and the minimal
// ServiceDto the API supports. UI features with no backend support are mocked
// here and documented in BACKEND_GAPS.md (search for BACKEND-GAP tags).
import { ServiceDto, ServiceScheduleDto, ServicePricingOptionDto } from '../../services/services';
import {
  AddressDto,
  resolveImageUrl,
  providerTypeLabel,
  providerTypeValue,
  ServiceProviderType,
} from '../../services/service-providers';
import { uploadFilesBulk } from '../../services/files';
import { getApiBaseUrl } from '../../services/http';
import {
  AdditionalServiceChargeType,
  isPerDistance,
  isTransportKind,
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
 * One row in the form's "Additional Services" editor: one KIND from the preset list
 * (`AdditionalServiceKind`, feedback 2026-10-26) and how it is priced. The partner never types a
 * name — the server names an extra after its kind, and every screen shows the kind's translation.
 *
 * `chargeType` decides which price fields matter, and the API rejects a mismatch: a PerDistance
 * extra (a pickup, drop-off or pet taxi only) needs `baseFee`/`perKmFee`, a Flat one needs `price`
 * and neither of the others. The trip a per-distance extra bills follows from its kind. Money and
 * distance fields are strings because they're bound to text inputs; empty means unset.
 */
export interface AdditionalServiceEntry {
  // The persisted AdditionalService id (edit mode) — undefined for a row the user just added.
  // The service write upserts by id, so keeping it is what stops an edit from churning the row
  // (and orphaning the bookings whose bill lines reference it).
  id?: number | null;
  /** AdditionalServiceKind. 0 until the partner picks one — and on an extra from before the list. */
  kind: number;
  /**
   * The name an extra saved before the preset list carries (kind 0). Shown so the partner knows
   * which extra it is while choosing its kind, which the API now requires to save it.
   */
  legacyName?: string;
  description?: string;
  /** AdditionalServiceChargeType: 0 = Flat, 1 = PerDistance. */
  chargeType: number;
  /** Flat surcharge. Only used when chargeType is Flat. */
  price: string;
  // Per-distance pricing (ignored for a flat extra).
  baseFee?: string;
  perKmFee?: string;
  freeDistanceKm?: string;
  maxDistanceKm?: string;
  /** Maps to isActive — a deactivated extra stays configured but can't be booked. */
  enabled: boolean;
}

/** A blank row for the "add additional service" button: no kind yet, flat (the simpler of the two). */
export function newAdditionalServiceEntry(): AdditionalServiceEntry {
  return {
    kind: 0,
    chargeType: AdditionalServiceChargeType.Flat,
    price: '',
    enabled: true,
  };
}

/** A second window the same day — a split day, 08:00–12:00 and 17:00–21:00. */
export type SecondWindow = { startTime: string; endTime: string };

export interface WorkingHours {
  [day: string]: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    second?: SecondWindow | null;
  };
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
  /**
   * Whether `pricingTiers` describes REAL `ServicePricingOption` rows, or the single synthetic
   * "Standard" tier synthesised below so the editor always has a price row to bind to. Read
   * surfaces must not present that scaffold as a tier the provider created.
   */
  hasPricingOptions: boolean;
  additionalServices: AdditionalServiceEntry[];
  workingHours: WorkingHours;
  /** Currency the tier/add-on amounts are in — from ServiceDto.currency, never assumed. */
  currency?: string | null;
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

// The charge-type enum is re-exported so the form can build its picker without importing the
// service layer.
export { AdditionalServiceChargeType } from '../../services/service-addons';

// --- Additional services <-> DTO ------------------------------------------

const numOrNull = (v?: string): number | null => {
  const n = parseFloat(v ?? '');
  return Number.isFinite(n) ? n : null;
};

/** DTO → form row. */
export function additionalServiceToEntry(dto: AdditionalServiceDto): AdditionalServiceEntry {
  const perDistance = isPerDistance(dto);
  return {
    id: dto.id ?? undefined,
    kind: dto.kind ?? 0,
    legacyName: dto.kind ? undefined : dto.name?.trim() || undefined,
    description: dto.description ?? '',
    chargeType: dto.chargeType ?? AdditionalServiceChargeType.Flat,
    price: perDistance ? '' : String(dto.price ?? 0),
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
 * Form row → DTO. One row is one extra: its kind, and only the price fields its charge type
 * allows (a PerDistance entry carrying a bare `price`, or a Flat one carrying a `distancePrice`,
 * is a 422). No name and no trip — the server takes both from the kind, so a pet taxi is one
 * extra billing both legs rather than the Pickup + Drop-off pair the editor used to split it into.
 * Distance pricing is only sent for a transport kind; any other kind goes as flat.
 *
 * `id` is preserved so the write updates the row in place rather than churning it (and orphaning
 * the bookings whose bill lines reference it).
 */
export function entryToAdditionalService(entry: AdditionalServiceEntry): AdditionalServiceDto {
  const base = {
    id: entry.id ?? undefined,
    kind: entry.kind,
    description: entry.description?.trim() || null,
    isActive: entry.enabled,
  };
  if (
    entry.chargeType !== AdditionalServiceChargeType.PerDistance ||
    !isTransportKind(entry.kind)
  ) {
    return {
      ...base,
      chargeType: AdditionalServiceChargeType.Flat,
      price: parseFloat(entry.price) || 0,
    };
  }
  return {
    ...base,
    chargeType: AdditionalServiceChargeType.PerDistance,
    distancePrice: {
      baseFee: parseFloat(entry.baseFee ?? '') || 0,
      perKmFee: parseFloat(entry.perKmFee ?? '') || 0,
      freeDistanceKm: numOrNull(entry.freeDistanceKm),
      maxDistanceKm: numOrNull(entry.maxDistanceKm),
    },
  };
}

/**
 * On-screen title for an extra in the editor and on the provider's own service card: its kind as
 * every customer reads it, else the name an extra from before the list was saved with, else (a
 * new row) the prompt to choose one.
 */
export function additionalServiceTitle(
  t: (key: any, params?: Record<string, string | number>) => string,
  tEnum: (enumName: 'additionalServiceKind', value: number | null | undefined) => string,
  entry: Pick<AdditionalServiceEntry, 'kind' | 'legacyName'>
): string {
  if (entry.kind) return tEnum('additionalServiceKind', entry.kind);
  return entry.legacyName || t('addEditService.extraChooseKind');
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
 * range booking). Written nested on the service itself (`uiToServiceDto`).
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
// with "HH:mm:ss" times. These helpers translate between the two; the result is
// written nested on the service (see services/service-schedules.ts for the
// per-row CRUD, which now only covers clearing them).
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

/**
 * Whether a day's hours run past midnight into the next day ("20:00" → "02:00"), in the form's
 * 24h "HH:mm" strings. The backend reads an end at or before the start that way (Domain.WorkingHours,
 * feedback 2026-10-18) — late and overnight sitting. "24:00" is the end of the same day.
 */
export function isOvernightHours(startTime: string, endTime: string): boolean {
  if (endTime.startsWith('24:')) return false;
  const minutes = (t: string) => {
    const [h, m] = t.split(':').map((n) => parseInt(n, 10) || 0);
    return h * 60 + m;
  };
  return minutes(endTime) <= minutes(startTime);
}

/** Service schedules (embedded on the service GET) → the form's WorkingHours. */
export function schedulesToWorkingHours(schedules?: ServiceScheduleDto[] | null): WorkingHours {
  const hours: WorkingHours = {};
  // Disabled-by-default in UI order so unset days render Mon→Sun, off.
  for (const day of UI_DAY_ORDER) {
    hours[day] = { enabled: false, startTime: '09:00', endTime: '17:00' };
  }
  // A day may have two windows (a split day). They used to overwrite each other here, so editing
  // a service with a split day and saving it dropped all but the last window. Earliest first.
  const sorted = [...(schedules ?? [])].sort(
    (a, b) => a.day - b.day || a.from.localeCompare(b.from)
  );
  for (const s of sorted) {
    const name = DAY_NAMES[s.day];
    if (!name || !hours[name]) continue;
    const window = { startTime: hmsToUiTime(s.from), endTime: hmsToUiTime(s.to) };
    if (!hours[name].enabled) {
      hours[name] = { enabled: true, ...window, second: null };
    } else if (!hours[name].second) {
      hours[name] = { ...hours[name], second: window };
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
    if (h.second) {
      out.push({
        serviceId,
        day,
        from: uiTimeToHms(h.second.startTime),
        to: uiTimeToHms(h.second.endTime),
      });
    }
  }
  return out;
}

/** ServiceDto (GET) → rich UI shape for cards and the edit form. */
export function serviceDtoToUi(dto: ServiceDto): UiService {
  // The stored price, never `dto.price`: that is what a customer pays today, with any live
  // promotion taken off. Seeding the editor from it wrote the discounted figure back as the base
  // price on save, so each edit during a 15% offer cut the real price by another 15%.
  const price = String(dto.pricing?.basePrice ?? dto.price ?? 0);
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
    hasPricingOptions: (dto.pricingOptions?.length ?? 0) > 0,
    // Whatever extras this service actually offers — an open-ended list the provider owns, not a
    // fixed catalog. A service with none starts the editor empty.
    additionalServices: (dto.additionalServices ?? []).map(additionalServiceToEntry),
    // Real per-day working hours from the service's schedules (S2 now wired).
    workingHours: schedulesToWorkingHours(dto.schedules),
    currency: dto.currency,
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
  /**
   * What the price is per (PricingUnit) when the service has one price and no duration tiers:
   * per visit, hour, day or night. Omit to keep the original's. Ignored with duration tiers,
   * whose prices are each for the whole option.
   */
  pricingUnit?: number;
  maxPetCapacity?: number; // → details.maxConcurrentBookings
  // Which pets the service takes (PetSpeciesType FLAGS) → details.acceptedSpecies. The screen
  // refuses to save with none, as the API does.
  acceptedSpecies?: number;
  // The full desired set of extras. Same row shape the editor binds to; unnamed rows are
  // dropped on the way to the DTO. Previously this was a fixed three-row list with an
  // `expanded` flag doubling as "enabled" — now it's an open list with an explicit `enabled`.
  additionalServices: AdditionalServiceEntry[];
  // Per-day working hours as the form holds them. Translated to `schedules` on the DTO and
  // written with the service itself — see the note on the return value below.
  workingHours: WorkingHours;
  // Ready-to-send photos array — build with buildServicePhotos()
  photos?: ServiceDto['photos'];
  // The service's own address as it should be saved — build with resolveServiceAddressForSave().
  // null removes it (the service is where its provider is); omit to keep the original's.
  address?: AddressDto | null;
};

/**
 * The service's own address as the save should send it:
 * - a newly picked one goes inline as `id: 0`. The server updates the service's address row in
 *   place, or creates one; it never links an existing row by id, so a pick can't end up sharing
 *   (and later rewriting) the provider's or the account's address. (This used to create the row
 *   through POST /api/addresses first and send its id, working around a PUT that 500'd on a new
 *   inline address — fixed server-side in 2026-09, and since 2026-10 the id would be ignored.)
 * - `useProviderLocation` sends `null`, which removes the override: the service is where its
 *   provider is again (their business address, else their account address).
 * - otherwise the saved address goes back unchanged.
 */
export function resolveServiceAddressForSave(
  picked: AddressDto | null,
  original: AddressDto | null | undefined,
  useProviderLocation: boolean
): AddressDto | null {
  if (picked) {
    return { ...picked, id: 0, state: picked.state || '' };
  }
  if (useProviderLocation) return null;
  return original ?? null;
}

/**
 * Rich form state → ServiceDto for create/update. Only API-backed fields persist.
 * Pass the original DTO in edit mode: details/pricing fields the form doesn't
 * capture (weight/duration limits, escrow, unit) are non-nullable server-side and
 * would reset to 0/None if omitted from a PUT.
 *
 * **The whole aggregate goes in one request.** `schedules` and `pricingOptions` ride along with
 * the service instead of being reconciled afterwards through their own CRUD: saving a service
 * with a full week of hours and four duration tiers used to cost a dozen requests, any of which
 * could fail on its own and leave the service saved but half-configured. The server persists
 * the lot in a single SaveChanges (see `docs/mapper-driven-aggregate-writes.md` in the API repo).
 * It also fixes the prices: nested amounts are converted using the root's declared `currency`,
 * whereas the standalone option writes declared none and so were stored as though the provider
 * had typed RSD.
 *
 * One thing the nested form cannot say: an **empty** `schedules` array means "leave them alone",
 * not "clear them" — a provider switching every day off still needs `clearServiceSchedules`.
 * Pricing options have no such gap; `[]` there really is "no tiers".
 */
/** Whether any tier names a duration — then the service prices by option, not by unit. */
export function hasDurationTiers(tiers: PricingTier[]): boolean {
  return tiers.some((tier) => !!tier.duration);
}

export function uiToServiceDto(form: ServiceFormInput, original?: ServiceDto): ServiceDto {
  // basePrice = the cheapest tier, so any card reading `price` alone shows a correct "from"
  // figure; the tiers themselves persist as the `pricingOptions` below.
  //
  // Note this payload deliberately carries no `discounts` — offers are written through
  // /api/service-discounts (services/service-discounts.ts), which is where the coherence
  // rules are honoured. The same validator now runs on this nested write too, so adding
  // discounts here would mean re-implementing them.
  const tierPrices = form.pricingTiers
    .map((t) => parseFloat(t.price))
    .filter((p) => Number.isFinite(p));
  const basePrice = tierPrices.length ? Math.min(...tierPrices) : 0;

  // Live tracking is server-restricted to Walker and Transporter services (422:
  // "Live location tracking can only be enabled on Walker or Transporter services").
  // The form has no toggle for it, so a provider switching an existing tracked Walker to,
  // say, Groomer would round-trip `true` into an illegal combination and get a rejection
  // about a setting they can't even see. Follow the type instead.
  const type = providerTypeValue(form.serviceType) ?? 0;
  const typeAllowsLiveTracking =
    type === ServiceProviderType.Walker || type === ServiceProviderType.Transporter;

  const details: NonNullable<ServiceDto['details']> = {
    ...original?.details,
    // Non-nullable booleans with no UI yet — round-trip from the original so a
    // PUT doesn't reset them (default false on create).
    supportsLiveTracking: typeAllowsLiveTracking
      ? (original?.details?.supportsLiveTracking ?? false)
      : false,
    // FLAGS, chosen on the form. The fallbacks only cover a caller that doesn't pass it.
    acceptedSpecies: form.acceptedSpecies || original?.details?.acceptedSpecies || 63,
    maxConcurrentBookings: form.maxPetCapacity ?? original?.details?.maxConcurrentBookings ?? 1,
  };

  // `pricing` prices the service itself; add-on money lives on each extra's own row.
  const pricing: NonNullable<ServiceDto['pricing']> = {
    basePrice,
    unit: hasDurationTiers(form.pricingTiers)
      ? 0
      : (form.pricingUnit ?? original?.pricing?.unit ?? 0),
    isEscrowPercentEnabled: original?.pricing?.isEscrowPercentEnabled ?? false,
    escrowPercent: original?.pricing?.escrowPercent ?? null,
    escrowAmount: original?.pricing?.escrowAmount ?? 0,
  };

  // The extras go over as one array, which the server treats as the desired FULL set: rows keep
  // their id and are updated in place, id-less rows are created, and anything the form dropped is
  // removed. Every row must have a kind by now (the screen refuses to save one without).
  const additionalServices = form.additionalServices.map(entryToAdditionalService);

  // Both collections are pinned to the service being written server-side, so the id we put on
  // them here is only a placeholder on create (where there is no id yet).
  const serviceId = form.id ?? 0;

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
    type,
    isActive: true,
    pricing,
    details,
    additionalServices,
    // Enabled days only. Non-empty replaces the stored windows wholesale (the Photos
    // convention); empty is the "leave alone" case the screen handles separately.
    schedules: workingHoursToSchedules(form.workingHours, serviceId),
    // The desired full set, upserted by id: known ids are updated in place — which is what
    // keeps existing bookings pointing at their tier — id-less rows are created, and a tier
    // the provider removed is dropped. A service with no resolvable duration sends `[]` and
    // goes back to classic free-range booking.
    pricingOptions: pricingTiersToOptions(form.pricingTiers, serviceId),
    photos: form.photos ?? [],
    // Round-trip the stored address when the form didn't touch it (omitting it
    // on PUT also keeps it — this is just explicit).
    address: form.address !== undefined ? form.address : (original?.address ?? null),
  };
}
