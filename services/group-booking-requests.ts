import { apiJson, apiPage, type PagedResult } from './http';
import { declaredWriteCurrency } from './currency';
import type { AddressDto } from './service-providers';
import type { AdditionalServiceDto } from './services';

/**
 * Group requests — "ask several providers at once" (`/api/group-booking-requests`).
 *
 * A pet owner describes one service they need (type, pet, time, optional address and note) and
 * sends it to providers they picked from the browse list, or to **every provider matching the
 * filters they had applied**. Providers see it in their Group requests inbox; the **first to
 * accept** turns it into an ordinary confirmed booking on one of their own services (priced by the
 * server, like any booking) and the request closes for everyone else. Nothing about a request is
 * editable after it is sent — the owner can only cancel it while it is open.
 *
 * - Create / list / find are the generated CRUD routes; accept / decline / cancel are POSTs.
 * - The list's `view` picks the side: `Mine` (the owner's requests), `Inbox` (open requests the
 *   provider can still answer), `Answered` (their history, narrowed by `response`).
 * - **An open request is not a booking.** It reaches the owner's bookings only once accepted, as a
 *   normal booking — so `bookingId` on a Fulfilled request is the link to follow.
 * - `bookingFrom`/`bookingTo` are naive wall-clock, exactly like a booking's: read with
 *   `parseBookingDate`, write with `formatBookingDate` (services/bookings.ts).
 * - Statuses: Open → Fulfilled | Cancelled, and **Expired is derived** by the server for an open
 *   request whose start has passed — it is never written.
 */

export const GroupBookingAudience = { SelectedProviders: 0, AnyEligible: 1 } as const;
export type GroupBookingAudienceValue =
  (typeof GroupBookingAudience)[keyof typeof GroupBookingAudience];

export const GroupBookingStatus = { Open: 0, Fulfilled: 1, Cancelled: 2, Expired: 3 } as const;
export type GroupBookingStatusValue = (typeof GroupBookingStatus)[keyof typeof GroupBookingStatus];

export const GroupBookingResponse = { Pending: 0, Declined: 1, Accepted: 2 } as const;
export type GroupBookingResponseValue =
  (typeof GroupBookingResponse)[keyof typeof GroupBookingResponse];

export const GroupBookingRequestView = { Mine: 0, Inbox: 1, All: 2, Answered: 3 } as const;
export type GroupBookingRequestViewValue =
  (typeof GroupBookingRequestView)[keyof typeof GroupBookingRequestView];

export type GroupBookingRecipientReadDto = {
  serviceProviderId: number;
  serviceProviderName?: string | null;
  serviceId?: number | null;
  serviceName?: string | null;
  isInvited: boolean;
  response: GroupBookingResponseValue;
  respondedAt?: string | null;
  declineReason?: string | null;
};

export type GroupBookingPricingOptionReadDto = {
  id: number;
  name: string;
  durationMinutes: number;
  price: number;
};

/** One of the provider's own services that can take the request — the accept dialog's choices. */
export type GroupBookingEligibleServiceReadDto = {
  serviceId: number;
  name: string;
  price: number;
  currency: string;
  /** The owner picked this provider from this very service. */
  isPreselected: boolean;
  /** Non-empty → one must be picked to accept (the booking's end follows its duration). */
  pricingOptions: GroupBookingPricingOptionReadDto[];
  /**
   * The extras the owner asked for, as this service offers them. Accepting puts them on the
   * booking's bill (a per-distance one priced from the trip once the address is known).
   */
  requiredExtras: AdditionalServiceDto[];
};

