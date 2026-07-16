import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLocale } from '../../../context/LocaleContext';
import { providerTypeValue } from '../../../services/service-providers';

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

/** A viewable image document (absolute URL ready for <Image>). */
export type ApplicationImage = { src: string; name: string };

/** A certificate file: an image (viewable inline) or another file type (downloadable). */
export type ApplicationCertificate = {
  name: string;
  issuer: string;
  fileSrc: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  isImage: boolean;
};

export type PartnerApplication = {
  id: string;
  applicantName: string;
  submittedDate: string;
  submittedTime: string;
  services: string[];
  status: ApplicationStatus;
  email: string;
  phone: string;
  address: string;
  experience: string;
  bio: string;
  certifications: string;
  availability: string;
  documents: {
    profilePhoto: ApplicationImage | null;
    petPhotos: ApplicationImage[];
    governmentIdFront: ApplicationImage | null;
    governmentIdBack: ApplicationImage | null;
    certificates: ApplicationCertificate[];
  };
  // Real-data fields (present when sourced from the API):
  providerId?: number; // ServiceProvider id used to call the approve/delete endpoints
  certificateIds?: number[]; // certificate ids to approve alongside the provider
};

type Props = {
  application: PartnerApplication;
  isDarkMode: boolean;
  cardBg: string;
  textColor: string;
  subTextColor: string;
  borderColor: string;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
};

// Labels are translation keys, resolved with t() at render.
const STATUS_CONFIG: Record<
  ApplicationStatus,
  { labelKey: string; bg: string; text: string; borderColor: string }
> = {
  pending: {
    labelKey: 'admin.statusPending',
    bg: '#FEF9C3',
    text: '#A16207',
    borderColor: '#FDE047',
  },
  approved: {
    labelKey: 'admin.statusApproved',
    bg: '#DCFCE7',
    text: '#15803D',
    borderColor: '#86EFAC',
  },
  rejected: {
    labelKey: 'admin.statusRejected',
    bg: '#FEE2E2',
    text: '#B91C1C',
    borderColor: '#FCA5A5',
  },
};

