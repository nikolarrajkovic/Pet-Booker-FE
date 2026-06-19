import React, { ReactNode } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';

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
  const insets = useSafeAreaInsets();

  const bgColor = isDarkMode ? 'bg-[#0f1621]' : 'bg-brand-500';
  
  // Base padding values (in pixels/points)
  const basePaddingTop = variant === 'large' ? 16 : variant === 'standard' ? 48 : 32;
  const paddingBottom = variant === 'large' ? 'pb-6' : variant === 'standard' ? 'pb-6' : 'pb-4';
  
  // Add reduced safe area inset to top padding (only use 40% of the inset to avoid excessive spacing)
  const totalPaddingTop = basePaddingTop + (insets.top * 0.4);

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
      style={{ paddingTop: totalPaddingTop }}
    >
      {/* Navigation Row - show if we have back button or actions */}
      {(showBackButton || showNotificationButton || rightAction) && (
        <View className="flex-row items-center justify-between mb-4">
          {/* Left side - Back button */}
          {showBackButton ? (
            <TouchableOpacity
              onPress={handleBackPress}
              className="w-10 h-10 rounded-full bg-brand-600 items-center justify-center"
            >
              <Ionicons name="arrow-back" size={20} color="white" />
            </TouchableOpacity>
          ) : (
            <View className="w-10 h-10" />
          )}

          {/* Center - Title in navigation row */}
          {title && (
            <Text className="text-white text-lg font-semibold flex-1 text-center">
              {title}
            </Text>
          )}

          {/* Right side - Notification or custom action */}
          {showNotificationButton ? (
            <TouchableOpacity 
              onPress={handleNotificationPress}
              className="w-10 h-10 rounded-full bg-brand-600 items-center justify-center"
            >
              <Ionicons name="notifications-outline" size={20} color="white" />
            </TouchableOpacity>
          ) : rightAction ? (
            rightAction
          ) : (
            <View className="w-10 h-10" />
          )}
        </View>
      )}

      {/* Title and Subtitle (full width centered style - only if no nav row) */}
      {title && !showBackButton && !showNotificationButton && !rightAction && (
        <View className="items-center">
          <Text className="text-white text-2xl font-bold">{title}</Text>
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
