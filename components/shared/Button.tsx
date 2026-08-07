import React from 'react';
import { TouchableOpacity, Text, View, ViewStyle } from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type IconPosition = 'left' | 'right' | 'center';

type Props = {
  text?: string;
  children?: React.ReactNode;
  onPress: () => void;
  icon?: React.ReactNode;
  iconPosition?: IconPosition;
  variant?: ButtonVariant;
  className?: string;
  style?: ViewStyle;
  disabled?: boolean;
  activeOpacity?: number;
  /**
   * What a screen reader announces. Defaults to `text`, which covers most buttons — pass it
   * explicitly for an ICON-ONLY button, where there is no text to fall back to and the control
   * would otherwise be announced as an unlabelled button.
   */
  accessibilityLabel?: string;
  /** Longer explanation of what happens on activation, when the label alone is ambiguous. */
  accessibilityHint?: string;
};

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600',
  secondary: 'bg-brand-500',
  outline: 'border-2 border-brand-600',
  ghost: 'bg-transparent',
};

const textColorMap: Record<ButtonVariant, string> = {
  primary: 'text-white',
  secondary: 'text-white',
  outline: 'text-brand-600',
  ghost: 'text-brand-600',
};

export default function Button({
  text,
  children,
  onPress,
  icon,
  iconPosition = 'left',
  variant = 'primary',
  className = '',
  style,
  disabled = false,
  activeOpacity = 0.7,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const variantClass = variantStyles[variant];
  const textColorClass = textColorMap[variant];
  const isDisabled = disabled;

  const renderContent = () => {
    if (icon && iconPosition !== 'center') {
      return (
        <View className="flex-row items-center justify-center gap-2">
          {iconPosition === 'left' && icon}
          {text && <Text className={`font-semibold ${textColorClass}`}>{text}</Text>}
          {children && <View>{children}</View>}
          {iconPosition === 'right' && icon}
        </View>
      );
    }

    if (icon && iconPosition === 'center') {
      return icon;
    }

    return (
      <>
        {text && <Text className={`font-semibold ${textColorClass}`}>{text}</Text>}
        {children && children}
      </>
    );
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={activeOpacity}
      // A TouchableOpacity renders as a plain <div> on web with no role and no name, so every
      // button in the app was invisible to assistive tech and unreachable by keyboard. `role`
      // makes it a button; the label falls back to the visible text so callers get this for free.
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? text}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled }}
      style={style}
      className={`items-center justify-center rounded-xl px-4 py-3 ${variantClass} ${
        isDisabled ? 'opacity-50' : ''
      } ${className}`}>
      {renderContent()}
    </TouchableOpacity>
  );
}
