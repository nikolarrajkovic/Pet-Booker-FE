import React, { ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';

type StickyFooterProps = {
  children: ReactNode;
  /** Look of the bar itself (bg / border / padding) — positioning is owned by this component. */
  className?: string;
  style?: ViewStyle;
  /** Keep the bar pinned above the keyboard instead of hiding it (e.g. a chat composer). */
  hideOnKeyboard?: boolean;
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
 * No-op on web (the keyboard-controller bindings there never report a visible keyboard), which is
 * what we want — there is no on-screen keyboard to hide from.
 */
export default function StickyFooter({
  children,
  className = '',
  style,
  hideOnKeyboard = true,
}: StickyFooterProps) {
  const isKeyboardVisible = useKeyboardState((state) => state.isVisible);

  if (hideOnKeyboard && isKeyboardVisible) return null;

  return (
    <View className={`absolute bottom-0 left-0 right-0 ${className}`} style={style}>
      {children}
    </View>
  );
}
