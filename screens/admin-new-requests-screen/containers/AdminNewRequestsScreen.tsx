import React, { useState, useCallback } from 'react';
import { ScrollView, BackHandler } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAppNavigation } from '../../../hooks/useAppNavigation';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useToast } from '../../../context/ToastContext';
import { useLocale } from '../../../context/LocaleContext';
import { getErrorMessage } from '../../../services/http';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import ListState from '../../../components/shared/ListState';
import FilterTabs, { moderationTabs } from '../../../components/shared/FilterTabs';
import { PartnerApplicationCard } from '../components';
import type { PartnerApplication } from '../components';
import ResponsiveGrid from '../../../components/shared/ResponsiveGrid';
import { showAlert } from '../../../services/alert';
import { getAllServiceProviders } from '../../../services/service-providers';
import { providerToApplication } from '../providerToApplication';
import { useResponsive } from '../../../hooks/useResponsive';
import AdminNewRequestsWeb from './AdminNewRequestsWeb';
import {
  approveServiceProvider,
  declineServiceProvider,
  approveCertificate,
} from '../../../services/admin';

type FilterTab = 'pending' | 'approved' | 'rejected';

// A rejected application reads "Rejected" rather than the reviews queue's "Declined".
const TABS = moderationTabs('admin.statusRejected');

/**
 * Partner applications, in whichever of the app's two designs the window calls for: the web design
 * pages a table-like list from the server (`AdminNewRequestsWeb`), the phone keeps its card queue.
 * Separate components rather than branches, so dragging a window across the breakpoint mounts the
 * other design cleanly instead of changing how many hooks one component calls.
 */
export default function AdminNewRequestsScreen() {
  const { isWebLayout } = useResponsive();
  return isWebLayout ? <AdminNewRequestsWeb /> : <AdminNewRequestsMobile />;
}

/** The phone design's queue — unchanged: every application read up front, split into tabs. */
function AdminNewRequestsMobile() {
  const navigation = useNavigation<any>();
  const { goUp } = useAppNavigation();
  const { isDarkMode, hex } = useThemeColors();
  const { showError } = useToast();
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');
  const [applications, setApplications] = useState<PartnerApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // Every provider, not the first 200 of 420: this screen sorts them into its own
      // pending/approved/rejected tabs on the client, so a capped page made each tab an
      // arbitrary slice — the pending tab showed 7 of 42, and the missing 35 applications were
      // unreachable from anywhere in the app.
      const dtos = await getAllServiceProviders();
      setApplications(dtos.map(providerToApplication));
    } catch (e) {
      setLoadError(getErrorMessage(e, t('admin.applicationsLoadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  // Android hardware back, kept in step with the header button above
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

  // Re-fetch on every focus (covers returning from ApplicationReview)
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

  const counts = {
    pending: applications.filter((a) => a.status === 'pending').length,
    approved: applications.filter((a) => a.status === 'approved').length,
    rejected: applications.filter((a) => a.status === 'rejected').length,
  };

  const filtered = applications.filter((a) => a.status === activeTab);

  const handleApprove = async (id: string) => {
    const app = applications.find((a) => a.id === id);
    if (!app?.providerId) return;
    setBusyId(id);
    try {
      await approveServiceProvider(app.providerId);
      // Approve any attached certificates alongside the application
      await Promise.all((app.certificateIds ?? []).map((cid) => approveCertificate(cid)));
      await load();
    } catch (e) {
      showError(getErrorMessage(e, t('admin.approveFailed')));
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = (id: string) => {
    const app = applications.find((a) => a.id === id);
    if (!app?.providerId) return;
    showAlert(t('admin.rejectTitle'), t('admin.rejectMsg', { name: app.applicantName }), [
      { text: t('admin.cancel'), style: 'cancel' },
      {
        text: t('admin.reject'),
        style: 'destructive',
        onPress: async () => {
          setBusyId(id);
          try {
            await declineServiceProvider(app.providerId!, t('admin.declinedByAdmin'));
            await load();
          } catch (e) {
            showError(getErrorMessage(e, t('admin.rejectFailed')));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      // Pops real history when there is any, so arriving here from the notification feed and
      // pressing Back returns to the feed; the admin home is only the FALLBACK, for when this
      // screen was opened directly (tab to tab) and there is nothing to pop. Hardcoding the
      // destination made every arrival behave like the second case.
      onBackPress={() => goUp('AdminDashboard')}
      headerTitle={t('admin.requestsTitle')}
      headerSubtitle={t('admin.requestsSubtitle')}
      contentBg={contentBg}
      width="wide">
      <FilterTabs tabs={TABS} activeKey={activeTab} onChange={setActiveTab} counts={counts} />

      {/* ── List ── */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 4 }}
        showsVerticalScrollIndicator={false}>
        <ListState
          isLoading={isLoading}
          error={loadError}
          isEmpty={filtered.length === 0}
          emptyIcon="clipboard-outline"
          emptyMessage={
            activeTab === 'pending'
              ? t('admin.noPendingApplications')
              : activeTab === 'approved'
                ? t('admin.noApprovedApplications')
                : t('admin.noRejectedApplications')
          }>
          {/*
            Moderation cards are full-width rows built for a phone queue. On a wide page they
            become 1120px bars with an avatar at one end, so the reviewer scrolls past three
            screenfuls to see what fits in one. `rowGap={0}` lets each card keep the bottom margin
            it already has rather than making a presentational component width-aware.
          */}
          <ResponsiveGrid columns={{ mobile: 1, tablet: 1, desktop: 2 }} gap={12} rowGap={0}>
            {filtered.map((application) => (
              <PartnerApplicationCard
                key={application.id}
                application={application}
                isDarkMode={isDarkMode}
                cardBg={cardBg}
                textColor={textColor}
                subTextColor={subTextColor}
                borderColor={borderColor}
                onApprove={busyId ? undefined : handleApprove}
                onReject={busyId ? undefined : handleReject}
              />
            ))}
          </ResponsiveGrid>
        </ListState>
      </ScrollView>
    </ScreenLayout>
  );
}
