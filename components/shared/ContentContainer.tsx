import React, { ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';
import { useResponsive, byMode } from '../../hooks/useResponsive';
import { PAGE_GUTTER } from '../../hooks/usePageGutter';

/**
 * The width of a **form page** on the web design (see `narrow`): one column of fields, the title
 * above it, centred in the window.
 */
export const FORM_WIDTH = 720;

type ContentContainerProps = {
  children: ReactNode;
  /**
   * A form or a page of text: cap the column at `FORM_WIDTH` and centre it. Web design only.
   * Everything else leaves this off and fills the width.
   */
  narrow?: boolean;
  /** Drop the horizontal padding — for a child that manages its own gutters (a full-bleed rail). */
  noPadding?: boolean;
  className?: string;
  style?: ViewStyle;
};

/**
 * The column the web design lays a page in.
 *
 * **Most pages: the full width beside the sidebar, inset by the one page gutter**
 * (hooks/usePageGutter — 32 on web, 16 on a phone), laid out the way Search is. Pages used to pick
 * a cap here — 1360, 1600 — centred in what was left of the window, so on a 1920 screen content
 * started anywhere from 32px to 211px from the sidebar (feedback 2026-10-19).
 *
 * **Forms and text pages are `narrow`**: one column, `FORM_WIDTH` wide, centred, with the title
 * above it. Stretched to the full width a form became a band of 1,600px inputs, and side-by-side
 * fields read as two forms (feedback 2026-10-20: "one field per row … smaller width as before").
 *
 * On mobile this is a plain `View` with the phone's gutter, so wrapping a screen body in it
 * changes nothing about the phone design.
 */
export default function ContentContainer({
  children,
  narrow = false,
  noPadding = false,
  className = '',
  style,
}: ContentContainerProps) {
  const { mode, isWebLayout } = useResponsive();
  const horizontalPadding = noPadding ? 0 : byMode(mode, PAGE_GUTTER);
  // The gutter sits inside the cap, so a narrow page's title and its form card share one edge.
  const cap: ViewStyle =
    narrow && isWebLayout ? { maxWidth: FORM_WIDTH, marginHorizontal: 'auto' } : {};

  return (
    <View
      className={className}
      style={[{ width: '100%', paddingHorizontal: horizontalPadding }, cap, style]}>
      {children}
    </View>
  );
}
