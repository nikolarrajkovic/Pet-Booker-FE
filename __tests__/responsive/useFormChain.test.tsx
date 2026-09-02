import React, { useState } from 'react';
import { TextInput, View, type TextInput as RNTextInput } from 'react-native';
import { render, renderHook, screen } from '@testing-library/react-native';
import { withProviders, setViewport, setPlatform } from '../test-utils';
import { useFormChain, type FieldSpec } from '../../hooks/useFormChain';

/**
 * Keyboard form submission — behaviour difference **B16**.
 *
 * On a phone a form is driven by thumbs and the return key is decoration. In a browser people
 * type, press Enter, and expect something to happen; when nothing does, the form reads as broken
 * long before anyone hunts for the button. This is the wiring that makes Enter mean something,
 * and these are the cases where getting it wrong stays invisible until someone types their way
 * through a whole form.
 *
 * Asserted against the hook rather than a rendered screen: the contract *is* the props it hands
 * to a `TextInput` and what its `onSubmitEditing` does with the refs, and a test renderer has no
 * real focus to read back. One integration test at the bottom checks the props actually arrive.
 */

/** A stand-in for a mounted TextInput — all the hook ever calls on one is `focus()`. */
const fakeInput = () => ({ focus: jest.fn() }) as unknown as RNTextInput & { focus: jest.Mock };

/** Builds a chain and mounts a fake input for each named field. */
function chainWith(order: FieldSpec[], onSubmit: () => void) {
  const { result, rerender } = renderHook(
    ({ o, s }: { o: FieldSpec[]; s: () => void }) => useFormChain(o, s),
    { initialProps: { o: order, s: onSubmit } }
  );
  const inputs: Record<string, ReturnType<typeof fakeInput>> = {};
  order.forEach((spec) => {
    const name = typeof spec === 'string' ? spec : spec.name;
    inputs[name] = fakeInput();
    result.current.field(name).ref(inputs[name]);
  });
  return { form: result, inputs, rerender };
}

afterEach(() => {
  jest.restoreAllMocks();
  setPlatform('web');
});

describe('useFormChain', () => {
  it('submits from the last field and not from the others', () => {
    const onSubmit = jest.fn();
    const { form } = chainWith(['a', 'b', 'c'], onSubmit);

    form.current.field('a').onSubmitEditing?.();
    form.current.field('b').onSubmitEditing?.();
    expect(onSubmit).not.toHaveBeenCalled();

    form.current.field('c').onSubmitEditing?.();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('moves focus to the next field instead of submitting', () => {
    const onSubmit = jest.fn();
    const { form, inputs } = chainWith(['a', 'b'], onSubmit);

    form.current.field('a').onSubmitEditing?.();

    expect(inputs.b.focus).toHaveBeenCalledTimes(1);
    expect(inputs.a.focus).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('labels the return key Next mid-form and Go on the last field', () => {
    // This reaches the phone keyboard, and web's `enterkeyhint` — it is what tells the user
    // whether pressing return will move on or finish.
    const { form } = chainWith(['a', 'b'], jest.fn());

    expect(form.current.field('a').returnKeyType).toBe('next');
    expect(form.current.field('b').returnKeyType).toBe('go');
  });

  it('keeps focus while advancing and releases it on submit', () => {
    // `blurOnSubmit` on a mid-form field closes and reopens the phone keyboard on every Next,
    // which is a visible flap between each field.
    const { form } = chainWith(['a', 'b'], jest.fn());

    expect(form.current.field('a').blurOnSubmit).toBe(false);
    expect(form.current.field('b').blurOnSubmit).toBe(true);
  });

  it('exposes focus() so a screen can jump to a field itself', () => {
    const { form, inputs } = chainWith(['a', 'b'], jest.fn());

    form.current.focus('b');
    expect(inputs.b.focus).toHaveBeenCalledTimes(1);
  });

  describe('multiline fields', () => {
    const order: FieldSpec[] = ['a', { name: 'notes', multiline: true }];

    it('attaches no submit handler, so Enter can insert a newline', () => {
      // react-native-web calls `onSubmitEditing` AND `preventDefault()` on a multiline input
      // whenever `blurOnSubmit` is true — so an unmarked description box submits the form instead
      // of starting a second paragraph. Omitting the prop entirely is what leaves Enter alone.
      const { form } = chainWith(order, jest.fn());
      const notes = form.current.field('notes');

      expect(notes.onSubmitEditing).toBeUndefined();
      expect(notes.blurOnSubmit).toBe(false);
      expect(notes.returnKeyType).toBe('default');
    });

    it('is still a valid target of the previous field’s Enter', () => {
      // It opts out of *advancing from* itself, not out of being arrived at.
      const { form, inputs } = chainWith(order, jest.fn());

      form.current.field('a').onSubmitEditing?.();
      expect(inputs.notes.focus).toHaveBeenCalledTimes(1);
    });
  });

  it('calls the CURRENT submit handler, not the one from the first render', () => {
    // The handler closes over form state, so a stale one would submit yesterday's values — and
    // that only goes wrong after the user edits something, which is the worst time to find out.
    const first = jest.fn();
    const second = jest.fn();
    const { form, rerender } = chainWith(['a'], first);

    rerender({ o: ['a'], s: second });
    form.current.field('a').onSubmitEditing?.();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('follows a reordered field list, as a multi-step form produces', () => {
    // A wizard passes the ACTIVE step's fields. A chain frozen at the first render would try to
    // focus a field that is no longer on screen, and Enter would appear to do nothing at all.
    const onSubmit = jest.fn();
    const { form, rerender } = chainWith(['a', 'b'], onSubmit);

    expect(form.current.field('a').returnKeyType).toBe('next');

    rerender({ o: ['a'], s: onSubmit });
    expect(form.current.field('a').returnKeyType).toBe('go');

    form.current.field('a').onSubmitEditing?.();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not submit from a field that is not in the chain', () => {
    // A typo'd name must not silently behave like "the last field" and submit the form early.
    const onSubmit = jest.fn();
    const { form } = chainWith(['a', 'b'], onSubmit);

    form.current.field('typo').onSubmitEditing?.();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('useFormChain — wired to a real TextInput', () => {
  function Harness({ order, onSubmit }: { order: FieldSpec[]; onSubmit: () => void }) {
    const form = useFormChain(order, onSubmit);
    const [values, setValues] = useState<Record<string, string>>({});
    return (
      <View>
        {order.map((spec) => {
          const name = typeof spec === 'string' ? spec : spec.name;
          return (
            <TextInput
              key={name}
              {...form.field(name)}
              multiline={typeof spec !== 'string' && spec.multiline}
              testID={name}
              value={values[name] ?? ''}
              onChangeText={(v) => setValues((s) => ({ ...s, [name]: v }))}
            />
          );
        })}
      </View>
    );
  }

  it('hands the props straight through to the input', () => {
    // The spread is the whole integration surface — if a screen's own props overrode
    // `onSubmitEditing`, everything above would still pass while Enter did nothing.
    setViewport('desktop');
    render(
      withProviders(
        <Harness order={['a', { name: 'notes', multiline: true }]} onSubmit={jest.fn()} />
      )
    );

    expect(screen.getByTestId('a').props.returnKeyType).toBe('next');
    expect(typeof screen.getByTestId('a').props.onSubmitEditing).toBe('function');
    expect(screen.getByTestId('notes').props.onSubmitEditing).toBeUndefined();
  });
});
