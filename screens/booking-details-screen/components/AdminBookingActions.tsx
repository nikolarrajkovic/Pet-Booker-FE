import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import { useToast } from '../../../context/ToastContext';
import ReasonPromptModal from '../../../components/shared/ReasonPromptModal';
import { getErrorMessage } from '../../../services/http';
import {
  AdminBookingAction,
  adminActionsFor,
  adminBookingAction,
  type AdminBookingActionValue,
  type BookingDto,
} from '../../../services/bookings';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const ACTION_COPY: Record<
  AdminBookingActionValue,
  { label: string; title: string; subtitle: string; icon: IoniconName; color: string }
> = {
  [AdminBookingAction.CallOffWithFullRefund]: {
    label: 'adminActions.refundAll',
    title: 'adminActions.refundAllTitle',
    subtitle: 'adminActions.refundAllSubtitle',
    icon: 'arrow-undo-outline',
    color: '#DC2626',
  },
  [AdminBookingAction.CallOffKeepingDeposit]: {
    label: 'adminActions.keepDeposit',
    title: 'adminActions.keepDepositTitle',
    subtitle: 'adminActions.keepDepositSubtitle',
    icon: 'close-circle-outline',
    color: '#DC2626',
  },
  [AdminBookingAction.Complete]: {
    label: 'adminActions.complete',
    title: 'adminActions.completeTitle',
    subtitle: 'adminActions.completeSubtitle',
    icon: 'checkmark-done-outline',
    color: BRAND_GREEN,
  },
  [AdminBookingAction.CustomerNoShow]: {
    label: 'adminActions.customerNoShow',
    title: 'adminActions.customerNoShowTitle',
    subtitle: 'adminActions.customerNoShowSubtitle',
    icon: 'person-remove-outline',
    color: '#B45309',
  },
  [AdminBookingAction.ProviderNoShow]: {
    label: 'adminActions.providerNoShow',
    title: 'adminActions.providerNoShowTitle',
    subtitle: 'adminActions.providerNoShowSubtitle',
    icon: 'briefcase-outline',
    color: '#B45309',
  },
};

/**
 * Support's tools on a booking (app review 2026-11-13, finding 40): call it off with a full refund
 * or keeping the deposit, mark it completed, record that either side didn't come, and read the
 * pair's chat. Each action asks for a reason, which both sides are told.
 */
export default function AdminBookingActions({
  booking,
  onChanged,
  onOpenChat,
}: {
  booking: BookingDto;
  onChanged: () => void;
  onOpenChat: () => void;
}) {
  const { hex, textColor, subtextColor } = useThemeColors();
  const { t } = useLocale();
  const { showSuccess, showError } = useToast();
  const [pending, setPending] = useState<AdminBookingActionValue | null>(null);
  const [busy, setBusy] = useState(false);
  const actions = adminActionsFor(booking);
  const copy = pending != null ? ACTION_COPY[pending] : null;

  const button = (
    key: string,
    label: string,
    icon: IoniconName,
    color: string,
    onPress: () => void
  ) => (
    <TouchableOpacity
      key={key}
      testID={`admin-action-${key}`}
      accessibilityRole="button"
      onPress={onPress}
      className="mb-2 mr-2 flex-row items-center rounded-full border px-3 py-2"
      style={{ borderColor: color }}>
      <Ionicons name={icon} size={15} color={color} />
      <Text style={{ color, fontSize: 13, fontWeight: '600', marginLeft: 6 }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View
      className="mt-6 rounded-2xl border p-4"
      style={{ borderColor: hex.border, backgroundColor: hex.card }}>
      <View className="mb-1 flex-row items-center">
        <Ionicons name="shield-checkmark-outline" size={16} color={BRAND_GREEN} />
        <Text className={`ml-2 text-base font-bold ${textColor}`}>{t('adminActions.title')}</Text>
      </View>
      <Text className={`mb-3 text-xs ${subtextColor}`}>{t('adminActions.subtitle')}</Text>
      <View className="flex-row flex-wrap">
        {actions.map((a) =>
          button(
            String(a),
            t(ACTION_COPY[a].label as any),
            ACTION_COPY[a].icon,
            ACTION_COPY[a].color,
            () => setPending(a)
          )
        )}
        {button('chat', t('adminActions.readChat'), 'chatbubbles-outline', hex.subtext, onOpenChat)}
      </View>

      <ReasonPromptModal
        visible={copy != null}
        title={copy ? t(copy.title as any) : ''}
        subtitle={copy ? t(copy.subtitle as any) : undefined}
        placeholder={t('adminActions.reasonPlaceholder')}
        confirmLabel={copy ? t(copy.label as any) : ''}
        submitting={busy}
        onClose={() => setPending(null)}
        onConfirm={async (reason) => {
          if (pending == null || !booking.id) return;
          setBusy(true);
          try {
            await adminBookingAction(booking.id, pending, reason);
            setPending(null);
            showSuccess(t('adminActions.done'));
            onChanged();
          } catch (e) {
            showError(getErrorMessage(e, t('adminActions.failed')));
          } finally {
            setBusy(false);
          }
        }}
      />
    </View>
  );
}
