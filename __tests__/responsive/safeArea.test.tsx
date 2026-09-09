import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { render } from '@testing-library/react-native';
import { withProviders, setViewport, setPlatform } from '../test-utils';

/**
 * Safe-area handling on the phone design.
 *
 * The app draws edge-to-edge on Android (Expo SDK 54 onwards), so the status bar and the system
 * navigation bar are painted OVER it — nothing is kept clear unless the app keeps it clear. React
 * Native's own `SafeAreaView` insets on iOS only, which is why this was previously guessed at:
 * `AppHeader` padded by `basePaddingTop + insets.top * 0.4`, a fraction tuned by eye against one
 * handset, so iOS was over-padded (SafeAreaView's inset *plus* the 40%) and Android under-padded.
 * On the 'large' variant that put the title under the camera cutout on any device with a top inset
 * above ~27dp.
 *
 * The insets here come from `test-utils`' fixed metrics — top 47, bottom 34, a notched phone.
 */

const INSET_TOP = 47;
const INSET_BOTTOM = 34;

jest.mock('../../context/LocaleContext', () => {
  const { translate } = jest.requireActual('../../i18n');
  const value = {
    t: (key: string, params?: Record<string, unknown>) => translate('en', key, params),
    tEnum: (_n: string, v: unknown) => String(v),
    language: 'en',
  };
  return { useLocale: () => value };
});

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ isPartner: false, isAdmin: false, currentUser: { id: 1 } }),
}));

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), canGoBack: () => false, goBack: jest.fn() }),
  useRoute: () => ({ name: 'Home', key: 'k', params: undefined }),
}));

import AppHeader from '../../components/shared/AppHeader';
import ScreenLayout from '../../components/shared/ScreenLayout';
import StickyFooter from '../../components/shared/StickyFooter';
import TabBar from '../../components/shared/TabBar';

type Rendered = ReturnType<typeof render>;

/**
 * Every resolved value of one style property anywhere in the tree, in render order.
 *
 * Host nodes only. A composite element and the host element it renders carry the same `style`
 * prop, so counting both would report every padding twice — which matters here, because one of
 * these assertions is precisely that the inset is reserved ONCE.
 */
function styleValues(
  tree: Rendered,
  property: 'paddingTop' | 'paddingBottom' | 'height'
): number[] {
  const found: number[] = [];
  tree.UNSAFE_root.findAll((node: { type: unknown; props?: { style?: unknown } }) => {
    if (typeof node.type !== 'string') return false;
    const flat = StyleSheet.flatten(node.props?.style as never) as
      | Record<string, unknown>
      | undefined;
    const value = flat?.[property];
    if (typeof value === 'number') found.push(value);
    return false;
  });
  return found;
}

afterEach(() => {
  jest.restoreAllMocks();
  setPlatform('web');
});

describe('AppHeader clears the status bar', () => {
  // 'large' is the variant Home, Profile and My Schedule use, and the one the old 40% fudge broke:
  // 16 + 0.4 × 47 = 34.8, which is less than the 47pt inset, so the greeting sat under the cutout.
  it.each([
    ['standard', INSET_TOP + 24],
    ['large', INSET_TOP + 16],
    ['compact', INSET_TOP + 20],
  ] as const)('pads %s by the real inset plus its own spacing', (variant, expected) => {
    setViewport('mobile');
    const tree = render(withProviders(<AppHeader variant={variant} title="Title" />));

    const paddings = styleValues(tree, 'paddingTop');
    expect(paddings).toContain(expected);
    // The property that actually matters, stated separately from the arithmetic: the header's
    // content always begins below the status bar, whatever the device reports.
    expect(Math.max(...paddings)).toBeGreaterThan(INSET_TOP);
  });
});

describe('the bottom inset is reserved exactly once', () => {
  it('TabBar keeps its labels above the system navigation bar', () => {
    setViewport('mobile');
    const tree = render(withProviders(<TabBar />));

    expect(styleValues(tree, 'paddingBottom')).toContain(INSET_BOTTOM);
  });

  it('a footerless screen reserves it on the content sheet', () => {
    setViewport('mobile');
    const tree = render(
      withProviders(
        <ScreenLayout headerTitle="Pets">
          <Text>body</Text>
        </ScreenLayout>
      )
    );

    expect(styleValues(tree, 'paddingBottom')).toContain(INSET_BOTTOM);
  });

  it('hands it to the footer instead when there is one, rather than counting it twice', () => {
    setViewport('mobile');
    const tree = render(
      withProviders(
        <ScreenLayout headerTitle="Home" footer={<TabBar />}>
          <Text>body</Text>
        </ScreenLayout>
      )
    );

    // Exactly one thing in the tree reserves the inset — the bar. Two would float it a full
    // navigation bar's height off the bottom of the screen.
    expect(styleValues(tree, 'paddingBottom').filter((v) => v === INSET_BOTTOM)).toHaveLength(1);
  });

  it('StickyFooter reserves it on its own when nothing above it has', () => {
    setViewport('mobile');
    const tree = render(
      withProviders(
        <StickyFooter>
          <Text>Book Now</Text>
        </StickyFooter>
      )
    );

    expect(styleValues(tree, 'height')).toContain(INSET_BOTTOM);
  });

  it('StickyFooter defers to the content sheet that already reserved it', () => {
    setViewport('mobile');
    const tree = render(
      withProviders(
        <ScreenLayout headerTitle="Book">
          <View>
            <StickyFooter>
              <Text>Book Now</Text>
            </StickyFooter>
          </View>
        </ScreenLayout>
      )
    );

    // The sheet's padding is the reservation; the bar adds a zero-height spacer, not a second one.
    expect(styleValues(tree, 'paddingBottom')).toContain(INSET_BOTTOM);
    expect(styleValues(tree, 'height')).not.toContain(INSET_BOTTOM);
  });
});
