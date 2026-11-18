import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ResponsiveModal from './ResponsiveModal';
import { BRAND_GREEN, useThemeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';
import { useResource } from '../../hooks/useResource';
import { getReviewsPage, type ReviewDto } from '../../services/reviews';
import { SubmissionOrder } from '../../services/service-providers';
import { customerName } from '../../services/users';
import { formatShortDate } from '../../i18n/dates';

/** How many reviews one page of the "all reviews" sheet reads. */
const PAGE_SIZE = 20;
/** ApprovalStatus.Approved: only approved reviews are public. */
const APPROVED = 1;

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View className="flex-row items-center" accessibilityLabel={`${value}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Ionicons
          key={i}
          name={i < Math.round(value) ? 'star' : 'star-outline'}
          size={size}
          color="#F59E0B"
        />
      ))}
    </View>
  );
}

/**
 * One review: its stars, who wrote it and when, the title and the text. With `showService`, also
 * which of the partner's services it was for — ratings are the partner's, so a service page lists
 * reviews of their other services too (finding 37).
 */
export function ReviewItem({ review, showService }: { review: ReviewDto; showService?: boolean }) {
  const { cardBg, textColor, subtextColor, borderColor } = useThemeColors();
  const written = review.createdAt ? new Date(review.createdAt) : null;
  const byline = [
    customerName(review.user),
    written && !isNaN(written.getTime()) ? formatShortDate(written) : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View className={`${cardBg} mb-3 rounded-2xl border p-4 ${borderColor}`}>
      <View className="mb-2 flex-row items-center justify-between">
        <Stars value={review.rating} />
        {byline ? (
          <Text className={`ml-3 shrink text-xs ${subtextColor}`} numberOfLines={1}>
            {byline}
          </Text>
        ) : null}
      </View>
      {showService && review.serviceName ? (
        <View className="mb-1.5 flex-row items-center">
          <Ionicons name="pricetag-outline" size={12} color={BRAND_GREEN} />
          <Text className="ml-1 shrink text-xs font-medium text-brand-600" numberOfLines={1}>
            {review.serviceName}
          </Text>
        </View>
      ) : null}
      {review.title ? (
        <Text className={`mb-1 font-semibold ${textColor}`}>{review.title}</Text>
      ) : null}
      {review.comment ? <Text className={`text-sm ${subtextColor}`}>{review.comment}</Text> : null}
    </View>
  );
}

type Props = {
  serviceId: number;
  /**
   * The partner offering it. The stars a customer sees on a service are the partner's average over
   * all their services, so the list is the partner's reviews too; without it, the service's own.
   */
  serviceProviderId?: number | null;
  /** The average shown with the stars, when the caller has it; else worked out from the reviews read. */
  rating?: number | null;
  /** How many to show before "See all". */
  preview?: number;
  /** Drawn around the block (the booking form's card on the web, its gutter on a phone). */
  containerClassName?: string;
};

/**
 * What other customers said about a service, where the customer is deciding to book it (asked for
 * on 2026-11-18): the average and the count, the newest few, and every review a tap away in a
 * sheet that pages as it goes. Public: guests read it too, as they read the service page.
 */
export default function ServiceReviews({
  serviceId,
  serviceProviderId,
  rating,
  preview = 2,
  containerClassName,
}: Props) {
  const { textColor, subtextColor, cardBg } = useThemeColors();
  const { t } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  // Whose reviews: the partner's when known (they match the stars), else the service's own.
  const scope = serviceProviderId ? { serviceProviderId } : { serviceId };
  const scopeKey = serviceProviderId ? `provider-${serviceProviderId}` : `service-${serviceId}`;

  const { data: firstPage, isLoading } = useResource(
    ['reviews', scopeKey, 'first'],
    () =>
      getReviewsPage({
        ...scope,
        approvalStatus: APPROVED,
        order: SubmissionOrder.NewestFirst,
        page: 1,
        perPage: PAGE_SIZE,
      }),
    { enabled: (serviceProviderId ?? serviceId) > 0 }
  );
  const [more, setMore] = useState<ReviewDto[]>([]);
  const [nextPage, setNextPage] = useState(2);
  const [loadingMore, setLoadingMore] = useState(false);

  const total = firstPage?.totalItems ?? 0;
  const shown = [...(firstPage?.items ?? []), ...more];
  const average =
    rating && rating > 0
      ? rating
      : shown.length > 0
        ? shown.reduce((sum, r) => sum + r.rating, 0) / shown.length
        : 0;

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await getReviewsPage({
        ...scope,
        approvalStatus: APPROVED,
        order: SubmissionOrder.NewestFirst,
        page: nextPage,
        perPage: PAGE_SIZE,
      });
      setMore((prev) => [...prev, ...page.items]);
      setNextPage((n) => n + 1);
    } catch {
      // The sheet keeps what it has; the button stays for another try.
    } finally {
      setLoadingMore(false);
    }
  };

  const summary = (
    <View className="flex-row items-center">
      <Ionicons name="star" size={18} color="#F59E0B" />
      <Text className={`ml-1.5 text-base font-bold ${textColor}`}>
        {average > 0 ? average.toFixed(1) : '—'}
      </Text>
      <Text className={`ml-2 text-sm ${subtextColor}`}>
        {t('serviceReviews.count', { count: total })}
      </Text>
    </View>
  );

  return (
    <View className={containerClassName}>
      <View className="mb-3 flex-row items-center justify-between">
        <Text className={`text-base font-semibold ${textColor}`}>{t('serviceReviews.title')}</Text>
        {total > 0 ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('serviceReviews.seeAll', { count: total })}
            onPress={() => setIsOpen(true)}>
            {summary}
          </TouchableOpacity>
        ) : null}
      </View>
      {isLoading ? (
        <ActivityIndicator color={BRAND_GREEN} />
      ) : total === 0 ? (
        <Text className={`text-sm ${subtextColor}`}>{t('serviceReviews.none')}</Text>
      ) : (
        <>
          {shown.slice(0, preview).map((r, i) => (
            <ReviewItem key={r.id ?? i} review={r} showService={!!serviceProviderId} />
          ))}
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setIsOpen(true)}
            className="flex-row items-center self-start py-1">
            <Text className="text-sm font-semibold text-brand-600">
              {t('serviceReviews.seeAll', { count: total })}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={BRAND_GREEN} />
          </TouchableOpacity>
        </>
      )}

      <ResponsiveModal visible={isOpen} onClose={() => setIsOpen(false)} dialogWidth={560}>
        <View className={`${cardBg} p-5`} style={{ maxHeight: 680 }}>
          <View className="mb-3 flex-row items-center justify-between">
            <View>
              <Text className={`text-lg font-bold ${textColor}`}>{t('serviceReviews.title')}</Text>
              <View className="mt-1">{summary}</View>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={() => setIsOpen(false)}
              className="p-1">
              <Ionicons name="close" size={22} color={BRAND_GREEN} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 560 }}>
            {shown.map((r, i) => (
              <ReviewItem key={r.id ?? i} review={r} showService={!!serviceProviderId} />
            ))}
            {shown.length < total ? (
              <TouchableOpacity
                accessibilityRole="button"
                disabled={loadingMore}
                onPress={loadMore}
                className="items-center py-3">
                {loadingMore ? (
                  <ActivityIndicator color={BRAND_GREEN} />
                ) : (
                  <Text className="text-sm font-semibold text-brand-600">
                    {t('serviceReviews.showMore')}
                  </Text>
                )}
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </View>
      </ResponsiveModal>
    </View>
  );
}
