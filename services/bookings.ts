import { apiJson, apiList, apiVoid } from './http';
import { resolveImageUrl, AddressDto } from './service-providers';
import type { ServicePricingOptionDto } from './services';

// BookingState enum (verified /enums 2026-06-19). The API advances `state` as the
// provider acts on a booking: confirming moves it to Accepted(3), starting the
// service moves it to InProgress(4). NOTE: a confirmed booking is therefore
// state=Accepted, NOT Upcoming — code that gated on `state === Upcoming` (e.g. the
// old Live Session selectors) silently dropped every accepted booking.
export const BookingState = {
  Upcoming: 0,
  Completed: 1,
  Cancelled: 2,
  Accepted: 3,
  InProgress: 4,
} as const;

// BookingStatusType enum (verified /enums): the detailed lifecycle status
export const BookingStatusType = {
  ServiceRequestedByUser: 0,
  ServiceConfirmedByProvider: 1,
  PrePayment: 2,
  ServiceStarted: 3,
  ServiceEnded: 4,
  PostPayment: 5,
  DeclinedByProvider: 6,
  CancelledByUser: 7,
} as const;

// PaymentType enum (verified /enums): 0=Cash, 1=Card, 2=BankTransfer, 3=Wallet
export const PaymentType = { Cash: 0, Card: 1, BankTransfer: 2, Wallet: 3 } as const;

type NestedPhoto = { src?: string | null; isSelected?: boolean };
type NestedEntity = { name?: string | null; photos?: NestedPhoto[]; id?: number | null };

export type BookingDto = {
  id?: number | null;
  userId: number;
  serviceProviderId: number;
  serviceId: number;
  petId: number;
  priceCurrency?: string | null;
  state: number;
  cancelReason?: string | null;
  bookingFrom: string; // ISO date-time
  bookingTo: string; // ISO date-time
  basePrice: number;
  discountAmount: number;
  totalPrice: number;
  // The chosen service pricing option (duration/price variant). REQUIRED when
  // the booked service defines pricingOptions (else 422 "This service defines
  // pricing options; PricingOptionId is required." — on PUT too, so
  // toWritableBooking round-trips it); must be null for option-less services.
  // With an option set the server derives bookingTo (= bookingFrom +
  // durationMinutes) and basePrice (= option price, discount applied) itself.
  pricingOptionId?: number | null;
  // READ-only nested echo of the chosen option (GET only).
  pricingOption?: ServicePricingOptionDto | null;
  paymentType: number;
  paymentMethodId: number; // REQUIRED — must reference an existing PaymentMethod
  currentStatus: number;
  // Add-on selection — WRITE side: ids only. Each entry names one of the booked
  // service's `additionalServices`. Prices are ALWAYS resolved server-side (from the
  // service's catalog and, for a per-distance extra, the measured leg) and frozen on
  // the booking — the client never sends an amount. On update the array is the
  // desired full set, so a deselected extra loses its line entirely.
  // On READ the same field comes back enriched: see BookingAdditionalServiceReadDto.
  additionalServices?: BookingAdditionalServiceReadDto[] | BookingAdditionalServiceRef[];
  // Add-on money — READ-only, computed by the server (a client-sent totalPrice is
  // recomputed server-side).
  addOnsTotal?: number | null;
  depositAmount?: number | null;
  // Populated on GET (read-only nested includes — stripped by toWritableBooking):
  serviceProvider?: NestedEntity | null;
  service?: NestedEntity | null;
  pet?: NestedEntity | null;
  // The booker — populated on GET since the API update (was always null before)
  user?: {
    id?: number | null;
    userName?: string | null;
    email?: string | null;
    photos?: NestedPhoto[];
  } | null;
  review?: { rating?: number | null } | null;
  // The read DTO now returns the pickup/leave-over addresses nested under
  // `location` (location.pickupAddress / location.leaveOverAddress) — the booking
  // POST persists them since the 2026-06 update (BACKEND_GAPS B2 resolved). The
  // top-level `pickupAddress`/`leaveOverAddress` are backfilled from `location`
  // by withResolvedAddresses() in the read/create paths so existing consumers
  // (BookingDetails, LiveSession) keep reading them top-level.
  pickupAddress?: AddressDto | null;
  leaveOverAddress?: AddressDto | null;
  location?: BookingLocationDto | null;
  createdAt?: string;
  updatedAt?: string;
};

