import fs from 'fs';
import path from 'path';

import { PAGE_GUTTER, pageGutterFor } from '../../hooks/usePageGutter';
import { BRAND, SERVICE_TYPE_COLORS } from '../../hooks/useThemeColors';
import { PROVIDER_TYPE_LABELS } from '../../services/service-providers';

/**
 * The page gutter is one number per design. Screens used to pick their own — 16, 20 and 24 all
 * shipped, sometimes two on the same screen — so these pin the values and the classes that go with
 * them, and fail the moment a screen goes back to writing its own.
 */
describe('page gutter', () => {
  it('is 16 on the phone and 32 on the web design', () => {
    expect(pageGutterFor('mobile').value).toBe(16);
    expect(pageGutterFor('tablet').value).toBe(32);
    expect(pageGutterFor('desktop').value).toBe(32);
  });

  it('hands out classes that match the number', () => {
    // A class that disagrees with `value` would put a style-padded block and a class-padded block
    // on different lines — the exact drift this exists to stop.
    const px = (n: number) => `px-${n / 4}`;
    for (const mode of ['mobile', 'tablet', 'desktop'] as const) {
      const g = pageGutterFor(mode);
      expect(g.px).toBe(px(g.value));
      expect(g.mx).toBe(`mx-${g.value / 4}`);
      expect(g.negMx).toBe(`-mx-${g.value / 4}`);
    }
  });

  it('is what ContentContainer pads the web page title with', () => {
    // The body is padded by screens and the title by ContentContainer; they only line up if both
    // read the same constant.
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../components/shared/ContentContainer.tsx'),
      'utf8'
    );
    expect(src).toContain('byMode(mode, PAGE_GUTTER)');
    expect(PAGE_GUTTER.desktop).toBe(pageGutterFor('desktop').value);
  });

  it('is not hard-coded back into a screen scroll container', () => {
    // The shape every screen used before: a ScrollView padding its own sides with a literal.
    // Allowed: a scroller that is a PANEL inside a page rather than the page itself.
    const allowed = new Set([
      // The inbox column of the web split view — its padding is the panel's inset, not a gutter.
      path.join('screens', 'messages-screen', 'components', 'MessagesSplitView.tsx'),
    ]);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx$/.test(entry.name)) {
          const src = fs.readFileSync(full, 'utf8');
          if (/contentContainerStyle=\{\{[^}]*paddingHorizontal: \d+/.test(src)) {
            const rel = path.relative(path.resolve(__dirname, '../..'), full);
            if (!allowed.has(rel)) offenders.push(rel);
          }
        }
      }
    };
    walk(path.resolve(__dirname, '../../screens'));
    expect(offenders).toEqual([]);
  });
});

describe('service type colours', () => {
  it('gives every service type its own colour', () => {
    const types = Object.keys(PROVIDER_TYPE_LABELS).map(Number);
    for (const type of types) expect(SERVICE_TYPE_COLORS[type]).toBeDefined();
    const colours = types.map((type) => SERVICE_TYPE_COLORS[type]);
    expect(new Set(colours).size).toBe(colours.length);
  });

  it('keeps brand green for the last type only', () => {
    // The pills sit directly under the green header, where a leading green pill disappears.
    const types = Object.keys(PROVIDER_TYPE_LABELS)
      .map(Number)
      .sort((a, b) => a - b);
    const greens = types.filter((type) => SERVICE_TYPE_COLORS[type] === BRAND[500]);
    expect(greens).toEqual([types[types.length - 1]]);
  });
});
