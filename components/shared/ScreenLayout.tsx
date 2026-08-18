import React, { ReactNode } from 'react';
import { SafeAreaView, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useThemeColors } from '../../hooks/useThemeColors';
import AppHeader from './AppHeader';

type ScreenLayoutProps = {
  // AppHeader props
  headerVariant?: 'large' | 'standard' | 'compact';
  showBackButton?: boolean;
  onBackPress?: () => void;
  headerTitle?: string;
  headerSubtitle?: string;
  headerChildren?: ReactNode;
  showNotificationButton?: boolean;
  onNotificationPress?: () => void;
  rightAction?: ReactNode;

  // Content area props
  children: ReactNode;
  contentRounded?: boolean; // default true

  // Footer (e.g., TabBar)
  footer?: ReactNode;

  // Background colors (can be overridden)
  safeAreaBg?: string;
  contentBg?: string;

  // Keyboard avoidance (default true) — see the note on the KeyboardAvoidingView below.
  avoidKeyboard?: boolean;
};

export default function ScreenLayout({
  headerVariant = 'standard',
  showBackButton = false,
  onBackPress,
  headerTitle,
  headerSubtitle,
  headerChildren,
  showNotificationButton = false,
  onNotificationPress,
  rightAction,
  children,
  contentRounded = true,
  footer,
  safeAreaBg,
  contentBg,
  avoidKeyboard = true,
}: ScreenLayoutProps) {
  const { bgColor } = useThemeColors();

  const finalSafeAreaBg = safeAreaBg || bgColor;
  const finalContentBg = contentBg || bgColor;

  return (
    <SafeAreaView className={`flex-1 ${finalSafeAreaBg}`}>
      {/*
        Android has drawn edge-to-edge since Expo SDK 54, which makes the manifest's
        `adjustResize` a no-op — the window no longer shrinks when the keyboard opens, so the IME
        covers the focused field instead. Padding the screen by the keyboard's height restores
        that: the body shrinks, and the ScrollView inside it scrolls the focused input into view
        the way it used to. This is a no-op while the keyboard is closed, so it is on for every
        screen; pass `avoidKeyboard={false}` for the rare one that manages the keyboard itself.

        Requires the `KeyboardProvider` mounted in App.tsx — without it this never moves.
      */}
      <KeyboardAvoidingView behavior="padding" enabled={avoidKeyboard} style={{ flex: 1 }}>
        <AppHeader
          variant={headerVariant}
          showBackButton={showBackButton}
          onBackPress={onBackPress}
          title={headerTitle}
          subtitle={headerSubtitle}
          showNotificationButton={showNotificationButton}
          onNotificationPress={onNotificationPress}
          rightAction={rightAction}>
          {headerChildren}
        </AppHeader>

        {/* Content area with rounded top */}
        {contentRounded ? (
          <View
            className={`-mt-8 ${finalContentBg} flex-1 rounded-t-3xl`}
            style={{ overflow: 'hidden' }}>
            {children}
          </View>
        ) : (
          <View className="flex-1">{children}</View>
        )}

        {/* Footer (e.g., TabBar) */}
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
