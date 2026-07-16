import React from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocale } from '../../../context/LocaleContext';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export type ReviewModerationItem = {
  id: number;
  providerName: string;
  providerAvatar: string | null;
  reviewerName: string;
  reviewerEmail: string;
  rating: number;
  title: string;
  comment: string;
  dateLabel: string;
  status: ReviewStatus;
  declineReason: string | null;
};

type Props = {
  review: ReviewModerationItem;
  isDarkMode: boolean;
  cardBg: string;
  textColor: string;
  subTextColor: string;
  borderColor: string;
  busy?: boolean;
  onApprove?: (id: number) => void;
  onDecline?: (id: number) => void;
};

// Labels are translation keys, resolved with t() at render.
const STATUS_STYLE: Record<ReviewStatus, { labelKey: string; color: string; bg: string }> = {
  pending: { labelKey: 'admin.statusPending', color: '#A16207', bg: '#FEF9C3' },
  approved: { labelKey: 'admin.statusApproved', color: '#15803D', bg: '#DCFCE7' },
  rejected: { labelKey: 'admin.statusDeclined', color: '#B91C1C', bg: '#FEE2E2' },
};

export function ReviewModerationCard({
  review,
  isDarkMode,
  cardBg,
  textColor,
  subTextColor,
  borderColor,
  busy,
  onApprove,
  onDecline,
}: Props) {
  const { t } = useLocale();
  const status = STATUS_STYLE[review.status];
  const initials = review.providerName
    .split(' ')
    .map((p) => p.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View
      style={{
        backgroundColor: cardBg,
        borderRadius: 16,
        borderWidth: 1,
        borderColor,
        padding: 16,
        marginBottom: 12,
      }}>
      {/* ── Header: reviewed provider + status badge ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {review.providerAvatar ? (
          <Image
            source={{ uri: review.providerAvatar }}
            style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }}
          />
        ) : (
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              marginRight: 12,
              backgroundColor: isDarkMode ? '#243447' : '#E8F5EF',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ color: '#00A85A', fontWeight: '700', fontSize: 15 }}>
              {initials || '?'}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: textColor, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
            {review.providerName}
          </Text>
          <Text style={{ color: subTextColor, fontSize: 12, marginTop: 1 }} numberOfLines={1}>
            {review.dateLabel}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: status.bg,
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}>
          <Text style={{ color: status.color, fontSize: 11, fontWeight: '700' }}>
            {t(status.labelKey as any)}
          </Text>
        </View>
      </View>

      {/* ── Star rating ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Ionicons
            key={i}
            name={i < review.rating ? 'star' : 'star-outline'}
            size={16}
            color="#F59E0B"
            style={{ marginRight: 2 }}
          />
        ))}
        <Text style={{ color: subTextColor, fontSize: 12, marginLeft: 6 }}>
          {review.rating.toFixed(1)}
        </Text>
      </View>

      {/* ── Title + comment ── */}
      {review.title ? (
        <Text style={{ color: textColor, fontSize: 14, fontWeight: '600', marginTop: 10 }}>
          {review.title}
        </Text>
      ) : null}
      {review.comment ? (
        <Text
          style={{
            color: subTextColor,
            fontSize: 13,
            lineHeight: 19,
            marginTop: review.title ? 4 : 10,
          }}>
          {review.comment}
        </Text>
      ) : null}

      {/* ── Reviewer (booker) ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
        <Ionicons name="person-circle-outline" size={16} color={subTextColor} />
        <Text style={{ color: subTextColor, fontSize: 12, marginLeft: 6 }} numberOfLines={1}>
          {review.reviewerName}
          {review.reviewerEmail ? ` · ${review.reviewerEmail}` : ''}
        </Text>
      </View>

      {/* ── Decline reason (when present) ── */}
      {review.status === 'rejected' && review.declineReason ? (
        <View
          style={{
            marginTop: 12,
            backgroundColor: isDarkMode ? '#3a1f1f' : '#FEF2F2',
            borderRadius: 10,
            padding: 10,
          }}>
          <Text style={{ color: '#B91C1C', fontSize: 12, fontWeight: '600' }}>
            {t('admin.declineReason')}
          </Text>
          <Text style={{ color: isDarkMode ? '#FCA5A5' : '#7F1D1D', fontSize: 12, marginTop: 2 }}>
            {review.declineReason}
          </Text>
        </View>
      ) : null}

      {/* ── Actions (pending only) ── */}
      {review.status === 'pending' ? (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={busy}
            onPress={() => onDecline?.(review.id)}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 11,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: '#FCA5A5',
              opacity: busy ? 0.6 : 1,
            }}>
            <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
            <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 14, marginLeft: 6 }}>
              {t('admin.decline')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={busy}
            onPress={() => onApprove?.(review.id)}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 11,
              borderRadius: 12,
              backgroundColor: '#00C870',
              opacity: busy ? 0.6 : 1,
            }}>
            {busy ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="white" />
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 14, marginLeft: 6 }}>
                  {t('admin.approve')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
