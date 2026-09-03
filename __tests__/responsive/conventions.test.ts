import fs from 'fs';
import path from 'path';

/**
 * Conformance checks for the two-design rules in `WEB_LAYOUT.md`.
 *
 * The rest of the responsive suite asserts that the components *behave*. This file asserts that
 * the codebase keeps *following the rules* — which is the failure mode that matters after this
 * work lands, because it is silent. Nobody notices a new screen was built phone-only until
 * someone opens it on a desktop, and by then it is one of forty.
 *
 * Source scanning is a blunt instrument and these tests are deliberately narrow: each one encodes
 * a rule that is written down, with an allowlist for the cases that are genuinely exempt. A new
 * entry in an allowlist should be an explicit decision with a reason beside it, not a way to make
 * the test go quiet.
 */

const ROOT = path.join(__dirname, '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const rel = (f: string) => path.relative(ROOT, f).replace(/\\/g, '/');
const read = (f: string) => fs.readFileSync(f, 'utf8');

const screenFiles = walk(path.join(ROOT, 'screens'));
const componentFiles = walk(path.join(ROOT, 'components'));
const containers = screenFiles.filter((f) => f.includes(`containers${path.sep}`));

describe('every screen opts into both designs', () => {
  /**
   * A screen gets its two layouts from `ScreenLayout` (or `AuthLayout` for the signed-out ones).
   * A screen that draws its own root gets neither for free, so it has to at least consult
   * `useResponsive` — otherwise it is phone-only by construction.
   */
  const EXEMPT: Record<string, string> = {
    // Registered in App.tsx but unreachable — Home and Search both go to ServiceDetail now.
    // Documented as orphaned in CLAUDE.md; adapting a dead screen would be waste.
    'screens/provider-detail-screen/containers/ProviderDetailScreen.tsx': 'orphaned, see CLAUDE.md',
  };

  it.each(containers.map((f) => [rel(f), f]))('%s', (name, file) => {
    if (EXEMPT[name as string]) return;
    const src = read(file as string);
    const usesLayout = /\b(ScreenLayout|AuthLayout)\b/.test(src);
    const usesResponsive = /\buseResponsive\b/.test(src);

    // The message is the point: a failure here should tell the next person what to do.
    expect(
      usesLayout || usesResponsive
        ? true
        : `${name} renders its own root without consulting useResponsive, so it is phone-only. ` +
            `Use ScreenLayout (see WEB_LAYOUT.md), or branch on useResponsive() if it genuinely ` +
            `needs a custom root.`
    ).toBe(true);
  });
});

describe('Platform.OS is not used for layout', () => {
  /**
   * `Platform.OS === 'web'` is for **capability** differences — storage, pickers, paste events,
   * key listeners. Using it for layout is what puts a sidebar on a phone browser, which is the
   * single decision this whole design rests on.
   *
   * Rather than banning the check, this pins the places that use it, so adding one is a
   * deliberate act that updates this list with a reason.
   */
  const ALLOWED: Record<string, string> = {
    'screens/partner-application-screen/containers/PartnerApplicationScreen.tsx':
      'DocumentPicker exposes a native File on web — read via FileReader',
    'screens/verify-email-screen/containers/VerifyEmailScreen.tsx':
      'onPaste is a DOM event; native has no paste handler on TextInput',
    'components/shared/PatternBackground.tsx':
      'ImageBackground resizeMode="repeat" does not tile on react-native-web — it draws one tile ' +
      'in the corner — so web tiles through CSS background-repeat instead',
  };

  it('only appears where a capability genuinely differs', () => {
    const offenders = [...screenFiles, ...componentFiles]
      .filter((f) => /Platform\.OS === 'web'/.test(read(f)))
      .map(rel)
      .filter((f) => !(f in ALLOWED));

    expect(offenders).toEqual([]);
  });
});

describe('dialogs can be dismissed with Esc', () => {
  /**
   * `<Modal onRequestClose>` fires for Android's hardware back button and for nothing else, so a
   * modal without `useEscapeToClose` ignores the first key a desktop user reaches for.
   */
  const EXEMPT: Record<string, string> = {
    // Its own dropdown, dismissed by the transparent backdrop; Esc would close the whole menu
    // while the user is mid-hover, which is not what a menu does.
    'components/layout/TopBar.tsx': 'account menu, backdrop-dismissed',
    // Full-screen map pickers with an explicit confirm/cancel — Esc mid-pin-drop would discard
    // the address the user just placed.
    'components/shared/MapAddressPicker.tsx': 'map picker with explicit confirm',
    'components/shared/MapAddressPicker.web.tsx': 'map picker with explicit confirm',
    'components/shared/DirectionsModal.tsx': 'full-screen directions view',
    'components/shared/DirectionsModal.web.tsx': 'full-screen directions view',
  };

  it('every <Modal> either handles Esc or is listed as exempt', () => {
    const offenders = [...screenFiles, ...componentFiles]
      .filter((f) => {
        const src = read(f);
        // ResponsiveModal handles Esc itself, so a screen using it needs nothing.
        const hasRawModal = /<Modal[\s>]/.test(src);
        return hasRawModal && !/useEscapeToClose/.test(src);
      })
      .map(rel)
      .filter((f) => !(f in EXEMPT))
      // ResponsiveModal IS the implementation.
      .filter((f) => f !== 'components/shared/ResponsiveModal.tsx');

    expect(offenders).toEqual([]);
  });
});

describe('the nav bars cannot drift apart', () => {
  it('TabBar and SideNav both read navItems, and neither keeps its own list', () => {
    // The two bars showing different destinations, or gating them differently by role, is
    // invisible while you are looking at either one of them.
    const tabBar = read(path.join(ROOT, 'components', 'shared', 'TabBar.tsx'));
    const sideNav = read(path.join(ROOT, 'components', 'layout', 'SideNav.tsx'));

    expect(tabBar).toMatch(/from '\.\.\/\.\.\/navigation\/navItems'/);
    expect(sideNav).toMatch(/from '\.\.\/\.\.\/navigation\/navItems'/);

    // A hardcoded route name in either file would be a second source of truth.
    for (const [name, src] of [
      ['TabBar', tabBar],
      ['SideNav', sideNav],
    ] as const) {
      expect(`${name}: ${/'(Home|Search|Profile|PartnerHub|AdminDashboard)'/.test(src)}`).toBe(
        `${name}: false`
      );
    }
  });

  it('TabBar renders nothing off the phone design', () => {
    // Two navigations on one screen is the obvious failure of running both designs from one tree.
    const tabBar = read(path.join(ROOT, 'components', 'shared', 'TabBar.tsx'));
    expect(tabBar).toMatch(/if \(!isMobile\) return null;/);
  });
});

describe('the native gate stays shut', () => {
  it('RESPONSIVE_ON_NATIVE is false and lives in exactly one place', () => {
    // Flipping it is a decision about every screen in the app, so it should be a visible diff in
    // one file — not something that drifts in behind a `Platform.OS` check somewhere.
    const hook = read(path.join(ROOT, 'hooks', 'useResponsive.ts'));
    expect(hook).toMatch(/const RESPONSIVE_ON_NATIVE = false;/);

    const others = [...screenFiles, ...componentFiles].filter((f) =>
      /RESPONSIVE_ON_NATIVE/.test(read(f))
    );
    expect(others.map(rel)).toEqual([]);
  });
});
