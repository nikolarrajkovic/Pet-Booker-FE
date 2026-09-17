import React from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';

const MARK_SOURCE = require('../../assets/brand/logo-mark.png');

type BrandMarkProps = {
  /** Edge of the mark — or of the white plate, when `plated`. Defaults to 32. */
  size?: number;
  /**
   * Draw the mark on a white rounded plate instead of straight onto the surface.
   *
   * Required on anything brand-green: see the note below.
   */
  plated?: boolean;
  /** Corner radius of the plate. Defaults to a squircle-ish `size / 3.4`. */
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * The PetBooker mark — the `pB` calendar from `assets/logo_pB_small_calendar.png`.
 *
 * Replaces the paw glyph that used to stand in for a logo in the three places the app brands
 * itself: the signed-out band (`AuthLayout`), the web sidebar (`SideNav`) and the phone home
 * header. Everywhere else a paw still appears it is a *pet* placeholder — a missing pet photo —
 * and stays a paw.
 *
 * ## Why `plated` exists
 *
 * The mark is two greens: a light-green `p` and calendar frame, and a dark-green `B`. On the
 * brand-green band (`bg-brand-500`) the light half is within a few percent of the background
 * and the mark reads as a floating `B` with a smear beside it. So on green it goes on a white
 * plate — which is also what the signed-out screens already did with the paw, and why this
 * renders as a plate rather than asking each caller to build one.
 *
 * On a card, a page background or dark mode the mark has enough contrast on its own, and the
 * plate would just be a white box around a logo.
 *
 * ## Why a PNG and not an SVG
 *
 * The source art is a raster hand-off (1254px squares). `scripts/build-brand-assets.py` derives
 * this file from it — trimmed, and with the baked-in white background cut away so the mark can
 * sit on a plate, a dark card or the pattern wallpaper without a white tile behind it.
 */
export default function BrandMark({ size = 32, plated = false, radius, style }: BrandMarkProps) {
  // Optical fit: the mark is nearly square, so inset it rather than letting it touch the
  // plate's rounded corners.
  const markSize = plated ? Math.round(size * 0.72) : size;

  const mark = (
    <Image
      source={MARK_SOURCE}
      style={{ width: markSize, height: markSize }}
      resizeMode="contain"
      // Decorative: every caller already labels the pressable or heading that contains it, so
      // announcing "PetBooker" a second time is noise on a screen reader.
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );

  if (!plated) return <View style={style}>{mark}</View>;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius ?? Math.round(size / 3.4),
          backgroundColor: '#ffffff',
        },
        style,
      ]}>
      {mark}
    </View>
  );
}
