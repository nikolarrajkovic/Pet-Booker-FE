import fs from 'fs';
import path from 'path';

/**
 * Every pressable is either a control or explicitly inert.
 *
 * A `TouchableOpacity`/`Pressable` renders on web as a plain focusable `<div>` with no role and no
 * name, so a card built from one is clickable, sits in the tab order, and is announced as loose
 * text rather than as something you can activate. The app had 216 in that state.
 *
 * Two acceptable outcomes, and nothing in between:
 *
 *  - **A real control** — carries `accessibilityRole`.
 *  - **A backdrop or a stop-propagation wrapper** — carries `accessible={false}`, plus
 *    `focusable={false}` (TouchableOpacity) or `tabIndex={-1}` (Pressable), which is what actually
 *    removes it from the web tab order. Giving one of these a role announces a dimming layer as a
 *    button; leaving it focusable puts an unlabelled stop in the keyboard order.
 *
 * `components/shared/Button.tsx` is the model: role, name defaulting to the visible text, and
 * disabled state.
 */

const ROOT = path.join(__dirname, '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/** Ends an opening JSX tag, ignoring `>` inside strings and `{...}` expressions. */
function tagEnd(src: string, from: number): number {
  let depth = 0;
  let inStr: string | null = null;
  for (let j = from; j < src.length; j++) {
    const c = src[j];
    if (inStr) {
      if (c === inStr) inStr = null;
    } else if (c === '"' || c === "'" || c === '`') inStr = c;
    else if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return j;
  }
  return src.length;
}

const files = [...walk(path.join(ROOT, 'screens')), ...walk(path.join(ROOT, 'components'))];

it('every pressable with an onPress is either a control or explicitly inert', () => {
  const offenders: string[] = [];

  for (const file of files) {
    // Strip line comments first. A `<div>` written inside one ends the tag scan early and hides
    // the very attribute being looked for — that false positive cost a real debugging detour on
    // Button.tsx, which had the role all along.
    const src = fs.readFileSync(file, 'utf8').replace(/^[ \t]*\/\/.*$/gm, '');
    const re = /<(TouchableOpacity|Pressable|TouchableWithoutFeedback)\b/g;

    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const start = m.index + m[0].length;
      const tag = src.slice(start, tagEnd(src, start));
      if (!tag.includes('onPress')) continue;
      if (tag.includes('accessibilityRole') || tag.includes('accessible={false}')) continue;

      const line = src.slice(0, m.index).split('\n').length;
      offenders.push(`${path.relative(ROOT, file).split(path.sep).join('/')}:${line}`);
    }
  }

  expect(offenders).toEqual([]);
});

/**
 * A no-op `onPress` is a stop-propagation wrapper, and must be inert rather than roled.
 *
 * These sit inside a modal backdrop and exist only so a tap landing on the dialog card doesn't
 * bubble out and close it. Giving one `accessibilityRole="button"` satisfies the check above while
 * announcing the whole dialog as a button and putting a 400px-wide stop in the tab order ahead of
 * its own contents — which is exactly what the first pass did to the language and currency pickers.
 */
it('a no-op onPress is inert, never a button', () => {
  const offenders: string[] = [];

  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8').replace(/^[ \t]*\/\/.*$/gm, '');
    const re = /<(TouchableOpacity|Pressable|TouchableWithoutFeedback)\b/g;

    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const start = m.index + m[0].length;
      const tag = src.slice(start, tagEnd(src, start));
      if (!/onPress=\{\(\) => \{\}\}/.test(tag)) continue;
      if (!tag.includes('accessibilityRole')) continue;

      const line = src.slice(0, m.index).split('\n').length;
      offenders.push(`${path.relative(ROOT, file).split(path.sep).join('/')}:${line}`);
    }
  }

  expect(offenders).toEqual([]);
});
