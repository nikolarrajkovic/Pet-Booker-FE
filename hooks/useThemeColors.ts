import { useTheme } from '../context/ThemeContext';

/**
 * The brand palette as raw hex, mirroring the `brand-*` tokens in
 * `tailwind.config.js`. These are theme-independent — the brand green is the
 * same in light and dark mode.
 *
 * Use a `brand-*` Tailwind class wherever a `className` will do. Reach for these
 * constants only where a raw string is required: `color=` on an `Ionicons` or
 * `ActivityIndicator`, a `style={}` value, or a native component that cannot
 * take classes. `#00C870` had been pasted into 200+ such places, so a palette
 * change would have meant a find-and-replace across 70 files.
 */
export const BRAND = {
  50: '#E6FAF0',
  400: '#2CE07F',
  500: '#00C870',
  600: '#00A85A',
  900: '#003822',
} as const;

/** The primary brand green (`brand-500`) — the default for spinners and active icons. */
export const BRAND_GREEN = BRAND[500];

/**
 * One colour per service type, keyed by the `ServiceProviderType` value, for everywhere a type is
 * colour-coded: the Home category pills and the admin revenue-by-type bars. Those two used to
 * disagree (Sitter was blue on Home and pink on the dashboard), and Home only had three colours
 * for six types — blue, purple, then green four times over.
 *
 * Brand green is deliberately **last**: the pills sit right under the green header, so a green
 * pill up front blended into it. Orange and cyan are the 600 shades, not 500, to keep white label
 * text legible on them (a 500 orange is under 3:1 against white).
 */
export const SERVICE_TYPE_COLORS: Record<number, string> = {
  0: '#3B82F6', // Sitter — blue-500
  1: '#A855F7', // Walker — purple-500
  2: '#EA580C', // Boarder — orange-600
  3: '#EC4899', // Pet Hotel — pink-500
  4: '#0891B2', // Groomer — cyan-600
  5: BRAND[500], // Transporter — brand green
};

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
    // The page ground is a soft green-tinted off-white, NOT pure white, and cards stay white on
    // top of it. Both used to be `#ffffff`, which is why the app read as one flat white sheet —
    // a card had nothing to be raised against, and there was no brand colour anywhere but the
    // buttons. One token change tints every screen and makes every card pop, without touching a
    // single screen file.
    bgColor: isDarkMode ? 'bg-[#0f1621]' : 'bg-[#F1F8F4]',
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
      bg: isDarkMode ? '#0f1621' : '#F1F8F4',
      card: isDarkMode ? '#1a2332' : '#ffffff',
      text: isDarkMode ? '#F9FAFB' : '#111827',
      subtext: isDarkMode ? '#9CA3AF' : '#6B7280',
      border: isDarkMode ? '#2d3748' : '#E5E7EB',
      inputBg: isDarkMode ? '#243447' : '#F9FAFB',
      /** Large decorative glyphs — the icon on an empty/error state. Dimmer than `subtext`. */
      mutedIcon: isDarkMode ? '#4B5563' : '#D1D5DB',
      /** Neutral chip/badge fill behind a count on an inactive tab. */
      chipBg: isDarkMode ? '#374151' : '#E5E7EB',
    },
  } as const;
}

export function useThemeColors() {
  const { isDarkMode } = useTheme();
  return themeColors(isDarkMode);
}
