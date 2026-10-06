import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import { useToast } from '../../../context/ToastContext';
import { useResource } from '../../../hooks/useResource';
import ResponsiveModal from '../../../components/shared/ResponsiveModal';
import AddCardForm from '../../../components/shared/AddCardForm';
import { formatMoney } from '../../../services/currency';
import { getErrorMessage } from '../../../services/http';
import { formatShortDate } from '../../../i18n/dates';
import { BookingStatusType } from '../../../services/bookings';
import {
  getPaymentSummary,
  payBooking,
  PaymentPhase,
  PaymentStatus,
  cardLabel,
  type PaymentPhaseValue,
} from '../../../services/payments';
import { getPaymentMethods, type PaymentMethodDto } from '../../../services/payment-methods';

/** Mirrors `Domain.BookingWorkflow.AcceptsPayment`: confirmed through paid-after-service. */
const PAYABLE_STATUSES: number[] = [
  BookingStatusType.ServiceConfirmedByProvider,
  BookingStatusType.PrePayment,
  BookingStatusType.ServiceStarted,
  BookingStatusType.ServiceEnded,
  BookingStatusType.PostPayment,
];

type Props = {
  bookingId: number;
  currentStatus: number;
  isExpired: boolean;
  /** Only the customer pays; the provider (and an admin) see the same ledger read-only. */
  isCustomer: boolean;
  /** The booking's owner — whose saved cards the pay sheet offers. */
  userId: number;
  /** Re-read the booking after a payment, which can move its status (deposit paid, settled). */
  onPaid: () => void;
};

/**
 * What has been paid on a booking, what was refunded and what is still owed, plus the customer's
 * way to pay it. Until this the app had no way to pay at all: the server could take a deposit and
 * the balance, but nothing called it, so every booking sat at "confirmed" and providers had no
 * way to tell whether the deposit had landed. Charges go through a mock gateway for now (they
 * always succeed and move no money); the screen is the one the real provider will sit behind.
 */
