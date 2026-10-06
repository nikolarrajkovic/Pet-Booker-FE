import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BRAND_GREEN, useThemeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';
import {
  createPaymentMethod,
  PaymentMethodStatus,
  type PaymentMethodDto,
} from '../../services/payment-methods';
import { cardBrandOf, isValidCardNumber } from '../../services/payments';
import { getErrorMessage } from '../../services/http';

type Props = {
  userId: number;
  onSaved: (method: PaymentMethodDto) => void;
  onCancel?: () => void;
  /** Make the new card the default. */
  makeDefault?: boolean;
};

/**
 * Adds a card for paying bookings. Card processing is mocked, so only what a real provider would
 * hand back is kept — the brand, the last four digits and the expiry — never the number itself or
 * the security code (which is checked for shape and then discarded).
 */
export default function AddCardForm({ userId, onSaved, onCancel, makeDefault = false }: Props) {
  const { textColor, subtextColor, inputBg, inputText, borderColor, placeholderColor } =
    useThemeColors();
  const { t } = useLocale();
  const [holder, setHolder] = useState('');
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const input = `${inputBg} rounded-xl px-4 py-3 ${inputText} border ${borderColor}`;

  const formatNumber = (v: string) =>
    v
      .replace(/\D/g, '')
      .slice(0, 19)
      .replace(/(\d{4})(?=\d)/g, '$1 ');
  const formatExpiry = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const save = async () => {
    const [mm, yy] = expiry.split('/').map((p) => Number(p));
    const now = new Date();
    const year = 2000 + (yy || 0);
    const expired =
      !mm ||
      mm < 1 ||
      mm > 12 ||
      !yy ||
      year < now.getFullYear() ||
      (year === now.getFullYear() && mm < now.getMonth() + 1);
    if (!holder.trim()) return setError(t('payments.cardHolderRequired'));
    if (!isValidCardNumber(number)) return setError(t('payments.cardNumberInvalid'));
    if (expired) return setError(t('payments.cardExpiryInvalid'));
    if (!/^\d{3,4}$/.test(cvc)) return setError(t('payments.cardCvcInvalid'));

    setError('');
    setSaving(true);
    try {
      const digits = number.replace(/\D/g, '');
      const saved = await createPaymentMethod({
        userId,
        type: 1, // PaymentType.Card
        provider: 'mock',
        providerPaymentMethodId: `mock_pm_${Date.now()}`,
        cardHolderName: holder.trim(),
        cardBrand: cardBrandOf(digits),
        cardLast4: digits.slice(-4),
        expirationMonth: mm,
        expirationYear: year,
        isDefault: makeDefault,
        status: PaymentMethodStatus.Active,
      });
      onSaved(saved);
    } catch (e) {
      setError(getErrorMessage(e, t('payments.cardSaveFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <Text className={`mb-2 text-sm font-semibold ${textColor}`}>{t('payments.cardHolder')}</Text>
      <TextInput
        value={holder}
        onChangeText={setHolder}
        autoCapitalize="words"
        accessibilityLabel={t('payments.cardHolder')}
        className={`${input} mb-3`}
        placeholderTextColor={placeholderColor}
      />
      <Text className={`mb-2 text-sm font-semibold ${textColor}`}>{t('payments.cardNumber')}</Text>
      <TextInput
        value={number}
        onChangeText={(v) => setNumber(formatNumber(v))}
        keyboardType="number-pad"
        autoComplete="cc-number"
        placeholder="0000 0000 0000 0000"
        accessibilityLabel={t('payments.cardNumber')}
        className={`${input} mb-3`}
        placeholderTextColor={placeholderColor}
      />
      <View className="mb-3 flex-row" style={{ gap: 12 }}>
        <View className="flex-1">
          <Text className={`mb-2 text-sm font-semibold ${textColor}`}>
            {t('payments.cardExpiry')}
          </Text>
          <TextInput
            value={expiry}
            onChangeText={(v) => setExpiry(formatExpiry(v))}
            keyboardType="number-pad"
            autoComplete="cc-exp"
            placeholder="MM/YY"
            accessibilityLabel={t('payments.cardExpiry')}
            className={input}
            placeholderTextColor={placeholderColor}
          />
        </View>
        <View className="flex-1">
          <Text className={`mb-2 text-sm font-semibold ${textColor}`}>{t('payments.cardCvc')}</Text>
          <TextInput
            value={cvc}
            onChangeText={(v) => setCvc(v.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            secureTextEntry
            autoComplete="cc-csc"
            placeholder="123"
            accessibilityLabel={t('payments.cardCvc')}
            className={input}
            placeholderTextColor={placeholderColor}
          />
        </View>
      </View>
      <Text className={`mb-3 text-xs ${subtextColor}`}>{t('payments.testModeNote')}</Text>
      {error ? <Text className="mb-3 text-sm text-red-500">{error}</Text> : null}
      <View className="flex-row" style={{ gap: 12 }}>
        {onCancel ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={onCancel}
            disabled={saving}
            className={`flex-1 items-center rounded-xl border py-3 ${borderColor}`}>
            <Text className={`font-semibold ${textColor}`}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          accessibilityRole="button"
          onPress={save}
          disabled={saving}
          className="flex-1 items-center rounded-xl py-3"
          style={{ backgroundColor: BRAND_GREEN, opacity: saving ? 0.7 : 1 }}>
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="font-semibold text-white">{t('payments.saveCard')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
