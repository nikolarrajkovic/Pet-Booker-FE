import React, { useEffect, useRef } from 'react';
import { Animated, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { themeColors } from '../../hooks/useThemeColors';

export type ToastVariant = 'error' | 'success' | 'info';

export type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
};

const VARIANT_CONFIG: Record<
  ToastVariant,
  { icon: keyof typeof Ionicons.glyphMap; accent: string }
> = {
  error: { icon: 'alert-circle', accent: '#EF4444' },
  success: { icon: 'checkmark-circle', accent: '#00C870' },
  info: { icon: 'information-circle', accent: '#3B82F6' },
};

type ToastViewProps = {
  toast: ToastItem;
  isDarkMode: boolean;
  onDismiss: (id: number) => void;
};

/**
 * A single toast row. Presentational — animates itself in on mount and exposes
 * a dismiss button. Themed via the pure `themeColors(isDarkMode)` palette so it
 * can render inside the global overlay without a hook into ThemeContext here.
 */
export default function ToastView({ toast, isDarkMode, onDismiss }: ToastViewProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;
  const { hex } = themeColors(isDarkMode);
  const { icon, accent } = VARIANT_CONFIG[toast.variant];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }],
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: hex.card,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: accent,
        paddingVertical: 12,
        paddingLeft: 12,
        paddingRight: 8,
        marginBottom: 8,
        // elevation / shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 6,
        elevation: 5,
      }}>
      <Ionicons name={icon} size={22} color={accent} style={{ marginRight: 10 }} />
      <Text style={{ flex: 1, color: hex.text, fontSize: 14, lineHeight: 19 }} numberOfLines={4}>
        {toast.message}
      </Text>
      <TouchableOpacity
        onPress={() => onDismiss(toast.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{ padding: 4, marginLeft: 4 }}>
        <Ionicons name="close" size={18} color={hex.subtext} />
      </TouchableOpacity>
    </Animated.View>
  );
}
