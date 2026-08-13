import { apiJson, apiList, apiPage, type ApiRequestOptions } from './http';

export type ReviewDto = {
  id?: number | null;
  bookingId: number;
  userId: number;
  serviceProviderId: number;
  // The reviewed service. REQUIRED on write — the API validates ServiceId > 0
  // (GreaterThanValidator; a missing/0 value 422s "ServiceId is required.").
  // Returned on read. Ties the review to the specific service, not just the provider.
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

/** Shared request options for the two shapes below — one place for the filter names. */
function reviewsRequest(params?: GetReviewsParams): ApiRequestOptions {
  return {
    query: {
      ServiceProviderId: params?.serviceProviderId,
      UserId: params?.userId,
      BookingId: params?.bookingId,
      Rating: params?.rating,
      ApprovalStatus: params?.approvalStatus,
      Page: params?.page ?? 1,
      PerPage: params?.perPage ?? 20,
    },
    fallback: 'Failed to load reviews.',
    context: 'getReviews',
  };
}

export async function getReviews(params?: GetReviewsParams): Promise<ReviewDto[]> {
  return apiList<ReviewDto>('/api/reviews', reviewsRequest(params));
}

/**
 * How many reviews match a filter, without reading them.
 *
 * Asks for a single row and returns the wrapper's `totalItems`. A badge that only needs a
 * number used to pull 200 full reviews — each with its nested user, provider and booking
 * includes — and call `.length` on them, which was both wasteful and silently wrong past the
 * page cap.
 */
export async function countReviews(params?: GetReviewsParams): Promise<number> {
  const page = await apiPage<ReviewDto>('/api/reviews', {
    ...reviewsRequest({ ...params, page: 1, perPage: 1 }),
    context: 'countReviews',
  });
  return page.totalItems;
}

export async function createReview(review: Omit<ReviewDto, 'id'>): Promise<ReviewDto> {
  return apiJson<ReviewDto>('/api/reviews', {
    method: 'POST',
    // Sub-ratings are non-nullable on the API — default them to the overall rating
    body: {
      ...review,
      serviceQualityRating: review.serviceQualityRating ?? review.rating,
      communicationRating: review.communicationRating ?? review.rating,
      timelinessRating: review.timelinessRating ?? review.rating,
      valueRating: review.valueRating ?? review.rating,
    } satisfies Omit<ReviewDto, 'id'>,
    fallback: 'Failed to submit review.',
    context: 'createReview',
  });
}