export function PartnerApplicationCard({
  application,
  isDarkMode,
  cardBg,
  textColor,
  subTextColor,
  borderColor,
  onApprove,
  onReject,
}: Props) {
  const navigation = useNavigation<any>();
  const { t, tEnum } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[application.status];
  // Service tags are English enum labels — localize display via the enum value.
  const svcLabel = (label: string) => {
    const v = providerTypeValue(label);
    return v != null ? tEnum('serviceProviderType', v, label) : label;
  };

  const infoBorderColor = isDarkMode ? '#2d3748' : '#F3F4F6';

  return (
    <View
      style={{
        backgroundColor: cardBg,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor,
        overflow: 'hidden',
      }}>
      {/* ── Card header row ── */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setExpanded((v) => !v)}
        style={{ padding: 16 }}>
        {/* Name + status + chevron */}
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Text style={{ color: textColor, fontSize: 16, fontWeight: '700' }}>
              {application.applicantName}
            </Text>
            <View
              style={{
                marginLeft: 8,
                backgroundColor: cfg.bg,
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderWidth: 1,
                borderColor: cfg.borderColor,
              }}>
              <Text style={{ color: cfg.text, fontSize: 11, fontWeight: '600' }}>
                {t(cfg.labelKey as any)}
              </Text>
            </View>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={subTextColor}
          />
        </View>

        {/* ID + submitted */}
        <Text style={{ color: subTextColor, fontSize: 12, marginTop: 4 }}>
          {t('admin.idSubmitted', {
            id: application.id,
            date: application.submittedDate,
            time: application.submittedTime,
          })}
        </Text>

        {/* Service tags */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {application.services.map((svc) => (
            <View
              key={svc}
              style={{
                backgroundColor: isDarkMode ? '#1e3a2f' : '#E8F5EF',
                borderRadius: 20,
                paddingHorizontal: 10,
                paddingVertical: 3,
              }}>
              <Text style={{ color: '#00A85A', fontSize: 11, fontWeight: '500' }}>
                {svcLabel(svc)}
              </Text>
            </View>
          ))}
        </View>

        {/* Action buttons */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('ApplicationReview', { application })}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
              alignItems: 'center',
            }}>
            <Text style={{ color: textColor, fontSize: 13, fontWeight: '600' }}>
              {t('admin.viewDetails')}
            </Text>
          </TouchableOpacity>
          {application.status === 'pending' && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => onApprove?.(application.id)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: '#00C870',
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
              }}>
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color="white"
                style={{ marginRight: 4 }}
              />
              <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>
                {t('admin.approve')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>

      {/* ── Expanded details ── */}
      {expanded && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <View style={{ height: 1, backgroundColor: infoBorderColor, marginBottom: 14 }} />

          {/* Personal Information */}
          <Text style={{ color: textColor, fontSize: 13, fontWeight: '700', marginBottom: 10 }}>
            {t('admin.personalInformation')}
          </Text>
          <InfoRow
            icon="mail-outline"
            text={application.email}
            textColor={textColor}
            subTextColor={subTextColor}
          />
          <InfoRow
            icon="call-outline"
            text={application.phone}
            textColor={textColor}
            subTextColor={subTextColor}
          />
          <InfoRow
            icon="location-outline"
            text={application.address}
            textColor={textColor}
            subTextColor={subTextColor}
          />

          <View style={{ height: 1, backgroundColor: infoBorderColor, marginVertical: 14 }} />

          {/* Service Information */}
          <Text style={{ color: textColor, fontSize: 13, fontWeight: '700', marginBottom: 10 }}>
            {t('admin.serviceInformation')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Ionicons name="briefcase-outline" size={14} color={subTextColor} />
            <Text style={{ color: subTextColor, fontSize: 12, marginLeft: 6 }}>
              {t('admin.experienceLine', { text: application.experience })}
            </Text>
          </View>
          <Text style={{ color: subTextColor, fontSize: 12, marginBottom: 6, fontWeight: '600' }}>
            {t('admin.bio')}
          </Text>
          <Text style={{ color: textColor, fontSize: 12, marginBottom: 10 }}>
            {application.bio}
          </Text>
          <Text style={{ color: subTextColor, fontSize: 12, marginBottom: 2, fontWeight: '500' }}>
            {t('admin.certificationsColon')}
          </Text>
          <Text style={{ color: subTextColor, fontSize: 12, marginBottom: 6 }}>
            {application.certifications}
          </Text>
          <Text style={{ color: subTextColor, fontSize: 12, marginBottom: 2, fontWeight: '500' }}>
            {t('admin.availabilityColon')}
          </Text>
          <Text style={{ color: textColor, fontSize: 12, marginBottom: 10 }}>
            {application.availability}
          </Text>

          <View style={{ height: 1, backgroundColor: infoBorderColor, marginBottom: 14 }} />

          {/* Documents */}
          <Text style={{ color: textColor, fontSize: 13, fontWeight: '700', marginBottom: 10 }}>
            {t('admin.documents')}
          </Text>
          <DocStatus
            label={t('admin.profilePhoto')}
            uploaded={!!application.documents.profilePhoto}
            subTextColor={subTextColor}
            textColor={textColor}
          />
          <DocStatus
            label={t('admin.petPhotosCount', { n: application.documents.petPhotos.length })}
            uploaded={application.documents.petPhotos.length > 0}
            subTextColor={subTextColor}
            textColor={textColor}
          />
          <DocStatus
            label={t('admin.govIdFront')}
            uploaded={!!application.documents.governmentIdFront}
            subTextColor={subTextColor}
            textColor={textColor}
          />
          <DocStatus
            label={t('admin.govIdBack')}
            uploaded={!!application.documents.governmentIdBack}
            subTextColor={subTextColor}
            textColor={textColor}
          />
          <DocStatus
            label={t('admin.certificatesCount', { n: application.documents.certificates.length })}
            uploaded={application.documents.certificates.length > 0}
            subTextColor={subTextColor}
            textColor={textColor}
          />
        </View>
      )}
    </View>
  );
}

function InfoRow({
  icon,
  text,
  textColor,
  subTextColor,
}: {
  icon: any;
  text: string;
  textColor: string;
  subTextColor: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
      <Ionicons name={icon} size={14} color={subTextColor} />
      <Text style={{ color: textColor, fontSize: 12, marginLeft: 6 }}>{text}</Text>
    </View>
  );
}

function DocStatus({
  label,
  uploaded,
  textColor,
  subTextColor,
}: {
  label: string;
  uploaded: boolean;
  textColor: string;
  subTextColor: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
      <Ionicons
        name={uploaded ? 'checkmark-circle' : 'close-circle'}
        size={18}
        color={uploaded ? '#00C870' : '#EF4444'}
      />
      <Text style={{ color: textColor, fontSize: 12, marginLeft: 8 }}>{label}</Text>
    </View>
  );
}