/**
 * Write-side location for a booking. The pickup/leave-over addresses are sent
 * INLINE in the booking POST (never via a separate /api/addresses call). Read
 * DTOs expose the resolved pickupAddress/leaveOverAddress top-level.
 */
export type BookingLocationDto = {
  id?: number | null;
  pickupAddressId?: number | null;
  leaveOverAddressId?: number | null;
  pickupAddress?: AddressDto | null;
  leaveOverAddress?: AddressDto | null;
  // The measured road distance of each journey, in km, beside the address it was
  // measured against. READ: what the server routed when it priced the booking.
  // WRITE: leave both undefined — the server measures them (real routing + geocoding,
  // server-held key). Sending a value overrides the measurement, which is for operator
  // correction only; the client must not measure distances, because they set the price.
  pickupDistanceKm?: number | null;
  leaveOverDistanceKm?: number | null;
};

/** What a booking sends to select an extra: the catalog id, nothing else. */
export type BookingAdditionalServiceRef = { additionalServiceId: number };

/**
 * One extra charged on a booking — a self-explaining line on the bill, all of it frozen
 * when the booking was priced. A per-distance line carries the fees and THIS LEG's
 * distance behind its amount, so a client can render "200 + 8.4 km × 50 = 620" without
 * recomputing anything.
 */
export type BookingAdditionalServiceReadDto = {
  id?: number | null;
  /** The service's catalog entry; null if the provider has since removed it. */
  additionalServiceId?: number | null;
  name: string;
  chargeType: number;
  /** Which journey this line paid for (see DistanceLeg); null for a flat line. */
  distanceLeg?: number | null;
  price: number;
  baseFee?: number | null;
  perKmFee?: number | null;
  distanceKm?: number | null;
};

/**
 * The fields the booking POST actually accepts (matches the server write DTO).
 * `state`/`currentStatus` are intentionally absent — they're read-only and
 * advanced only via the dedicated lifecycle endpoints, not the create/PUT body.
 */
type WritableBookingCreate = {
  id?: number | null;
  userId: number;
  serviceProviderId: number;
  serviceId: number;
  petId: number;
  priceCurrency?: string | null;
  bookingFrom: string;
  bookingTo: string;
  basePrice: number;
  discountAmount: number;
  totalPrice: number;
  pricingOptionId?: number | null;
  paymentType: number;
  paymentMethodId: number;
  // Ids only — the server prices each extra and freezes it as a bill line. No amounts, and no
  // distances: it measures each trip leg itself from the addresses under `location`.
  additionalServices?: BookingAdditionalServiceRef[];
  location?: BookingLocationDto | null;
};

/**
 * The booking read DTO returns the pickup/leave-over addresses nested under
 * `location` (BACKEND_GAPS B2 resolved — they now persist and round-trip). For
 * compatibility with consumers that read `pickupAddress`/`leaveOverAddress`
 * top-level, this backfills the top-level fields from `location` when present.
 * Applied at the service boundary (getBooking/getBookings/createBooking).
 */
function withResolvedAddresses(dto: BookingDto): BookingDto {
  if (!dto?.location) return dto;
  return {
    ...dto,
    pickupAddress: dto.pickupAddress ?? dto.location.pickupAddress ?? null,
    leaveOverAddress: dto.leaveOverAddress ?? dto.location.leaveOverAddress ?? null,
  };
}

/**
 * Display key derived from BookingState. 'booked' = Accepted (provider
 * confirmed, not started); 'in-progress' = InProgress (service underway).
 * These are internal keys — user-facing text comes from tEnum('bookingState').
 * Active (non-terminal) labels group under the MyBookings "Upcoming" tab.
 */
export type BookingStatusLabel = 'upcoming' | 'booked' | 'in-progress' | 'completed' | 'cancelled';

/** The statusLabels that count as active/not-yet-finished (MyBookings "Upcoming" tab). */
export const ACTIVE_STATUS_LABELS: readonly BookingStatusLabel[] = [
  'upcoming',
  'booked',
  'in-progress',
];

