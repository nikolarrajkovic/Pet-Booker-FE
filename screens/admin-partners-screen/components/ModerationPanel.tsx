import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import {
  ModerationAction,
  type ModerationActionValue,
  type ModerationHistoryEntry,
} from '../../../services/admin';
import type { PartnerStatus } from './PartnerCard';
import { formatModerationTime } from './moderationFormat';

type Props = {
  status: PartnerStatus;
  reason?: string | null;
  timedOutUntil?: string | null;
  bannedAt?: string | null;
  history: ModerationHistoryEntry[];
  loadingHistory: boolean;
  /** Rendered in the panel on the web design; the phone keeps its bottom bar instead. */
  actions?: React.ReactNode;
};

const ACTION_CFG: Record<ModerationActionValue, { icon: any; color: string; labelKey: string }> = {
  [ModerationAction.TimedOut]: {
    icon: 'time-outline',
    color: '#D97706',
    labelKey: 'moderation.historyTimedOut',
  },
  [ModerationAction.TimeoutLifted]: {
    icon: 'play-circle-outline',
    color: BRAND_GREEN,
    labelKey: 'moderation.historyLifted',
  },
  [ModerationAction.Banned]: {
    icon: 'ban-outline',
    color: '#EF4444',
    labelKey: 'moderation.historyBanned',
  },
  [ModerationAction.Unbanned]: {
    icon: 'checkmark-circle-outline',
    color: BRAND_GREEN,
    labelKey: 'moderation.historyUnbanned',
  },
};

/**
 * The partner's moderation on Partner Details: where they stand (with the reason the admin gave
 * and until when) and every timeout, ban and lift before it — each with its reason and who decided.
 */
export default function ModerationPanel({
  status,
  reason,
  timedOutUntil,
  bannedAt,
  history,
  loadingHistory,
  actions,
}: Props) {
  const { hex, isDarkMode } = useThemeColors();
  const { t } = useLocale();

  const summary =
    status === 'timeout'
      ? {
          icon: 'time-outline' as const,
          color: '#A16207',
          bg: isDarkMode ? 'rgba(217,119,6,0.12)' : '#FFFBEB',
          title: timedOutUntil
            ? t('moderation.pausedUntil', { date: formatModerationTime(timedOutUntil) })
            : t('admin.statusTimeout'),
        }
      : status === 'banned'
        ? {
            icon: 'ban-outline' as const,
            color: '#B91C1C',
            bg: isDarkMode ? 'rgba(239,68,68,0.12)' : '#FEF2F2',
            title: bannedAt
              ? t('moderation.bannedSince', { date: formatModerationTime(bannedAt) })
              : t('admin.statusBanned'),
          }
        : {
            icon: 'checkmark-circle-outline' as const,
            color: BRAND_GREEN,
            bg: isDarkMode ? 'rgba(0,168,90,0.12)' : '#ECFDF5',
            title: t('moderation.noRestrictions'),
          };

  return (
    <View
      style={{
        backgroundColor: hex.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: hex.border,
        padding: 16,
      }}>
      <Text style={{ color: hex.text, fontSize: 15, fontWeight: '700', marginBottom: 12 }}>
        {t('moderation.title')}
      </Text>

      <View style={{ backgroundColor: summary.bg, borderRadius: 12, padding: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name={summary.icon} size={18} color={summary.color} />
          <Text
            style={{
              color: summary.color,
              fontSize: 14,
              fontWeight: '700',
              marginLeft: 8,
              flex: 1,
            }}>
            {summary.title}
          </Text>
        </View>
        {status !== 'active' && reason ? (
          <Text style={{ color: hex.text, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
            <Text style={{ fontWeight: '600' }}>{t('moderation.reasonLabel')} </Text>
            {reason}
          </Text>
        ) : null}
      </View>

      {actions ? (
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>{actions}</View>
      ) : null}

      <Text
        style={{
          color: hex.subtext,
          fontSize: 12,
          fontWeight: '600',
          marginTop: 16,
          marginBottom: 6,
        }}>
        {t('moderation.history')}
      </Text>
      {loadingHistory ? (
        <ActivityIndicator
          color={BRAND_GREEN}
          style={{ alignSelf: 'flex-start', marginVertical: 6 }}
        />
      ) : history.length === 0 ? (
        <Text style={{ color: hex.subtext, fontSize: 13 }}>{t('moderation.historyEmpty')}</Text>
      ) : (
        history.map((entry) => {
          const cfg = ACTION_CFG[entry.action] ?? ACTION_CFG[ModerationAction.TimedOut];
          return (
            <View
              key={entry.id}
              style={{
                flexDirection: 'row',
                paddingVertical: 8,
                borderTopWidth: 1,
                borderTopColor: hex.border,
              }}>
              <Ionicons name={cfg.icon} size={16} color={cfg.color} style={{ marginTop: 2 }} />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={{ color: hex.text, fontSize: 13, fontWeight: '600' }}>
                  {t(cfg.labelKey as any, {
                    date: entry.timedOutUntil ? formatModerationTime(entry.timedOutUntil) : '',
                  })}
                </Text>
                {entry.reason ? (
                  <Text style={{ color: hex.text, fontSize: 12, lineHeight: 18, marginTop: 2 }}>
                    {entry.reason}
                  </Text>
                ) : null}
                <Text style={{ color: hex.subtext, fontSize: 11, marginTop: 2 }}>
                  {entry.decidedByName
                    ? t('moderation.byOn', {
                        name: entry.decidedByName,
                        date: formatModerationTime(entry.createdAt),
                      })
                    : formatModerationTime(entry.createdAt)}
                </Text>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}
