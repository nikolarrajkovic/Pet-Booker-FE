import React, { ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTopInset } from '../../hooks/useSafeAreaSpacing';
import { useTheme } from '../../context/ThemeContext';
import { useLocale } from '../../context/LocaleContext';

type AppHeaderProps = {
  // Size variant
  variant?: 'large' | 'standard' | 'compact';

  // Navigation
  showBackButton?: boolean;
  onBackPress?: () => void;

  // Title/Content
  title?: string;
  subtitle?: string;

  // Custom content (for more complex headers like Home screen)
  children?: ReactNode;

  // Actions (right side)
  showNotificationButton?: boolean;
  onNotificationPress?: () => void;
  rightAction?: ReactNode;

  // Style options
  rounded?: boolean; // rounded-b-3xl
};

export default function AppHeader({
  variant = 'standard',
  showBackButton = false,
  onBackPress,
  title,
  subtitle,
  children,
  showNotificationButton = false,
  onNotificationPress,
  rightAction,
  rounded = false,
}: AppHeaderProps) {
  const navigation = useNavigation();
  const { isDarkMode } = useTheme();
  const { t } = useLocale();
  const topInset = useTopInset();

  const bgColor = isDarkMode ? 'bg-[#0f1621]' : 'bg-brand-500';

  // Breathing room between the status bar and the header's own content. Pure spacing: clearing
  // the status bar is the inset's job below, not a number baked into these.
  //
  // It used to be baked in — 48pt for 'standard' plus `insets.top * 0.4`, a fraction tuned by eye
  // against one handset. That is only ever right for one status-bar height, and it was wrong in
  // opposite directions on the two platforms: React Native's `SafeAreaView` insets on iOS only, so
  // iOS got the full inset AND the 40% on top, while Android — drawing edge-to-edge since Expo SDK
  // 54 — got nothing but the 40%. On 'large' (base 16) any device whose top inset exceeded ~27dp
  // put the title under the status bar and camera cutout, which is why two screens ended up
  // hand-rolling their own `Platform.OS === 'android' ? insets.top : 0`.
  const contentPaddingTop = variant === 'large' ? 16 : variant === 'standard' ? 24 : 20;
  const paddingBottom = variant === 'large' ? 'pb-6' : variant === 'standard' ? 'pb-6' : 'pb-4';

  // The header paints its own background up to the top of the window, so the green runs under the
  // status bar and the content sits below it — on every device, and on both platforms. In a
  // browser the inset is 0 and this is just the breathing room.
  const totalPaddingTop = topInset + contentPaddingTop;

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // Nothing to pop (e.g. a reset landed us here) — go up to Home instead of no-op.
      (navigation as any).navigate('MainTabs', { screen: 'Home' });
    }
  };

  const handleNotificationPress = () => {
    if (onNotificationPress) {
      onNotificationPress();
    } else {
      (navigation as any).navigate('Notifications');
    }
  };

  return (
    <View
      className={`${bgColor} px-6 ${paddingBottom} ${rounded ? 'rounded-b-3xl' : ''}`}
      style={{ paddingTop: totalPaddingTop }}>
      {/* Navigation Row - show if we have back button or actions */}
      {(showBackButton || showNotificationButton || rightAction) && (
        <View className="mb-4 flex-row items-center justify-between">
          {/* Left side - Back button */}
          {showBackButton ? (
            <TouchableOpacity
              onPress={handleBackPress}
              // An icon-only button announces as nothing without these — which was the case on
              // every screen in the app. The web design's PageHeader labels its own back link,
              // so leaving this one bare made the phone design the strictly less accessible of
              // the two for no reason.
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              className="h-10 w-10 items-center justify-center rounded-full bg-brand-600">
              <Ionicons name="arrow-back" size={20} color="white" />
            </TouchableOpacity>
          ) : (
            <View className="h-10 w-10" />
          )}

          {/* Center - Title in navigation row */}
          {title && (
            <Text className="flex-1 text-center text-lg font-semibold text-white">{title}</Text>
          )}

          {/* Right side - Notification or custom action */}
          {showNotificationButton ? (
            <TouchableOpacity
              onPress={handleNotificationPress}
              accessibilityRole="button"
              accessibilityLabel={t('profile.notifications')}
              className="h-10 w-10 items-center justify-center rounded-full bg-brand-600">
              <Ionicons name="notifications-outline" size={20} color="white" />
            </TouchableOpacity>
          ) : rightAction ? (
            rightAction
          ) : (
            <View className="h-10 w-10" />
          )}
        </View>
      )}

      {/* Title and Subtitle (full width centered style - only if no nav row) */}
      {title && !showBackButton && !showNotificationButton && !rightAction && (
        <View className="items-center">
          <Text className="text-2xl font-bold text-white">{title}</Text>
          {subtitle && (
            <Text className={`${isDarkMode ? 'text-gray-400' : 'text-brand-100'} mt-2`}>
              {subtitle}
            </Text>
          )}
        </View>
      )}

      {/* Custom content (for complex headers) */}
      {children}
    </View>
  );
}
