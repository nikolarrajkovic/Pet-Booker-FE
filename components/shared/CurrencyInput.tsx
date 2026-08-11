import React from 'react';
import { View, Text, TextInput, TextInputProps } from 'react-native';
import { useCurrency } from '../../hooks/useCurrency';

import { BRAND_GREEN } from '../../hooks/useThemeColors';
type Props = Omit<TextInputProps, 'keyboardType'> & {
  /** The currency being entered; omit to use the user's display preference. */
  currency?: string | null;
  /** Classes for the input's box (background, padding, radius) — same as before this wrapper. */
  containerClassName?: string;
  /** Classes for the TextInput itself (text color, size). */
  inputClassName?: string;
  /** Classes for the currency symbol (usually the screen's subtext color). */
  affixClassName?: string;
  keyboardType?: TextInputProps['keyboardType'];
};

/**
 * A numeric price field with its currency symbol attached on the conventional side —
 * "$ [25]" for USD, "[25] €" for EUR, "[1200] RSD" for dinar.
 *
 * Screens used to hardcode a `<Text>$</Text>` before the input, which was wrong for every
 * provider not pricing in dollars. The box, padding and text styles stay caller-controlled
 * so swapping this in doesn't change a field's appearance beyond the symbol itself.
 */
export default function CurrencyInput({
  currency,
  containerClassName = '',
  inputClassName = '',
  affixClassName = '',
  keyboardType = 'numeric',
  style,
  ...inputProps
}: Props) {
  const { prefix, suffix } = useCurrency(currency);

  return (
    <View className={`flex-row items-center ${containerClassName}`} style={{ overflow: 'hidden' }}>
      {prefix ? (
        <Text className={`mr-1 ${affixClassName}`} style={AFFIX_STYLE} numberOfLines={1}>
          {prefix}
        </Text>
      ) : null}
      <TextInput
        {...inputProps}
        className={`flex-1 ${inputClassName}`}
        // minWidth:0 is load-bearing. On React Native Web a TextInput is an <input>, which
        // gets `min-width: auto` in a flex row — that resolves to the control's intrinsic
        // width and stops `flex-1` from shrinking it. The row then overflows and a suffix
        // like "RSD" spills out under the next sibling (the tier row's Remove button).
        style={[{ minWidth: 0 }, style]}
        keyboardType={keyboardType}
        selectionColor={BRAND_GREEN}
        cursorColor={BRAND_GREEN}
      />
      {suffix ? (
        <Text className={`ml-2 ${affixClassName}`} style={AFFIX_STYLE} numberOfLines={1}>
          {suffix}
        </Text>
      ) : null}
    </View>
  );
}

// The symbol is the one part that must never be clipped or wrapped — the amount shrinks first.
const AFFIX_STYLE = { flexShrink: 0 } as const;
