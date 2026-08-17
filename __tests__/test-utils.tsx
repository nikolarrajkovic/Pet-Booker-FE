import React from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { ThemeProvider } from '../context/ThemeContext';

/**
 * Fixed insets so `useSafeAreaInsets` resolves without a native measurement pass — without
 * these the provider renders nothing on first pass and every screen under it stays blank.
 */
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/**
 * Wraps a screen in the providers it reads but doesn't care about in a test.
 *
 * `ThemeProvider` is used for real rather than mocked: `useThemeColors` derives the whole palette
 * from it, and stubbing that would mean maintaining a second copy of the palette's shape in
 * every test file. Everything with a network or native surface behind it (auth, toasts, locale,
 * navigation) is mocked per test instead, since those are usually what a given test asserts on.
 */
export function withProviders(ui: React.ReactElement): React.ReactElement {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider>{ui}</ThemeProvider>
    </SafeAreaProvider>
  );
}
