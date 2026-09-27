import React from 'react';
import { Platform } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { withProviders, setPlatform } from './test-utils';

/**
 * In a browser, Enter sends and Shift+Enter starts a new line.
 *
 * The composer is a multiline field, and a multiline field never fires `onSubmitEditing` on Enter
 * in a browser — Enter just added a line, so a message could only be sent with the mouse. Phones
 * keep their own keyboard: return adds a line, the button sends.
 */

jest.mock('../context/LocaleContext', () => {
  const { translate } = jest.requireActual('../i18n');
  const value = {
    t: (key: string, params?: Record<string, unknown>) => translate('en', key, params),
    language: 'en',
  };
  return { useLocale: () => value };
});

import MessageComposer from '../screens/messages-screen/components/MessageComposer';

const originalOS = Platform.OS;
afterEach(() => setPlatform(originalOS as 'web' | 'ios' | 'android'));

function setup() {
  const onSend = jest.fn();
  render(withProviders(<MessageComposer onSend={onSend} isDarkMode={false} />));
  const field = screen.getByLabelText('Message…');
  fireEvent.changeText(field, 'see you at 9');
  return { onSend, field };
}

const key = (field: ReturnType<typeof screen.getByLabelText>, nativeEvent: object) => {
  const preventDefault = jest.fn();
  act(() => {
    fireEvent(field, 'keyPress', { nativeEvent, preventDefault });
  });
  return preventDefault;
};

describe('the composer in a browser', () => {
  beforeEach(() => setPlatform('web'));

  it('sends on Enter, without adding a line', () => {
    const { onSend, field } = setup();
    const preventDefault = key(field, { key: 'Enter' });

    expect(onSend).toHaveBeenCalledWith('see you at 9');
    expect(preventDefault).toHaveBeenCalled();
  });

  it('adds a line on Shift+Enter instead of sending', () => {
    const { onSend, field } = setup();
    const preventDefault = key(field, { key: 'Enter', shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('leaves Enter to an IME that is still composing a word', () => {
    const { onSend, field } = setup();
    key(field, { key: 'Enter', isComposing: true });

    expect(onSend).not.toHaveBeenCalled();
  });
});

describe('the composer on a phone', () => {
  beforeEach(() => setPlatform('android'));

  it('leaves the return key to the keyboard', () => {
    const { onSend, field } = setup();
    const preventDefault = key(field, { key: 'Enter' });

    expect(onSend).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });
});
