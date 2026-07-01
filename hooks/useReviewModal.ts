import { useCallback, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { createReview } from '../services/reviews';
import { getErrorMessage } from '../services/http';

/** Which booking/provider a pending review belongs to, plus a name to show. */
export type ReviewTarget = { bookingId: number; serviceProviderId: number; serviceName: string };

/**
 * Owns the "leave a review" modal lifecycle for completed bookings: which booking
 * is being reviewed, the submitting flag, and the POST via `createReview`. Shared
 * by every entry point (notifications, booking details, my bookings) so the submit
 * logic lives in one place.
 *
 * @param onSubmitted Optional callback fired with the bookingId after a successful
 *   submit — e.g. to refresh a list/detail so the new rating shows.
 */
export function useReviewModal(onSubmitted?: (bookingId: number) => void) {
  const { currentUser } = useAuth();
  const { showError, showSuccess } = useToast();
  const [target, setTarget] = useState<ReviewTarget | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Keep the callback in a ref so `submit` stays stable (callers needn't memoize).
  const onSubmittedRef = useRef(onSubmitted);
  onSubmittedRef.current = onSubmitted;

  const open = useCallback((t: ReviewTarget) => setTarget(t), []);

  const close = useCallback(() => {
    setSubmitting((s) => {
      if (!s) setTarget(null); // ignore close requests mid-submit
      return s;
    });
  }, []);

  const submit = useCallback(
    async (rating: number, comment: string) => {
      if (!target || !currentUser?.id) return;
      setSubmitting(true);
      try {
        await createReview({
          bookingId: target.bookingId,
          userId: currentUser.id,
          serviceProviderId: target.serviceProviderId,
          rating,
          comment: comment.trim() || null,
        });
        setTarget(null);
        showSuccess('Your review has been submitted. Thank you!');
        onSubmittedRef.current?.(target.bookingId);
      } catch (e) {
        showError(getErrorMessage(e, 'Could not submit your review. Please try again.'));
      } finally {
        setSubmitting(false);
      }
    },
    [target, currentUser?.id, showError, showSuccess]
  );

  return { target, submitting, open, close, submit };
}
