import React, { useState, useCallback } from 'react';
import { ScrollView, Text, View, TouchableOpacity, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../../context/ThemeContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { PartnerApplicationCard } from '../components';
import type { PartnerApplication, ApplicationStatus } from '../components';

// ─── Mock partner applications ──────────────────────────────────────────────────
const mockApplications: PartnerApplication[] = [
  {
    id: 'PR-001',
    applicantName: 'Sarah Johnson',
    submittedDate: 'May 15, 2026',
    submittedTime: '10:30 AM',
    services: ['Dog Walking', 'Pet Sitting'],
    status: 'pending',
    email: 'sarah.johnson@email.com',
    phone: '(555) 234-5678',
    address: '456 Oak Avenue, San Francisco, CA 94102',
    experience: '5 years',
    bio: "I'm a passionate pet lover with over 5 years of experience caring for dogs and cats. I understand that pets are family members and treat them with the love and attention they deserve.",
    certifications: 'Certified Professional Dog Trainer, Pet First Aid',
    availability: 'Monday-Friday: 9am-6pm, Weekends: Flexible',
    documents: {
      profilePhoto: true,
      governmentId: true,
      insuranceCertificate: true,
    },
  },
  {
    id: 'PR-002',
    applicantName: 'Michael Chen',
    submittedDate: 'May 14, 2026',
    submittedTime: '02:20 PM',
    services: ['Grooming', 'Training'],
    status: 'pending',
    email: 'michael.chen@email.com',
    phone: '(555) 123-4567',
    address: '789 Pine Street, Oakland, CA 94601',
    experience: '8 years',
    bio: 'Professional groomer with certifications in multiple breeds. I take pride in making every pet look and feel their best.',
    certifications: 'Certified Master Groomer, AKC Canine Good Citizen Evaluator',
    availability: 'Tuesday-Saturday: 8am-5pm',
    documents: {
      profilePhoto: true,
      governmentId: true,
      insuranceCertificate: false,
    },
  },
  {
    id: 'PR-003',
    applicantName: 'Emma Rodriguez',
    submittedDate: 'May 13, 2026',
    submittedTime: '09:15 AM',
    services: ['Boarding', 'Pet Sitting'],
    status: 'approved',
    email: 'emma.r@example.com',
    phone: '(555) 345-6789',
    address: '123 Maple Drive, Berkeley, CA 94704',
    experience: '3 years',
    bio: 'I run a home-based pet boarding facility with a large backyard. Your pets will have plenty of space to play and receive individual attention.',
    certifications: 'Pet CPR Certified',
    availability: '24/7 for boarding guests',
    documents: {
      profilePhoto: true,
      governmentId: true,
      insuranceCertificate: true,
    },
  },
  {
    id: 'PR-004',
    applicantName: 'David Wilson',
    submittedDate: 'May 12, 2026',
    submittedTime: '04:45 PM',
    services: ['Veterinary'],
    status: 'rejected',
    email: 'd.wilson@mail.com',
    phone: '(555) 567-8901',
    address: '321 Elm Street, San Jose, CA 95110',
    experience: '1 year',
    bio: 'Recent veterinary assistant looking to provide mobile vet services.',
    certifications: '',
    availability: 'Weekends only',
    documents: {
      profilePhoto: false,
      governmentId: true,
      insuranceCertificate: false,
    },
  },
];

type FilterTab = 'pending' | 'approved' | 'rejected';

const TABS: { key: FilterTab; label: string; icon: any; activeColor: string; activeBg: string }[] = [
  { key: 'pending', label: 'Pending', icon: 'time-outline', activeColor: '#A16207', activeBg: '#FEF9C3' },
  { key: 'approved', label: 'Approved', icon: 'checkmark-circle-outline', activeColor: '#15803D', activeBg: '#DCFCE7' },
  { key: 'rejected', label: 'Rejected', icon: 'close-circle-outline', activeColor: '#B91C1C', activeBg: '#FEE2E2' },
];

export default function AdminNewRequestsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');
  const [applications, setApplications] = useState<PartnerApplication[]>(mockApplications);

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

  // Receive result back from ApplicationReviewScreen
  useFocusEffect(
    useCallback(() => {
      const updatedId = route.params?.updatedId;
      const updatedStatus = route.params?.updatedStatus as ApplicationStatus | undefined;
      if (updatedId && updatedStatus) {
        setApplications((prev) =>
          prev.map((a) => (a.id === updatedId ? { ...a, status: updatedStatus } : a))
        );
        navigation.setParams({ updatedId: undefined, updatedStatus: undefined });
      }
    }, [route.params?.updatedId, route.params?.updatedStatus])
  );

  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-[#F5F7FA]';
  const cardBg = isDarkMode ? '#1a2332' : '#ffffff';
  const textColor = isDarkMode ? '#F9FAFB' : '#111827';
  const subTextColor = isDarkMode ? '#9CA3AF' : '#6B7280';
  const borderColor = isDarkMode ? '#2d3748' : '#E5E7EB';
  const tabBg = isDarkMode ? '#1a2332' : '#ffffff';
  const tabBorder = isDarkMode ? '#2d3748' : '#E5E7EB';

  const counts = {
    pending: applications.filter((a) => a.status === 'pending').length,
    approved: applications.filter((a) => a.status === 'approved').length,
    rejected: applications.filter((a) => a.status === 'rejected').length,
  };

  const filtered = applications.filter((a) => a.status === activeTab);

  const handleApprove = (id: string) => {
    setApplications((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'approved' as ApplicationStatus } : a))
    );
  };

  const handleReject = (id: string) => {
    setApplications((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'rejected' as ApplicationStatus } : a))
    );
  };

  const activeTabCfg = TABS.find((t) => t.key === activeTab)!;

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      onBackPress={() => navigation.navigate('MainTabs', { screen: 'AdminDashboard' })}
      headerTitle="New Requests"
      headerSubtitle="Review and manage partner applications"
      contentBg={contentBg}
    >
      {/* ── Filter tabs ── */}
      <View
        style={{
          flexDirection: 'row',
          marginHorizontal: 16,
          marginTop: 20,
          marginBottom: 12,
          gap: 8,
        }}
      >
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
              }}
            >
              <Ionicons name={tab.icon} size={14} color={isActive ? tab.activeColor : subTextColor} />
              <Text
                style={{
                  color: isActive ? tab.activeColor : subTextColor,
                  fontSize: 13,
                  fontWeight: '600',
                  marginLeft: 5,
                }}
              >
                {tab.label}
              </Text>
              <View
                style={{
                  marginLeft: 5,
                  backgroundColor: isActive ? tab.activeColor : (isDarkMode ? '#374151' : '#E5E7EB'),
                  borderRadius: 8,
                  minWidth: 18,
                  height: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 4,
                }}
              >
                <Text
                  style={{
                    color: isActive ? 'white' : subTextColor,
                    fontSize: 10,
                    fontWeight: '700',
                  }}
                >
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
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
            <Ionicons
              name="clipboard-outline"
              size={64}
              color={isDarkMode ? '#4B5563' : '#D1D5DB'}
            />
            <Text style={{ color: subTextColor, textAlign: 'center', marginTop: 16, fontSize: 15 }}>
              No {activeTab} applications
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
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))
        )}
      </ScrollView>
    </ScreenLayout>
  );
}
