import React, { useEffect, useRef } from 'react';
import { Animated, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, themeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';

export type ToastVariant = 'error' | 'success' | 'info';

export type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
  /** Tapping the toast runs this and dismisses it. Without one the row is not pressable. */
  onPress?: () => void;
};

const VARIANT_CONFIG: Record<
  ToastVariant,
  { icon: keyof typeof Ionicons.glyphMap; accent: string }
> = {
  error: { icon: 'alert-circle', accent: '#EF4444' },
  success: { icon: 'checkmark-circle', accent: BRAND_GREEN },
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
  const { t } = useLocale();
  const { icon, accent } = VARIANT_CONFIG[toast.variant];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  const openAndDismiss = () => {
    onDismiss(toast.id);
    toast.onPress?.();
  };

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }],
        borderRadius: 12,
        marginBottom: 8,
        // elevation / shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 6,
        elevation: 5,
      }}>
      {/* A toast that leads somewhere is pressable across its whole width, not via a link inside
          it: it is on screen for a few seconds, so the target has to be as big as the thing the
          eye already went to. Without an `onPress` it stays an inert row.

          Dismiss is a SIBLING laid over the row, never a child of it: on web an
          accessibilityRole of "button" renders a real <button>, and a <button> inside a
          <button> is invalid HTML that React rejects outright. The row reserves the space it
          sits in via paddingRight, so the text still never runs underneath it. */}
      <TouchableOpacity
        disabled={!toast.onPress}
        onPress={openAndDismiss}
        activeOpacity={0.85}
        accessibilityRole={toast.onPress ? 'button' : undefined}
        accessibilityLabel={toast.message}
        accessibilityHint={toast.onPress ? t('shared.toastOpenHint') : undefined}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: hex.card,
          borderRadius: 12,
          borderLeftWidth: 4,
          borderLeftColor: accent,
          paddingVertical: 12,
          paddingLeft: 12,
          paddingRight: 40,
        }}>
        <Ionicons name={icon} size={22} color={accent} style={{ marginRight: 10 }} />
        <Text style={{ flex: 1, color: hex.text, fontSize: 14, lineHeight: 19 }} numberOfLines={4}>
          {toast.message}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => onDismiss(toast.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={t('shared.dismiss')}
        style={{
          position: 'absolute',
          right: 4,
          top: 0,
          bottom: 0,
          justifyContent: 'center',
          paddingHorizontal: 8,
        }}>
        <Ionicons name="close" size={18} color={hex.subtext} />
      </TouchableOpacity>
    </Animated.View>
  );
}
