import React, { Children, ReactNode } from 'react';
import { View } from 'react-native';
import { useResponsive } from '../../hooks/useResponsive';

type FormRowProps = {
  /** Two (occasionally three) short fields that belong together. */
  children: ReactNode;
};

/**
 * Puts short fields side by side on the web design, and leaves them stacked on the phone.
 *
 * A phone form is a single column because the screen is one column wide. Reproducing that on a
 * desktop gives a 700px-tall ribbon of one-line inputs with the whole window empty either side,
 * and a form that reads as far longer than it is — you scroll past six fields that would have
 * fitted on two rows.
 *
 * Pairing is a judgement per form, not something to apply mechanically: fields go together when
 * they are short, related, and filled in one thought (given/family name, weight/height). A long
 * free-text field or anything with its own picker keeps a row to itself.
 *
 * Renders nothing of its own on mobile — not even a wrapper — so the phone design is byte for
 * byte what it was.
 */
export default function FormRow({ children }: FormRowProps) {
  const { isWebLayout } = useResponsive();

  if (!isWebLayout) return <>{children}</>;

  return (
    <View style={{ flexDirection: 'row', gap: 16 }}>
      {Children.map(children, (child) =>
        child ? (
          // `minWidth: 0` so a long value shrinks the column instead of pushing its neighbour
          // off the row — the usual flexbox default is to refuse to go below content width.
          <View style={{ flex: 1, minWidth: 0 }}>{child}</View>
        ) : null
      )}
    </View>
  );
}
