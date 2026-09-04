import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { withProviders, setViewport, setPlatform } from '../test-utils';

/**
 * The web design's page-title block, and specifically what it does when there is nothing to put
 * in it — which is the case on any screen whose heading lives in the content instead.
 */

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), canGoBack: () => true, goBack: jest.fn() }),
}));

jest.mock('../../context/LocaleContext', () => {
  const { translate } = jest.requireActual('../../i18n');
  const value = {
    t: (key: string, params?: Record<string, unknown>) => translate('en', key, params),
    tEnum: (_n: string, v: unknown) => String(v),
    language: 'en',
  };
  return { useLocale: () => value };
});

import PageHeader from '../../components/shared/PageHeader';

beforeEach(() => setViewport('desktop'));
afterEach(() => {
  jest.restoreAllMocks();
  setPlatform('web');
});

describe('PageHeader', () => {
  it('renders nothing when it has nothing to show', () => {
    // Its padding alone is 32px above and 24px below. A screen that passes no title — Home, once
    // its greeting moved into a card — would otherwise get 56px of empty column pushing its real
    // first element down the page, which is exactly how it was reported.
    // `withProviders` wraps in SafeAreaProvider/ThemeProvider, so the tree is never literally
    // null — what matters is that the header contributed no node of its own beneath them.
    const tree = render(withProviders(<PageHeader />)).toJSON() as { children: unknown } | null;
    expect(tree?.children ?? null).toBeNull();
  });

  it('renders once it has a title', () => {
    render(withProviders(<PageHeader title="My Bookings" />));
    expect(screen.getByText('My Bookings')).toBeTruthy();
  });

  it('renders for a back link alone, with no title', () => {
    // A screen can be titleless and still need its way out, so the collapse must not swallow it.
    render(withProviders(<PageHeader showBackButton />));
    expect(screen.getByLabelText('Back')).toBeTruthy();
  });

  it('renders for children alone', () => {
    render(
      withProviders(
        <PageHeader>
          <Text>filter tabs</Text>
        </PageHeader>
      )
    );
    expect(screen.getByText('filter tabs')).toBeTruthy();
  });

  it('renders actions even with no title', () => {
    render(withProviders(<PageHeader actions={<Text>New offer</Text>} />));
    expect(screen.getByText('New offer')).toBeTruthy();
  });
});
