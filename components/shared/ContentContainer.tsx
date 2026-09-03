import React, { ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';
import { useResponsive, byMode } from '../../hooks/useResponsive';

/**
 * How wide the content column is allowed to grow on the web design.
 *
 * A page that runs to the edge of a 1920px window is unreadable — text lines pass 200 characters
 * and the eye loses the start of the next one. Each shape gets the cap that suits it rather than
 * one global number:
 */
export const CONTENT_WIDTHS = {
  /** Forms and auth — a single column of fields nobody wants to be 1400px wide. */
  narrow: 720,
  /** The default: reading pages, detail screens, lists of cards. */
  default: 1120,
  /** Dashboards and grids, where more columns genuinely help. */
  wide: 1400,
  /** No cap — maps and anything that should bleed to the window edge. */
  full: undefined,
} as const;

export type ContentWidth = keyof typeof CONTENT_WIDTHS;

type ContentContainerProps = {
  children: ReactNode;
  /** Max width on the web design. Ignored on mobile, which is always full-bleed. */
  width?: ContentWidth;
  /** Drop the horizontal padding — for a child that manages its own gutters (a full-bleed rail). */
  noPadding?: boolean;
  className?: string;
  style?: ViewStyle;
};

/**
 * The centred, width-capped column the web design lays its content in.
 *
 * On **mobile this is a plain `View`** with the phone's usual 24px gutters, so wrapping a screen
 * body in it changes nothing about the shipped phone design. On tablet/desktop it centres the
 * content and stops it growing past `CONTENT_WIDTHS[width]`.
 *
 * Use this rather than a hand-written `maxWidth` — four screens each picking their own number is
 * how a "responsive" app ends up with four different column widths and three different gutters.
 */
export default function ContentContainer({
  children,
  width = 'default',
  noPadding = false,
  className = '',
  style,
}: ContentContainerProps) {
  const { mode } = useResponsive();

  const horizontalPadding = noPadding ? 0 : byMode(mode, { mobile: 24, tablet: 32, desktop: 40 });

  return (
    <View
      className={className}
      style={[
        {
          width: '100%',
          maxWidth: CONTENT_WIDTHS[width],
          // `auto` margins are what centre a max-width box; on mobile `maxWidth` is undefined for
          // `full` and equal-or-wider than the screen otherwise, so this is a no-op there.
          marginHorizontal: 'auto',
          paddingHorizontal: horizontalPadding,
        },
        style,
      ]}>
      {children}
    </View>
  );
}
