import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppNavigation } from '../../../hooks/useAppNavigation';
import { useThemeColors } from '../../../hooks/useThemeColors';
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
import {
  PartnerApplicationListHeader,
  PartnerApplicationRow,
} from '../components/PartnerApplicationRow';
import { providerToApplication } from '../providerToApplication';
import type { PartnerApplication } from '../components';

// A rejected application reads "Rejected" rather than the reviews queue's "Declined".
const TABS = moderationTabs('admin.statusRejected');

// Module functions, so their identity is stable for the paging hook.
const fetchApplicationsPage = (query: ModerationPageQuery) => getServiceProvidersPage(query);
const countApplications = (approvalStatus: number) => countServiceProviders({ approvalStatus });

/**
 * Partner applications on the web design: a full-width list that pages from the server as the
 * reviewer scrolls, one tab per status, each in its own order (pending oldest first, decisions
 * newest first — both re-orderable).
 *
 * The phone design's screen read every provider in the system up front and split them into tabs
 * on the client. That still works for a queue on a phone, and is left alone there; here each tab
 * asks for its own page of its own status.
 */
export default function AdminNewRequestsWeb() {
  const navigation = useNavigation<any>();
  const { goUp } = useAppNavigation();
  const { subtextColor } = useThemeColors();
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

  // A decided application leaves the tab it was in at once. The write also invalidates the
  // resource, so the loaded pages and the counts are re-read behind it.
  const dropRow = (providerId: number) =>
    queue.setItems((rows) => rows.filter((dto) => dto.id !== providerId));

  const approve = async (app: PartnerApplication) => {
    if (!app.providerId || busyId != null) return;
    setBusyId(app.providerId);
    try {
      await approveServiceProvider(app.providerId);
      // Attached certificates are approved alongside the application, as on the phone.
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

  const emptyMessage =
    queue.activeTab === 'pending'
      ? t('admin.noPendingApplications')
      : queue.activeTab === 'approved'
        ? t('admin.noApprovedApplications')
        : t('admin.noRejectedApplications');

  return (
    <ScreenLayout
      showBackButton
      onBackPress={() => goUp('AdminDashboard')}
      headerTitle={t('admin.requestsTitle')}
      headerSubtitle={t('admin.requestsSubtitle')}
      width="wide">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        scrollEventThrottle={16}
        onScroll={(e) => (isNearBottom(e) ? queue.loadMore() : undefined)}>
        {/* Tabs on the left, the order on the right. Out-ranks the rows in paint order so the
            sort panel opens over them rather than under. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 16, zIndex: 20 }}>
          <View style={{ flex: 1 }}>
            <FilterTabs
              tabs={TABS}
              activeKey={queue.activeTab}
              onChange={queue.setActiveTab}
              counts={queue.counts}
            />
          </View>
          <SortMenu
            value={queue.order}
            options={SUBMISSION_ORDER_OPTIONS}
            onChange={queue.setOrder}
          />
        </View>

        <View ref={listRef} style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <ListState
            isLoading={queue.isLoading}
            error={queue.error}
            isEmpty={applications.length === 0}
            emptyIcon="clipboard-outline"
            emptyMessage={emptyMessage}>
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
