import React from 'react';
import { View, Text } from 'react-native';
import Avatar from '../../../components/shared/Avatar';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useResponsive } from '../../../hooks/useResponsive';
import { useLocale } from '../../../context/LocaleContext';
import {
  WebListCell,
  WebListHeader,
  WebListRow,
  WebRowButton,
  type WebColumn,
} from '../../../components/shared/WebListRow';
import type { ReviewModerationItem } from './ReviewModerationCard';

/** The columns of the web reviews list, shared by the header and every row. */
export const REVIEW_COLUMNS = {
  provider: { labelKey: 'admin.colProvider', flex: 1.6 },
  review: { labelKey: 'admin.colReview', flex: 3.4 },
  submitted: { labelKey: 'admin.colSubmitted', width: 120 },
  actions: { width: 212, align: 'right' },
} satisfies Record<string, WebColumn>;

export function ReviewModerationListHeader({ withActions }: { withActions: boolean }) {
  const { isDesktop } = useResponsive();
  const c = REVIEW_COLUMNS;
  // Mirrors the row: below desktop the review moves to a second line and loses its column.
  const columns: WebColumn[] = [c.provider, ...(isDesktop ? [c.review] : []), c.submitted];
  if (withActions) columns.push(c.actions);
  return <WebListHeader columns={columns} />;
}

type Props = {
  review: ReviewModerationItem;
  busy?: boolean;
  onApprove?: () => void;
  onDecline?: () => void;
};

/**
 * A review on the web design: who it is about and who wrote it, what they said, when — and, while
 * it is pending, the decision, on the same line. The phone keeps `ReviewModerationCard`.
 *
 * The comment gets the widest column and two lines before it ellipsises: it is the thing being
 * moderated, and a reviewer should not have to open anything to judge an ordinary review.
 */
export function ReviewModerationRow({ review, busy, onApprove, onDecline }: Props) {
  const { isDesktop } = useResponsive();
  const { isDarkMode, textColor, subtextColor } = useThemeColors();
  const { t } = useLocale();
  const c = REVIEW_COLUMNS;
  const isPending = review.status === 'pending';

  const provider = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch' }}>
      <Avatar
        uri={review.providerAvatar}
        name={review.providerName}
        size={40}
        placeholderClassName={isDarkMode ? 'bg-[#1e3a2f]' : 'bg-brand-50'}
        textClassName="text-base font-bold text-brand-600"
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text className={`text-[14px] font-bold ${textColor}`} numberOfLines={2}>
          {review.providerName}
        </Text>
        <Text className={`mt-0.5 text-xs ${subtextColor}`} numberOfLines={1}>
          {t('admin.reviewBy', { name: review.reviewerName })}
        </Text>
        {!!review.reviewerEmail && (
          <Text className={`text-xs ${subtextColor}`} numberOfLines={1}>
            {review.reviewerEmail}
          </Text>
        )}
      </View>
    </View>
  );

  const body = (
    <View style={{ alignSelf: 'stretch', minWidth: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        {Array.from({ length: 5 }, (_, i) => (
          <Ionicons
            key={i}
            name={i < review.rating ? 'star' : 'star-outline'}
            size={14}
            color="#F59E0B"
          />
        ))}
        <Text className={`ml-1.5 text-xs font-semibold ${textColor}`}>
          {review.rating.toFixed(1)}
        </Text>
      </View>
      {!!review.title && (
        <Text className={`mt-1 text-[14px] font-semibold ${textColor}`} numberOfLines={1}>
          {review.title}
        </Text>
      )}
      {!!review.comment && (
        <Text className={`mt-0.5 text-[13px] ${subtextColor}`} numberOfLines={2}>
          {review.comment}
        </Text>
      )}
      {review.status === 'rejected' && !!review.declineReason && (
        <Text className="mt-1 text-xs" style={{ color: '#B91C1C' }} numberOfLines={1}>
          {t('admin.declineReason')}: {review.declineReason}
        </Text>
      )}
    </View>
  );

  const submitted = (
    <Text className={`text-[13px] font-medium ${textColor}`}>{review.dateLabel}</Text>
  );

  const actions = isPending ? (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <WebRowButton label={t('admin.decline')} onPress={onDecline} tone="danger" disabled={busy} />
      <WebRowButton
        label={t('admin.approve')}
        icon="checkmark-circle-outline"
        onPress={onApprove}
        tone="primary"
        disabled={busy}
      />
    </View>
  ) : null;

  return (
    <WebListRow
      hasActions={isPending}
      footer={
        // Narrower than the desktop design: the review itself takes the second line whole, which
        // reads better than a comment column a hundred pixels wide.
        !isDesktop ? <View style={{ marginTop: 12, paddingLeft: 52 }}>{body}</View> : undefined
      }>
      <WebListCell column={c.provider}>{provider}</WebListCell>
      {isDesktop && <WebListCell column={c.review}>{body}</WebListCell>}
      <WebListCell column={c.submitted}>{submitted}</WebListCell>
      {actions && <WebListCell column={c.actions}>{actions}</WebListCell>}
    </WebListRow>
  );
}
