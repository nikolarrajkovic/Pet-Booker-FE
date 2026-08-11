import React, { useState, useCallback } from 'react';
import { ScrollView, BackHandler, Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useToast } from '../../../context/ToastContext';
import { useLocale } from '../../../context/LocaleContext';
import { getErrorMessage } from '../../../services/http';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import ListState from '../../../components/shared/ListState';
import FilterTabs, { moderationTabs } from '../../../components/shared/FilterTabs';
import { PartnerApplicationCard } from '../components';
import type { PartnerApplication } from '../components';
import {
  getServiceProviders,
  providerTypeLabel,
  extractProviderDocuments,
  ApprovalStatus,
  ServiceProviderDto,
} from '../../../services/service-providers';
import {
  approveServiceProvider,
  declineServiceProvider,
  approveCertificate,
} from '../../../services/admin';

// Maps a raw ServiceProviderDto (a partner application) to the card's view shape.
// Note: the provider DTO does not carry phone/bio/experience/availability —
// those are blank until the backend exposes them.
export function providerToApplication(dto: ServiceProviderDto): PartnerApplication {
  const created = dto.createdAt ? new Date(dto.createdAt) : null;
  const addr = dto.address;
  const address = addr
    ? [addr.line1, addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ')
    : '';

  const documents = extractProviderDocuments(dto);

  return {
    id: String(dto.id ?? 0),
    providerId: dto.id ?? 0,
    applicantName: dto.name ?? 'Applicant',
    submittedDate: created
      ? created.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : '',
    submittedTime: created
      ? created.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
      : '',
    services: [providerTypeLabel(dto.type)],
    status:
      dto.approvalStatus === ApprovalStatus.Declined
        ? 'rejected'
        : dto.approvalStatus === ApprovalStatus.Approved || dto.isApproved
          ? 'approved'
          : 'pending',
    email: dto.contactEmail ?? '',
    phone: '',
    address,
    experience: '',
    bio: '',
    certifications: (dto.certificates ?? [])
      .map((c) => c.name)
      .filter(Boolean)
      .join(', '),
    availability: '',
    documents,
    certificateIds: (dto.certificates ?? []).map((c) => c.id).filter((x): x is number => x != null),
  };
}

type FilterTab = 'pending' | 'approved' | 'rejected';

// A rejected application reads "Rejected" rather than the reviews queue's "Declined".
const TABS = moderationTabs('admin.statusRejected');

export default function AdminNewRequestsScreen() {
  const navigation = useNavigation<any>();
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
      const dtos = await getServiceProviders({ perPage: 200 });
      setApplications(dtos.map(providerToApplication));
    } catch (e) {
      setLoadError(getErrorMessage(e, t('admin.applicationsLoadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  // Always navigate to AdminDashboard on Android hardware back
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
    Alert.alert(t('admin.rejectTitle'), t('admin.rejectMsg', { name: app.applicantName }), [
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
      onBackPress={() => navigation.navigate('MainTabs', { screen: 'AdminDashboard' })}
      headerTitle={t('admin.requestsTitle')}
      headerSubtitle={t('admin.requestsSubtitle')}
      contentBg={contentBg}>
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
        </ListState>
      </ScrollView>
    </ScreenLayout>
  );
}
