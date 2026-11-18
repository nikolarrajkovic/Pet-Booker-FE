import React from 'react';
import { TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, useThemeColors } from '../../hooks/useThemeColors';
import { useResponsive } from '../../hooks/useResponsive';
import { useLocale } from '../../context/LocaleContext';

/**
 * The search field an admin list carries in its header: under the title inside the green slab on
 * the phone (translucent, on green), under the page title on web (a plain bordered field). The
 * Partners list draws the same field inline.
 */
export default function AdminSearchField({
  value,
  onChange,
  placeholder,
  testID,
}: {
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  testID?: string;
}) {
  const { isDarkMode, hex } = useThemeColors();
  const { isWebLayout } = useResponsive();
  const { t } = useLocale();
  return (
    <View
      className={isWebLayout ? (isDarkMode ? 'bg-[#1a2332]' : 'bg-white') : undefined}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        paddingHorizontal: 12,
        marginTop: 14,
        ...(isWebLayout
          ? { borderWidth: 1, borderColor: hex.border, height: 42, maxWidth: 420 }
          : {
              marginBottom: 20,
              paddingVertical: 10,
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.9)',
            }),
      }}>
      <Ionicons
        name="search-outline"
        size={18}
        color={isWebLayout ? hex.subtext : isDarkMode ? 'rgba(255,255,255,0.6)' : '#6B7280'}
      />
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={
          isWebLayout ? hex.subtext : isDarkMode ? 'rgba(255,255,255,0.5)' : '#9CA3AF'
        }
        selectionColor={BRAND_GREEN}
        style={{
          flex: 1,
          marginLeft: 8,
          fontSize: 14,
          color: isWebLayout ? hex.text : isDarkMode ? 'white' : '#111827',
        }}
      />
      {value.length > 0 && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('shared.clear')}
          onPress={() => onChange('')}>
          <Ionicons name="close-circle" size={18} color={hex.subtext} />
        </TouchableOpacity>
      )}
    </View>
  );
}
