import React from 'react';
import { View, Text } from 'react-native';
import Avatar from '../../../components/shared/Avatar';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useResponsive } from '../../../hooks/useResponsive';
import { useLocale } from '../../../context/LocaleContext';
import { providerTypeValue } from '../../../services/service-providers';
import {
  WebListCell,
  WebListHeader,
  WebListRow,
  WebRowButton,
  type WebColumn,
} from '../../../components/shared/WebListRow';
import type { PartnerApplication } from './PartnerApplicationCard';

/** The columns of the web applications list, shared by the header and every row. */
export const APPLICATION_COLUMNS = {
  applicant: { labelKey: 'admin.applicant', flex: 2 },
  submitted: { labelKey: 'admin.colSubmitted', width: 120 },
  services: { labelKey: 'admin.colServices', flex: 1.1 },
  contact: { labelKey: 'admin.colContact', flex: 2 },
  documents: { labelKey: 'admin.documents', flex: 1.7 },
  actions: { width: 316, align: 'right' },
} satisfies Record<string, WebColumn>;

/** Which columns a window this wide can hold on one line; the rest move to a second line. */
function visibleColumns(isDesktop: boolean): WebColumn[] {
  const c = APPLICATION_COLUMNS;
  return isDesktop
    ? [c.applicant, c.submitted, c.services, c.contact, c.documents, c.actions]
    : [c.applicant, c.submitted, c.actions];
}

export function PartnerApplicationListHeader() {
  const { isDesktop } = useResponsive();
  return <WebListHeader columns={visibleColumns(isDesktop)} />;
}

type Props = {
  application: PartnerApplication;
  onOpen: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  busy?: boolean;
};

/**
 * A partner application on the web design: everything a reviewer triages on — who, when, what they
 * offer, how to reach them, whether their paperwork is in — on one line, with the decision at the
 * end of it. The phone keeps `PartnerApplicationCard`, whose expand-to-read layout is the right
 * one for a 390px queue.
 *
 * No status chip: the list is already one status per tab, and on the phone card the chip was
 * what squeezed the applicant's name down to an ellipsis once it sat in a column.
 */
export function PartnerApplicationRow({ application, onOpen, onApprove, onReject, busy }: Props) {
  const { isDesktop } = useResponsive();
  const { isDarkMode, textColor, subtextColor } = useThemeColors();
  const { t, tEnum } = useLocale();
  const c = APPLICATION_COLUMNS;
  const photo = application.documents.profilePhoto?.src;

  const identity = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch' }}>
      <Avatar
        uri={photo}
        name={application.applicantName}
        size={44}
        placeholderClassName={isDarkMode ? 'bg-[#1e3a2f]' : 'bg-brand-50'}
        textClassName="text-base font-bold text-brand-600"
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        {/* Two lines before an ellipsis: a name is what the reviewer reads the row by. */}
        <Text className={`text-[15px] font-bold ${textColor}`} numberOfLines={2}>
          {application.applicantName}
        </Text>
        <Text className={`mt-0.5 text-xs ${subtextColor}`} numberOfLines={1}>
          {t('admin.applicationId', { id: application.id })}
        </Text>
      </View>
    </View>
  );

  const submitted = (
    <View>
      <Text className={`text-[13px] font-medium ${textColor}`}>{application.submittedDate}</Text>
      <Text className={`mt-0.5 text-xs ${subtextColor}`}>{application.submittedTime}</Text>
    </View>
  );

  const services = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {application.services.map((svc) => {
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

  const contact = (
    <View style={{ gap: 4, minWidth: 0, alignSelf: 'stretch' }}>
      <IconLine icon="mail-outline" text={application.email || t('admin.notProvided')} />
      <IconLine icon="location-outline" text={application.address || t('admin.notProvided')} />
    </View>
  );

  const docs = application.documents;
  const documents = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4 }}>
      <DocMark ok={!!docs.profilePhoto} label={t('admin.profilePhoto')} />
      <DocMark
        ok={!!docs.governmentIdFront && !!docs.governmentIdBack}
        label={t('admin.governmentId')}
      />
      <DocMark
        ok={docs.certificates.length > 0}
        label={t('admin.certificatesCount', { n: docs.certificates.length })}
      />
    </View>
  );

  const actions = (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <WebRowButton label={t('admin.viewDetails')} onPress={onOpen} tone="neutral" />
      {application.status === 'pending' && (
        <>
          <WebRowButton
            label={t('admin.reject')}
            onPress={onReject}
            tone="danger"
            disabled={busy}
          />
          <WebRowButton
            label={t('admin.approve')}
            icon="checkmark-circle-outline"
            onPress={onApprove}
            tone="primary"
            disabled={busy}
          />
        </>
      )}
    </View>
  );

  return (
    <WebListRow
      onPress={onOpen}
      hasActions
      accessibilityLabel={application.applicantName}
      footer={
        // Narrower than the desktop design: the triage details wrap under the name rather than
        // being squeezed into columns too thin to read.
        !isDesktop ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 16,
              marginTop: 12,
              paddingLeft: 56,
            }}>
            {services}
            <View style={{ minWidth: 220, flex: 1 }}>{contact}</View>
            {documents}
          </View>
        ) : undefined
      }>
      <WebListCell column={c.applicant}>{identity}</WebListCell>
      <WebListCell column={c.submitted}>{submitted}</WebListCell>
      {isDesktop && <WebListCell column={c.services}>{services}</WebListCell>}
      {isDesktop && <WebListCell column={c.contact}>{contact}</WebListCell>}
      {isDesktop && <WebListCell column={c.documents}>{documents}</WebListCell>}
      <WebListCell column={c.actions}>{actions}</WebListCell>
    </WebListRow>
  );
}

function IconLine({
  icon,
  text,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  text: string;
}) {
  const { textColor, hex } = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <Ionicons name={icon} size={14} color={hex.subtext} />
      <Text className={`text-xs ${textColor}`} numberOfLines={1} style={{ flexShrink: 1 }}>
        {text}
      </Text>
    </View>
  );
}

function DocMark({ ok, label }: { ok: boolean; label: string }) {
  const { subtextColor } = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'close-circle'}
        size={15}
        color={ok ? BRAND_GREEN : '#EF4444'}
      />
      <Text className={`text-xs ${subtextColor}`}>{label}</Text>
    </View>
  );
}
