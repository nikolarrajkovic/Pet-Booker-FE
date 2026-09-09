import fs from 'fs';
import path from 'path';

import { themeColors } from '../../hooks/useThemeColors';

/**
 * Tailwind only generates a rule for a class it has SEEN. A class name that lives in a file
 * outside `content` in `tailwind.config.js` produces no CSS, and — because a `className` with no
 * matching rule is not an error — the element simply renders unstyled.
 *
 * That is not hypothetical. `hooks/useThemeColors.ts` is the app's palette and it returns class
 * names, but `hooks/` was not scanned. Eleven of its twelve tokens happened to survive because the
 * same literal was also typed under `screens/` or `components/`; the twelfth, the light-mode page
 * ground `bg-[#F1F8F4]`, existed nowhere else. It resolved to transparent, which let the green
 * header show through `ScreenLayout`'s content sheet — so rows scrolling past stayed visible over
 * the header instead of disappearing behind it, and the first card on a list sat on the green.
 *
 * These tests fail when a folder holding class names drops out of `content` again.
 */

const ROOT = path.resolve(__dirname, '..', '..');

const config = require(path.join(ROOT, 'tailwind.config.js')) as { content: string[] };

/** Top-level folder a glob covers, e.g. `./hooks/**\/*.{js,ts,tsx}` → `hooks`. */
function globRoot(glob: string): string {
  return glob.replace(/^\.\//, '').split('/')[0];
}

const scannedRoots = new Set(config.content.map(globRoot));

/** Folders that are never bundled into the app, so a class name there is not a real one. */
const NOT_APP_CODE = new Set([
  '__tests__',
  'assets',
  'node_modules',
  'dist',
  'coverage',
  '.expo',
  '.git',
  'android',
  'ios',
]);

/**
 * A Tailwind utility as it appears inside a quoted string. Deliberately anchored to a prefix list
 * rather than "any hyphenated word", so a MIME type or a kebab-case identifier is not mistaken for
 * a class name.
 */
const CLASS_TOKEN =
  /(?<![\w-])(?:bg|text|border|rounded|flex|items|justify|gap|shadow|opacity|w|h|min-w|max-w|p[xytblr]?|m[xytblr]?)-\[?[#\w./%-]+\]?/;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || NOT_APP_CODE.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx|js)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Every top-level app folder that has at least one file containing a Tailwind class name. */
function foldersHoldingClassNames(): Map<string, string> {
  const found = new Map<string, string>();
  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || NOT_APP_CODE.has(entry.name))
      continue;
    for (const file of sourceFiles(path.join(ROOT, entry.name))) {
      const source = fs.readFileSync(file, 'utf8');
      const quoted = source.match(/(['"`])[^'"`\n]*\1/g) ?? [];
      if (quoted.some((literal) => CLASS_TOKEN.test(literal))) {
        found.set(entry.name, path.relative(ROOT, file).replace(/\\/g, '/'));
        break;
      }
    }
  }
  return found;
}

describe('tailwind.config.js content globs', () => {
  it('covers the palette, whose class names live outside any JSX', () => {
    // The specific regression: every token `useThemeColors` hands out is a class name, and it is
    // the only place several of them appear.
    expect(scannedRoots.has('hooks')).toBe(true);

    // `as unknown[]` because the palette's values are literal types, not plain `string`.
    const tokens = [themeColors(false), themeColors(true)].flatMap((palette) =>
      (Object.values(palette) as unknown[]).filter((v): v is string => typeof v === 'string')
    );
    const classNames = tokens.filter((token) => CLASS_TOKEN.test(token));

    // Guards the guard: if the palette ever stops returning class names this test would pass
    // vacuously, and the thing it protects would be gone without anyone noticing.
    expect(classNames.length).toBeGreaterThan(5);
  });

  it('covers every app folder that holds class names', () => {
    const uncovered = [...foldersHoldingClassNames()].filter(
      ([folder]) => !scannedRoots.has(folder)
    );

    expect(uncovered.map(([folder, example]) => `${folder}/ (e.g. ${example})`)).toEqual([]);
  });
});
