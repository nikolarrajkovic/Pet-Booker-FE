/**
 * @jest-environment jsdom
 *
 * The Esc assertions dispatch a real key event, so this suite needs a DOM. `jest-expo` defaults
 * to the node environment, where `document` does not exist and they would pass vacuously.
 */
import React from 'react';
import { Text } from 'react-native';
import { render, screen, renderHook } from '@testing-library/react-native';
import { withProviders, setViewport, setPlatform, describeBothLayouts } from '../test-utils';
import AuthLayout from '../../components/layout/AuthLayout';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';

/**
 * The signed-out screens and the Esc key.
 *
 * `AuthLayout` is the one shell that is NOT `AppShell` — signed-out users get no sidebar, because
 * a column of destinations behind a login is a list of dead links. So its centring is its own,
 * and nothing else in the app would catch it regressing.
 */

jest.mock('../../context/LocaleContext', () => {
  const { translate } = jest.requireActual('../../i18n');
  const value = {
    t: (key: string, params?: Record<string, unknown>) => translate('en', key, params),
    tEnum: (_n: string, v: unknown) => String(v),
    language: 'en',
  };
  return { useLocale: () => value };
});

afterEach(() => {
  jest.restoreAllMocks();
  setPlatform('web');
});

describeBothLayouts('AuthLayout', ({ renderScreen }) => {
  it('renders the brand band and the form in both designs', () => {
    // The band is drawn by the layout rather than passed in, so it is the one thing that could
    // silently go missing from one design when the other is being worked on.
    renderScreen(
      <AuthLayout title="Pet Booker" subtitle="Welcome back!">
        <Text>sign-in form</Text>
      </AuthLayout>
    );

    expect(screen.getByText('Pet Booker')).toBeTruthy();
    expect(screen.getByText('Welcome back!')).toBeTruthy();
    expect(screen.getByText('sign-in form')).toBeTruthy();
  });

  it('renders without a subtitle', () => {
    renderScreen(
      <AuthLayout title="Verify your email">
        <Text>code entry</Text>
      </AuthLayout>
    );

    expect(screen.getByText('Verify your email')).toBeTruthy();
    expect(screen.getByText('code entry')).toBeTruthy();
  });
});

describe('AuthLayout — the web card', () => {
  it('caps the card so a sign-in form does not span the monitor', () => {
    // A 1440px-wide login form with a full-width green band is the most obvious "phone app in a
    // browser" tell in the product, and it is the first screen anybody sees.
    setViewport('desktop');
    const { UNSAFE_root } = render(
      withProviders(
        <AuthLayout title="Pet Booker">
          <Text>form</Text>
        </AuthLayout>
      )
    );

    const hasCap = UNSAFE_root.findAll((n: { props?: { style?: unknown } }) =>
      JSON.stringify(n.props?.style ?? '').includes('"maxWidth":440')
    );
    expect(hasCap.length).toBeGreaterThan(0);
  });

  it('does not cap anything on the phone design', () => {
    // The phone design is full-bleed; a 440px cap there would inset the form for no reason.
    setViewport('mobile');
    const { UNSAFE_root } = render(
      withProviders(
        <AuthLayout title="Pet Booker">
          <Text>form</Text>
        </AuthLayout>
      )
    );

    const capped = UNSAFE_root.findAll((n: { props?: { style?: unknown } }) =>
      JSON.stringify(n.props?.style ?? '').includes('"maxWidth":440')
    );
    expect(capped).toHaveLength(0);
  });
});

describe('useEscapeToClose', () => {
  it('calls onClose when Esc is pressed', () => {
    // B4. RN's `<Modal onRequestClose>` fires for Android's back button and nothing else, so
    // without this hook every dialog in the app ignores the first key a desktop user reaches for.
    setPlatform('web');
    const onClose = jest.fn();
    renderHook(() => useEscapeToClose(true, onClose));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys', () => {
    setPlatform('web');
    const onClose = jest.fn();
    renderHook(() => useEscapeToClose(true, onClose));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does nothing while disabled', () => {
    // What keeps the first-run language chooser non-dismissable, and a mid-submit review dialog
    // from being escaped out of half way through.
    setPlatform('web');
    const onClose = jest.fn();
    renderHook(() => useEscapeToClose(false, onClose));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('attaches nothing on native', () => {
    // There is no key to press on a handset, and no `document` to listen on — the hook must bail
    // before touching it rather than relying on a DOM that happens to exist in a test.
    setPlatform('ios');
    const onClose = jest.fn();
    const spy = jest.spyOn(document, 'addEventListener');
    renderHook(() => useEscapeToClose(true, onClose));

    expect(spy).not.toHaveBeenCalledWith('keydown', expect.any(Function));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('stops listening once unmounted', () => {
    setPlatform('web');
    const onClose = jest.fn();
    const { unmount } = renderHook(() => useEscapeToClose(true, onClose));
    unmount();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
