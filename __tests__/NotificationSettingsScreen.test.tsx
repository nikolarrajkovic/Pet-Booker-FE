import React from 'react';
import { Switch } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';

/**
 * The push switch is the one setting the app doesn't get the final say on — the OS does.
 *
 * Everything asserted here is about that split. The screen used to write `pushEnabled: true`
 * straight to the backend on a tap, so a phone with notifications blocked reported push as ON
 * and then silently dropped every notification, with nothing on screen admitting it. These
 * tests pin the three device states apart: granted (the preference is real), denied (the switch
 * refuses to lie and offers the way out), and unsupported (web/simulator, where there is no
 * permission to grant at all).
 */

// `mock`-prefixed because jest hoists the factories below above these declarations.
const mockGetPushPermission = jest.fn();
const mockRequestPushPermission = jest.fn();
const mockOpenSettings = jest.fn();
const mockRegisterPushDevice = jest.fn();
const mockUnregisterPushDevice = jest.fn();

jest.mock('../services/push-registration', () => ({
  getPushPermission: (...a: unknown[]) => mockGetPushPermission(...a),
  requestPushPermission: (...a: unknown[]) => mockRequestPushPermission(...a),
  openDeviceNotificationSettings: (...a: unknown[]) => mockOpenSettings(...a),
  registerPushDevice: (...a: unknown[]) => mockRegisterPushDevice(...a),
  unregisterPushDevice: (...a: unknown[]) => mockUnregisterPushDevice(...a),
}));

const mockGetSettings = jest.fn();
const mockSaveSettings = jest.fn();

jest.mock('../services/notifications', () => {
  const actual = jest.requireActual('../services/notifications');
  return {
    ...actual, // keep defaultNotificationSettings real — it defines the shape under test
    getNotificationSettings: (...a: unknown[]) => mockGetSettings(...a),
    saveNotificationSettings: (...a: unknown[]) => mockSaveSettings(...a),
  };
});

jest.mock('../context/AuthContext', () => {
  const value = { currentUser: { id: 1 } };
  return { useAuth: () => value };
});

const mockShowError = jest.fn();
jest.mock('../context/ToastContext', () => ({
  useToast: () => ({ showError: mockShowError, showSuccess: jest.fn(), showInfo: jest.fn() }),
}));

// The locale value must be STABLE across renders — the focus effect depends on values from here.
jest.mock('../context/LocaleContext', () => {
  const value = {
    t: (key: string) => key,
    tEnum: (_type: string, value: unknown) => String(value),
    language: 'en',
  };
  return { useLocale: () => value };
});

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react');
  return {
    useFocusEffect: (cb: () => void | (() => void)) => react.useEffect(cb, [cb]),
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
    useRoute: () => ({ params: {} }),
  };
});

import NotificationSettingsScreen from '../screens/notifications-screen/containers/NotificationSettingsScreen';
import { withProviders } from './test-utils';

const GRANTED = { supported: true, status: 'granted', canAskAgain: false };
const DENIED = { supported: true, status: 'denied', canAskAgain: false };
const UNDETERMINED = { supported: true, status: 'undetermined', canAskAgain: true };
const UNSUPPORTED = { supported: false, status: 'denied', canAskAgain: false };

/** The stored preference: push ON as far as the account is concerned. */
const storedSettings = (overrides = {}) => ({
  id: 5,
  userId: 1,
  pushEnabled: true,
  emailEnabled: true,
  smsEnabled: false,
  bookingUpdates: true,
  appointmentReminders: true,
  messages: true,
  promotionsOffers: false,
  newServices: false,
  dndEnabled: false,
  dndStartTime: '22:00:00',
  dndEndTime: '08:00:00',
  ...overrides,
});

/** Lets the settings fetch, the permission read and every effect they schedule settle. */
const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

async function renderScreen() {
  render(withProviders(<NotificationSettingsScreen />));
  await flush();
}

/** The push row's Switch — the first on the screen, above Email. */
const pushSwitch = () => screen.UNSAFE_getAllByType(Switch)[0];

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSettings.mockResolvedValue(storedSettings());
  mockSaveSettings.mockImplementation(async (s: unknown) => s);
  mockRegisterPushDevice.mockResolvedValue(true);
  mockGetPushPermission.mockResolvedValue(GRANTED);
});

