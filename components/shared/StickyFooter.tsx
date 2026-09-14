import React, { ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { useResponsive } from '../../hooks/useResponsive';
import { useBottomInset, useBottomInsetReserved } from '../../hooks/useSafeAreaSpacing';

type StickyFooterProps = {
  children: ReactNode;
  /** Look of the bar itself (bg / border / padding) — positioning is owned by this component. */
  className?: string;
  style?: ViewStyle;
  /** Keep the bar pinned above the keyboard instead of hiding it (e.g. a chat composer). */
  hideOnKeyboard?: boolean;
  /**
   * Keep the bar pinned on the web design too.
   *
   * Default is to un-pin it, because a full-width bar stuck to the bottom of a 1440px window is a
   * phone artefact. Set this for the few screens where the action must stay reachable at any
   * scroll offset and there is no aside to put it in.
   */
  pinnedOnWeb?: boolean;
};

/**
 * A CTA bar pinned to the bottom of a screen, which gets OUT OF THE WAY while the keyboard is up.
 *
 * These bars are absolutely positioned, so they overlay the ScrollView rather than shortening it.
 * `ScreenLayout`'s KeyboardAvoidingView shrinks the screen by the keyboard height and the
 * ScrollView then scrolls the focused input to the bottom of its own viewport — which is exactly
 * where the bar sits, so the field the user is typing into ended up underneath it. Dropping the
 * bar for as long as the keyboard is open frees that strip; nothing reflows, because the bar is
 * out of the layout flow either way.
 *
 * ## On the web design it stops being pinned
 *
 * The pinning solves a phone problem: a checkout-shaped screen taller than the display, where the
 * confirm button would otherwise be buried under a scroll the user cannot see the end of. On a
 * desktop the same screen usually fits, the button is in view, and a bar welded across the whole
 * window — the sidebar's width included, if it were pinned to the viewport — reads as a mobile app
 * in a browser. So on web it renders in the flow where it sits, and the screens that genuinely
 * need a persistent action put it in a `TwoColumn` aside, which is sticky and stays in view
 * without spanning anything.
 *
 * No-op on native web keyboards (the keyboard-controller bindings never report a visible keyboard
 * there), which is what we want — there is no on-screen keyboard to hide from.
 */
export default function StickyFooter({
  children,
  className = '',
  style,
  hideOnKeyboard = true,
  pinnedOnWeb = false,
}: StickyFooterProps) {
  const isKeyboardVisible = useKeyboardState((state) => state.isVisible);
  const { isWebLayout } = useResponsive();
  // Zero when ScreenLayout's content sheet already reserved it — see BottomInsetReservedContext.
  const bottomInset = useBottomInset();
  const insetAlreadyReserved = useBottomInsetReserved();
  const reservedHere = insetAlreadyReserved ? 0 : bottomInset;

  if (hideOnKeyboard && isKeyboardVisible) return null;

  if (isWebLayout && !pinnedOnWeb) {
    return (
      <View className={className} style={style}>
        {children}
      </View>
    );
  }

  // Pinned over the screen, so — like the tab bar — it has to reserve the Android navigation bar
  // for itself, or the CTA sits under the system buttons on a three-button handset.
  //
  // A spacer rather than `paddingBottom`: callers pass their own padding through `className`
  // (`px-6 py-4` and friends), and an inline `paddingBottom` would replace it — leaving the button
  // flush against the bar's edge on any device whose inset is 0. This adds to that padding instead
  // of competing with it, and the bar's background still extends behind the system buttons.
  return (
    <View className={`absolute bottom-0 left-0 right-0 ${className}`} style={style}>
      {children}
      <View style={{ height: reservedHere }} />
    </View>
  );
}
