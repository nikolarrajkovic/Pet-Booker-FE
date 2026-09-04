import React from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, useThemeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';
import { LANGUAGES, type Language } from '../../i18n';
import CountryFlag from './CountryFlag';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';

type Props = {
  visible: boolean;
  /** Currently active language (row gets a checkmark). */
  current: Language;
  onSelect: (lang: Language) => void;
  /** Omit for the first-run chooser (non-dismissable, no close/backdrop). */
  onClose?: () => void;
};

/**
 * Language chooser used both as the first-run gate (no `onClose` → non-dismissable,
 * MaterialCommunity-style full prompt) and the Settings picker (`onClose` provided →
 * dismissable modal). Labels come from the `languages` dictionary section.
 */
export default function LanguagePicker({ visible, current, onSelect, onClose }: Props) {
  const { t } = useLocale();
  const { isDarkMode, hex } = useThemeColors();
  const dismissable = !!onClose;

  useEscapeToClose(visible && dismissable, onClose);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessible={false}
        focusable={false}
        tabIndex={-1}
        onPress={dismissable ? onClose : undefined}
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
              {t('languages.title')}
            </Text>
            {dismissable ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                onPress={onClose}
                hitSlop={8}>
                <Ionicons name="close" size={24} color={hex.subtext} />
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={{ color: hex.subtext }} className="mb-5 text-sm">
            {t('languages.subtitle')}
          </Text>

          {LANGUAGES.map((lang) => {
            const active = lang.code === current;
            return (
              <TouchableOpacity
                accessibilityRole="button"
                key={lang.code}
                onPress={() => onSelect(lang.code)}
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
                <CountryFlag iso={lang.iso} width={28} />
                <Text style={{ color: hex.text }} className="ml-3 flex-1 text-base font-semibold">
                  {lang.label}
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
