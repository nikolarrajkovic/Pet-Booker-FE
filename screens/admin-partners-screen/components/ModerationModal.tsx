import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ResponsiveModal from '../../../components/shared/ResponsiveModal';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import { getErrorMessage } from '../../../services/http';
import type { TranslationKey } from '../../../i18n';
import { formatModerationTime } from './moderationFormat';

export type ModerationMode = 'timeout' | 'liftTimeout' | 'ban' | 'unban';

/** Timeout lengths offered, in days. The server caps a timeout at 365; longer is a ban. */
const DURATIONS = [1, 3, 7, 14, 30, 90] as const;
const MIN_REASON = 10;

type Props = {
  mode: ModerationMode | null;
  partnerName: string;
  onClose: () => void;
  /** Runs the action; a thrown error is shown in the dialog, which stays open. */
  onSubmit: (input: { reason: string; until?: Date }) => Promise<void>;
};

const COLORS: Record<ModerationMode, string> = {
  timeout: '#D97706',
  ban: '#EF4444',
  liftTimeout: BRAND_GREEN,
  unban: BRAND_GREEN,
};

/**
 * The admin's timeout / ban dialog, and the lift and unban that undo them. A timeout and a ban
 * need a reason — the partner is told it, in the app and by email — and say plainly what will
 * happen; lifting either takes an optional note for the history.
 */
export default function ModerationModal({ mode, partnerName, onClose, onSubmit }: Props) {
  const {
    cardBg,
    textColor,
    subtextColor,
    inputBg,
    inputText,
    borderColor,
    placeholderColor,
    isDarkMode,
  } = useThemeColors();
  const { t } = useLocale();
  const [reason, setReason] = useState('');
  const [days, setDays] = useState<number>(7);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // A fresh dialog each time it opens.
  useEffect(() => {
    if (mode) {
      setReason('');
      setDays(7);
      setError('');
      setSubmitting(false);
    }
  }, [mode]);

  if (!mode) return null;

  const needsReason = mode === 'timeout' || mode === 'ban';
  const trimmed = reason.trim();
  const tooShort = needsReason && trimmed.length < MIN_REASON;
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const color = COLORS[mode];

  const title = {
    timeout: t('moderation.timeoutTitle', { name: partnerName }),
    liftTimeout: t('moderation.liftTitle', { name: partnerName }),
    ban: t('moderation.banTitle', { name: partnerName }),
    unban: t('moderation.unbanTitle', { name: partnerName }),
  }[mode];
  const confirmLabel = {
    timeout: t('moderation.timeoutConfirm'),
    liftTimeout: t('admin.liftTimeout'),
    ban: t('admin.banPartner'),
    unban: t('admin.unbanPartner'),
  }[mode];

  const submit = async () => {
    if (tooShort || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({ reason: trimmed, until: mode === 'timeout' ? until : undefined });
    } catch (e) {
      setError(getErrorMessage(e, t('moderation.failed')));
      setSubmitting(false);
    }
  };

  const consequence = (icon: any, text: string) => (
    <View className="mt-1.5 flex-row" key={text}>
      <Ionicons name={icon} size={15} color={color} style={{ marginTop: 1 }} />
      <Text className={`ml-2 flex-1 text-xs leading-5 ${textColor}`}>{text}</Text>
    </View>
  );

  return (
    <ResponsiveModal
      visible
      onClose={submitting ? () => {} : onClose}
      mobilePresentation="centered"
      dismissOnBackdropPress={false}
      dialogWidth={520}>
      <View className={`${cardBg} p-5`}>
        <Text className={`text-lg font-bold ${textColor}`}>{title}</Text>

        {mode === 'timeout' && (
          <>
            <Text className={`mb-2 mt-4 text-sm font-semibold ${textColor}`}>
              {t('moderation.duration')}
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {DURATIONS.map((d) => {
                const active = d === days;
                return (
                  <TouchableOpacity
                    key={d}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setDays(d)}
                    disabled={submitting}
                    className={`rounded-full border px-4 py-2 ${active ? '' : borderColor}`}
                    style={active ? { backgroundColor: color, borderColor: color } : undefined}>
                    <Text className={`text-sm font-semibold ${active ? 'text-white' : textColor}`}>
                      {t(`moderation.duration${d}` as TranslationKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text className={`mt-2 text-xs ${subtextColor}`}>
              {t('moderation.endsAt', { date: formatModerationTime(until) })}
            </Text>
          </>
        )}

        {(mode === 'timeout' || mode === 'ban') && (
          <View
            className="mt-4 rounded-xl px-3 py-3"
            style={{
              backgroundColor:
                mode === 'ban'
                  ? isDarkMode
                    ? 'rgba(239,68,68,0.12)'
                    : '#FEF2F2'
                  : isDarkMode
                    ? 'rgba(217,119,6,0.12)'
                    : '#FFFBEB',
            }}>
            {mode === 'timeout'
              ? [
                  consequence('eye-off-outline', t('moderation.timeoutHidden')),
                  consequence('calendar-outline', t('moderation.timeoutKeeps')),
                  consequence('time-outline', t('moderation.timeoutEnds')),
                ]
              : [
                  consequence('log-out-outline', t('moderation.banSignIn')),
                  consequence('eye-off-outline', t('moderation.banHidden')),
                  consequence('close-circle-outline', t('moderation.banBookings')),
                ]}
          </View>
        )}

        <Text className={`mb-2 mt-4 text-sm font-semibold ${textColor}`}>
          {needsReason ? t('moderation.reason') : t('moderation.note')}
        </Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder={
            needsReason ? t('moderation.reasonPlaceholder') : t('moderation.notePlaceholder')
          }
          placeholderTextColor={placeholderColor}
          multiline
          numberOfLines={3}
          maxLength={1000}
          textAlignVertical="top"
          editable={!submitting}
          accessibilityLabel={needsReason ? t('moderation.reason') : t('moderation.note')}
          className={`${inputBg} rounded-xl px-4 py-3 ${inputText}`}
          style={{ minHeight: 88 }}
          selectionColor={BRAND_GREEN}
        />
        <Text
          className={`mt-1 text-xs ${trimmed.length > 0 && tooShort ? 'text-red-500' : subtextColor}`}>
          {needsReason ? t('moderation.reasonHint') : t('moderation.noteHint')}
        </Text>

        {error ? <Text className="mt-3 text-sm text-red-500">{error}</Text> : null}

        <View className="mt-5 flex-row" style={{ gap: 12 }}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={onClose}
            disabled={submitting}
            activeOpacity={0.7}
            className={`flex-1 items-center rounded-xl border py-3 ${borderColor}`}>
            <Text className={`font-semibold ${textColor}`}>{t('admin.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: tooShort || submitting }}
            onPress={submit}
            disabled={tooShort || submitting}
            activeOpacity={0.7}
            className={`flex-1 items-center rounded-xl py-3 ${tooShort ? 'opacity-50' : ''}`}
            style={{ backgroundColor: color }}>
            {submitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="font-semibold text-white">{confirmLabel}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ResponsiveModal>
  );
}
