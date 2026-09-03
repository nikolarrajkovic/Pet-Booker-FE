/**
 * @jest-environment jsdom
 *
 * The web design's behaviour includes real browser events — Esc closing a dialog — so this suite
 * needs a DOM to dispatch into. `jest-expo` defaults to the node environment, where `document`
 * does not exist and the assertions would pass vacuously against a listener that never attached.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { withProviders, setViewport, setPlatform } from '../test-utils';
import ResponsiveGrid from '../../components/shared/ResponsiveGrid';
import ResponsiveModal from '../../components/shared/ResponsiveModal';
import ContentContainer, { CONTENT_WIDTHS } from '../../components/shared/ContentContainer';
import TwoColumn from '../../components/shared/TwoColumn';
import StickyFooter from '../../components/shared/StickyFooter';

/**
 * The primitives every screen is built from.
 *
 * Tested here once, so the per-screen work in later stages does not have to re-assert that a grid
 * keeps its children or that a dialog closes.
 */

afterEach(() => {
  jest.restoreAllMocks();
  setPlatform('web');
});

const cards = (n: number) =>
  Array.from({ length: n }, (_, i) => <Text key={i}>{`card ${i + 1}`}</Text>);

describe('ResponsiveGrid', () => {
  it.each([
    ['mobile', 1],
    ['tablet', 2],
    ['desktop', 3],
  ] as const)('lays out %s in %i column(s)', (layout, expected) => {
    setViewport(layout);
    const { UNSAFE_root } = render(
      withProviders(
        <ResponsiveGrid columns={{ mobile: 1, tablet: 2, desktop: 3 }}>{cards(6)}</ResponsiveGrid>
      )
    );

    // The column count is expressed as each cell's percentage width, so that is what to assert:
    // asserting on class names would pin NativeWind's output rather than the layout.
    const cells = UNSAFE_root.findAll(
      (node: { type: unknown; props?: { style?: unknown } }) =>
        typeof node.type === 'string' &&
        !!node.props?.style &&
        JSON.stringify(node.props.style).includes('%')
    );
    if (expected === 1) {
      expect(cells).toHaveLength(0); // single column renders a plain stack, no percentages
    } else {
      expect(JSON.stringify(cells[0].props.style)).toContain(`${100 / expected}%`);
    }
  });

  it.each(['mobile', 'tablet', 'desktop'] as const)(
    'renders every child at %s, including a ragged last row',
    (layout) => {
      // Seven items into three columns is the case that drops one when the wrapping maths is off
      // by a margin — and a missing card is invisible unless you count them.
      setViewport(layout);
      render(withProviders(<ResponsiveGrid>{cards(7)}</ResponsiveGrid>));

      for (let i = 1; i <= 7; i++) expect(screen.getByText(`card ${i}`)).toBeTruthy();
    }
  );

  it('drops a conditionally-rendered child without leaving a hole', () => {
    setViewport('desktop');
    render(
      withProviders(
        <ResponsiveGrid>
          <Text>first</Text>
          {false && <Text>hidden</Text>}
          {null}
          <Text>second</Text>
        </ResponsiveGrid>
      )
    );

    expect(screen.getByText('first')).toBeTruthy();
    expect(screen.getByText('second')).toBeTruthy();
    expect(screen.queryByText('hidden')).toBeNull();
  });

  it('rowGap of 0 leaves the vertical spacing to the cards themselves', () => {
    // The moderation and booking lists reuse presentational cards that already carry a bottom
    // margin from the phone design. Those components take their theme as props and call no hooks,
    // so making them width-aware just to drop a margin would push a hook into every one of them.
    // Zeroing the row gap gets the same spacing with no change to the card at all.
    setViewport('desktop');
    const { UNSAFE_root } = render(
      withProviders(
        <ResponsiveGrid columns={{ mobile: 1, desktop: 2 }} gap={12} rowGap={0}>
          {cards(4)}
        </ResponsiveGrid>
      )
    );

    const cell = UNSAFE_root.findAll(
      (n: { type: unknown; props?: { style?: unknown } }) =>
        typeof n.type === 'string' && JSON.stringify(n.props?.style ?? '').includes('%')
    )[0];
    const style = JSON.stringify(cell.props.style);
    expect(style).toContain('"paddingBottom":0');
    // The horizontal gap still applies — only the rows are the cards' business.
    expect(style).toContain('"paddingHorizontal":6');
  });

  it('rowGap of 0 also collapses the single-column stack', () => {
    // At mobile width the grid is a plain stack; the same rule has to hold there or the cards
    // would get their own margin plus the stack's.
    setViewport('mobile');
    render(
      withProviders(
        <ResponsiveGrid columns={{ mobile: 1 }} gap={12} rowGap={0}>
          {cards(3)}
        </ResponsiveGrid>
      )
    );

    for (let i = 1; i <= 3; i++) expect(screen.getByText(`card ${i}`)).toBeTruthy();
  });

  it('falls back to the narrower column count when a level is omitted', () => {
    setViewport('tablet');
    const { UNSAFE_root } = render(
      withProviders(<ResponsiveGrid columns={{ mobile: 1, desktop: 4 }}>{cards(4)}</ResponsiveGrid>)
    );

    // tablet inherits mobile's 1 column — a stack, so no percentage cells.
    expect(
      UNSAFE_root.findAll(
        (n: { type: unknown; props?: { style?: unknown } }) =>
          typeof n.type === 'string' && JSON.stringify(n.props?.style ?? '').includes('%')
      )
    ).toHaveLength(0);
  });
});

