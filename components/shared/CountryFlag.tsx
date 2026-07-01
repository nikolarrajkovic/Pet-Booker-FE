import React from 'react';
import { Image, ImageStyle, StyleProp, StyleSheet } from 'react-native';

interface CountryFlagProps {
  /** ISO 3166-1 alpha-2 country code, e.g. "RS". */
  iso: string;
  /** Rendered width in px (height is derived at a 4:3 ratio). Default 24. */
  width?: number;
  style?: StyleProp<ImageStyle>;
}

/**
 * Renders a country flag as an image (flagcdn) so it displays consistently on
 * every platform — unlike flag *emoji*, which Windows/web fall back to showing
 * as the two-letter country code. A 48×36 source is requested for crispness at
 * the small sizes used by the phone-number country picker.
 */
export default function CountryFlag({ iso, width = 24, style }: CountryFlagProps) {
  const code = (iso || '').toLowerCase();
  const height = Math.round((width * 3) / 4);
  return (
    <Image
      source={{ uri: `https://flagcdn.com/48x36/${code}.png` }}
      style={[
        {
          width,
          height,
          borderRadius: 3,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(0,0,0,0.12)',
        },
        style,
      ]}
      resizeMode="cover"
      accessibilityIgnoresInvertColors
    />
  );
}
