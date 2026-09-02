import React, { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { useResponsive } from '../../hooks/useResponsive';

type TwoColumnProps = {
  /** The screen's body. Takes the remaining width on web, and the whole screen on mobile. */
  children: ReactNode;
  /** The side panel — a summary, a price breakdown, the primary CTA. */
  aside: ReactNode;
  /** Aside width in px on the web design. */
  asideWidth?: number;
  /** Gap between the columns in px. */
  gap?: number;
  /**
   * Put the aside first in the stacked (mobile) order.
   *
   * Default is aside-last: on a phone the body is what the user came for, and a summary panel
   * pushed above it just means scrolling past the summary to reach the content. Set this for the
   * screens where the panel *is* the point — a price the user is about to confirm.
   */
  asideFirstOnMobile?: boolean;
};

/**
 * Main content beside a side panel on web; one stacked column on mobile.
 *
 * This is the shape that most of the detail and form screens want on a wide window: the thing you
 * are reading on the left, and the thing you are about to do about it — book, confirm, pay, edit
 * — pinned in view on the right instead of at the bottom of a long scroll. On a phone the two
 * simply stack, which is exactly the design that ships today.
 *
 * The aside is `position: sticky` on web so it stays in view as the main column scrolls. That is a
 * web-only CSS value; it is passed through `react-native-web`'s style layer and ignored on native,
 * which never renders this branch anyway.
 */
export default function TwoColumn({
  children,
  aside,
  asideWidth = 360,
  gap = 32,
  asideFirstOnMobile = false,
}: TwoColumnProps) {
  const { isWebLayout } = useResponsive();

  if (!isWebLayout) {
    return (
      <>
        {asideFirstOnMobile && <View className="mb-6">{aside}</View>}
        {children}
        {!asideFirstOnMobile && <View className="mt-6">{aside}</View>}
      </>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      <View
        // `position: sticky` is a web-only CSS value with no RN equivalent, so the object is cast:
        // react-native-web passes it straight through, and native never renders this branch.
        style={
          {
            width: asideWidth,
            marginLeft: gap,
            position: 'sticky',
            top: 24,
          } as unknown as ViewStyle
        }>
        {aside}
      </View>
    </View>
  );
}
