import React, { ReactNode } from 'react';
import { SafeAreaView, View } from 'react-native';
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
}: ScreenLayoutProps) {
  const { bgColor } = useThemeColors();

  const finalSafeAreaBg = safeAreaBg || bgColor;
  const finalContentBg = contentBg || bgColor;

  return (
    <SafeAreaView className={`flex-1 ${finalSafeAreaBg}`}>
      <AppHeader
        variant={headerVariant}
        showBackButton={showBackButton}
        onBackPress={onBackPress}
        title={headerTitle}
        subtitle={headerSubtitle}
        showNotificationButton={showNotificationButton}
        onNotificationPress={onNotificationPress}
        rightAction={rightAction}
      >
        {headerChildren}
      </AppHeader>

      {/* Content area with rounded top */}
      {contentRounded ? (
        <View className={`-mt-8 ${finalContentBg} rounded-t-3xl flex-1`} style={{ overflow: 'hidden' }}>
          {children}
        </View>
      ) : (
        <View className="flex-1">
          {children}
        </View>
      )}

      {/* Footer (e.g., TabBar) */}
      {footer}
    </SafeAreaView>
  );
}
