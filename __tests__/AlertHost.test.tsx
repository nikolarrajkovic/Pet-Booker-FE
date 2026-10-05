import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { withProviders } from './test-utils';

/**
 * The web build's `showAlert` renders in the app's own dialog once `AlertHost` is mounted — the
 * browser's `window.alert`/`confirm` (the grey box at the top of the window that "Partner added"
 * used to arrive in) is only the fallback before it is. The branch a button runs is pinned in
 * `alertWeb.test.ts` for the fallback; this pins the same semantics for the dialog.
 */

jest.mock('../context/LocaleContext', () => {
  const { translate } = jest.requireActual('../i18n');
  const value = {
    t: (key: string, params?: Record<string, unknown>) => translate('en', key, params),
    language: 'en',
  };
  return { useLocale: () => value };
});

import AlertHost from '../components/shared/AlertHost';
import { showAlert } from '../services/alert.web';

const realAlert = window.alert;
const realConfirm = window.confirm;

afterEach(() => {
  window.alert = realAlert;
  window.confirm = realConfirm;
});

function mountHost() {
  // Neither browser dialog may be reached while the host is up.
  window.alert = jest.fn() as typeof window.alert;
  window.confirm = jest.fn(() => true) as typeof window.confirm;
  return render(withProviders(<AlertHost />));
}

describe('AlertHost', () => {
  it('shows a lone message with an OK that runs its button', () => {
    mountHost();
    const onPress = jest.fn();

    act(() =>
      showAlert('Invitation sent', 'They get a link to set a password.', [{ text: 'OK', onPress }])
    );

    expect(screen.getByText('Invitation sent')).toBeTruthy();
    expect(screen.getByText('They get a link to set a password.')).toBeTruthy();
    fireEvent.press(screen.getByText('OK'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Invitation sent')).toBeNull();
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('runs only the button pressed in a confirm', () => {
    mountHost();
    const cancel = jest.fn();
    const remove = jest.fn();

    act(() =>
      showAlert('Delete Service', 'This action cannot be undone.', [
        { text: 'Cancel', style: 'cancel', onPress: cancel },
        { text: 'Delete', style: 'destructive', onPress: remove },
      ])
    );
    fireEvent.press(screen.getByText('Cancel'));

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('queues a second dialog behind the first instead of replacing it', () => {
    mountHost();

    act(() => {
      showAlert('First');
      showAlert('Second');
    });

    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.queryByText('Second')).toBeNull();
    fireEvent.press(screen.getByText('OK'));
    expect(screen.getByText('Second')).toBeTruthy();
  });

  it('falls back to the browser dialog once the host is gone', () => {
    const view = mountHost();
    view.unmount();

    showAlert('After unmount');

    expect(window.alert).toHaveBeenCalledWith('After unmount');
  });
});
