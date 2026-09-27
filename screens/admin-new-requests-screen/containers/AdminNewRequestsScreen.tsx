import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View, BackHandler } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAppNavigation } from '../../../hooks/useAppNavigation';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useResponsive } from '../../../hooks/useResponsive';
import { useToast } from '../../../context/ToastContext';
import { useLocale } from '../../../context/LocaleContext';
import { getErrorMessage } from '../../../services/http';
import { showAlert } from '../../../services/alert';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import ListState from '../../../components/shared/ListState';
import FilterTabs, { moderationTabs } from '../../../components/shared/FilterTabs';
import SortMenu from '../../../components/shared/SortMenu';
import LoadMoreFooter, { isNearBottom } from '../../../components/shared/LoadMoreFooter';
import { useNearBottomLoader } from '../../../hooks/useNearBottomLoader';
import {
  useModerationQueue,
  SUBMISSION_ORDER_OPTIONS,
  type ModerationPageQuery,
} from '../../../hooks/useModerationQueue';
import {
  countServiceProviders,
  getServiceProvidersPage,
  type ServiceProviderDto,
} from '../../../services/service-providers';
import {
  approveCertificate,
  approveServiceProvider,
  declineServiceProvider,
} from '../../../services/admin';
import { PartnerApplicationCard } from '../components';
import type { PartnerApplication } from '../components';
import {
  PartnerApplicationListHeader,
  PartnerApplicationRow,
} from '../components/PartnerApplicationRow';
import { providerToApplication } from '../providerToApplication';

// A rejected application reads "Rejected" rather than the reviews queue's "Declined".
const TABS = moderationTabs('admin.statusRejected');

// Module functions, so their identity is stable for the paging hook.
const fetchApplicationsPage = (query: ModerationPageQuery) => getServiceProvidersPage(query);
const countApplications = (approvalStatus: number) => countServiceProviders({ approvalStatus });

/**
 * Partner applications: one tab per status, each paging itself from the server as the reviewer
 * scrolls, in its own order — pending oldest first, decisions newest first, both re-orderable.
 *
 * Both designs share the list; only the item differs. The web design draws a full-width row per
 * application under a column header (`PartnerApplicationRow`), the phone keeps its expandable
 * card queue (`PartnerApplicationCard`).
 *
 * Both used to read every provider in the system up front — one 200-row page after another — and
 * split them into tabs on the client, so opening the queue got slower with every partner who had
 * ever signed up, approved or not.
 */
