/**
 * Jest setup for the Expo app.
 *
 * `jest-expo` supplies the RN/Expo module mocks and the babel transform; without its preset a
 * test importing anything from `react-native` or `expo-*` dies on ESM in node_modules.
 *
 * The transformIgnorePatterns allowlist is the usual RN tax: those packages ship untranspiled
 * ESM, so they must go through babel rather than be skipped like the rest of node_modules.
 */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|nativewind|react-native-css-interop)',
  ],
  // Only our own code counts — coverage over node_modules is noise.
  collectCoverageFrom: [
    'services/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'screens/**/*.{ts,tsx}',
    '!**/*.d.ts',
  ],
  testMatch: ['<rootDir>/__tests__/**/*.test.{ts,tsx}'],
};
