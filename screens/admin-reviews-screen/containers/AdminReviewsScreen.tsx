import React, { useState, useCallback, useMemo } from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  BackHandler,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useToast } from '../../../context/ToastContext';
import { useLocale } from '../../../context/LocaleContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { ReviewModerationCard } from '../components';
import type { ReviewModerationItem, ReviewStatus } from '../components';
import { getReviews, ReviewDto } from '../../../services/reviews';
import { approveReview, declineReview } from '../../../services/admin';
import { ApprovalStatus, resolveImageUrl } from '../../../services/service-providers';
import { getErrorMessage } from '../../../services/http';

// ReviewDto (with nested user/serviceProvider includes) → the card's view shape.
// Takes the translate fn so name fallbacks follow the active language.
function reviewToItem(
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

type FilterTab = ReviewStatus;

// Labels are translation keys, resolved with t() at render.
const TABS: {
  key: FilterTab;
  labelKey: string;
  icon: any;
  activeColor: string;
  activeBg: string;
}[] = [
  {
    key: 'pending',
    labelKey: 'admin.statusPending',
    icon: 'time-outline',
    activeColor: '#A16207',
    activeBg: '#FEF9C3',
  },
  {
    key: 'approved',
    labelKey: 'admin.statusApproved',
    icon: 'checkmark-circle-outline',
    activeColor: '#15803D',
    activeBg: '#DCFCE7',
  },
  {
    key: 'rejected',
    labelKey: 'admin.statusDeclined',
    icon: 'close-circle-outline',
    activeColor: '#B91C1C',
    activeBg: '#FEE2E2',
  },
];

export default function AdminReviewsScreen() {
  const navigation = useNavigation<any>();
  const {
    isDarkMode,
    hex,
    inputBg,
    inputText,
    textColor: tColor,
    subtextColor,
    borderColor: bColor,
    placeholderColor,
  } = useThemeColors();
  const { showError } = useToast();
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');
  const [reviews, setReviews] = useState<ReviewDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  // Decline-reason modal: the review being declined + the admin's reason text.
  const [declineTargetId, setDeclineTargetId] = useState<number | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // No approvalStatus filter — fetch all so every tab has its data in one call.
      setReviews(await getReviews({ perPage: 200 }));
    } catch (e) {
      setLoadError(getErrorMessage(e, t('admin.reviewsLoadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  // Android hardware back → AdminDashboard
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        navigation.navigate('MainTabs', { screen: 'AdminDashboard' });
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [navigation])
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!cancelled) await load();
      })();
      return () => {
        cancelled = true;
      };
    }, [load])
  );

  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-[#F5F7FA]';
  const cardBg = hex.card;
  const textColor = hex.text;
  const subTextColor = hex.subtext;
  const borderColor = hex.border;

  const items = useMemo(() => reviews.map((r) => reviewToItem(t, r)), [reviews, t]);

  const counts = {
    pending: items.filter((r) => r.status === 'pending').length,
    approved: items.filter((r) => r.status === 'approved').length,
    rejected: items.filter((r) => r.status === 'rejected').length,
  };

  const filtered = items.filter((r) => r.status === activeTab);

  const handleApprove = async (id: number) => {
    if (busyId !== null) return;
    setBusyId(id);
    try {
      await approveReview(id);
      await load();
    } catch (e) {
      showError(getErrorMessage(e, t('admin.approveReviewFailed')));
    } finally {
      setBusyId(null);
    }
  };

  // Open the decline-reason modal (reason collected, then sent).
  const handleDecline = (id: number) => {
    if (busyId !== null) return;
    setDeclineReason('');
    setDeclineTargetId(id);
  };

  const confirmDecline = async () => {
    if (declineTargetId === null) return;
    const id = declineTargetId;
    const trimmed = declineReason.trim();
    // Server requires a reason of ≥10 chars when one is given; blank is allowed
    // and uses a generic fallback. Guard the 1–9 char range.
    if (trimmed.length > 0 && trimmed.length < 10) return;
    const reason = trimmed || t('admin.declinedByAdminReason');
    setDeclineTargetId(null);
    setBusyId(id);
    try {
      await declineReview(id, reason);
      await load();
    } catch (e) {
      showError(getErrorMessage(e, t('admin.declineReviewFailed')));
    } finally {
      setBusyId(null);
    }
  };

  // A typed reason must be ≥10 chars (server rule); blank is fine (uses fallback).
  const declineReasonTooShort = declineReason.trim().length > 0 && declineReason.trim().length < 10;

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      onBackPress={() => navigation.navigate('MainTabs', { screen: 'AdminDashboard' })}
      headerTitle={t('admin.reviewsTitle')}
      headerSubtitle={t('admin.reviewsSubtitle')}
      contentBg={contentBg}>
      {/* ── Filter tabs ── */}
      <View
        style={{
          flexDirection: 'row',
          marginHorizontal: 16,
          marginTop: 20,
          marginBottom: 12,
          gap: 8,
        }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: isActive ? tab.activeBg : cardBg,
                borderWidth: 1.5,
                borderColor: isActive ? tab.activeColor + '55' : borderColor,
              }}>
              <Ionicons
                name={tab.icon}
                size={14}
                color={isActive ? tab.activeColor : subTextColor}
              />
              <Text
                style={{
                  color: isActive ? tab.activeColor : subTextColor,
                  fontSize: 13,
                  fontWeight: '600',
                  marginLeft: 5,
                }}>
                {t(tab.labelKey as any)}
              </Text>
              <View
                style={{
                  marginLeft: 5,
                  backgroundColor: isActive ? tab.activeColor : isDarkMode ? '#374151' : '#E5E7EB',
                  borderRadius: 8,
                  minWidth: 18,
                  height: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 4,
                }}>
                <Text
                  style={{
                    color: isActive ? 'white' : subTextColor,
                    fontSize: 10,
                    fontWeight: '700',
                  }}>
                  {counts[tab.key]}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── List ── */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 4 }}
        showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
            <ActivityIndicator size="large" color="#00C870" />
          </View>
        ) : loadError ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
            <Ionicons
              name="alert-circle-outline"
              size={64}
              color={isDarkMode ? '#4B5563' : '#D1D5DB'}
            />
            <Text style={{ color: subTextColor, textAlign: 'center', marginTop: 16, fontSize: 15 }}>
              {loadError}
            </Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
            <Ionicons name="star-outline" size={64} color={isDarkMode ? '#4B5563' : '#D1D5DB'} />
            <Text style={{ color: subTextColor, textAlign: 'center', marginTop: 16, fontSize: 15 }}>
              {activeTab === 'pending'
                ? t('admin.noPendingReviews')
                : activeTab === 'approved'
                  ? t('admin.noApprovedReviews')
                  : t('admin.noDeclinedReviews')}
            </Text>
          </View>
        ) : (
          filtered.map((review) => (
            <ReviewModerationCard
              key={review.id}
              review={review}
              isDarkMode={isDarkMode}
              cardBg={cardBg}
              textColor={textColor}
              subTextColor={subTextColor}
              borderColor={borderColor}
              busy={busyId === review.id}
              onApprove={busyId !== null ? undefined : handleApprove}
              onDecline={busyId !== null ? undefined : handleDecline}
            />
          ))
        )}
      </ScrollView>

      {/* ── Decline-reason modal ── */}
      <Modal
        visible={declineTargetId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeclineTargetId(null)}>
        <View className="flex-1 justify-center bg-black/50 px-6">
          <View style={{ backgroundColor: cardBg, borderRadius: 16, padding: 20 }}>
            <Text style={{ color: tColor, fontSize: 18, fontWeight: '700', marginBottom: 4 }}>
              {t('admin.declineReviewTitle')}
            </Text>
            <Text style={{ color: subtextColor, fontSize: 13, marginBottom: 16 }}>
              {t('admin.declineReviewMsg')}
            </Text>
            <TextInput
              value={declineReason}
              onChangeText={setDeclineReason}
              placeholder={t('admin.declineReasonPlaceholder')}
              placeholderTextColor={placeholderColor}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              className={`${inputBg} ${inputText}`}
              style={{
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                minHeight: 80,
                marginBottom: declineReasonTooShort ? 4 : 16,
              }}
              selectionColor="#00C870"
            />
            {declineReasonTooShort && (
              <Text style={{ color: '#EF4444', fontSize: 12, marginBottom: 12 }}>
                Please use at least 10 characters, or leave it blank.
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setDeclineTargetId(null)}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: bColor,
                  paddingVertical: 12,
                }}>
                <Text style={{ color: tColor, fontWeight: '600' }}>{t('admin.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDecline}
                disabled={declineReasonTooShort}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  borderRadius: 12,
                  backgroundColor: '#EF4444',
                  paddingVertical: 12,
                  opacity: declineReasonTooShort ? 0.5 : 1,
                }}>
                <Text style={{ color: 'white', fontWeight: '600' }}>{t('admin.decline')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenLayout>
  );
}