export type GroupBookingRequestDto = {
  id: number;
  userId: number;
  /** The owner's first name — all a provider sees of them before accepting. */
  userFirstName?: string | null;
  petId: number;
  petName?: string | null;
  petSpecies?: number | null;
  petBreed?: string | null;
  petPhotoUrl?: string | null;
  serviceType: number;
  bookingFrom: string;
  bookingTo: string;
  /**
   * "As soon as possible": `bookingFrom` is when it was asked, `bookingTo − bookingFrom` the length
   * wanted, and it stays open until `activeUntil` (naive wall-clock). It starts when a provider
   * accepts — they say how soon they can be there.
   */
  isAsap?: boolean;
  activeUntil?: string | null;
  addressId?: number | null;
  /** Owner / admin / the accepting provider only. Everyone else gets `city`. */
  address?: AddressDto | null;
  city?: string | null;
  note?: string | null;
  paymentType: number;
  audience: GroupBookingAudienceValue;
  /** Effective status (Expired derived server-side). */
  status: GroupBookingStatusValue;
  minPrice?: number | null;
  maxPrice?: number | null;
  priceCurrency: string;
  minRating?: number | null;
  acceptedSpecies?: number | null;
  onSaleOnly: boolean;
  /** `AdditionalServiceKind` FLAGS: kinds of extra every provider's service must offer. */
  requiredAddOnKinds?: number | null;
  acceptedServiceProviderId?: number | null;
  acceptedServiceProviderName?: string | null;
  bookingId?: number | null;
  closedAt?: string | null;
  cancelReason?: string | null;
  createdAt: string;
  /** Owner/admin: every recipient. Provider: only their own row. */
  recipients: GroupBookingRecipientReadDto[];
  /** Owner/admin, AnyEligible: the providers left out. Always empty for a provider. */
  excluded?: GroupBookingRecipientReadDto[];
  invitedCount: number;
  declinedCount: number;
  /** AnyEligible: only providers within this many km were asked. Null: any distance. */
  maxDistanceKm?: number | null;
  /**
   * Owner/admin only: how many providers the request went to when it was sent ("Sent to 6
   * walkers"); 0 means nobody could see it. Null on requests sent before this was recorded.
   */
  reachedProviderCount?: number | null;
  /** Provider reader only. */
  myResponse?: GroupBookingResponseValue | null;
  /** Provider reader only — empty means they have nothing to accept it with. */
  myEligibleServices: GroupBookingEligibleServiceReadDto[];
};

export type CreateGroupBookingRequestInput = {
  petId: number;
  serviceType: number;
  /** Naive wall-clock (`formatBookingDate`). For ASAP: now and now + the length wanted. */
  bookingFrom: string;
  bookingTo: string;
  /** "As soon as possible": the server starts it at its own now and keeps it open until `activeUntil`. */
  isAsap?: boolean;
  /** ASAP only: the latest start the owner will take (15 minutes to 12 hours ahead). Wall-clock. */
  activeUntil?: string | null;
  addressId?: number | null;
  note?: string | null;
  paymentType: number;
  paymentMethodId: number;
  audience: GroupBookingAudienceValue;
  /** SelectedProviders: the picks, each with the service it was picked from. */
  providers?: { serviceProviderId: number; serviceId?: number | null }[];
  /** AnyEligible: providers the owner unticked — every matching provider except these. */
  excludedProviderIds?: number[];
  /** AnyEligible: the browse filters applied when "any matching provider" was chosen. */
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  acceptedSpecies?: number;
  onSaleOnly?: boolean;
  /** `AdditionalServiceKind` FLAGS OR-ed: kinds of extra the provider's service must offer. */
  requiredAddOnKinds?: number;
  /**
   * AnyEligible: ask only providers within this many km (1–100) of the place, else of the
   * owner's home address. Dropped by the server when neither is on the map.
   */
  maxDistanceKm?: number | null;
};

const PATH = '/api/group-booking-requests';

/** The distances the request form offers, in km; `null` is "any distance". */
export const REQUEST_DISTANCES_KM = [null, 2, 5, 10, 20] as const;

/**
 * Sends the request. Price bounds are in the currency the user saw them in, so the body DECLARES
 * that currency (`declaredWriteCurrency`) — undeclared, the server would read them as RSD.
 */
export function createGroupBookingRequest(
  input: CreateGroupBookingRequestInput
): Promise<GroupBookingRequestDto> {
  return apiJson<GroupBookingRequestDto>(PATH, {
    method: 'POST',
    body: {
      id: 0,
      userId: 0, // bound from the session server-side
      ...input,
      providers: input.providers ?? [],
      onSaleOnly: input.onSaleOnly ?? false,
      currency: declaredWriteCurrency(),
    },
    fallback: 'Could not send your request.',
    context: 'createGroupBookingRequest',
  });
}

