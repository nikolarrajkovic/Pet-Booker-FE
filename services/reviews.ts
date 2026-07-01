import { apiAuthFetch, getApiBaseUrl, parseApiError, extractPageItems } from './http';

export type ReviewDto = {
  id?: number | null;
  bookingId: number;
  userId: number;
  serviceProviderId: number;
  // The reviewed service. Optional on write (server defaults it); returned on
  // read since the API update. Pass it when available so the review is tied to
  // the specific service, not just the provider.
  serviceId?: number;
  rating: number;
  // Per-category sub-ratings (non-nullable server-side — createReview defaults
  // any missing one to the overall rating so they never post as 0)
  serviceQualityRating?: number;
  communicationRating?: number;
  timelinessRating?: number;
  valueRating?: number;
  title?: string | null;
  comment?: string | null;
  // Read-only moderation fields (reviews are admin-moderated via
  // /admin/reviews/{id}/approve|decline): ApprovalStatus 0=Pending, 1=Approved, 2=Declined
  approvalStatus?: number;
  declineReason?: string | null;
  createdAt?: string;
  photos?: {
    id?: number | null;
    alt?: string | null;
    name?: string | null;
    src?: string | null;
    fileUploadId?: number | null;
    isSelected: boolean;
  }[];
  // Read-only nested includes the GET embeds (used by the admin moderation UI):
  // the booker, the reviewed provider, and the related booking window.
  user?: {
    id?: number;
    userName?: string | null;
    email?: string | null;
    photos?: { src?: string | null; isSelected?: boolean }[];
  } | null;
  serviceProvider?: {
    id?: number;
    name?: string | null;
    photos?: { src?: string | null; isSelected?: boolean }[];
  } | null;
  booking?: {
    id?: number;
    state?: number;
    bookingFrom?: string;
    bookingTo?: string;
  } | null;
};

export type GetReviewsParams = {
  serviceProviderId?: number;
  userId?: number;
  bookingId?: number;
  rating?: number;
  approvalStatus?: number; // ApprovalStatus (see services/service-providers.ts)
  page?: number;
  perPage?: number;
};

export async function getReviews(params?: GetReviewsParams): Promise<ReviewDto[]> {
  const query = new URLSearchParams();
  if (params?.serviceProviderId !== undefined) query.set('ServiceProviderId', String(params.serviceProviderId));
  if (params?.userId !== undefined) query.set('UserId', String(params.userId));
  if (params?.bookingId !== undefined) query.set('BookingId', String(params.bookingId));
  if (params?.rating !== undefined) query.set('Rating', String(params.rating));
  if (params?.approvalStatus !== undefined) query.set('ApprovalStatus', String(params.approvalStatus));
  query.set('Page', String(params?.page ?? 1));
  query.set('PerPage', String(params?.perPage ?? 20));

  const url = `${getApiBaseUrl()}/api/reviews?${query.toString()}`;
  const response = await apiAuthFetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to load reviews.', 'getReviews'));
  }

  const raw = await response.json();
  return extractPageItems<ReviewDto>(raw);
}

export async function createReview(review: Omit<ReviewDto, 'id'>): Promise<ReviewDto> {
  const url = `${getApiBaseUrl()}/api/reviews`;
  // Sub-ratings are non-nullable on the API — default them to the overall rating
  const body: Omit<ReviewDto, 'id'> = {
    ...review,
    serviceQualityRating: review.serviceQualityRating ?? review.rating,
    communicationRating: review.communicationRating ?? review.rating,
    timelinessRating: review.timelinessRating ?? review.rating,
    valueRating: review.valueRating ?? review.rating,
  };
  const response = await apiAuthFetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to submit review.', 'createReview'));
  }

  return response.json();
}
