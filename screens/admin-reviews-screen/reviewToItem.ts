import type { ReviewDto } from '../../services/reviews';
import { ApprovalStatus, resolveImageUrl } from '../../services/service-providers';
import type { ReviewModerationItem, ReviewStatus } from './components';

// ReviewDto (with nested user/serviceProvider includes) → the card's view shape.
// Takes the translate fn so name fallbacks follow the active language.
export function reviewToItem(
  t: (key: any, params?: Record<string, string | number>) => string,
  dto: ReviewDto
): ReviewModerationItem {
  const created = dto.createdAt ? new Date(dto.createdAt) : null;
  const providerPhoto =
    dto.serviceProvider?.photos?.find((p) => p.isSelected)?.src ??
    dto.serviceProvider?.photos?.[0]?.src ??
    null;
  const status: ReviewStatus =
    dto.approvalStatus === ApprovalStatus.Approved
      ? 'approved'
      : dto.approvalStatus === ApprovalStatus.Declined
        ? 'rejected'
        : 'pending';

  return {
    id: dto.id ?? 0,
    providerName: dto.serviceProvider?.name ?? t('admin.serviceProvider'),
    providerAvatar: resolveImageUrl(providerPhoto) || null,
    reviewerName: dto.user?.userName ?? t('admin.user'),
    reviewerEmail: dto.user?.email ?? '',
    rating: dto.rating ?? 0,
    title: dto.title ?? '',
    comment: dto.comment ?? '',
    dateLabel: created
      ? created.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : '',
    status,
    declineReason: dto.declineReason ?? null,
  };
}