export type GetGroupBookingRequestsParams = {
  view: GroupBookingRequestViewValue;
  /** Mine: true = open and upcoming, false = everything else. */
  isActive?: boolean;
  /** Answered: accepted only / declined only. */
  response?: GroupBookingResponseValue;
  page?: number;
  perPage?: number;
};

export function getGroupBookingRequestsPage(
  params: GetGroupBookingRequestsParams
): Promise<PagedResult<GroupBookingRequestDto>> {
  return apiPage<GroupBookingRequestDto>(PATH, {
    query: {
      View: params.view,
      IsActive: params.isActive,
      Response: params.response,
      Page: params.page ?? 1,
      PerPage: params.perPage ?? 20,
    },
    fallback: 'Failed to load group requests.',
    context: 'getGroupBookingRequestsPage',
  });
}

/** How many requests a list holds, without reading them (one row, the wrapper's total). */
export async function countGroupBookingRequests(
  params: Omit<GetGroupBookingRequestsParams, 'page' | 'perPage'>
): Promise<number> {
  const page = await getGroupBookingRequestsPage({ ...params, page: 1, perPage: 1 });
  return page.totalItems;
}

export function getGroupBookingRequest(id: number): Promise<GroupBookingRequestDto> {
  return apiJson<GroupBookingRequestDto>(`${PATH}/${id}`, {
    fallback: 'Failed to load the group request.',
    context: 'getGroupBookingRequest',
  });
}

/**
 * Provider: take it with one of their services. First come, first served — a late accept 400s.
 * An ASAP request also needs `startInMinutes` (how soon they can start, 0–180, by its deadline).
 */
export function acceptGroupBookingRequest(
  id: number,
  serviceId: number,
  pricingOptionId?: number | null,
  startInMinutes?: number | null
): Promise<GroupBookingRequestDto> {
  return apiJson<GroupBookingRequestDto>(`${PATH}/${id}/accept`, {
    method: 'POST',
    body: {
      serviceId,
      pricingOptionId: pricingOptionId ?? null,
      startInMinutes: startInMinutes ?? null,
    },
    fallback: 'Could not accept this request.',
    context: 'acceptGroupBookingRequest',
  });
}

/** Provider: pass on it. It stays open for the others. */
export function declineGroupBookingRequest(
  id: number,
  reason?: string
): Promise<GroupBookingRequestDto> {
  return apiJson<GroupBookingRequestDto>(`${PATH}/${id}/decline`, {
    method: 'POST',
    body: { reason: reason?.trim() || null },
    fallback: 'Could not decline this request.',
    context: 'declineGroupBookingRequest',
  });
}

/** Owner: withdraw an open request. */
/**
 * Sends an "as soon as possible" request that closed with nobody accepting it again: a new request
 * with the same pet, length, place and providers, open for `openForMinutes` (else as long as
 * before) and within `maxDistanceKm` (null: any distance).
 */
export function sendGroupBookingRequestAgain(
  id: number,
  options: { openForMinutes?: number | null; maxDistanceKm?: number | null }
): Promise<GroupBookingRequestDto> {
  return apiJson<GroupBookingRequestDto>(`${PATH}/${id}/send-again`, {
    method: 'POST',
    body: {
      openForMinutes: options.openForMinutes ?? null,
      maxDistanceKm: options.maxDistanceKm ?? null,
    },
    fallback: 'Could not send your request again.',
    context: 'sendGroupBookingRequestAgain',
  });
}

export function cancelGroupBookingRequest(
  id: number,
  reason?: string
): Promise<GroupBookingRequestDto> {
  return apiJson<GroupBookingRequestDto>(`${PATH}/${id}/cancel`, {
    method: 'POST',
    body: { reason: reason?.trim() || null },
    fallback: 'Could not cancel this request.',
    context: 'cancelGroupBookingRequest',
  });
}
