import { apiAuthFetch, getApiBaseUrl, parseApiError, extractPageItems } from './http';
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
  // Add-on selection — WRITE side. These flags are what register an add-on on
  // the booking; the server then computes the surcharge from the service's
  // pricing. Sending `location.pickupAddress` alone does NOT register pickup —
  // the flag must be set (verified live). Pickup ↔ pickupAddress, PetReturn
  // (Drop-off) ↔ leaveOverAddress. Non-nullable server-side, so always send them
  // (toWritableBooking round-trips them on PUT).
  includePickup?: boolean;
  includePetReturn?: boolean;
  includeSpecialNeeds?: boolean;
  distanceKm?: number | null;
  // Add-on money — READ-only, computed by the server from the service pricing
  // (not accepted on write; a client-sent totalPrice is recomputed server-side).
  pickupPrice?: number | null;
  petReturnPrice?: number | null;
  specialNeedsPrice?: number | null;
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
  includePickup?: boolean;
  includePetReturn?: boolean;
  includeSpecialNeeds?: boolean;
  distanceKm?: number | null;
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
  statusLabel: 'upcoming' | 'completed' | 'cancelled';
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

// Currencies with a well-known symbol render as "€52"; anything else falls back
// to "52 RSD". The server stamps a booking's priceCurrency from its provider
// (Currency, default EUR) — a client-sent value is ignored — so `null` (older
// rows) formats as EUR, matching the backend payment fallback.
const CURRENCY_SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', RUB: '₽' };

export function formatMoney(amount: number, currency?: string | null): string {
  const code = (currency ?? 'EUR').toUpperCase();
  const symbol = CURRENCY_SYMBOLS[code];
  return symbol ? `${symbol}${amount}` : `${amount} ${code}`;
}

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
  const query = new URLSearchParams();
  if (params?.userId !== undefined) query.set('UserId', String(params.userId));
  if (params?.serviceProviderId !== undefined)
    query.set('ServiceProviderId', String(params.serviceProviderId));
  if (params?.serviceId !== undefined) query.set('ServiceId', String(params.serviceId));
  if (params?.petId !== undefined) query.set('PetId', String(params.petId));
  if (params?.state !== undefined) query.set('State', String(params.state));
  if (params?.currentStatus !== undefined) query.set('CurrentStatus', String(params.currentStatus));
  if (params?.bookingFrom) query.set('BookingFrom', params.bookingFrom);
  if (params?.bookingTo) query.set('BookingTo', params.bookingTo);
  query.set('Page', String(params?.page ?? 1));
  query.set('PerPage', String(params?.perPage ?? 50));

  const url = `${getApiBaseUrl()}/api/bookings?${query.toString()}`;
  const response = await apiAuthFetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to load bookings.', 'getBookings'));
  }

  const raw = await response.json();
  return extractPageItems<BookingDto>(raw).map(withResolvedAddresses);
}

export async function getBooking(id: number): Promise<BookingDto> {
  const url = `${getApiBaseUrl()}/api/bookings/${id}`;
  const response = await apiAuthFetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to load booking.', 'getBooking'));
  }

  return withResolvedAddresses(await response.json());
}

export type CreateBookingInput = {
  userId: number;
  serviceProviderId: number;
  serviceId: number;
  petId: number;
  paymentMethodId: number; // REQUIRED — see API note below
  bookingFrom: string; // ISO date-time
  bookingTo: string; // ISO date-time
  basePrice: number;
  discountAmount?: number;
  totalPrice: number;
  // The chosen pricing option — REQUIRED when the service defines
  // pricingOptions. The server derives bookingTo/basePrice from the option
  // (the values sent above are then ignored server-side).
  pricingOptionId?: number;
  paymentType?: number; // defaults to Card
  // NOTE: there is deliberately no priceCurrency input — the server stamps it
  // from the booked service's provider (Currency, default EUR) and ignores any
  // client-sent value, like the other server-authoritative price fields.
  // Selecting Pickup / Drop-off. The presence of an address sets the matching
  // include flag (includePickup / includePetReturn) on the booking, which is
  // what actually registers the add-on. The address is posted inline under
  // `location` and now persists + round-trips on GET (BACKEND_GAPS B2 resolved
  // 2026-06-22): the read DTO returns it under `location.pickupAddress` /
  // `location.leaveOverAddress` (backfilled top-level by withResolvedAddresses).
  pickupAddress?: AddressDto;
  leaveOverAddress?: AddressDto;
  // Special Needs add-on — selected in BookService (no address, unlike pickup/
  // drop-off), carried through the appointment. Defaults false. The server
  // computes the specialNeedsPrice surcharge from the service pricing.
  includeSpecialNeeds?: boolean;
};

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
    // These flags register the add-ons; the server computes the surcharge (so it
    // overrides totalPrice). An address without its flag is ignored.
    includePickup: !!input.pickupAddress,
    includePetReturn: !!input.leaveOverAddress,
    includeSpecialNeeds: input.includeSpecialNeeds ?? false,
  };

  // Pickup/Drop-off addresses are sent INLINE in this POST (never /api/addresses).
  if (input.pickupAddress || input.leaveOverAddress) {
    body.location = {
      pickupAddress: input.pickupAddress ?? null,
      leaveOverAddress: input.leaveOverAddress ?? null,
    };
  }

  const url = `${getApiBaseUrl()}/api/bookings`;
  const response = await apiAuthFetch(url, { method: 'POST', body: JSON.stringify(body) });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to create booking.', 'createBooking'));
  }

  return withResolvedAddresses(await response.json());
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
    // Round-trip the add-on flags (non-nullable server-side) so a status/cancel
    // PUT doesn't silently clear a booking's pickup/return selection.
    includePickup: b.includePickup ?? false,
    includePetReturn: b.includePetReturn ?? false,
    includeSpecialNeeds: b.includeSpecialNeeds ?? false,
    distanceKm: b.distanceKm ?? null,
  };
}

