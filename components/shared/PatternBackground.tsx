import React from 'react';
import { Platform, StyleSheet, View, ImageBackground, type ViewStyle } from 'react-native';
import { Asset } from 'expo-asset';
import { useResponsive } from '../../hooks/useResponsive';
import { useTheme } from '../../context/ThemeContext';

const TILE_SOURCE = require('../../assets/pattern-bg.png');

/** Tile size in px — must match the asset's own dimensions so the CSS tiling is 1:1. */
const TILE = { width: 420, height: 420 } as const;

/**
 * How loud the texture is. Deliberately low: this sits *behind* real content, and a background
 * that competes with the foreground is worse than no background at all.
 *
 * Dark mode gets much less. The tile is line art keyed to alpha, so on a dark ground it reads as
 * light strokes — which carry far further than the same strokes on white.
 */
const OPACITY = { light: 0.5, dark: 0.16 } as const;

type PatternBackgroundProps = {
  /** Content drawn on top of the pattern. */
  children?: React.ReactNode;
  /**
   * Draw on the phone design too.
   *
   * Off by default: the whitespace this exists to fill is a *wide-window* problem. On a phone the
   * content already fills the screen, so the texture would sit under the content rather than
   * beside it — all noise, no gap filled.
   */
  onMobile?: boolean;
  style?: ViewStyle;
};

/**
 * The pet-pattern texture that fills the empty space around capped content on the web design.
 *
 * At 1920px a 440px login card leaves 740px of blank white either side, and a content column
 * capped at 1400px leaves ~180px each side on every signed-in screen. That emptiness is what makes
 * a correctly laid-out page still read as "a phone app in a browser". This puts something there.
 *
 * **It is a background, not decoration on top of anything**: the tile is absolutely positioned
 * behind `children` and marked non-interactive, so it can never intercept a press or a scroll.
 * Content that needs to stay readable paints its own opaque surface over it — which every card,
 * sheet and dialog in the app already does.
 *
 * ## Why web tiles through CSS
 *
 * `<ImageBackground resizeMode="repeat">` does not tile on react-native-web — it renders a single
 * image at natural size in the top-left corner and leaves the rest empty. Sizing it through
 * `imageStyle` resizes that one element rather than the tile, and `Image.resolveAssetSource`,
 * the usual route to a URL, is not implemented there either. `expo-asset` resolves the hashed
 * URL on every platform, so the web design tiles with real CSS and native keeps the
 * `ImageBackground` path, which does work there.
 *
 * The asset is authored at exactly its tile size (420×420 — square, because the source is a
 * square seamless tile and changing the aspect would break the repeat), so `background-size` is a
 * straight
 * 1:1 and the file stays small.
 */
export default function PatternBackground({
  children,
  onMobile = false,
  style,
}: PatternBackgroundProps) {
  const { isWebLayout } = useResponsive();
  const { isDarkMode } = useTheme();

  const show = isWebLayout || onMobile;
  const opacity = isDarkMode ? OPACITY.dark : OPACITY.light;

  return (
    <View style={[{ flex: 1 }, style]}>
      {show && (
        <View
          style={StyleSheet.absoluteFillObject}
          // The backdrop must never eat a click meant for the page. `ImageBackground` has no
          // `pointerEvents` prop of its own, which is the other reason for this wrapper.
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          {Platform.OS === 'web' ? (
            <View
              style={
                {
                  ...StyleSheet.absoluteFillObject,
                  opacity,
                  backgroundImage: `url(${Asset.fromModule(TILE_SOURCE).uri})`,
                  backgroundRepeat: 'repeat',
                  backgroundSize: `${TILE.width}px ${TILE.height}px`,
                } as unknown as ViewStyle
              }
            />
          ) : (
            <ImageBackground
              source={TILE_SOURCE}
              resizeMode="repeat"
              style={[StyleSheet.absoluteFillObject, { opacity }]}
            />
          )}
        </View>
      )}
      {children}
    </View>
  );
}