export default function BookingPaymentPanel({
  bookingId,
  currentStatus,
  isExpired,
  isCustomer,
  userId,
  onPaid,
}: Props) {
  const { textColor, subtextColor, borderColor } = useThemeColors();
  const { t } = useLocale();
  const {
    data: summary,
    isLoading,
    refresh,
  } = useResource(['payments', 'summary', bookingId], () => getPaymentSummary(bookingId));
  const [payPhase, setPayPhase] = useState<PaymentPhaseValue | null>(null);

  if (isLoading && !summary) {
    return (
      <View className="items-center py-4">
        <ActivityIndicator color={BRAND_GREEN} />
      </View>
    );
  }
  if (!summary) return null;

  const { currency } = summary;
  const depositOutstanding = Math.max(0, summary.depositAmount - summary.amountPaid);
  const payable = !isExpired && PAYABLE_STATUSES.includes(currentStatus);
  // The deposit is what the provider waits on before the appointment; offer it on its own while
  // it is still outstanding, and the full rest alongside it.
  const canPayDeposit =
    isCustomer &&
    payable &&
    currentStatus === BookingStatusType.ServiceConfirmedByProvider &&
    depositOutstanding > 0;
  const canPayBalance = isCustomer && payable && summary.balanceDue > 0;
  const awaitingConfirmation =
    isCustomer && !isExpired && currentStatus === BookingStatusType.ServiceRequestedByUser;

  const amountFor = (phase: PaymentPhaseValue) =>
    phase === PaymentPhase.Deposit ? depositOutstanding : summary.balanceDue;

  const Line = ({ label, value, accent }: { label: string; value: string; accent?: string }) => (
    <View className={`flex-row items-center justify-between border-b py-3 ${borderColor}`}>
      <Text className={`text-sm ${subtextColor}`}>{label}</Text>
      <Text className={`text-sm font-semibold ${accent ?? textColor}`}>{value}</Text>
    </View>
  );

  return (
    <View className="mt-2">
      {summary.depositAmount > 0 ? (
        <Line label={t('payments.deposit')} value={formatMoney(summary.depositAmount, currency)} />
      ) : null}
      <Line
        label={t('payments.paid')}
        value={formatMoney(summary.amountPaid, currency)}
        accent={summary.amountPaid > 0 ? 'text-brand-600' : undefined}
      />
      {summary.amountRefunded > 0 ? (
        <Line
          label={t('payments.refunded')}
          value={formatMoney(summary.amountRefunded, currency)}
          accent="text-blue-600"
        />
      ) : null}
      <Line
        label={t('payments.balanceDue')}
        value={formatMoney(summary.balanceDue, currency)}
        accent={summary.balanceDue > 0 ? 'text-amber-600' : undefined}
      />

      {summary.payments.length > 0 ? (
        <View className="mt-3">
          <Text className={`mb-1 text-xs font-semibold uppercase ${subtextColor}`}>
            {t('payments.history')}
          </Text>
          {summary.payments.map((p) => {
            const refunded = p.status === PaymentStatus.Refunded;
            return (
              <View key={p.id} className="flex-row items-center py-2">
                <Ionicons
                  name={refunded ? 'return-down-back-outline' : 'checkmark-circle-outline'}
                  size={16}
                  color={refunded ? '#2563EB' : BRAND_GREEN}
                />
                <Text className={`ml-2 flex-1 text-sm ${textColor}`}>
                  {refunded ? t('payments.statusRefunded') : t('payments.statusPaid')}
                  <Text className={subtextColor}>
                    {' · '}
                    {formatShortDate(new Date(refunded && p.refundedAt ? p.refundedAt : p.paidAt))}
                  </Text>
                </Text>
                <Text
                  className={`text-sm font-semibold ${refunded ? 'text-blue-600 line-through' : textColor}`}>
                  {formatMoney(p.amount, p.currency || currency)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {awaitingConfirmation ? (
        <Text className={`mt-3 text-sm ${subtextColor}`}>{t('payments.payAfterConfirm')}</Text>
      ) : null}

      {canPayDeposit || canPayBalance ? (
        <View className="mt-4" style={{ gap: 10 }}>
          {canPayDeposit ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setPayPhase(PaymentPhase.Deposit)}
              activeOpacity={0.85}
              className="flex-row items-center justify-center rounded-2xl bg-brand-500 py-4">
              <Ionicons name="card-outline" size={18} color="white" />
              <Text className="ml-2 text-base font-bold text-white">
                {t('payments.payDeposit', { amount: formatMoney(depositOutstanding, currency) })}
              </Text>
            </TouchableOpacity>
          ) : null}
          {canPayBalance ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setPayPhase(PaymentPhase.Balance)}
              activeOpacity={0.85}
              className={
                canPayDeposit
                  ? 'flex-row items-center justify-center rounded-2xl border-2 border-brand-500 py-4'
                  : 'flex-row items-center justify-center rounded-2xl bg-brand-500 py-4'
              }>
              <Ionicons
                name="card-outline"
                size={18}
                color={canPayDeposit ? BRAND_GREEN : 'white'}
              />
              <Text
                className={`ml-2 text-base font-bold ${canPayDeposit ? 'text-brand-600' : 'text-white'}`}>
                {t(summary.amountPaid > 0 ? 'payments.payRest' : 'payments.payInFull', {
                  amount: formatMoney(summary.balanceDue, currency),
                })}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <PaySheet
        visible={payPhase !== null}
        bookingId={bookingId}
        userId={userId}
        phase={payPhase ?? PaymentPhase.Balance}
        amountLabel={payPhase !== null ? formatMoney(amountFor(payPhase), currency) : ''}
        onClose={() => setPayPhase(null)}
        onPaid={() => {
          setPayPhase(null);
          refresh();
          onPaid();
        }}
      />
    </View>
  );
}

type PaySheetProps = {
  visible: boolean;
  bookingId: number;
  userId: number;
  phase: PaymentPhaseValue;
  amountLabel: string;
  onClose: () => void;
  onPaid: () => void;
};

/** Pick a saved card (or add one) and pay. The server computes the amount; this only shows it. */
function PaySheet({
  visible,
  bookingId,
  userId,
  phase,
  amountLabel,
  onClose,
  onPaid,
}: PaySheetProps) {
  const { cardBg, textColor, subtextColor, borderColor } = useThemeColors();
  const { t } = useLocale();
  const { showSuccess } = useToast();
  const [cards, setCards] = useState<PaymentMethodDto[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    let live = true;
    setError('');
    setCards(null);
    getPaymentMethods(userId)
      .then((all) => {
        if (!live) return;
        // Only real cards can be charged; the 'manual' placeholder an older booking flow created
        // is a booking reference, not something to pay with.
        const usable = all.filter((m) => m.provider !== 'manual' && m.cardLast4);
        setCards(usable);
        setSelected((usable.find((m) => m.isDefault) ?? usable[0])?.id ?? null);
        setAdding(usable.length === 0);
      })
      .catch((e) => live && setError(getErrorMessage(e, t('payments.cardsLoadFailed'))));
    return () => {
      live = false;
    };
  }, [visible, userId, t]);

  const pay = async () => {
    if (selected == null) return;
    setPaying(true);
    setError('');
    try {
      await payBooking(bookingId, phase, selected);
      showSuccess(t('payments.paySuccess'));
      onPaid();
    } catch (e) {
      setError(getErrorMessage(e, t('payments.payFailed')));
    } finally {
      setPaying(false);
    }
  };

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      mobilePresentation="centered"
      dismissOnBackdropPress={!paying}
      dialogWidth={480}>
      <View className={`${cardBg} p-5`}>
        <Text className={`mb-1 text-lg font-bold ${textColor}`}>
          {phase === PaymentPhase.Deposit ? t('payments.payDepositTitle') : t('payments.payTitle')}
        </Text>
        <Text className={`mb-4 text-2xl font-bold text-brand-600`}>{amountLabel}</Text>

        {cards === null && !error ? (
          <ActivityIndicator color={BRAND_GREEN} />
        ) : adding ? (
          <AddCardForm
            userId={userId}
            makeDefault={(cards ?? []).length === 0}
            onCancel={(cards ?? []).length > 0 ? () => setAdding(false) : onClose}
            onSaved={(card) => {
              setCards((prev) => [...(prev ?? []), card]);
              setSelected(card.id ?? null);
              setAdding(false);
            }}
          />
        ) : (
          <>
            {(cards ?? []).map((card) => {
              const isSelected = card.id === selected;
              return (
                <TouchableOpacity
                  key={card.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  onPress={() => setSelected(card.id ?? null)}
                  className={`mb-2 flex-row items-center rounded-xl border px-4 py-3 ${
                    isSelected ? 'border-brand-500' : borderColor
                  }`}>
                  <Ionicons
                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={isSelected ? BRAND_GREEN : '#9CA3AF'}
                  />
                  <Text className={`ml-3 flex-1 text-sm font-semibold ${textColor}`}>
                    {cardLabel(card, t('payments.card'))}
                  </Text>
                  {card.expirationMonth && card.expirationYear ? (
                    <Text className={`text-xs ${subtextColor}`}>
                      {String(card.expirationMonth).padStart(2, '0')}/
                      {String(card.expirationYear).slice(-2)}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setAdding(true)}
              className="mb-3 flex-row items-center py-2">
              <Ionicons name="add-circle-outline" size={20} color={BRAND_GREEN} />
              <Text className="ml-2 font-semibold text-brand-600">{t('payments.addCard')}</Text>
            </TouchableOpacity>
            <Text className={`mb-3 text-xs ${subtextColor}`}>{t('payments.testModeNote')}</Text>
            {error ? <Text className="mb-3 text-sm text-red-500">{error}</Text> : null}
            <View className="flex-row" style={{ gap: 12 }}>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={onClose}
                disabled={paying}
                className={`flex-1 items-center rounded-xl border py-3 ${borderColor}`}>
                <Text className={`font-semibold ${textColor}`}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={pay}
                disabled={paying || selected == null}
                className="flex-1 items-center rounded-xl py-3"
                style={{
                  backgroundColor: BRAND_GREEN,
                  opacity: paying || selected == null ? 0.6 : 1,
                }}>
                {paying ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="font-semibold text-white">
                    {t('payments.payNow', { amount: amountLabel })}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
        {adding && error ? <Text className="mt-3 text-sm text-red-500">{error}</Text> : null}
      </View>
    </ResponsiveModal>
  );
}
