import React, { ReactNode } from 'react';
import { Modal, Pressable, View, ViewStyle } from 'react-native';
import { useResponsive } from '../../hooks/useResponsive';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';

type ResponsiveModalProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Dialog width on the web design, in px. */
  dialogWidth?: number;
  /**
   * How the phone design presents it: a full-screen sheet (the default, for anything with its own
   * header and a lot of content) or a centred card (short confirmations).
   */
  mobilePresentation?: 'fullScreen' | 'centered';
  /** Dismiss by tapping the backdrop. Off for anything with unsaved input behind it. */
  dismissOnBackdropPress?: boolean;
  className?: string;
  style?: ViewStyle;
};

/**
 * A modal that is a full-screen sheet on a phone and a centred dialog on a desktop.
 *
 * The phone treatment is right on a phone: there is no room for a dialog, and a sheet that owns
 * the display is how every mobile OS asks a question. Rendered unchanged in a browser it covers a
 * 27" display to collect a decline reason, with the close button 900px from the content.
 *
 * On the web design the same children go in a card on a scrim, with the two dismissal routes a
 * desktop user expects: clicking outside, and **Esc**. (RN's `<Modal onRequestClose>` fires for
 * Android's back button, not for a browser key press, so the key listener here is what makes Esc
 * work at all — it is behaviour difference B4 in `WEB_LAYOUT.md`.)
 *
 * Use this instead of a bare `<Modal>` anywhere a modal outlives Stage 5.
 */
export default function ResponsiveModal({
  visible,
  onClose,
  children,
  dialogWidth = 520,
  mobilePresentation = 'fullScreen',
  dismissOnBackdropPress = true,
  className = '',
  style,
}: ResponsiveModalProps) {
  const { isWebLayout } = useResponsive();
  const { cardBg, borderColor } = useThemeColors();

  useEscapeToClose(visible, onClose);

  if (isWebLayout) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable
          accessible={false}
          focusable={false}
          tabIndex={-1}
          onPress={dismissOnBackdropPress ? onClose : undefined}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: 24,
          }}>
          {/* Swallows the press so a click inside the dialog doesn't reach the backdrop. */}
          <Pressable
            accessible={false}
            focusable={false}
            tabIndex={-1}
            onPress={(e) => e.stopPropagation()}
            className={`${cardBg} border ${borderColor} rounded-2xl ${className}`}
            style={[
              {
                width: '100%',
                maxWidth: dialogWidth,
                maxHeight: '90%',
                overflow: 'hidden',
                shadowColor: '#000',
                shadowOpacity: 0.25,
                shadowRadius: 32,
                shadowOffset: { width: 0, height: 12 },
                elevation: 12,
              },
              style,
            ]}>
            {children}
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  if (mobilePresentation === 'centered') {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable
          accessible={false}
          focusable={false}
          tabIndex={-1}
          onPress={dismissOnBackdropPress ? onClose : undefined}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: 24,
          }}>
          <Pressable
            accessible={false}
            focusable={false}
            tabIndex={-1}
            onPress={(e) => e.stopPropagation()}
            className={`${cardBg} w-full rounded-2xl ${className}`}
            style={style}>
            {children}
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className={`flex-1 ${cardBg} ${className}`} style={style}>
        {children}
      </View>
    </Modal>
  );
}
