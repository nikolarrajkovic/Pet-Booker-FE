import { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The one place the app turns device safe-area insets into layout numbers.
 *
 * ## Why this exists
 *
 * React Native's own `SafeAreaView` **insets on iOS only** — on Android it is a plain `View`. That
 * was survivable while Android windows still shrank for the system bars, but Android has drawn
 * edge-to-edge since Expo SDK 54: the status bar and the navigation bar are now drawn *over* the
 * app, and nothing pads for them unless the app does it itself.
 *
 * What the app did instead was guess. `AppHeader` padded by `basePaddingTop + insets.top * 0.4` —
 * 40% of the real inset, a fraction tuned by eye against one handset in April — while iOS got the
 * full inset from `SafeAreaView` *plus* that 40% on top, so the same header was over-padded on one
 * platform and under-padded on the other. Two screens later hand-rolled
 * `Platform.OS === 'android' ? insets.top : 0` to patch the symptom locally, and the shared
 * component kept the bug for everyone else.
 *
 * These hooks replace all of that. They report the real inset on both platforms, which is 0 in a
 * browser, so one expression is correct on every device and every window size.
 */

/**
 * The tab bar's fixed chrome: its own vertical padding, each item's padding, and the 24px icon.
 * Everything here is independent of the user's text-size setting.
 */
const TAB_BAR_CHROME = 60;

/** Line box of the tab bar's `text-xs` label at a text scale of 1. */
const TAB_LABEL_LINE_HEIGHT = 16;

/** Gap left between the last row of content and the top of the tab bar. */
const TAB_BAR_CLEARANCE = 24;

/**
 * Padding a screen must leave at the top for the status bar / camera cutout.
 *
 * Only components that paint their own top edge need this — in practice `AppHeader` and the few
 * screens that draw a coloured header instead of using it. A screen inside `ScreenLayout` gets it
 * from the header and must not add it again.
 */
export function useTopInset(): number {
  return useSafeAreaInsets().top;
}

/**
 * Padding a bottom-anchored bar must leave for the system navigation bar.
 *
 * This is the number that changes when you swap handsets: roughly 16–24dp under a gesture pill,
 * around 48dp under three-button navigation, and 0 in a browser. A bar pinned with
 * `absolute bottom-0` and no allowance for it has its labels sitting under the system buttons on
 * one phone and looking fine on the next.
 */
export function useBottomInset(): number {
  return useSafeAreaInsets().bottom;
}

/**
 * Whether an ancestor has already reserved the bottom inset for whatever sits at the bottom of
 * this screen.
 *
 * Exactly one thing may reserve it. `ScreenLayout` pads its content sheet when the screen has no
 * `footer`, which covers the common case of a screen that just scrolls; a `StickyFooter` rendered
 * inside that sheet must then NOT add the inset a second time, or the CTA floats twice the
 * navigation bar's height above the bottom. A `TabBar` passed as `footer` sits outside the padded
 * sheet and keeps owning its own inset.
 */
export const BottomInsetReservedContext = createContext(false);

/** @see BottomInsetReservedContext */
export function useBottomInsetReserved(): boolean {
  return useContext(BottomInsetReservedContext);
}

/**
 * How tall the bottom `TabBar` actually renders.
 *
 * Both terms are real measurements rather than a guess: the label grows with the user's text-size
 * setting (`fontScale`), and the bar reserves the system navigation bar below itself. At the
 * default text size on a device with no bottom inset this is 76 — what the bar has always been.
 */
export function useTabBarHeight(): number {
  const { fontScale } = useWindowDimensions();
  return TAB_BAR_CHROME + TAB_LABEL_LINE_HEIGHT * fontScale + useBottomInset();
}

/**
 * `paddingBottom` for a tab screen's ScrollView, so its last row clears the tab bar.
 *
 * Replaces the hardcoded `paddingBottom: 100` that was copied across the tab screens. That number
 * was the bar's height on one device at one text size with no navigation bar; it resolves to
 * exactly 100 in that case, and grows correctly everywhere else.
 */
export function useTabBarSpacing(): number {
  return useTabBarHeight() + TAB_BAR_CLEARANCE;
}
