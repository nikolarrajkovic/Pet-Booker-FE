import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocale } from '../../../context/LocaleContext';
import { providerTypeValue } from '../../../services/service-providers';

export type PartnerStatus = 'active' | 'timeout' | 'banned';

export type ServiceHistoryItem = {
  id: string;
  date: string;
  clientName: string;
  service: string;
  price: number;
  status: 'completed' | 'cancelled' | 'refunded';
};

export type Partner = {
  id: string;
  name: string;
  image: string;
  status: PartnerStatus;
  rating: number;
  reviews: number;
  totalServices: number;
  services: string[];
  distance: string;
  joinedDate: string;
  email: string;
  phone: string;
  address: string;
  bio: string;
  startingPrice: number;
  avgRating: number;
  documents: {
    profilePhoto: boolean;
    governmentId: boolean;
    insuranceCertificate: boolean;
  };
  serviceHistory: ServiceHistoryItem[];
};

// Labels are translation keys, resolved with t() at render.
const STATUS_CFG: Record<
  PartnerStatus,
  { labelKey: string; bg: string; text: string; borderColor: string; icon: any }
> = {
  active: {
    labelKey: 'admin.statusActive',
    bg: '#DCFCE7',
    text: '#15803D',
    borderColor: '#86EFAC',
    icon: 'checkmark-circle-outline',
  },
  timeout: {
    labelKey: 'admin.statusTimeout',
    bg: '#FEF9C3',
    text: '#A16207',
    borderColor: '#FDE047',
    icon: 'time-outline',
  },
  banned: {
    labelKey: 'admin.statusBanned',
    bg: '#FEE2E2',
    text: '#B91C1C',
    borderColor: '#FCA5A5',
    icon: 'ban-outline',
  },
};

type Props = {
  partner: Partner;
  isDarkMode: boolean;
  cardBg: string;
  textColor: string;
  subTextColor: string;
  borderColor: string;
  onPress: () => void;
};

export function PartnerCard({
  partner,
  isDarkMode,
  cardBg,
  textColor,
  subTextColor,
  borderColor,
  onPress,
}: Props) {
  const { t, tEnum } = useLocale();
  const cfg = STATUS_CFG[partner.status];
  // Service tags are English enum labels — localize display via the enum value.
  const svcLabel = (label: string) => {
    const v = providerTypeValue(label);
    return v != null ? tEnum('serviceProviderType', v, label) : label;
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        backgroundColor: cardBg,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor,
        flexDirection: 'row',
        padding: 14,
        alignItems: 'flex-start',
      }}>
      {/* Image */}
      <View style={{ position: 'relative', marginRight: 12 }}>
        <Image
          source={{ uri: partner.image }}
          style={{ width: 72, height: 72, borderRadius: 12 }}
          resizeMode="cover"
        />
        {partner.status === 'active' && (
          <View
            style={{
              position: 'absolute',
              bottom: -6,
              right: -6,
              backgroundColor: '#00C870',
              borderRadius: 10,
              width: 20,
              height: 20,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: cardBg,
            }}>
            <Ionicons name="checkmark" size={11} color="white" />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        {/* Name + status */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 3,
          }}>
          <Text
            style={{ color: textColor, fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 }}
            numberOfLines={1}>
            {partner.name}
          </Text>
          <View
            style={{
              backgroundColor: cfg.bg,
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderWidth: 1,
              borderColor: cfg.borderColor,
              flexDirection: 'row',
              alignItems: 'center',
            }}>
            <Ionicons name={cfg.icon} size={11} color={cfg.text} style={{ marginRight: 3 }} />
            <Text style={{ color: cfg.text, fontSize: 11, fontWeight: '600' }}>
              {t(cfg.labelKey as any)}
            </Text>
          </View>
        </View>

        {/* Rating + services count */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Ionicons name="star" size={13} color="#F59E0B" />
          <Text style={{ color: textColor, fontSize: 12, fontWeight: '600', marginLeft: 3 }}>
            {partner.rating.toFixed(1)}
          </Text>
          <Text style={{ color: subTextColor, fontSize: 12, marginLeft: 2 }}>
            ({partner.reviews})
          </Text>
          <Text style={{ color: subTextColor, fontSize: 12, marginHorizontal: 6 }}>•</Text>
          <Text style={{ color: subTextColor, fontSize: 12 }}>
            {t('admin.nServices', { n: partner.totalServices })}
          </Text>
        </View>

        {/* Tags row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          {partner.services.slice(0, 1).map((svc) => (
            <View
              key={svc}
              style={{
                backgroundColor: isDarkMode ? '#1e3a2f' : '#E8F5EF',
                borderRadius: 20,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}>
              <Text style={{ color: '#00A85A', fontSize: 11, fontWeight: '500' }}>
                {svcLabel(svc)}
              </Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="location-outline" size={11} color={subTextColor} />
            <Text style={{ color: subTextColor, fontSize: 11, marginLeft: 2 }}>
              {partner.distance}
            </Text>
          </View>
          <Text style={{ color: subTextColor, fontSize: 11 }}>•</Text>
          <Text style={{ color: subTextColor, fontSize: 11 }}>
            {t('admin.joined', { date: partner.joinedDate })}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