describe('the push switch answers to the device, not just the account', () => {
  it('shows push as ON only when the OS agrees', async () => {
    await renderScreen();
    expect(pushSwitch().props.value).toBe(true);
    expect(screen.queryByText('notificationSettings.pushBlockedTitle')).toBeNull();
  });

  it('shows push as OFF when the account says on but the phone blocks it', async () => {
    // The exact state the old screen misreported: stored `pushEnabled: true`, OS denied.
    mockGetPushPermission.mockResolvedValue(DENIED);
    await renderScreen();

    expect(pushSwitch().props.value).toBe(false);
    expect(screen.getByText('notificationSettings.pushBlockedTitle')).toBeTruthy();
  });

  it('offers the settings app as the way out of a permanent denial', async () => {
    mockGetPushPermission.mockResolvedValue(DENIED);
    await renderScreen();

    fireEvent.press(screen.getByText('notificationSettings.openSettings'));
    expect(mockOpenSettings).toHaveBeenCalled();
  });

  it('asks the OS before recording the preference, and records nothing when refused', async () => {
    mockGetPushPermission.mockResolvedValue(UNDETERMINED);
    mockRequestPushPermission.mockResolvedValue(DENIED);
    await renderScreen();
    mockSaveSettings.mockClear();

    fireEvent(pushSwitch(), 'valueChange', true);
    await flush();

    expect(mockRequestPushPermission).toHaveBeenCalled();
    // The whole point: a refusal must not leave a stored `true` the device will never honour.
    expect(mockSaveSettings).not.toHaveBeenCalled();
    expect(mockRegisterPushDevice).not.toHaveBeenCalled();
  });

  it('records the preference and registers the device once permission is granted', async () => {
    mockGetPushPermission.mockResolvedValue(UNDETERMINED);
    mockRequestPushPermission.mockResolvedValue(GRANTED);
    mockGetSettings.mockResolvedValue(storedSettings({ pushEnabled: false }));
    await renderScreen();
    mockSaveSettings.mockClear();

    fireEvent(pushSwitch(), 'valueChange', true);
    await flush();

    expect(mockSaveSettings).toHaveBeenCalledWith(expect.objectContaining({ pushEnabled: true }));
    expect(mockRegisterPushDevice).toHaveBeenCalledWith(1);
  });

  it('says so when the device could not be registered', async () => {
    mockGetPushPermission.mockResolvedValue(UNDETERMINED);
    mockRequestPushPermission.mockResolvedValue(GRANTED);
    mockRegisterPushDevice.mockResolvedValue(false);
    mockGetSettings.mockResolvedValue(storedSettings({ pushEnabled: false }));
    await renderScreen();

    fireEvent(pushSwitch(), 'valueChange', true);
    await waitFor(() =>
      expect(mockShowError).toHaveBeenCalledWith('notificationSettings.pushEnableFailed')
    );
  });

  it('retires this handset when push is switched off, not just the preference', async () => {
    await renderScreen();
    mockSaveSettings.mockClear();

    fireEvent(pushSwitch(), 'valueChange', false);
    await flush();

    expect(mockSaveSettings).toHaveBeenCalledWith(expect.objectContaining({ pushEnabled: false }));
    // Without this a spare or shared handset keeps buzzing until the next sign-out.
    expect(mockUnregisterPushDevice).toHaveBeenCalledWith(1);
  });

  it('does not offer a permission it cannot grant, on web or a simulator', async () => {
    mockGetPushPermission.mockResolvedValue(UNSUPPORTED);
    await renderScreen();

    expect(pushSwitch().props.disabled).toBe(true);
    expect(screen.getByText('notificationSettings.pushUnavailableTitle')).toBeTruthy();
    // A settings deep link would be a dead end here — there is nothing to turn on.
    expect(screen.queryByText('notificationSettings.openSettings')).toBeNull();
  });

  it('registers the handset when permission was granted outside the app', async () => {
    // Granting from the settings app leaves the device registered nowhere: sign-in already tried
    // and came back empty. Observing the grant here is what closes that gap.
    await renderScreen();
    expect(mockRegisterPushDevice).toHaveBeenCalledWith(1);
  });
});

describe('quiet hours are editable, not decorative', () => {
  it('persists a picked time to the API', async () => {
    mockGetSettings.mockResolvedValue(storedSettings({ dndEnabled: true }));
    await renderScreen();
    mockSaveSettings.mockClear();

    // The stored start time is shown on its own row, and opens the picker.
    fireEvent.press(screen.getByText('22:00'));
    await flush();

    // TimePicker's confirm control writes the value back through `update`.
    fireEvent.press(screen.getByText('shared.done'));
    await flush();

    expect(mockSaveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ dndStartTime: expect.stringMatching(/^\d{2}:\d{2}:00$/) })
    );
  });
});