/** UI-friendly booking shape for MyBookingsScreen / schedule views. */
export type BookingViewModel = {
  id: number;
  providerName: string;
  providerId: number;
  serviceName: string;
  serviceId: number;
  petName: string;
  petId: number;
  date: string; // formatted, e.g. "Jun 15, 2026"
  time: string; // formatted, e.g. "10:00 AM"
  bookingFrom: string; // raw ISO
  price: number;
  currency: string | null; // server-stamped from the provider; format via formatMoney
  state: number; // BookingState
  status: number; // BookingStatusType
  statusLabel: BookingStatusLabel;
  image: string;
  rating?: number; // from the booking's review, when one exists
  clientName: string; // the booker (from the populated `user` include)
  clientEmail: string;
  clientAvatar: string;
};

/**
 * Booking times are naive wall-clock values that the API serializes with a UTC
 * offset suffix (e.g. "2026-06-18T13:00:00+00:00" means 13:00 *local*, not 13:00
 * UTC). Parsing them with `new Date(iso)` would convert from UTC and shift the
 * displayed time by the device's offset. This drops the trailing offset/Z so the
 * wall-clock components are read in the current timezone. Use this everywhere a
 * booking's `bookingFrom`/`bookingTo` is read for display or comparison.
 */
export function parseBookingDate(iso?: string | null): Date {
  if (!iso) return new Date(NaN);
  return new Date(iso.replace(/(?:Z|[+-]\d{2}:?\d{2})$/, ''));
}

/**
 * Inverse of parseBookingDate for the write side: a local Date → a naive
 * "YYYY-MM-DDTHH:mm:ss" string (no offset), so a booking created from a picked
 * local time round-trips back to the same wall-clock under parseBookingDate.
 */
export function formatBookingDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// Money formatting lives in ./currency — it is not a booking concern (services, stats, discounts
// and promotions all format prices too), and burying it here made it easy to miss and re-invent.
//
// Deliberately NOT re-exported from here: a re-export makes `bookings` a second, equally valid
// import path for the same symbol, which is how it got hard to find in the first place — and it
// puts money formatting behind this module's initialization. Import from './currency' directly.

function firstPhoto(entity?: NestedEntity | null): string {
  const photos = entity?.photos ?? [];
  const selected = photos.find((p) => p.isSelected) ?? photos[0];
  return resolveImageUrl(selected?.src);
}

