import { useResponsive, byMode, type LayoutMode } from './useResponsive';

/**
 * The page gutter — the space between the window edge and the content — as **one number per
 * design**, and the only place that number is written down.
 *
 * Every screen used to pick its own: 16 on the lists, 20 on the partner hub and the admin detail
 * pages, 24 on the forms, the profile and the header, with some screens mixing two of them (the
 * admin dashboard's stat grid sat at 16 while the cards under it sat at 20). The phone design now
 * uses **16** throughout — the compact-width margin both Material 3 and iOS settle on, and 8dp of
 * extra content width a side on a small screen. The web design uses 32, which is what
 * `ContentContainer` already pads the page title with, so a page's body finally lines up under
 * its own heading (it sat 8px left of it at 24).
 *
 * Read it through {@link usePageGutter} rather than typing `px-4`: a literal can't follow the
 * design switch, and it is how the gutters drifted apart in the first place.
 */
export const PAGE_GUTTER = { mobile: 16, tablet: 32, desktop: 32 } as const;

/** Tailwind classes for each gutter value — literal so the class scanner generates them. */
const CLASSES = {
  16: { px: 'px-4', mx: 'mx-4', negMx: '-mx-4' },
  32: { px: 'px-8', mx: 'mx-8', negMx: '-mx-8' },
} as const;

export type PageGutter = {
  /** The gutter in dp, for `style` props. */
  value: number;
  /** `px-*` — horizontal padding equal to the gutter. */
  px: string;
  /** `mx-*` — horizontal margin equal to the gutter. */
  mx: string;
  /** `-mx-*` — cancels the gutter, for a row that should bleed to the window edge. */
  negMx: string;
};

/** The gutter for a given layout mode. Exported for tests and for non-hook callers. */
export function pageGutterFor(mode: LayoutMode): PageGutter {
  const value = byMode(mode, PAGE_GUTTER);
  return { value, ...CLASSES[value] };
}

/** The page gutter for the design currently on screen. */
export function usePageGutter(): PageGutter {
  const { mode } = useResponsive();
  return pageGutterFor(mode);
}
