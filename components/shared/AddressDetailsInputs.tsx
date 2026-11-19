import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { themeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';
import type { AddressDetails } from '../../services/geocoding';

type Props = {
  value: AddressDetails;
  onChange: (value: AddressDetails) => void;
  isDarkMode: boolean;
};

/**
 * Where in the building: entrance, floor, flat and anything else that finds the door (an intercom
 * name, a gate code). All optional, asked by the map picker under the pin (app review
 * 2026-11-13): a partner coming to a flat got only the street and number.
 */
export default function AddressDetailsInputs({ value, onChange, isDarkMode }: Props) {
  const { t } = useLocale();
  const { hex } = themeColors(isDarkMode);
  const input = {
    backgroundColor: hex.inputBg,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 10,
    color: hex.text,
    borderWidth: 1,
    borderColor: hex.border,
  } as const;

  const short = (key: 'entrance' | 'floor' | 'apartment', label: string) => (
    <TextInput
      testID={`address-${key}`}
      accessibilityLabel={label}
      value={value[key] ?? ''}
      onChangeText={(text) => onChange({ ...value, [key]: text })}
      placeholder={label}
      placeholderTextColor={hex.subtext}
      maxLength={20}
      style={{ ...input, flex: 1, minWidth: 0 }}
    />
  );

  return (
    <View testID="address-details" style={{ marginBottom: 12 }}>
      <Text style={{ color: hex.subtext, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
        {t('address.detailsTitle')}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        {short('entrance', t('address.entrance'))}
        {short('floor', t('address.floor'))}
        {short('apartment', t('address.apartment'))}
      </View>
      <TextInput
        testID="address-other"
        accessibilityLabel={t('address.otherDetails')}
        value={value.line2 ?? ''}
        onChangeText={(text) => onChange({ ...value, line2: text })}
        placeholder={t('address.otherDetails')}
        placeholderTextColor={hex.subtext}
        maxLength={200}
        style={input}
      />
    </View>
  );
}
