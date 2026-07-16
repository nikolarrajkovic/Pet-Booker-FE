import React, { useState, useCallback } from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  BackHandler,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useToast } from '../../../context/ToastContext';
import { useLocale } from '../../../context/LocaleContext';
import { getErrorMessage } from '../../../services/http';
import ScreenLayout from '../../../components/shared/ScreenLayout';
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
    labelKey: 'admin.statusRejected',
    icon: 'close-circle-outline',
    activeColor: '#B91C1C',
    activeBg: '#FEE2E2',
  },
];

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
  const tabBg = hex.card;
  const tabBorder = hex.border;

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
                backgroundColor: isActive ? tab.activeBg : tabBg,
                borderWidth: 1.5,
                borderColor: isActive ? tab.activeColor + '55' : tabBorder,
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
            <Ionicons
              name="clipboard-outline"
              size={64}
              color={isDarkMode ? '#4B5563' : '#D1D5DB'}
            />
            <Text style={{ color: subTextColor, textAlign: 'center', marginTop: 16, fontSize: 15 }}>
              {activeTab === 'pending'
                ? t('admin.noPendingApplications')
                : activeTab === 'approved'
                  ? t('admin.noApprovedApplications')
                  : t('admin.noRejectedApplications')}
            </Text>
          </View>
        ) : (
          filtered.map((application) => (
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
          ))
        )}
      </ScrollView>
    </ScreenLayout>
  );
}
