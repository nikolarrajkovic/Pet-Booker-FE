import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import FormCard from '../../../components/shared/FormCard';
import AddCardForm from '../../../components/shared/AddCardForm';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useResource } from '../../../hooks/useResource';
import { usePageGutter } from '../../../hooks/usePageGutter';
import { showAlert } from '../../../services/alert';
import { getErrorMessage } from '../../../services/http';
import { deletePaymentMethod, getPaymentMethods } from '../../../services/payment-methods';
import { cardLabel } from '../../../services/payments';

/**
 * The customer's saved cards: the ones the pay sheet on a booking offers. Card processing is a
 * mock for now, so a card here is its brand, last four digits and expiry — what a real provider
 * hands back — never the number. The `manual` placeholders an earlier booking flow created are a
 * booking reference rather than something to pay with, so they are not listed.
 */
export default function PaymentMethodsScreen() {
  const gutter = usePageGutter();
  const { bgColor, textColor, subtextColor, borderColor } = useThemeColors();
  const { t } = useLocale();
  const { currentUser } = useAuth();
  const { showError, showSuccess } = useToast();
  const userId = currentUser?.id ?? 0;
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const {
    data: methods,
    isLoading,
    error,
    refresh,
  } = useResource(['payment-methods', userId], () => getPaymentMethods(userId), {
    enabled: userId > 0,
    errorFallback: t('payments.cardsLoadFailed'),
  });
  const cards = (methods ?? []).filter((m) => m.provider !== 'manual' && m.cardLast4);

  const remove = (id: number, label: string) => {
    showAlert(t('payments.removeCardTitle'), t('payments.removeCardMsg', { card: label }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.remove'),
        style: 'destructive',
        onPress: async () => {
          setRemovingId(id);
          try {
            await deletePaymentMethod(id);
            showSuccess(t('payments.cardRemoved'));
            refresh();
          } catch (e) {
            showError(getErrorMessage(e, t('payments.cardRemoveFailed')));
          } finally {
            setRemovingId(null);
          }
        },
      },
    ]);
  };

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle={t('payments.methodsTitle')}
      contentBg={bgColor}
      width="narrow">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        <FormCard>
          <View className={`${gutter.px} py-6`}>
            <Text className={`mb-5 text-sm ${subtextColor}`}>{t('payments.methodsIntro')}</Text>

            {isLoading && !methods ? (
              <ActivityIndicator color={BRAND_GREEN} />
            ) : error ? (
              <Text className="text-sm text-red-500">{error}</Text>
            ) : (
              <>
                {cards.length === 0 && !adding ? (
                  <View
                    className={`mb-4 items-center rounded-2xl border border-dashed py-8 ${borderColor}`}>
                    <Ionicons name="card-outline" size={36} color="#9CA3AF" />
                    <Text className={`mt-2 text-sm ${subtextColor}`}>{t('payments.noCards')}</Text>
                  </View>
                ) : null}
                {cards.map((card) => {
                  const label = cardLabel(card, t('payments.card'));
                  return (
                    <View
                      key={card.id}
                      className={`mb-3 flex-row items-center rounded-2xl border px-4 py-4 ${borderColor}`}>
                      <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-green-50">
                        <Ionicons name="card" size={20} color={BRAND_GREEN} />
                      </View>
                      <View className="flex-1">
                        <Text className={`font-semibold ${textColor}`}>{label}</Text>
                        <Text className={`text-xs ${subtextColor}`}>
                          {card.cardHolderName}
                          {card.expirationMonth && card.expirationYear
                            ? ` · ${String(card.expirationMonth).padStart(2, '0')}/${String(card.expirationYear).slice(-2)}`
                            : ''}
                        </Text>
                      </View>
                      {card.isDefault ? (
                        <View className="mr-2 rounded-full bg-brand-100 px-2 py-0.5">
                          <Text className="text-xs font-semibold text-brand-700">
                            {t('payments.default')}
                          </Text>
                        </View>
                      ) : null}
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`${t('common.remove')} ${label}`}
                        disabled={removingId === card.id}
                        onPress={() => card.id != null && remove(card.id, label)}
                        className="p-2">
                        {removingId === card.id ? (
                          <ActivityIndicator size="small" color="#EF4444" />
                        ) : (
                          <Ionicons name="trash-outline" size={20} color="#EF4444" />
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}

                {adding ? (
                  <View className={`mt-2 rounded-2xl border p-4 ${borderColor}`}>
                    <AddCardForm
                      userId={userId}
                      makeDefault={cards.length === 0}
                      onCancel={() => setAdding(false)}
                      onSaved={() => {
                        setAdding(false);
                        showSuccess(t('payments.cardSaved'));
                        refresh();
                      }}
                    />
                  </View>
                ) : (
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => setAdding(true)}
                    className="mt-1 flex-row items-center justify-center rounded-2xl border-2 border-brand-500 py-3">
                    <Ionicons name="add" size={20} color={BRAND_GREEN} />
                    <Text className="ml-2 font-semibold text-brand-600">
                      {t('payments.addCard')}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </FormCard>
      </ScrollView>
    </ScreenLayout>
  );
}