export default function AdminNewRequestsScreen() {
  const navigation = useNavigation<any>();
  const { goUp } = useAppNavigation();
  const { isDarkMode, hex, subtextColor } = useThemeColors();
  const { isWebLayout } = useResponsive();
  const { showError } = useToast();
  const { t } = useLocale();
  const [busyId, setBusyId] = useState<number | null>(null);

  const queue = useModerationQueue<ServiceProviderDto>({
    fetchPage: fetchApplicationsPage,
    count: countApplications,
    resource: 'service-providers',
    errorFallback: t('admin.applicationsLoadFailed'),
  });
  const applications = useMemo(() => queue.items.map(providerToApplication), [queue.items]);
  const listRef = useNearBottomLoader(true, queue.loadMore);

  // Android hardware back, kept in step with the header button.
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        // Same rule as the header's back button: pop real history when there is some, so a
        // notification that opened this screen leads back to the feed, and fall back to the
        // admin home only when there is nothing to pop.
        if (navigation.canGoBack()) navigation.goBack();
        else navigation.navigate('MainTabs', { screen: 'AdminDashboard' });
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [navigation])
  );

  // A decided application leaves the tab it was in at once. The write also invalidates the
  // resource, so the loaded pages and the counts are re-read behind it.
  const dropRow = (providerId: number) =>
    queue.setItems((rows) => rows.filter((dto) => dto.id !== providerId));

  const approve = async (app: PartnerApplication) => {
    if (!app.providerId || busyId != null) return;
    setBusyId(app.providerId);
    try {
      await approveServiceProvider(app.providerId);
      // Attached certificates are approved alongside the application.
      await Promise.all((app.certificateIds ?? []).map((cid) => approveCertificate(cid)));
      dropRow(app.providerId);
    } catch (e) {
      showError(getErrorMessage(e, t('admin.approveFailed')));
    } finally {
      setBusyId(null);
    }
  };

  const reject = (app: PartnerApplication) => {
    if (!app.providerId || busyId != null) return;
    const providerId = app.providerId;
    showAlert(t('admin.rejectTitle'), t('admin.rejectMsg', { name: app.applicantName }), [
      { text: t('admin.cancel'), style: 'cancel' },
      {
        text: t('admin.reject'),
        style: 'destructive',
        onPress: async () => {
          setBusyId(providerId);
          try {
            await declineServiceProvider(providerId, t('admin.declinedByAdmin'));
            dropRow(providerId);
          } catch (e) {
            showError(getErrorMessage(e, t('admin.rejectFailed')));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  // The phone card reports the row by its string id.
  const byId = (id: string) => applications.find((a) => a.id === id);

  const emptyMessage =
    queue.activeTab === 'pending'
      ? t('admin.noPendingApplications')
      : queue.activeTab === 'approved'
        ? t('admin.noApprovedApplications')
        : t('admin.noRejectedApplications');

  const tabs = (
    <FilterTabs
      tabs={TABS}
      activeKey={queue.activeTab}
      onChange={queue.setActiveTab}
      counts={queue.counts}
    />
  );
  const sort = (
    <SortMenu value={queue.order} options={SUBMISSION_ORDER_OPTIONS} onChange={queue.setOrder} />
  );

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      // Pops real history when there is any, so arriving here from the notification feed and
      // pressing Back returns to the feed; the admin home is only the FALLBACK, for when this
      // screen was opened directly (tab to tab) and there is nothing to pop.
      onBackPress={() => goUp('AdminDashboard')}
      headerTitle={t('admin.requestsTitle')}
      headerSubtitle={t('admin.requestsSubtitle')}
      contentBg={isWebLayout ? undefined : isDarkMode ? 'bg-[#0f1621]' : 'bg-[#F5F7FA]'}
      width="wide">
      {/* On the phone the tabs stay put above the scrolling queue, as they always have. */}
      {!isWebLayout && tabs}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={isWebLayout}
        scrollEventThrottle={16}
        onScroll={(e) => (isNearBottom(e) ? queue.loadMore() : undefined)}>
        {/* The order control out-ranks the rows in paint order, so its panel opens over them
            rather than under. Web: tabs on the left, order on the right. Phone: the tab row is
            already full, so the order sits alone above the cards, as it does on Search. */}
        {isWebLayout ? (
          <View
            style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 16, zIndex: 20 }}>
            <View style={{ flex: 1 }}>{tabs}</View>
            {sort}
          </View>
        ) : (
          <View style={{ alignItems: 'flex-end', paddingHorizontal: 16, zIndex: 20 }}>{sort}</View>
        )}

        <View ref={listRef} style={{ paddingHorizontal: 16, paddingTop: isWebLayout ? 4 : 12 }}>
          <ListState
            isLoading={queue.isLoading}
            error={queue.error}
            isEmpty={applications.length === 0}
            emptyIcon="clipboard-outline"
            emptyMessage={emptyMessage}>
            {isWebLayout ? (
              <>
                <PartnerApplicationListHeader />
                {applications.map((application) => (
                  <PartnerApplicationRow
                    key={application.id}
                    application={application}
                    busy={busyId === application.providerId}
                    onOpen={() => navigation.navigate('ApplicationReview', { application })}
                    onApprove={() => approve(application)}
                    onReject={() => reject(application)}
                  />
                ))}
              </>
            ) : (
              applications.map((application) => (
                <PartnerApplicationCard
                  key={application.id}
                  application={application}
                  isDarkMode={isDarkMode}
                  cardBg={hex.card}
                  textColor={hex.text}
                  subTextColor={hex.subtext}
                  borderColor={hex.border}
                  onApprove={busyId != null ? undefined : (id) => byId(id) && approve(byId(id)!)}
                  onReject={busyId != null ? undefined : (id) => byId(id) && reject(byId(id)!)}
                />
              ))
            )}
          </ListState>

          {applications.length > 0 && (
            <LoadMoreFooter
              loaded={applications.length}
              total={queue.totalItems}
              hasMore={queue.hasMore}
              isLoadingMore={queue.isLoadingMore}
              onLoadMore={queue.loadMore}
            />
          )}
          {/* The end of an endless list should say so, or it reads as a page that failed. */}
          {applications.length > 0 && !queue.hasMore && !queue.isLoadingMore && (
            <Text className={`pt-4 text-center text-xs ${subtextColor}`}>
              {t('admin.endOfList', { count: queue.totalItems })}
            </Text>
          )}
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}
