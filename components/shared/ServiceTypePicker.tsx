import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';
import { useEnums } from '../../context/EnumsContext';
import type { EnumEntry } from '../../services/enums';
import { PROVIDER_TYPE_LABELS } from '../../services/service-providers';

// Before /enums resolves (or if it fails), the static labels, so the field is never empty.
const FALLBACK_TYPE_ENTRIES: EnumEntry[] = Object.keys(PROVIDER_TYPE_LABELS).map((value) => ({
  value: Number(value),
  name: PROVIDER_TYPE_LABELS[Number(value)],
}));

type Props = {
  /** ServiceProviderType values picked so far. */
  selected: number[];
  onChange: (next: number[]) => void;
  /** Outlines every chip red, for a required field left empty. */
  invalid?: boolean;
};

/**
 * The kinds of service a partner offers, as toggle chips (app review G13). A partner declares
 * these when applying, or an admin adding them does, and edits them on the business profile;
 * each service they add then picks one. Selection keeps enum order, so the first is stable.
 */
export default function ServiceTypePicker({ selected, onChange, invalid }: Props) {
  const { isDarkMode, inputBg, borderColor } = useThemeColors();
  const { tEnum } = useLocale();
  const { enums } = useEnums();
  const entries = enums?.serviceProviderType?.length
    ? enums.serviceProviderType
    : FALLBACK_TYPE_ENTRIES;

  const toggle = (value: number) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    onChange(next.sort((a, b) => a - b));
  };

  return (
    <View className="flex-row flex-wrap" style={{ gap: 12 }}>
      {entries.map((entry) => {
        const isSelected = selected.includes(entry.value);
        return (
          <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected }}
            // react-native-web reads aria-*, not accessibilityState.
            aria-checked={isSelected}
            key={entry.value}
            onPress={() => toggle(entry.value)}
            className={`flex-row items-center rounded-xl border-2 px-5 py-3 ${
              isSelected
                ? 'border-brand-500 bg-brand-500'
                : `${inputBg} ${invalid ? 'border-red-500' : borderColor}`
            }`}>
            {isSelected ? (
              <Ionicons name="checkmark" size={16} color="white" style={{ marginRight: 6 }} />
            ) : null}
            <Text
              className={`font-medium ${
                isSelected ? 'text-white' : isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
              {tEnum('serviceProviderType', entry.value, entry.displayName ?? entry.name)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
