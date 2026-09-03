/* eslint-env jest */
/**
 * Global test setup.
 *
 * These are the modules every screen pulls in transitively but which have nothing to do with
 * what the tests assert — native surfaces (haptics, secure storage, geolocation) and the
 * styling interop. Mocking them here keeps each test file about its own subject.
 */

// React Native Testing Library v13 registers its matchers on import — the old
// `extend-expect` entry point no longer exists.

// `__DEV__` gates the request logging in services/http.ts.
global.__DEV__ = true;

// The API base URL is read from the environment and throws when unset.
process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:5161';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 44.8, longitude: 20.4 } })),
  reverseGeocodeAsync: jest.fn(async () => []),
  watchPositionAsync: jest.fn(async () => ({ remove: jest.fn() })),
  Accuracy: { Balanced: 3, High: 4 },
}));

jest.mock('expo-device', () => ({ isDevice: true, osName: 'iOS', modelName: 'test' }));

jest.mock('expo-notifications', () => ({
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[test]' })),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
}));

// SignalR: the hubs are exercised by the backend e2e suite, not here.
jest.mock('@microsoft/signalr', () => ({
  HubConnectionBuilder: jest.fn().mockImplementation(() => ({
    withUrl: jest.fn().mockReturnThis(),
    withAutomaticReconnect: jest.fn().mockReturnThis(),
    configureLogging: jest.fn().mockReturnThis(),
    build: jest.fn(() => ({
      on: jest.fn(),
      off: jest.fn(),
      start: jest.fn(async () => undefined),
      stop: jest.fn(async () => undefined),
      invoke: jest.fn(async () => undefined),
      onreconnected: jest.fn(),
      onclose: jest.fn(),
      state: 'Disconnected',
    })),
  })),
  LogLevel: { Information: 2, Warning: 3, Error: 4, None: 6 },
  HttpTransportType: { WebSockets: 1 },
}));

// `react-native-keyboard-controller` is a native module: importing it under jest reaches for a
// TurboModule that only exists in a built app, and the require throws before any component
// renders. Every screen pulls it in through `ScreenLayout`, so without this mock two thirds of
// the suite cannot render a screen at all. The keyboard is never visible in a test — the
// avoidance path is inert on the web design and untestable on the phone one, so a passthrough
// view and a permanently-hidden keyboard are the honest stubs.
jest.mock('react-native-keyboard-controller', () => {
  const { View } = require('react-native');
  return {
    KeyboardProvider: ({ children }) => children,
    KeyboardAvoidingView: View,
    KeyboardAwareScrollView: View,
    useKeyboardState: (selector) => {
      const state = { isVisible: false, height: 0 };
      return typeof selector === 'function' ? selector(state) : state;
    },
    useKeyboardHandler: () => undefined,
    useReanimatedKeyboardAnimation: () => ({ height: { value: 0 }, progress: { value: 0 } }),
  };
});
