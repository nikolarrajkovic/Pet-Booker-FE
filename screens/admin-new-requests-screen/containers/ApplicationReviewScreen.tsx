import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../../../hooks/useThemeColors';
import type { PartnerApplication, ApplicationStatus } from '../components';

// ─── Static placeholder images / assets ────────────────────────────────────────
const PROFILE_PHOTO_URL =
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80';
const GOV_ID_URL =
  'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&q=80';

const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; bg: string; text: string; borderColor: string }
> = {
  pending: { label: 'Pending', bg: '#FEF9C3', text: '#A16207', borderColor: '#FDE047' },
  approved: { label: 'Approved', bg: '#DCFCE7', text: '#15803D', borderColor: '#86EFAC' },
  rejected: { label: 'Rejected', bg: '#FEE2E2', text: '#B91C1C', borderColor: '#FCA5A5' },
};

export default function ApplicationReviewScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDarkMode, hex } = useThemeColors();
  const insets = useSafeAreaInsets();

  const application: PartnerApplication = route.params?.application;
  const [govIdRevealed, setGovIdRevealed] = useState(false);
  const [status, setStatus] = useState<ApplicationStatus>(application?.status ?? 'pending');

  if (!application) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Application not found.</Text>
      </View>
    );
  }

  const cfg = STATUS_CONFIG[status];
  const bgColor = hex.bg;
  const cardBg = hex.card;
  const textColor = hex.text;
  const subTextColor = hex.subtext;
  const borderColor = hex.border;
  const sectionBg = hex.card;
  const dividerColor = isDarkMode ? '#2d3748' : '#F3F4F6';

  const handleApprove = () => {
    navigation.navigate('AdminNewRequests', {
      updatedId: application.id,
      updatedStatus: 'approved',
    });
  };

  const handleReject = () => {
    navigation.navigate('AdminNewRequests', {
      updatedId: application.id,
      updatedStatus: 'rejected',
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#00C870' }}>
      {/* ── Green header ── */}
      <View
        style={{
          backgroundColor: '#00C870',
          paddingHorizontal: 20,
          paddingTop: insets.top + 12,
          paddingBottom: 28,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.25)',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Ionicons name="arrow-back" size={20} color="white" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'white', fontSize: 20, fontWeight: '700' }}>Application Review</Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>ID: {application.id}</Text>
          </View>
        </View>
      </View>

      {/* ── Scrollable content ── */}
      <View
        style={{
          flex: 1,
          backgroundColor: bgColor,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          marginTop: -20,
        }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Applicant summary card ── */}
          <View
            style={{
              backgroundColor: sectionBg,
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
              borderWidth: 1,
              borderColor,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: textColor, fontSize: 18, fontWeight: '700' }}>
                  {application.applicantName}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Ionicons name="calendar-outline" size={13} color={subTextColor} />
                  <Text style={{ color: subTextColor, fontSize: 12, marginLeft: 4 }}>
                    Submitted {application.submittedDate} at {application.submittedTime}
                  </Text>
                </View>
              </View>
              <View
                style={{
                  backgroundColor: cfg.bg,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderWidth: 1,
                  borderColor: cfg.borderColor,
                  marginLeft: 8,
                }}
              >
                <Text style={{ color: cfg.text, fontSize: 12, fontWeight: '700' }}>{cfg.label}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {application.services.map((svc) => (
                <View
                  key={svc}
                  style={{
                    backgroundColor: isDarkMode ? '#1e3a2f' : '#E8F5EF',
                    borderRadius: 20,
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                  }}
                >
                  <Text style={{ color: '#00A85A', fontSize: 11, fontWeight: '500' }}>{svc}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── Personal Information ── */}
          <SectionCard
            icon="person-outline"
            title="Personal Information"
            sectionBg={sectionBg}
            borderColor={borderColor}
            textColor={textColor}
          >
            <LabelValueRow icon="mail-outline" label="Email" value={application.email} textColor={textColor} subTextColor={subTextColor} />
            <LabelValueRow icon="call-outline" label="Phone" value={application.phone} textColor={textColor} subTextColor={subTextColor} />
            <LabelValueRow icon="location-outline" label="Address" value={application.address} textColor={textColor} subTextColor={subTextColor} />
          </SectionCard>

          {/* ── Service Information ── */}
          <SectionCard
            icon="briefcase-outline"
            title="Service Information"
            sectionBg={sectionBg}
            borderColor={borderColor}
            textColor={textColor}
          >
            <View style={{ marginBottom: 10 }}>
              <Text style={{ color: subTextColor, fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Experience</Text>
              <Text style={{ color: textColor, fontSize: 13 }}>{application.experience}</Text>
            </View>
            <View style={{ height: 1, backgroundColor: dividerColor, marginBottom: 10 }} />
            <View style={{ marginBottom: 10 }}>
              <Text style={{ color: subTextColor, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>About</Text>
              <Text style={{ color: textColor, fontSize: 13, lineHeight: 19 }}>{application.bio}</Text>
            </View>
            {application.certifications ? (
              <>
                <View style={{ height: 1, backgroundColor: dividerColor, marginBottom: 10 }} />
                <View style={{ marginBottom: 10 }}>
                  <Text style={{ color: subTextColor, fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Certifications</Text>
                  <Text style={{ color: textColor, fontSize: 13 }}>{application.certifications}</Text>
                </View>
              </>
            ) : null}
            <View style={{ height: 1, backgroundColor: dividerColor, marginBottom: 10 }} />
            <View>
              <Text style={{ color: subTextColor, fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Availability</Text>
              <Text style={{ color: textColor, fontSize: 13 }}>{application.availability}</Text>
            </View>
          </SectionCard>

          {/* ── Documents ── */}
          <SectionCard
            icon="document-text-outline"
            title="Documents"
            sectionBg={sectionBg}
            borderColor={borderColor}
            textColor={textColor}
          >
            {/* Profile Photo */}
            {application.documents.profilePhoto && (
              <View
                style={{
                  backgroundColor: isDarkMode ? '#243447' : '#F9FAFB',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#E8F5EF', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                      <Ionicons name="image-outline" size={18} color="#00C870" />
                    </View>
                    <Text style={{ color: textColor, fontSize: 13, fontWeight: '600' }}>Profile Photo</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={20} color="#00C870" />
                </View>
                <Text style={{ color: subTextColor, fontSize: 11, marginBottom: 8 }}>Uploaded</Text>
                <Image
                  source={{ uri: PROFILE_PHOTO_URL }}
                  style={{ width: '100%', height: 160, borderRadius: 10 }}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={{
                    marginTop: 10,
                    paddingVertical: 10,
                    borderRadius: 10,
                    borderWidth: 1.5,
                    borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="download-outline" size={16} color={textColor} style={{ marginRight: 6 }} />
                  <Text style={{ color: textColor, fontSize: 13, fontWeight: '600' }}>Download Photo</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Government ID */}
            {application.documents.governmentId && (
              <View
                style={{
                  backgroundColor: isDarkMode ? '#243447' : '#F9FAFB',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                      <Ionicons name="shield-outline" size={18} color="#6366F1" />
                    </View>
                    <View>
                      <Text style={{ color: textColor, fontSize: 13, fontWeight: '600' }}>Government ID</Text>
                      <Text style={{ color: subTextColor, fontSize: 11 }}>Driver's License</Text>
                    </View>
                  </View>
                  <Ionicons name="checkmark-circle" size={20} color="#00C870" />
                </View>
                <View style={{ position: 'relative', marginBottom: 10 }}>
                  <Image
                    source={{ uri: GOV_ID_URL }}
                    style={{ width: '100%', height: 140, borderRadius: 10 }}
                    resizeMode="cover"
                    blurRadius={govIdRevealed ? 0 : 12}
                  />
                  {!govIdRevealed && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setGovIdRevealed(true)}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        alignItems: 'center',
                        justifyContent: 'center',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: 'rgba(0,0,0,0.5)',
                          borderRadius: 8,
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                        }}
                      >
                        <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>
                          Click to view full document
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setGovIdRevealed((v) => !v)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      borderWidth: 1.5,
                      borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: textColor, fontSize: 13, fontWeight: '600' }}>
                      {govIdRevealed ? 'Hide Document' : 'View Full Document'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 10,
                      borderWidth: 1.5,
                      borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons name="download-outline" size={16} color={textColor} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Insurance Certificate */}
            {application.documents.insuranceCertificate && (
              <View
                style={{
                  backgroundColor: isDarkMode ? '#243447' : '#F9FAFB',
                  borderRadius: 12,
                  padding: 14,
                  borderWidth: 1,
                  borderColor,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#E8F5EF', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                      <Ionicons name="document-outline" size={18} color="#00C870" />
                    </View>
                    <Text style={{ color: textColor, fontSize: 13, fontWeight: '600' }}>Insurance Certificate</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={20} color="#00C870" />
                </View>
                <Text style={{ color: subTextColor, fontSize: 11, marginBottom: 10 }}>Liability Insurance</Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isDarkMode ? '#1a2332' : 'white',
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor,
                  }}
                >
                  <Ionicons name="document-text-outline" size={20} color={subTextColor} />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={{ color: textColor, fontSize: 12, fontWeight: '500' }}>
                      insurance_certificate.pdf
                    </Text>
                    <Text style={{ color: subTextColor, fontSize: 11 }}>2.4 MB • PDF Document</Text>
                  </View>
                </View>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={{
                    paddingVertical: 10,
                    borderRadius: 10,
                    borderWidth: 1.5,
                    borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="download-outline" size={16} color={textColor} style={{ marginRight: 6 }} />
                  <Text style={{ color: textColor, fontSize: 13, fontWeight: '600' }}>Download Certificate</Text>
                </TouchableOpacity>
              </View>
            )}
          </SectionCard>

          {/* ── Background Check info box ── */}
          <View
            style={{
              backgroundColor: isDarkMode ? '#1a2d3e' : '#EFF6FF',
              borderRadius: 12,
              padding: 14,
              marginBottom: 16,
              flexDirection: 'row',
              alignItems: 'flex-start',
              borderWidth: 1,
              borderColor: isDarkMode ? '#1e40af44' : '#BFDBFE',
            }}
          >
            <Ionicons name="information-circle-outline" size={20} color="#3B82F6" style={{ marginTop: 1 }} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: '#1D4ED8', fontSize: 13, fontWeight: '700', marginBottom: 3 }}>
                Background Check
              </Text>
              <Text style={{ color: isDarkMode ? '#93C5FD' : '#3B82F6', fontSize: 12, lineHeight: 18 }}>
                A background check will be conducted as part of the approval process. This helps ensure the safety of all pets and pet owners on the platform.
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* ── Sticky footer buttons ── */}
        {status === 'pending' && (
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: sectionBg,
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: insets.bottom > 0 ? insets.bottom : 16,
              borderTopWidth: 1,
              borderTopColor: borderColor,
              flexDirection: 'row',
              gap: 12,
            }}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleReject}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: '#EF4444',
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close-circle-outline" size={18} color="#EF4444" style={{ marginRight: 6 }} />
              <Text style={{ color: '#EF4444', fontSize: 15, fontWeight: '700' }}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleApprove}
              style={{
                flex: 2,
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: '#00C870',
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color="white" style={{ marginRight: 6 }} />
              <Text style={{ color: 'white', fontSize: 15, fontWeight: '700' }}>Approve Application</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Status banner for already-processed applications */}
        {status !== 'pending' && (
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: STATUS_CONFIG[status].bg,
              paddingHorizontal: 20,
              paddingTop: 14,
              paddingBottom: insets.bottom > 0 ? insets.bottom : 16,
              borderTopWidth: 1,
              borderTopColor: STATUS_CONFIG[status].borderColor,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: STATUS_CONFIG[status].text, fontSize: 15, fontWeight: '700' }}>
              Application {STATUS_CONFIG[status].label}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Helper components ──────────────────────────────────────────────────────────
function SectionCard({
  icon,
  title,
  children,
  sectionBg,
  borderColor,
  textColor,
}: {
  icon: any;
  title: string;
  children: React.ReactNode;
  sectionBg: string;
  borderColor: string;
  textColor: string;
}) {
  return (
    <View
      style={{
        backgroundColor: sectionBg,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
        <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: '#E8F5EF', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
          <Ionicons name={icon} size={16} color="#00C870" />
        </View>
        <Text style={{ color: textColor, fontSize: 15, fontWeight: '700' }}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function LabelValueRow({
  icon,
  label,
  value,
  textColor,
  subTextColor,
}: {
  icon: any;
  label: string;
  value: string;
  textColor: string;
  subTextColor: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
      <Ionicons name={icon} size={16} color={subTextColor} style={{ marginTop: 1 }} />
      <View style={{ marginLeft: 10, flex: 1 }}>
        <Text style={{ color: subTextColor, fontSize: 11, fontWeight: '600', marginBottom: 1 }}>{label}</Text>
        <Text style={{ color: textColor, fontSize: 13 }}>{value}</Text>
      </View>
    </View>
  );
}