function formatDate(iso: string): string {
  const d = parseBookingDate(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string): string {
  const d = parseBookingDate(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

function stateToLabel(state: number): BookingViewModel['statusLabel'] {
  if (state === BookingState.Completed) return 'completed';
  if (state === BookingState.Cancelled) return 'cancelled';
  if (state === BookingState.Accepted) return 'booked';
  if (state === BookingState.InProgress) return 'in-progress';
  return 'upcoming';
}

export function bookingToViewModel(dto: BookingDto): BookingViewModel {
  return {
    id: dto.id ?? 0,
    providerName: dto.serviceProvider?.name ?? 'Provider',
    providerId: dto.serviceProviderId,
    serviceName: dto.service?.name ?? 'Service',
    serviceId: dto.serviceId,
    petName: dto.pet?.name ?? 'Pet',
    petId: dto.petId,
    date: formatDate(dto.bookingFrom),
    time: formatTime(dto.bookingFrom),
    bookingFrom: dto.bookingFrom,
    price: dto.totalPrice,
    currency: dto.priceCurrency ?? null,
    state: dto.state,
    status: dto.currentStatus,
    statusLabel: stateToLabel(dto.state),
    image: firstPhoto(dto.serviceProvider) || firstPhoto(dto.pet),
    rating: dto.review?.rating ?? undefined,
    clientName: dto.user?.userName ?? '',
    clientEmail: dto.user?.email ?? '',
    clientAvatar: firstPhoto(dto.user),
  };
}

export type GetBookingsParams = {
  userId?: number;
  serviceProviderId?: number;
  serviceId?: number;
  petId?: number;
  state?: number;
  currentStatus?: number;
  bookingFrom?: string;
  bookingTo?: string;
  page?: number;
  perPage?: number;
};

export async function getBookings(params?: GetBookingsParams): Promise<BookingDto[]> {
  const items = await apiList<BookingDto>('/api/bookings', {
    query: {
      UserId: params?.userId,
      ServiceProviderId: params?.serviceProviderId,
      ServiceId: params?.serviceId,
      PetId: params?.petId,
      State: params?.state,
      CurrentStatus: params?.currentStatus,
      BookingFrom: params?.bookingFrom,
      BookingTo: params?.bookingTo,
      Page: params?.page ?? 1,
      PerPage: params?.perPage ?? 50,
    },
    fallback: 'Failed to load bookings.',
    context: 'getBookings',
  });
  return items.map(withResolvedAddresses);
}

export async function getBooking(id: number): Promise<BookingDto> {
  return withResolvedAddresses(
    await apiJson<BookingDto>(`/api/bookings/${id}`, {
      fallback: 'Failed to load booking.',
      context: 'getBooking',
    })
  );
}

export type CreateBookingInput = {
  userId: number;
  serviceProviderId: number;
  serviceId: number;
  petId: number;
  paymentMethodId: number; // REQUIRED — see API note below
  bookingFrom: string; // ISO date-time
  bookingTo: string; // ISO date-time
  /**
   * IGNORED SERVER-SIDE (since 2026-08-06) — kept because the quote returns them and the
   * booking read carries them back, so the flow reads more honestly sending what it was
   * quoted than sending nothing.
   *
   * The server derives base/discount from the booked service (or the chosen pricing option)
   * on create, and `totalPrice` is computed from them plus the add-on lines; only a
   * provider's `POST /bookings/{id}/adjust-price` can override a price afterwards. Before
   * that fix the client's numbers were trusted whenever the service had no live promotion,
   * so a 100 RSD service could be booked for 1 — the reason not to reintroduce a code path
   * that "corrects" a price here.
   */
  basePrice: number;
  discountAmount?: number;
  totalPrice: number;
  // The chosen pricing option — REQUIRED when the service defines
  // pricingOptions. The server derives bookingTo/basePrice from the option.
  pricingOptionId?: number;
  paymentType?: number; // defaults to Card
  // NOTE: there is deliberately no priceCurrency input — the server stamps it
  // from the booked service's provider (Currency, default EUR) and ignores any
  // client-sent value, like the other server-authoritative price fields.
  // Where the pet is collected / returned. Posted inline under `location`; the read DTO returns
  // them under `location.pickupAddress` / `location.leaveOverAddress` (backfilled top-level by
  // withResolvedAddresses). The server measures each trip leg from these — provider to the pickup
  // address, and the leave-over address back to the provider — so a per-distance extra bills the
  // journey it actually performs.
  pickupAddress?: AddressDto;
  leaveOverAddress?: AddressDto;
  // The extras to buy, by their AdditionalService id. Ids only: the server resolves each price
  // from the booked service's catalog and freezes it as a line item on the booking. There is
  // deliberately no way to send a price or a distance — both decide what is charged.
  additionalServiceIds?: number[];
};

/**
 * Rounds every number in an outgoing payload to at most 2 decimals, recursing
 * into nested objects and arrays. `latitude`/`longitude` are left at full
 * precision on purpose — rounding a coordinate to 2 decimals shifts it by up to
 * ~1km. Integers round to themselves, so ids / enum values / flags are
 * unaffected; only fractional money and distance values change. Applied to every
 * booking payload so no price or distance field is ever sent with >2 decimals.
 */
function round2Payload<T>(value: T): T {
  if (typeof value === 'number') {
    return (Number.isFinite(value) ? Math.round(value * 100) / 100 : value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => round2Payload(v)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = k === 'latitude' || k === 'longitude' ? v : round2Payload(v);
    }
    return out as unknown as T;
  }
  return value;
}

/**
 * Creates a booking.
 *
 * IMPORTANT (verified against the live API): a booking REQUIRES a valid
 * `paymentMethodId` referencing an existing PaymentMethod for the user.
 * Posting without one (null / 0 / missing) returns 422. New bookings start
 * with state = Upcoming and currentStatus = ServiceRequestedByUser.
 */
export async function createBooking(input: CreateBookingInput): Promise<BookingDto> {
  // `state` / `currentStatus` are NOT part of the write DTO — the server sets the
  // initial values (Upcoming / ServiceRequestedByUser) and advances them only via
  // the dedicated lifecycle endpoints (confirm/decline/start/complete/cancel).
  const body: WritableBookingCreate = {
    id: 0,
    userId: input.userId,
    serviceProviderId: input.serviceProviderId,
    serviceId: input.serviceId,
    petId: input.petId,
    // Server-stamped from the provider's currency; sent null so it's obvious
    // the client doesn't choose it.
    priceCurrency: null,
    bookingFrom: input.bookingFrom,
    bookingTo: input.bookingTo,
    basePrice: input.basePrice,
    discountAmount: input.discountAmount ?? 0,
    totalPrice: input.totalPrice,
    // When set, the server derives bookingTo/basePrice from the option — the
    // computed values above are still sent but ignored for option bookings.
    pricingOptionId: input.pricingOptionId ?? null,
    paymentType: input.paymentType ?? PaymentType.Card,
    paymentMethodId: input.paymentMethodId,
    // The selected extras, by id. The server prices each one from the service's catalog and
    // freezes it as a bill line, overriding the totalPrice sent above.
    additionalServices: (input.additionalServiceIds ?? []).map((id) => ({
      additionalServiceId: id,
    })),
  };

  // Pickup/Drop-off addresses are sent INLINE in this POST (never /api/addresses).
  if (input.pickupAddress || input.leaveOverAddress) {
    body.location = {
      pickupAddress: input.pickupAddress ?? null,
      leaveOverAddress: input.leaveOverAddress ?? null,
    };
  }

  return withResolvedAddresses(
    await apiJson<BookingDto>('/api/bookings', {
      method: 'POST',
      body: round2Payload(body),
      fallback: 'Failed to create booking.',
      context: 'createBooking',
    })
  );
}

/**
 * Picks only the writable scalar fields for a PUT. The booking GET returns
 * nested read-only includes (serviceProvider/service/pet/user/addresses); PUTing
 * those back 500s, so they must be stripped before update.
 */
function toWritableBooking(b: BookingDto): BookingDto {
  return {
    id: b.id,
    userId: b.userId,
    serviceProviderId: b.serviceProviderId,
    serviceId: b.serviceId,
    petId: b.petId,
    priceCurrency: b.priceCurrency,
    state: b.state,
    cancelReason: b.cancelReason,
    bookingFrom: b.bookingFrom,
    bookingTo: b.bookingTo,
    basePrice: b.basePrice,
    discountAmount: b.discountAmount,
    totalPrice: b.totalPrice,
    // Round-trip the pricing option — the coexist rule runs on PUT too, so a
    // status/scalar PUT on an option booking 422s without it.
    pricingOptionId: b.pricingOptionId ?? null,
    paymentType: b.paymentType,
    paymentMethodId: b.paymentMethodId,
    currentStatus: b.currentStatus,
    // Round-trip the extras selection as ids: a PUT's `additionalServices` is the desired FULL
    // set, so omitting it on a status/cancel edit would silently drop every extra off the bill.
    // Read DTOs come back enriched (name/price/distance) — reduce them to the id-only write shape.
    additionalServices: (b.additionalServices ?? [])
      .map((a) =>
        'additionalServiceId' in a && typeof a.additionalServiceId === 'number'
          ? { additionalServiceId: a.additionalServiceId }
          : null
      )
      .filter((a): a is { additionalServiceId: number } => a !== null),
    // Distances are NOT round-tripped: the server re-measures each leg from the addresses it
    // already has. Echoing a stored value back would turn a measurement into a client override.
  };
}

/**
 * @deprecated The booking write DTO no longer carries `state`/`currentStatus`,
 * so the generic PUT can NOT change a booking's lifecycle — use the dedicated
 * endpoints instead (confirmBooking / declineBooking / startBookingService /
 * endBookingService / cancelBooking). Kept only for non-lifecycle scalar edits.
 */
export function setBookingStatus(booking: BookingDto, currentStatus: number): Promise<BookingDto> {
  const body: BookingDto = { ...toWritableBooking(booking), currentStatus };

  return apiJson<BookingDto>(`/api/bookings/${booking.id}`, {
    method: 'PUT',
    body: round2Payload(body),
    fallback: 'Failed to update booking.',
    context: 'setBookingStatus',
  });
}

/**
 * Normalises a cancel/decline reason to something the API will accept: the field
 * is required and must be ≥10 characters (null → 400, 1–9 chars → 422), so a
 * blank or too-short reason falls back to a valid generic one.
 */
function ensureCancelReason(reason: string | null | undefined, fallback: string): string {
  const trimmed = (reason ?? '').trim();
  return trimmed.length >= 10 ? trimmed : fallback;
}

/**
 * POSTs one of the dedicated lifecycle transitions under `/bookings/{id}/…`.
 *
 * These endpoints all share a shape — id in the path, an optional `{ reason }`
 * body, the updated booking back — so they run through here rather than
 * repeating the request five times. Note the path has NO `/api` prefix, unlike
 * the CRUD routes above.
 */
function bookingTransition(
  id: number | null | undefined,
  action: string,
  fallback: string,
  context: string,
  reason?: string
): Promise<BookingDto> {
  return apiJson<BookingDto>(`/bookings/${id}/${action}`, {
    method: 'POST',
    body: reason === undefined ? undefined : { reason },
    fallback,
    context,
  });
}

/**
 * Live Session — partner taps "Start Service". Uses the dedicated
 * POST /bookings/{id}/start-service endpoint (moves the booking to
 * ServiceStarted, currentStatus = 3), mirroring confirm/decline rather than the
 * generic status PUT.
 */
export function startBookingService(booking: BookingDto): Promise<BookingDto> {
  return bookingTransition(
    booking.id,
    'start-service',
    'Failed to start service.',
    'startBookingService'
  );
}

/**
 * Live Session — partner taps "End Service". Uses the dedicated
 * POST /bookings/{id}/complete-service endpoint (moves the booking to
 * ServiceEnded, currentStatus = 4). Preferred over the generic status PUT, which
 * can 500 on the completion email for an invalid recipient (the seed `admin`,
 * BACKEND_GAPS B4); LiveSession still re-fetches on error as a guard.
 */
export function endBookingService(booking: BookingDto): Promise<BookingDto> {
  return bookingTransition(
    booking.id,
    'complete-service',
    'Failed to complete service.',
    'endBookingService'
  );
}

/**
 * Provider accepts a pending booking request via POST /bookings/{id}/confirm.
 * Sets currentStatus = ServiceConfirmedByProvider and returns the full booking.
 * GUARD (verified live): only bookings still in ServiceRequestedByUser can be
 * confirmed — anything else 422s ("Only bookings with status
 * ServiceRequestedByUser can be decided on."). Unlike the setBookingStatus PUT,
 * this does not 500 on recipients with invalid emails (BACKEND_GAPS B4).
 */
export function confirmBooking(id: number): Promise<BookingDto> {
  return bookingTransition(id, 'confirm', 'Failed to accept booking.', 'confirmBooking');
}

/**
 * Provider declines a pending booking request via POST /bookings/{id}/decline.
 * Sets state = Cancelled, currentStatus = DeclinedByProvider and stores the
 * reason as cancelReason (verified live). Same guard as confirmBooking — only
 * ServiceRequestedByUser bookings can be declined; use cancelBooking() to
 * cancel an already-accepted booking.
 */
export function declineBooking(id: number, reason?: string): Promise<BookingDto> {
  return bookingTransition(
    id,
    'decline',
    'Failed to decline booking.',
    'declineBooking',
    // The decline body's `reason` is required and must be ≥10 chars server-side
    // (null → 400, 1–9 chars → 422). Fall back to a valid generic reason.
    ensureCancelReason(reason, 'Declined by the provider.')
  );
}

/**
 * Cancels an already-accepted booking via the dedicated POST /bookings/{id}/cancel
 * endpoint (sets state = Cancelled, currentStatus = CancelledByUser and stores the
 * reason). This replaces the old PUT-with-state approach, which no longer works
 * now that `state` was removed from the booking write DTO. The `reason` field is
 * required (≥10 chars, like decline) — a blank/short one falls back to a generic.
 */
export function cancelBooking(booking: BookingDto, reason?: string): Promise<BookingDto> {
  return bookingTransition(
    booking.id,
    'cancel',
    'Failed to cancel booking.',
    'cancelBooking',
    ensureCancelReason(reason ?? booking.cancelReason, 'Cancelled by the user.')
  );
}

export function deleteBooking(id: number): Promise<void> {
  return apiVoid(`/api/bookings/${id}`, {
    method: 'DELETE',
    fallback: 'Failed to delete booking.',
    context: 'deleteBooking',
  });
}
