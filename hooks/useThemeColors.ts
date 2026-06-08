import { useTheme } from '../context/ThemeContext';

/**
 * Single source of truth for the app's dark/light color palette.
 *
 * Replaces the per-screen `const cardBg = isDarkMode ? ... : ...` blocks that
 * were previously duplicated across the whole app. Returns:
 *
 * - **NativeWind class tokens** (`bgColor`, `cardBg`, `textColor`, ...) for use
 *   in `className` props.
 * - **`placeholderColor`** as a raw hex string for `placeholderTextColor`.
 * - **`hex`** — raw hex values for `style={}` props and native components
 *   (react-native-maps, pickers, etc.) that cannot take Tailwind classes.
 * - **`isDarkMode`** so callers can still branch on it for one-off styling
 *   without a second `useTheme()` call.
 *
 * Usage:
 * ```tsx
 * const { bgColor, cardBg, textColor } = useThemeColors();
 * // raw hex:
 * const { hex } = useThemeColors();
 * <View style={{ backgroundColor: hex.card }} />
 * ```
 */
/**
 * Pure version of {@link useThemeColors} for **dumb/presentational components**
 * that already receive `isDarkMode` as a prop (e.g. ServiceDetailView). Lets
 * them share the exact same palette without calling a hook / reaching into context.
 */
export function themeColors(isDarkMode: boolean) {
  return {
    isDarkMode,

    // NativeWind class tokens (className=)
    bgColor: isDarkMode ? 'bg-[#0f1621]' : 'bg-white',
    cardBg: isDarkMode ? 'bg-[#1a2332]' : 'bg-white',
    textColor: isDarkMode ? 'text-white' : 'text-gray-900',
    subtextColor: isDarkMode ? 'text-gray-400' : 'text-gray-600',
    inputBg: isDarkMode ? 'bg-[#243447]' : 'bg-gray-50',
    inputText: isDarkMode ? 'text-white' : 'text-gray-900',
    borderColor: isDarkMode ? 'border-gray-700' : 'border-gray-200',

    // raw hex for placeholderTextColor=
    placeholderColor: isDarkMode ? '#9CA3AF' : '#6B7280',

    // raw hex for style={} / native components that can't take classes
    hex: {
      bg: isDarkMode ? '#0f1621' : '#ffffff',
      card: isDarkMode ? '#1a2332' : '#ffffff',
      text: isDarkMode ? '#F9FAFB' : '#111827',
      subtext: isDarkMode ? '#9CA3AF' : '#6B7280',
      border: isDarkMode ? '#2d3748' : '#E5E7EB',
      inputBg: isDarkMode ? '#243447' : '#F9FAFB',
    },
  } as const;
}

export function useThemeColors() {
  const { isDarkMode } = useTheme();
  return themeColors(isDarkMode);
}
