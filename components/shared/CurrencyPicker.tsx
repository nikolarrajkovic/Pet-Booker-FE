import React from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, useThemeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';
import { SUPPORTED_CURRENCIES, formatMoney, type SupportedCurrency } from '../../services/currency';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';

type Props = {
  visible: boolean;
  /** Currently active currency code (row gets a checkmark). */
  current: SupportedCurrency;
  onSelect: (currency: SupportedCurrency) => void;
  onClose: () => void;
};

/**
 * Display-currency chooser opened from Settings (mirrors LanguagePicker's dismissable
 * mode). The choice is a stored preference only — payments are always in RSD for now,
 * which the subtitle spells out. Labels come from the `currencies` dictionary section.
 */
export default function CurrencyPicker({ visible, current, onSelect, onClose }: Props) {
  const { t } = useLocale();
  const { isDarkMode, hex } = useThemeColors();

  useEscapeToClose(visible, onClose);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessible={false}
        focusable={false}
        tabIndex={-1}
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}>
        {/* Stop backdrop taps from closing when they land on the card */}
        <Pressable
          accessibilityRole="button"
          onPress={() => {}}
          style={{
            width: '100%',
            maxWidth: 400,
            borderRadius: 24,
            backgroundColor: hex.card,
            padding: 24,
          }}>
          <View className="mb-1 flex-row items-center justify-between">
            <Text style={{ color: hex.text }} className="text-xl font-bold">
              {t('currencies.title')}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={onClose}
              hitSlop={8}>
              <Ionicons name="close" size={24} color={hex.subtext} />
            </TouchableOpacity>
          </View>
          <Text style={{ color: hex.subtext }} className="mb-5 text-sm">
            {t('currencies.subtitle')}
          </Text>

          {SUPPORTED_CURRENCIES.map((code) => {
            const active = code === current;
            return (
              <TouchableOpacity
                accessibilityRole="button"
                key={code}
                onPress={() => onSelect(code)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 16,
                  marginBottom: 10,
                  borderWidth: 2,
                  borderColor: active ? BRAND_GREEN : isDarkMode ? '#374151' : '#E5E7EB',
                  backgroundColor: active
                    ? isDarkMode
                      ? 'rgba(0,200,112,0.12)'
                      : '#E6FAF0'
                    : 'transparent',
                }}>
                <Text style={{ color: hex.text }} className="flex-1 text-base font-semibold">
                  {t(`currencies.${code.toLowerCase()}` as any)}
                </Text>
                {/* Sample of how prices will read — symbol side differs per currency */}
                <Text style={{ color: hex.subtext }} className="mr-3 text-sm">
                  {formatMoney(1200, code)}
                </Text>
                {active ? <Ionicons name="checkmark-circle" size={22} color={BRAND_GREEN} /> : null}
              </TouchableOpacity>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