/**
 * @deprecated The booking write DTO no longer carries `state`/`currentStatus`,
 * so the generic PUT can NOT change a booking's lifecycle — use the dedicated
 * endpoints instead (confirmBooking / declineBooking / startBookingService /
 * endBookingService / cancelBooking). Kept only for non-lifecycle scalar edits.
 */
export async function setBookingStatus(
  booking: BookingDto,
  currentStatus: number
): Promise<BookingDto> {
  const url = `${getApiBaseUrl()}/api/bookings/${booking.id}`;
  const body: BookingDto = { ...toWritableBooking(booking), currentStatus };

  const response = await apiAuthFetch(url, { method: 'PUT', body: JSON.stringify(body) });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to update booking.', 'setBookingStatus'));
  }

  return response.json();
}

/**
 * Live Session — partner taps "Start Service". Uses the dedicated
 * POST /bookings/{id}/start-service endpoint (moves the booking to
 * ServiceStarted, currentStatus = 3), mirroring confirm/decline rather than the
 * generic status PUT.
 */
export async function startBookingService(booking: BookingDto): Promise<BookingDto> {
  const url = `${getApiBaseUrl()}/bookings/${booking.id}/start-service`;
  const response = await apiAuthFetch(url, { method: 'POST' });

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, 'Failed to start service.', 'startBookingService')
    );
  }

  return response.json();
}

/**
 * Live Session — partner taps "End Service". Uses the dedicated
 * POST /bookings/{id}/complete-service endpoint (moves the booking to
 * ServiceEnded, currentStatus = 4). Preferred over the generic status PUT, which
 * can 500 on the completion email for an invalid recipient (the seed `admin`,
 * BACKEND_GAPS B4); LiveSession still re-fetches on error as a guard.
 */
export async function endBookingService(booking: BookingDto): Promise<BookingDto> {
  const url = `${getApiBaseUrl()}/bookings/${booking.id}/complete-service`;
  const response = await apiAuthFetch(url, { method: 'POST' });

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, 'Failed to complete service.', 'endBookingService')
    );
  }

  return response.json();
}

/**
 * Provider accepts a pending booking request via POST /bookings/{id}/confirm.
 * Sets currentStatus = ServiceConfirmedByProvider and returns the full booking.
 * GUARD (verified live): only bookings still in ServiceRequestedByUser can be
 * confirmed — anything else 422s ("Only bookings with status
 * ServiceRequestedByUser can be decided on."). Unlike the setBookingStatus PUT,
 * this does not 500 on recipients with invalid emails (BACKEND_GAPS B4).
 */
export async function confirmBooking(id: number): Promise<BookingDto> {
  const url = `${getApiBaseUrl()}/bookings/${id}/confirm`;
  const response = await apiAuthFetch(url, { method: 'POST' });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to accept booking.', 'confirmBooking'));
  }

  return response.json();
}

/**
 * Provider declines a pending booking request via POST /bookings/{id}/decline.
 * Sets state = Cancelled, currentStatus = DeclinedByProvider and stores the
 * reason as cancelReason (verified live). Same guard as confirmBooking — only
 * ServiceRequestedByUser bookings can be declined; use cancelBooking() to
 * cancel an already-accepted booking.
 */
export async function declineBooking(id: number, reason?: string): Promise<BookingDto> {
  // The decline body's `reason` is required and must be ≥10 chars server-side
  // (null → 400, 1–9 chars → 422). Fall back to a valid generic reason.
  const trimmed = (reason ?? '').trim();
  const finalReason = trimmed.length >= 10 ? trimmed : 'Declined by the provider.';
  const url = `${getApiBaseUrl()}/bookings/${id}/decline`;
  const response = await apiAuthFetch(url, {
    method: 'POST',
    body: JSON.stringify({ reason: finalReason }),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to decline booking.', 'declineBooking'));
  }

  return response.json();
}

/**
 * Cancels an already-accepted booking via the dedicated POST /bookings/{id}/cancel
 * endpoint (sets state = Cancelled, currentStatus = CancelledByUser and stores the
 * reason). This replaces the old PUT-with-state approach, which no longer works
 * now that `state` was removed from the booking write DTO. The `reason` field is
 * required (≥10 chars, like decline) — a blank/short one falls back to a generic.
 */
export async function cancelBooking(booking: BookingDto, reason?: string): Promise<BookingDto> {
  const trimmed = (reason ?? booking.cancelReason ?? '').trim();
  const finalReason = trimmed.length >= 10 ? trimmed : 'Cancelled by the user.';
  const url = `${getApiBaseUrl()}/bookings/${booking.id}/cancel`;
  const response = await apiAuthFetch(url, {
    method: 'POST',
    body: JSON.stringify({ reason: finalReason }),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to cancel booking.', 'cancelBooking'));
  }

  return response.json();
}

export async function deleteBooking(id: number): Promise<void> {
  const url = `${getApiBaseUrl()}/api/bookings/${id}`;
  const response = await apiAuthFetch(url, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to delete booking.', 'deleteBooking'));
  }
}
