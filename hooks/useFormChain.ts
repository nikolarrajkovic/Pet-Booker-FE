import { useCallback, useRef } from 'react';
import type { TextInput, ReturnKeyTypeOptions } from 'react-native';

/**
 * A field in the chain. A bare string is a normal single-line input; the object form marks a
 * **multiline** one, where Enter must insert a newline rather than move on.
 */
export type FieldSpec = string | { name: string; multiline: true };

/** Props to spread onto a `TextInput` to put it in the chain. */
export type FieldProps = {
  ref: (instance: TextInput | null) => void;
  /** Absent on a multiline field, so react-native-web leaves Enter alone and it inserts a newline. */
  onSubmitEditing?: () => void;
  returnKeyType: ReturnKeyTypeOptions;
  /**
   * Keep focus when advancing to the next field — otherwise the keyboard closes and reopens
   * between every field, which on a phone is a visible flap on each Next.
   */
  blurOnSubmit: boolean;
};

export type FormChain = {
  /** Spread onto the `TextInput` for `name`. */
  field: (name: string) => FieldProps;
  /** Focus a field programmatically — e.g. to put the cursor in the first invalid one. */
  focus: (name: string) => void;
};

const nameOf = (spec: FieldSpec): string => (typeof spec === 'string' ? spec : spec.name);
const isMultiline = (spec: FieldSpec | undefined): boolean =>
  typeof spec === 'object' && spec.multiline === true;

/**
 * Wires a form's inputs into a keyboard chain: **Enter moves to the next field, and submits from
 * the last one.**
 *
 * This is the single most-missed web convention in an app ported from mobile. On a phone a form is
 * driven by thumbs — you tap the next field, and the return key is decoration. In a browser people
 * type, press Enter, and expect it to do something; when nothing happens the form reads as broken
 * long before anyone hunts for the button. Nothing here is web-only, though: on a phone the same
 * wiring turns the return key into **Next** and advances focus, which is better than what the
 * fields did before (nothing).
 *
 * ```tsx
 * const form = useFormChain(['identifier', 'password'], handleSignIn);
 * <TextInput {...form.field('identifier')} value={identifier} … />
 * <TextInput {...form.field('password')}  value={password}   … />
 * ```
 *
 * ## Rules worth knowing
 *
 * **Order is passed explicitly**, not discovered from render order, because render order is not
 * stable — a conditionally-rendered field would silently reorder the chain, and the bug that
 * produces (Enter skipping a field, or submitting early) is invisible until someone types their
 * way through the whole form. Pass the fields that are **currently on screen**, in the order they
 * appear; a multi-step form passes the active step's fields, not every step's.
 *
 * **`onSubmit` must be the same handler the button calls**, guards included. Pressing Enter on an
 * invalid form should do exactly what clicking a disabled submit button does, and duplicating the
 * validation here is how the two paths drift apart.
 *
 * **Mark multiline fields** with `{ name, multiline: true }`. In a textarea Enter means *newline*,
 * and react-native-web calls `onSubmitEditing` **and `preventDefault()`** on a multiline input
 * whenever `blurOnSubmit` is true — so an unmarked description box would submit the form instead
 * of letting the user start a second paragraph. A multiline field is still a valid *target* of the
 * previous field's Enter; it just never advances or submits from itself. If the last field is
 * multiline nothing submits on Enter at all, which is the right behaviour for a form ending in a
 * text area.
 *
 * **Non-text controls stay out of the chain** — pickers, date fields, toggles, composite inputs
 * like `PhoneInput`. Enter has no meaningful way to "move to" them, and validation on submit is
 * what catches the ones a user left unset.
 */
export function useFormChain(order: FieldSpec[], onSubmit: () => void): FormChain {
  const refs = useRef<Record<string, TextInput | null>>({});

  // Read through refs inside the callbacks rather than closing over the values, so a field
  // registered on a later render (a conditional one) is still reachable from a handler created on
  // an earlier one.
  const orderRef = useRef(order);
  orderRef.current = order;

  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;

  const focus = useCallback((name: string) => {
    refs.current[name]?.focus();
  }, []);

  const field = useCallback((name: string): FieldProps => {
    const specs = orderRef.current;
    const index = specs.findIndex((spec) => nameOf(spec) === name);
    const self = index >= 0 ? specs[index] : undefined;
    const next = index >= 0 ? specs[index + 1] : undefined;
    const nextName = next ? nameOf(next) : undefined;
    const isLast = !nextName;

    const ref = (instance: TextInput | null) => {
      refs.current[name] = instance;
    };

    // A name that is not in the chain gets inert props rather than being treated as the end of
    // it. Without this guard `index === -1` makes `isLast` true, so a **typo'd field name would
    // submit the form** the moment the user pressed Enter in it — and since the chain is a list
    // of strings, a typo is exactly the mistake this API invites. Failing silently is the right
    // trade here: doing nothing is recoverable, submitting a half-filled form is not.
    if (index < 0 || isMultiline(self)) {
      // No `onSubmitEditing` at all: react-native-web only intercepts Enter when that prop is
      // set, so omitting it is what lets the key do its normal job of inserting a newline.
      return { ref, returnKeyType: 'default', blurOnSubmit: false };
    }

    return {
      ref,
      onSubmitEditing: () => {
        if (isLast) {
          submitRef.current();
        } else if (nextName) {
          refs.current[nextName]?.focus();
        }
      },
      // 'go' on the last field is what a phone keyboard shows for "this submits"; 'next' is the
      // arrow that means "another field follows".
      returnKeyType: isLast ? 'go' : 'next',
      blurOnSubmit: isLast,
    };
  }, []);

  return { field, focus };
}
