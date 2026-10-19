import React, { ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';
import { useResponsive, byMode } from '../../hooks/useResponsive';
import { PAGE_GUTTER } from '../../hooks/usePageGutter';

type ContentContainerProps = {
  children: ReactNode;
  /** Drop the horizontal padding — for a child that manages its own gutters (a full-bleed rail). */
  noPadding?: boolean;
  className?: string;
  style?: ViewStyle;
};

/**
 * The column the web design lays a page in: **the full width beside the sidebar, inset by the one
 * page gutter** (hooks/usePageGutter — 32 on web, 16 on a phone).
 *
 * Pages used to pick a cap here — `narrow` 720 for forms, `default` 1360, `wide` 1600, `full` for
 * Search — and the capped column was centred in what was left of the window. On a 1920 screen
 * that put the content anywhere from 32px (Search) to 92px (dashboards), 211px (lists) and 531px
 * (forms) from the sidebar: every page had its own margins, and most of them left a band of empty
 * page on both sides (feedback 2026-10-19: "all pages … full width … same padding"). Now every
 * page is laid out the way Search was: full width, one gutter, the title and the body on the same
 * left edge.
 *
 * On mobile this is a plain `View` with the phone's gutter, so wrapping a screen body in it
 * changes nothing about the phone design.
 */
export default function ContentContainer({
  children,
  noPadding = false,
  className = '',
  style,
}: ContentContainerProps) {
  const { mode } = useResponsive();
  const horizontalPadding = noPadding ? 0 : byMode(mode, PAGE_GUTTER);

  return (
    <View
      className={className}
      style={[{ width: '100%', paddingHorizontal: horizontalPadding }, style]}>
      {children}
    </View>
  );
}
