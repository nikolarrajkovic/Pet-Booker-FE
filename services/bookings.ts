import { apiAuthFetch, getApiBaseUrl, parseApiError, extractPageItems } from './http';
import { resolveImageUrl } from './service-providers';

// BookingState enum (verified /enums): 0=Upcoming, 1=Completed, 2=Cancelled
export const BookingState = { Upcoming: 0, Completed: 1, Cancelled: 2 } as const;

// BookingStatusType enum (verified /enums): the detailed lifecycle status
export const BookingStatusType = {
  ServiceRequestedByUser: 0,
  ServiceConfirmedByProvider: 1,
  PrePayment: 2,
  ServiceStarted: 3,
  ServiceEnded: 4,
  PostPayment: 5,
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
  bookingTo: string;   // ISO date-time
  basePrice: number;
  discountAmount: number;
  totalPrice: number;
  paymentType: number;
  paymentMethodId: number; // REQUIRED — must reference an existing PaymentMethod
  currentStatus: number;
  // Populated on GET (read-only nested includes):
  serviceProvider?: NestedEntity | null;
  service?: NestedEntity | null;
  pet?: NestedEntity | null;
  createdAt?: string;
  updatedAt?: string;
};

/** UI-friendly booking shape for MyBookingsScreen / schedule views. */
export type BookingViewModel = {
  id: number;
  providerName: string;
  providerId: number;
  serviceName: string;
  serviceId: number;
  petName: string;
  petId: number;
  date: string;        // formatted, e.g. "Jun 15, 2026"
  time: string;        // formatted, e.g. "10:00 AM"
  bookingFrom: string; // raw ISO
  price: number;
  state: number;       // BookingState
  status: number;      // BookingStatusType
  statusLabel: 'upcoming' | 'completed' | 'cancelled';
  image: string;
};

function firstPhoto(entity?: NestedEntity | null): string {
  const photos = entity?.photos ?? [];
  const selected = photos.find((p) => p.isSelected) ?? photos[0];
  return resolveImageUrl(selected?.src);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
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
    state: dto.state,
    status: dto.currentStatus,
    statusLabel: stateToLabel(dto.state),
    image: firstPhoto(dto.serviceProvider) || firstPhoto(dto.pet),
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
  if (params?.serviceProviderId !== undefined) query.set('ServiceProviderId', String(params.serviceProviderId));
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
  return extractPageItems<BookingDto>(raw);
}

export async function getBooking(id: number): Promise<BookingDto> {
  const url = `${getApiBaseUrl()}/api/bookings/${id}`;
  const response = await apiAuthFetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to load booking.', 'getBooking'));
  }

  return response.json();
}

export type CreateBookingInput = {
  userId: number;
  serviceProviderId: number;
  serviceId: number;
  petId: number;
  paymentMethodId: number; // REQUIRED — see API note below
  bookingFrom: string;     // ISO date-time
  bookingTo: string;       // ISO date-time
  basePrice: number;
  discountAmount?: number;
  totalPrice: number;
  paymentType?: number;    // defaults to Card
  priceCurrency?: string;  // defaults to 'USD'
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
  const body: BookingDto = {
    id: 0,
    userId: input.userId,
    serviceProviderId: input.serviceProviderId,
    serviceId: input.serviceId,
    petId: input.petId,
    priceCurrency: input.priceCurrency ?? 'USD',
    state: BookingState.Upcoming,
    bookingFrom: input.bookingFrom,
    bookingTo: input.bookingTo,
    basePrice: input.basePrice,
    discountAmount: input.discountAmount ?? 0,
    totalPrice: input.totalPrice,
    paymentType: input.paymentType ?? PaymentType.Card,
    paymentMethodId: input.paymentMethodId,
    currentStatus: BookingStatusType.ServiceRequestedByUser,
  };

  const url = `${getApiBaseUrl()}/api/bookings`;
  const response = await apiAuthFetch(url, { method: 'POST', body: JSON.stringify(body) });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to create booking.', 'createBooking'));
  }

  return response.json();
}

/** Cancels a booking by setting state = Cancelled with an optional reason. */
export async function cancelBooking(booking: BookingDto, reason?: string): Promise<BookingDto> {
  const url = `${getApiBaseUrl()}/api/bookings/${booking.id}`;
  const body: BookingDto = {
    ...booking,
    state: BookingState.Cancelled,
    cancelReason: reason ?? booking.cancelReason ?? 'Cancelled by user',
  };

  const response = await apiAuthFetch(url, { method: 'PUT', body: JSON.stringify(body) });

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