describe('ResponsiveModal', () => {
  const body = <Text>modal body</Text>;

  it('renders its children in both designs', () => {
    setViewport('mobile');
    const mobile = render(
      withProviders(
        <ResponsiveModal visible onClose={jest.fn()}>
          {body}
        </ResponsiveModal>
      )
    );
    expect(mobile.getByText('modal body')).toBeTruthy();
    mobile.unmount();

    setViewport('desktop');
    render(
      withProviders(
        <ResponsiveModal visible onClose={jest.fn()}>
          {body}
        </ResponsiveModal>
      )
    );
    expect(screen.getByText('modal body')).toBeTruthy();
  });

  it('closes on Esc on the web design', () => {
    // B4. `<Modal onRequestClose>` fires for Android's back button, never for a browser key
    // press — so without the listener in ResponsiveModal, Esc does nothing and a desktop user's
    // first instinct for dismissing a dialog fails silently.
    setViewport('desktop');
    const onClose = jest.fn();
    render(
      withProviders(
        <ResponsiveModal visible onClose={onClose}>
          {body}
        </ResponsiveModal>
      )
    );

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('still closes on Esc at phone WIDTH, because a browser is a browser', () => {
    // The Esc listener is keyed on the platform, not the design: a narrow browser window draws
    // the phone design but still has a physical keyboard, and refusing Esc there would be a
    // deliberate downgrade. What decides it is `Platform.OS === 'web'`, which is exactly the
    // capability-vs-layout distinction the whole responsive design rests on.
    setViewport('mobile');
    const onClose = jest.fn();
    render(
      withProviders(
        <ResponsiveModal visible onClose={onClose}>
          {body}
        </ResponsiveModal>
      )
    );

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('attaches no key listener on native', () => {
    // There is no key to press on a handset, and `document` does not exist to listen on — so the
    // effect must bail before touching it rather than relying on a DOM that happens to be there.
    setViewport('mobile');
    setPlatform('ios');
    const onClose = jest.fn();
    const spy = jest.spyOn(document, 'addEventListener');
    render(
      withProviders(
        <ResponsiveModal visible onClose={onClose}>
          {body}
        </ResponsiveModal>
      )
    );

    expect(spy).not.toHaveBeenCalledWith('keydown', expect.any(Function));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not listen for Esc while hidden', () => {
    // A stack of mounted-but-invisible modals all listening would make one Esc close several.
    setViewport('desktop');
    const onClose = jest.fn();
    render(
      withProviders(
        <ResponsiveModal visible={false} onClose={onClose}>
          {body}
        </ResponsiveModal>
      )
    );

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('stops listening once unmounted', () => {
    setViewport('desktop');
    const onClose = jest.fn();
    const view = render(
      withProviders(
        <ResponsiveModal visible onClose={onClose}>
          {body}
        </ResponsiveModal>
      )
    );
    view.unmount();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('ContentContainer', () => {
  it('caps the column on the web design', () => {
    setViewport('desktop');
    const { UNSAFE_root } = render(
      withProviders(
        <ContentContainer width="narrow">
          <Text>body</Text>
        </ContentContainer>
      )
    );

    const style = JSON.stringify(UNSAFE_root.findByType(View).props.style);
    expect(style).toContain(String(CONTENT_WIDTHS.narrow));
  });

  it('leaves a full-width screen uncapped', () => {
    setViewport('desktop');
    const { UNSAFE_root } = render(
      withProviders(
        <ContentContainer width="full">
          <Text>body</Text>
        </ContentContainer>
      )
    );

    expect(JSON.stringify(UNSAFE_root.findByType(View).props.style)).not.toContain('maxWidth":1');
  });
});

describe('TwoColumn', () => {
  it('stacks main then aside on the phone design', () => {
    setViewport('mobile');
    render(
      withProviders(
        <TwoColumn aside={<Text>summary</Text>}>
          <Text>main</Text>
        </TwoColumn>
      )
    );

    // Both present is the assertion that matters: the aside's content must never be web-only, or
    // a phone user loses the price breakdown entirely.
    expect(screen.getByText('main')).toBeTruthy();
    expect(screen.getByText('summary')).toBeTruthy();
  });

  it('renders both columns on the web design', () => {
    setViewport('desktop');
    render(
      withProviders(
        <TwoColumn aside={<Text>summary</Text>}>
          <Text>main</Text>
        </TwoColumn>
      )
    );

    expect(screen.getByText('main')).toBeTruthy();
    expect(screen.getByText('summary')).toBeTruthy();
  });
});

describe('StickyFooter', () => {
  const cta = <Text>Book Now</Text>;

  it('pins itself over the scroll on the phone design', () => {
    setViewport('mobile');
    const { UNSAFE_root } = render(withProviders(<StickyFooter>{cta}</StickyFooter>));

    expect(screen.getByText('Book Now')).toBeTruthy();
    // NativeWind compiles `absolute bottom-0 left-0 right-0` into the className string; asserting
    // the class is present is the only handle on it that does not depend on the interop's output.
    expect(UNSAFE_root.findByType(View).props.className).toContain('absolute');
  });

  it('renders in the flow on the web design', () => {
    // B6. A bar welded across the bottom of a 1440px window — over the sidebar's column, if it
    // were pinned to the viewport — is a phone artefact.
    setViewport('desktop');
    const { UNSAFE_root } = render(withProviders(<StickyFooter>{cta}</StickyFooter>));

    expect(screen.getByText('Book Now')).toBeTruthy();
    expect(UNSAFE_root.findByType(View).props.className ?? '').not.toContain('absolute');
  });

  it('can still be pinned on web when a screen asks for it', () => {
    setViewport('desktop');
    const { UNSAFE_root } = render(withProviders(<StickyFooter pinnedOnWeb>{cta}</StickyFooter>));

    expect(UNSAFE_root.findByType(View).props.className).toContain('absolute');
  });
});
