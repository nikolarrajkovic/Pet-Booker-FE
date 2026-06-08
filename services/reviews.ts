import { apiAuthFetch, getApiBaseUrl, parseApiError, extractPageItems } from './http';

export type ReviewDto = {
  id?: number | null;
  bookingId: number;
  userId: number;
  serviceProviderId: number;
  rating: number;
  title?: string | null;
  comment?: string | null;
  photos?: Array<{
    id?: number | null;
    alt?: string | null;
    name?: string | null;
    src?: string | null;
    fileUploadId?: number | null;
    isSelected: boolean;
  }>;
};

export type GetReviewsParams = {
  serviceProviderId?: number;
  userId?: number;
  bookingId?: number;
  rating?: number;
  page?: number;
  perPage?: number;
};

export async function getReviews(params?: GetReviewsParams): Promise<ReviewDto[]> {
  const query = new URLSearchParams();
  if (params?.serviceProviderId !== undefined) query.set('ServiceProviderId', String(params.serviceProviderId));
  if (params?.userId !== undefined) query.set('UserId', String(params.userId));
  if (params?.bookingId !== undefined) query.set('BookingId', String(params.bookingId));
  if (params?.rating !== undefined) query.set('Rating', String(params.rating));
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
  const response = await apiAuthFetch(url, {
    method: 'POST',
    body: JSON.stringify(review),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to submit review.', 'createReview'));
  }

  return response.json();
}
