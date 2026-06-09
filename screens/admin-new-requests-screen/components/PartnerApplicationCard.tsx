import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

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
    profilePhoto: boolean;
    governmentId: boolean;
    insuranceCertificate: boolean;
  };
  // Real-data fields (present when sourced from the API):
  providerId?: number;       // ServiceProvider id used to call the approve/delete endpoints
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

const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; bg: string; text: string; borderColor: string }
> = {
  pending: { label: 'Pending', bg: '#FEF9C3', text: '#A16207', borderColor: '#FDE047' },
  approved: { label: 'Approved', bg: '#DCFCE7', text: '#15803D', borderColor: '#86EFAC' },
  rejected: { label: 'Rejected', bg: '#FEE2E2', text: '#B91C1C', borderColor: '#FCA5A5' },
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
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[application.status];

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
      }}
    >
      {/* ── Card header row ── */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setExpanded((v) => !v)}
        style={{ padding: 16 }}
      >
        {/* Name + status + chevron */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
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
              }}
            >
              <Text style={{ color: cfg.text, fontSize: 11, fontWeight: '600' }}>{cfg.label}</Text>
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
          ID: {application.id} • Submitted {application.submittedDate}, {application.submittedTime}
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
              }}
            >
              <Text style={{ color: '#00A85A', fontSize: 11, fontWeight: '500' }}>{svc}</Text>
            </View>
          ))}
        </View>

        {/* Action buttons */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() =>
              navigation.navigate('ApplicationReview', { application })
            }
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: textColor, fontSize: 13, fontWeight: '600' }}>View Details</Text>
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
              }}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color="white" style={{ marginRight: 4 }} />
              <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>Approve</Text>
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
            Personal Information
          </Text>
          <InfoRow icon="mail-outline" text={application.email} textColor={textColor} subTextColor={subTextColor} />
          <InfoRow icon="call-outline" text={application.phone} textColor={textColor} subTextColor={subTextColor} />
          <InfoRow icon="location-outline" text={application.address} textColor={textColor} subTextColor={subTextColor} />

          <View style={{ height: 1, backgroundColor: infoBorderColor, marginVertical: 14 }} />

          {/* Service Information */}
          <Text style={{ color: textColor, fontSize: 13, fontWeight: '700', marginBottom: 10 }}>
            Service Information
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Ionicons name="briefcase-outline" size={14} color={subTextColor} />
            <Text style={{ color: subTextColor, fontSize: 12, marginLeft: 6 }}>
              Experience: {application.experience}
            </Text>
          </View>
          <Text style={{ color: subTextColor, fontSize: 12, marginBottom: 6, fontWeight: '600' }}>Bio:</Text>
          <Text style={{ color: textColor, fontSize: 12, marginBottom: 10 }}>{application.bio}</Text>
          <Text style={{ color: subTextColor, fontSize: 12, marginBottom: 2, fontWeight: '500' }}>
            Certifications:
          </Text>
          <Text style={{ color: subTextColor, fontSize: 12, marginBottom: 6 }}>
            {application.certifications}
          </Text>
          <Text style={{ color: subTextColor, fontSize: 12, marginBottom: 2, fontWeight: '500' }}>
            Availability:
          </Text>
          <Text style={{ color: textColor, fontSize: 12, marginBottom: 10 }}>
            {application.availability}
          </Text>

          <View style={{ height: 1, backgroundColor: infoBorderColor, marginBottom: 14 }} />

          {/* Documents */}
          <Text style={{ color: textColor, fontSize: 13, fontWeight: '700', marginBottom: 10 }}>
            Documents
          </Text>
          <DocStatus
            label="Profile Photo"
            uploaded={application.documents.profilePhoto}
            subTextColor={subTextColor}
            textColor={textColor}
          />
          <DocStatus
            label="Government ID"
            uploaded={application.documents.governmentId}
            subTextColor={subTextColor}
            textColor={textColor}
          />
          <DocStatus
            label="Insurance Certificate"
            uploaded={application.documents.insuranceCertificate}
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
