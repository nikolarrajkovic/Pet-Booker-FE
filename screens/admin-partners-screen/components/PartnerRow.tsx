import React from 'react';
import { View, Text } from 'react-native';
import Avatar from '../../../components/shared/Avatar';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useResponsive } from '../../../hooks/useResponsive';
import { useLocale } from '../../../context/LocaleContext';
import { providerTypeValue } from '../../../services/service-providers';
import {
  WebListCell,
  WebListHeader,
  WebListRow,
  type WebColumn,
} from '../../../components/shared/WebListRow';
import type { Partner, PartnerStatus } from './PartnerCard';

/** The columns of the web partners list, shared by the header and every row. */
export const PARTNER_COLUMNS = {
  partner: { labelKey: 'admin.colPartner', flex: 2.2 },
  services: { labelKey: 'admin.colServices', flex: 1.2 },
  rating: { labelKey: 'admin.colRating', width: 170 },
  total: { labelKey: 'admin.totalServices', width: 120 },
  location: { labelKey: 'admin.colLocation', flex: 1.2 },
  chevron: { width: 20 },
} satisfies Record<string, WebColumn>;

function visibleColumns(isDesktop: boolean): WebColumn[] {
  const c = PARTNER_COLUMNS;
  return isDesktop
    ? [c.partner, c.services, c.rating, c.total, c.location, c.chevron]
    : [c.partner, c.rating, c.chevron];
}

export function PartnerListHeader() {
  const { isDesktop } = useResponsive();
  return <WebListHeader columns={visibleColumns(isDesktop)} />;
}

const STATUS_CHIP: Record<PartnerStatus, { labelKey: string; bg: string; text: string }> = {
  active: { labelKey: 'admin.statusActive', bg: '#DCFCE7', text: '#15803D' },
  timeout: { labelKey: 'admin.statusTimeout', bg: '#FEF9C3', text: '#A16207' },
  banned: { labelKey: 'admin.statusBanned', bg: '#FEE2E2', text: '#B91C1C' },
};

/**
 * A partner on the web design: who, what they offer, how they are rated, how much they list and
 * where — one line per partner, the whole row opening their details. The phone keeps
 * `PartnerCard`.
 *
 * Unlike the moderation lists this keeps its status chip: the "All" tab mixes active partners
 * with ones on timeout, so the status is the one thing that differs row to row.
 */
export function PartnerRow({ partner, onPress }: { partner: Partner; onPress: () => void }) {
  const { isDesktop } = useResponsive();
  const { isDarkMode, textColor, subtextColor, hex } = useThemeColors();
  const { t, tEnum } = useLocale();
  const c = PARTNER_COLUMNS;
  const chip = STATUS_CHIP[partner.status];

  const identity = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch' }}>
      <Avatar
        uri={partner.image}
        name={partner.name}
        size={44}
        placeholderClassName={isDarkMode ? 'bg-[#1e3a2f]' : 'bg-brand-50'}
        textClassName="text-base font-bold text-brand-600"
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            className={`text-[15px] font-bold ${textColor}`}
            numberOfLines={1}
            style={{ flexShrink: 1 }}>
            {partner.name}
          </Text>
          <View
            style={{
              backgroundColor: chip.bg,
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}>
            <Text style={{ color: chip.text, fontSize: 11, fontWeight: '600' }}>
              {t(chip.labelKey as any)}
            </Text>
          </View>
        </View>
        {!!partner.joinedDate && (
          <Text className={`mt-0.5 text-xs ${subtextColor}`} numberOfLines={1}>
            {t('admin.joined', { date: partner.joinedDate })}
          </Text>
        )}
      </View>
    </View>
  );

  const services = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {partner.services.map((svc) => {
        const v = providerTypeValue(svc);
        return (
          <View
            key={svc}
            className={isDarkMode ? 'bg-[#1e3a2f]' : 'bg-[#E8F5EF]'}
            style={{ borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Text style={{ color: '#00A85A', fontSize: 11, fontWeight: '500' }}>
              {v != null ? tEnum('serviceProviderType', v, svc) : svc}
            </Text>
          </View>
        );
      })}
    </View>
  );

  const rating = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name="star" size={14} color="#F59E0B" />
      <Text className={`text-[13px] font-semibold ${textColor}`}>
        {partner.rating > 0 ? partner.rating.toFixed(1) : '—'}
      </Text>
      <Text className={`text-xs ${subtextColor}`}>
        {t('shared.reviewsCount', { count: partner.reviews })}
      </Text>
    </View>
  );

  const total = (
    <Text className={`text-[13px] ${textColor}`}>
      {partner.totalServices === 1
        ? t('admin.nServicesOne')
        : t('admin.nServices', { n: partner.totalServices })}
    </Text>
  );

  const location = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'stretch' }}>
      <Ionicons name="location-outline" size={14} color={hex.subtext} />
      <Text className={`text-xs ${textColor}`} numberOfLines={1} style={{ flexShrink: 1 }}>
        {partner.distance || t('admin.notProvided')}
      </Text>
    </View>
  );

  return (
    <WebListRow
      onPress={onPress}
      accessibilityLabel={partner.name}
      footer={
        !isDesktop ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 16,
              marginTop: 12,
              paddingLeft: 56,
            }}>
            {services}
            {total}
            <View style={{ minWidth: 160 }}>{location}</View>
          </View>
        ) : undefined
      }>
      <WebListCell column={c.partner}>{identity}</WebListCell>
      {isDesktop && <WebListCell column={c.services}>{services}</WebListCell>}
      <WebListCell column={c.rating}>{rating}</WebListCell>
      {isDesktop && <WebListCell column={c.total}>{total}</WebListCell>}
      {isDesktop && <WebListCell column={c.location}>{location}</WebListCell>}
      <WebListCell column={c.chevron}>
        <Ionicons name="chevron-forward" size={18} color={hex.subtext} />
      </WebListCell>
    </WebListRow>
  );
}
