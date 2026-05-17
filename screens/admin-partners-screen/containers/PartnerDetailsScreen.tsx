import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../context/ThemeContext';
import type { Partner, PartnerStatus, ServiceHistoryItem } from '../components';

const PROFILE_PHOTO_URL = 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=600';
const GOV_ID_URL = 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&q=80';

const STATUS_CFG: Record<PartnerStatus, { label: string; bg: string; text: string; borderColor: string; icon: any }> = {
  active:  { label: 'Active',   bg: '#DCFCE7', text: '#15803D', borderColor: '#86EFAC', icon: 'checkmark-circle-outline' },
  timeout: { label: 'Timeout',  bg: '#FEF9C3', text: '#A16207', borderColor: '#FDE047', icon: 'time-outline' },
  banned:  { label: 'Banned',   bg: '#FEE2E2', text: '#B91C1C', borderColor: '#FCA5A5', icon: 'ban-outline' },
};

const HISTORY_STATUS_CFG = {
  completed: { label: 'Completed', color: '#00C870' },
  cancelled:  { label: 'Cancelled',  color: '#6B7280' },
  refunded:   { label: 'Refunded',   color: '#EF4444' },
};

export default function PartnerDetailsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  const partner: Partner = route.params?.partner;
  const [govIdRevealed, setGovIdRevealed] = useState(false);
  const [partnerStatus, setPartnerStatus] = useState<PartnerStatus>(partner?.status ?? 'active');
  const [confirm, setConfirm] = useState<{ title: string; message: string; confirmLabel: string; confirmColor: string; onConfirm: () => void } | null>(null);

  if (!partner) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Partner not found.</Text>
      </View>
    );
  }

  const cfg = STATUS_CFG[partnerStatus];
  const bgColor = isDarkMode ? '#0f1621' : '#F9FAFB';
  const cardBg = isDarkMode ? '#1a2332' : '#ffffff';
  const textColor = isDarkMode ? '#F9FAFB' : '#111827';
  const subTextColor = isDarkMode ? '#9CA3AF' : '#6B7280';
  const borderColor = isDarkMode ? '#2d3748' : '#E5E7EB';
  const dividerColor = isDarkMode ? '#2d3748' : '#F3F4F6';

  const handleTimeout = () => {
    if (partnerStatus === 'timeout') {
      setConfirm({
        title: 'Lift Timeout',
        message: `Restore ${partner.name} to active status?`,
        confirmLabel: 'Restore',
        confirmColor: '#00C870',
        onConfirm: () => { setPartnerStatus('active'); navigation.navigate('AdminPartners', { updatedId: partner.id, updatedStatus: 'active' }); },
      });
    } else {
      setConfirm({
        title: 'Timeout Partner',
        message: `Put ${partner.name} on timeout? They will be temporarily suspended.`,
        confirmLabel: 'Timeout',
        confirmColor: '#D97706',
        onConfirm: () => { setPartnerStatus('timeout'); navigation.navigate('AdminPartners', { updatedId: partner.id, updatedStatus: 'timeout' }); },
      });
    }
  };

  const handleBan = () => {
    if (partnerStatus === 'banned') {
      setConfirm({
        title: 'Unban Partner',
        message: `Unban ${partner.name} and restore their access?`,
        confirmLabel: 'Unban',
        confirmColor: '#00C870',
        onConfirm: () => { setPartnerStatus('active'); navigation.navigate('AdminPartners', { updatedId: partner.id, updatedStatus: 'active' }); },
      });
    } else {
      setConfirm({
        title: 'Ban Partner',
        message: `Permanently ban ${partner.name}? This will revoke all access.`,
        confirmLabel: 'Ban Partner',
        confirmColor: '#EF4444',
        onConfirm: () => { setPartnerStatus('banned'); navigation.navigate('AdminPartners', { updatedId: partner.id, updatedStatus: 'banned' }); },
      });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#00C870' }}>
      {/* ── Green header ── */}
      <View style={{ backgroundColor: '#00C870', paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: 28 }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="arrow-back" size={20} color="white" />
        </TouchableOpacity>
        <Text style={{ color: 'white', fontSize: 20, fontWeight: '700', marginTop: 10 }}>Partner Details</Text>
      </View>

      {/* ── Scrollable content ── */}
      <View style={{ flex: 1, backgroundColor: bgColor, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

          {/* ── Profile card ── */}
          <View style={{ backgroundColor: cardBg, marginHorizontal: 20, marginTop: 20, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor, marginBottom: 16 }}>
            {/* Large cover image */}
            <Image
              source={{ uri: PROFILE_PHOTO_URL }}
              style={{ width: '100%', height: 180 }}
              resizeMode="cover"
            />
            <View style={{ padding: 16 }}>
              {/* Small avatar + name + status */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Image
                    source={{ uri: partner.image }}
                    style={{ width: 52, height: 52, borderRadius: 12, borderWidth: 2, borderColor: cardBg, marginRight: 10 }}
                    resizeMode="cover"
                  />
                  <Text style={{ color: textColor, fontSize: 18, fontWeight: '700', flex: 1 }}>{partner.name}</Text>
                </View>
                <View style={{ backgroundColor: cfg.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: cfg.borderColor, flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                  <Ionicons name={cfg.icon} size={13} color={cfg.text} style={{ marginRight: 4 }} />
                  <Text style={{ color: cfg.text, fontSize: 12, fontWeight: '700' }}>{cfg.label}</Text>
                </View>
              </View>

              {/* Rating + service tag + distance */}
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="star" size={14} color="#F59E0B" />
                  <Text style={{ color: textColor, fontSize: 13, fontWeight: '600', marginLeft: 3 }}>{partner.rating.toFixed(1)}</Text>
                  <Text style={{ color: subTextColor, fontSize: 12, marginLeft: 3 }}>({partner.reviews} reviews)</Text>
                </View>
                <View style={{ backgroundColor: isDarkMode ? '#1e3a2f' : '#E8F5EF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }}>
                  <Text style={{ color: '#00A85A', fontSize: 12, fontWeight: '500' }}>{partner.services[0]}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="location-outline" size={13} color={subTextColor} />
                  <Text style={{ color: subTextColor, fontSize: 12, marginLeft: 3 }}>{partner.distance}</Text>
                </View>
              </View>

              {/* Bio */}
              <Text style={{ color: subTextColor, fontSize: 13, lineHeight: 19 }}>{partner.bio}</Text>
            </View>
          </View>

          {/* ── Stats row ── */}
          <View style={{ flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, backgroundColor: cardBg, borderRadius: 16, borderWidth: 1, borderColor, overflow: 'hidden' }}>
            <View style={{ flex: 1, alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ color: textColor, fontSize: 20, fontWeight: '800' }}>{partner.totalServices}</Text>
              <Text style={{ color: subTextColor, fontSize: 11, marginTop: 2 }}>Total Services</Text>
            </View>
            <View style={{ width: 1, backgroundColor: dividerColor }} />
            <View style={{ flex: 1, alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ color: textColor, fontSize: 20, fontWeight: '800' }}>{partner.avgRating.toFixed(1)}</Text>
              <Text style={{ color: subTextColor, fontSize: 11, marginTop: 2 }}>Avg Rating</Text>
            </View>
            <View style={{ width: 1, backgroundColor: dividerColor }} />
            <View style={{ flex: 1, alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ color: textColor, fontSize: 20, fontWeight: '800' }}>${partner.startingPrice}</Text>
              <Text style={{ color: subTextColor, fontSize: 11, marginTop: 2 }}>Starting Price</Text>
            </View>
          </View>

          {/* ── Partner Documents ── */}
          <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: '#E8F5EF', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                <Ionicons name="document-text-outline" size={16} color="#00C870" />
              </View>
              <Text style={{ color: textColor, fontSize: 15, fontWeight: '700' }}>Partner Documents</Text>
            </View>

            {/* Profile Photo */}
            {partner.documents.profilePhoto && (
              <DocCard isDarkMode={isDarkMode} cardBg={cardBg} borderColor={borderColor} textColor={textColor} subTextColor={subTextColor}
                iconBg="#E8F5EF" iconColor="#00C870" iconName="image-outline"
                title="Profile Photo" subtitle="Uploaded"
              >
                <Image source={{ uri: partner.image }} style={{ width: '100%', height: 160, borderRadius: 10 }} resizeMode="cover" />
                <DownloadButton label="Download Photo" textColor={textColor} borderColor={isDarkMode ? '#4B5563' : '#D1D5DB'} />
              </DocCard>
            )}

            {/* Government ID */}
            {partner.documents.governmentId && (
              <DocCard isDarkMode={isDarkMode} cardBg={cardBg} borderColor={borderColor} textColor={textColor} subTextColor={subTextColor}
                iconBg="#EEF2FF" iconColor="#6366F1" iconName="shield-outline"
                title="Government ID" subtitle="Driver's License"
              >
                <View style={{ position: 'relative', marginBottom: 10 }}>
                  <Image source={{ uri: GOV_ID_URL }} style={{ width: '100%', height: 140, borderRadius: 10 }} resizeMode="cover" blurRadius={govIdRevealed ? 0 : 12} />
                  {!govIdRevealed && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setGovIdRevealed(true)}
                      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }}>
                        <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>Click to view full document</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity activeOpacity={0.8} onPress={() => setGovIdRevealed((v) => !v)}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: isDarkMode ? '#4B5563' : '#D1D5DB', alignItems: 'center' }}>
                    <Text style={{ color: textColor, fontSize: 13, fontWeight: '600' }}>{govIdRevealed ? 'Hide Document' : 'View Full Document'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.8}
                    style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, borderColor: isDarkMode ? '#4B5563' : '#D1D5DB', flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="download-outline" size={16} color={textColor} />
                  </TouchableOpacity>
                </View>
              </DocCard>
            )}

            {/* Insurance Certificate */}
            {partner.documents.insuranceCertificate && (
              <DocCard isDarkMode={isDarkMode} cardBg={cardBg} borderColor={borderColor} textColor={textColor} subTextColor={subTextColor}
                iconBg="#E8F5EF" iconColor="#00C870" iconName="document-outline"
                title="Insurance Certificate" subtitle="Liability Insurance"
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDarkMode ? '#1a2332' : 'white', borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor }}>
                  <Ionicons name="document-text-outline" size={20} color={subTextColor} />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={{ color: textColor, fontSize: 12, fontWeight: '500' }}>insurance_certificate.pdf</Text>
                    <Text style={{ color: subTextColor, fontSize: 11 }}>2.4 MB • PDF Document</Text>
                  </View>
                </View>
                <DownloadButton label="Download Certificate" textColor={textColor} borderColor={isDarkMode ? '#4B5563' : '#D1D5DB'} />
              </DocCard>
            )}
          </View>

          {/* ── Recent Service History ── */}
          <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                <Ionicons name="calendar-outline" size={16} color="#6366F1" />
              </View>
              <Text style={{ color: textColor, fontSize: 15, fontWeight: '700' }}>Recent Service History</Text>
            </View>
            {partner.serviceHistory.map((item) => (
              <ServiceHistoryCard key={item.id} item={item} cardBg={cardBg} textColor={textColor} subTextColor={subTextColor} borderColor={borderColor} />
            ))}
          </View>
        </ScrollView>

        {/* ── Sticky footer ── */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: cardBg,
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
            onPress={handleTimeout}
            style={{
              flex: 1,
              paddingVertical: 13,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: '#D97706',
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="time-outline" size={17} color="#D97706" style={{ marginRight: 6 }} />
            <Text style={{ color: '#D97706', fontSize: 14, fontWeight: '700' }}>
              {partnerStatus === 'timeout' ? 'Lift Timeout' : 'Timeout'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleBan}
            style={{
              flex: 1,
              paddingVertical: 13,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: '#EF4444',
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="ban-outline" size={17} color="#EF4444" style={{ marginRight: 6 }} />
            <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '700' }}>
              {partnerStatus === 'banned' ? 'Unban Partner' : 'Ban Partner'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Confirmation modal ── */}
      <Modal visible={!!confirm} transparent animationType="fade" onRequestClose={() => setConfirm(null)}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setConfirm(null)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}
        >
          <TouchableOpacity activeOpacity={1} style={{ backgroundColor: cardBg, borderRadius: 20, padding: 24, width: '100%' }}>
            <Text style={{ color: textColor, fontSize: 17, fontWeight: '700', marginBottom: 8 }}>{confirm?.title}</Text>
            <Text style={{ color: subTextColor, fontSize: 14, lineHeight: 20, marginBottom: 24 }}>{confirm?.message}</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setConfirm(null)}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor, alignItems: 'center' }}
              >
                <Text style={{ color: subTextColor, fontSize: 14, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  confirm?.onConfirm();
                  setConfirm(null);
                }}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: confirm?.confirmColor, alignItems: 'center' }}
              >
                <Text style={{ color: 'white', fontSize: 14, fontWeight: '700' }}>{confirm?.confirmLabel}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Helper sub-components ──────────────────────────────────────────────────────
function DocCard({
  isDarkMode,
  cardBg,
  borderColor,
  textColor,
  subTextColor,
  iconBg,
  iconColor,
  iconName,
  title,
  subtitle,
  children,
}: {
  isDarkMode: boolean;
  cardBg: string;
  borderColor: string;
  textColor: string;
  subTextColor: string;
  iconBg: string;
  iconColor: string;
  iconName: any;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ backgroundColor: isDarkMode ? '#243447' : '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
            <Ionicons name={iconName} size={18} color={iconColor} />
          </View>
          <View>
            <Text style={{ color: textColor, fontSize: 13, fontWeight: '600' }}>{title}</Text>
            {subtitle ? <Text style={{ color: subTextColor, fontSize: 11 }}>{subtitle}</Text> : null}
          </View>
        </View>
        <Ionicons name="checkmark-circle" size={20} color="#00C870" />
      </View>
      {children}
    </View>
  );
}

function DownloadButton({ label, textColor, borderColor }: { label: string; textColor: string; borderColor: string }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={{ marginTop: 10, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name="download-outline" size={16} color={textColor} style={{ marginRight: 6 }} />
      <Text style={{ color: textColor, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );
}

function ServiceHistoryCard({ item, cardBg, textColor, subTextColor, borderColor }: { item: ServiceHistoryItem; cardBg: string; textColor: string; subTextColor: string; borderColor: string }) {
  const cfg = HISTORY_STATUS_CFG[item.status];
  return (
    <View style={{ backgroundColor: cardBg, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ color: subTextColor, fontSize: 11 }}>{item.id} • {item.date}</Text>
        <Text style={{ color: textColor, fontSize: 14, fontWeight: '700' }}>$ {item.price}</Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ color: textColor, fontSize: 13, fontWeight: '600' }}>{item.clientName}</Text>
          <Text style={{ color: subTextColor, fontSize: 12, marginTop: 1 }}>{item.service}</Text>
        </View>
        <Text style={{ color: cfg.color, fontSize: 13, fontWeight: '600' }}>{cfg.label}</Text>
      </View>
    </View>
  );
}
