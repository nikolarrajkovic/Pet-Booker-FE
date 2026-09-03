import React, { Children, ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';
import { useResponsive, byMode, type LayoutMode } from '../../hooks/useResponsive';

type Columns = { mobile: number; tablet?: number; desktop?: number; wide?: number };

type ResponsiveGridProps = {
  children: ReactNode;
  /**
   * Explicit column count per breakpoint. Omitted levels inherit the narrower one, so
   * `{ mobile: 1, desktop: 3 }` gives tablets 1 column — pass `tablet` when that is wrong.
   */
  columns?: Columns;
  /** Space between items, in px. Horizontal always; vertical unless `rowGap` overrides it. */
  gap?: number;
  /**
   * Vertical space between rows, when it differs from `gap`.
   *
   * Pass `0` for a list of cards that already carry their own bottom margin from the phone
   * design. Those cards are presentational — they take their theme as props and call no hooks —
   * so making them width-aware just to drop a margin would push a hook into every one of them
   * and break the convention that keeps them testable in isolation. Letting the card keep its
   * margin and zeroing the grid's row gap gets the same spacing with no change to the card.
   */
  rowGap?: number;
  className?: string;
  style?: ViewStyle;
};

const DEFAULT_COLUMNS: Columns = { mobile: 1, tablet: 2, desktop: 3, wide: 4 };

function columnsFor(mode: LayoutMode, isWide: boolean, columns: Columns): number {
  if (mode === 'desktop' && isWide)
    return columns.wide ?? columns.desktop ?? columns.tablet ?? columns.mobile;
  return byMode(mode, columns);
}

/**
 * Lays its children out in a breakpoint-driven grid: one column on a phone, two on a tablet,
 * three or four on a desktop.
 *
 * This is how a list of cards uses the width instead of being a 1120px-wide stack of rows with a
 * card floating at the left of each. Every card list in the web design goes through here, so the
 * gutters and column counts are decided once.
 *
 * **Why percentage widths and not flex-wrap on the children:** React Native's flexbox has no
 * `gap`-aware wrapping that behaves the same on native and web across RN versions, and a
 * `flexBasis: '33%'` child with margins overflows its row by the margin. Each cell here gets an
 * exact fraction of the row and the gap is applied as padding *inside* the cell, so the maths
 * cannot round into a wrapped row of one.
 */
export default function ResponsiveGrid({
  children,
  columns = DEFAULT_COLUMNS,
  gap = 16,
  rowGap,
  className = '',
  style,
}: ResponsiveGridProps) {
  const { mode, isWide } = useResponsive();
  const columnCount = Math.max(1, columnsFor(mode, isWide, columns));
  const verticalGap = rowGap ?? gap;

  // `Children.toArray` drops nulls and flattens fragments, so a conditionally-rendered card
  // doesn't leave a hole in the grid.
  const items = Children.toArray(children);

  if (columnCount === 1) {
    return (
      <View className={className} style={style}>
        {items.map((child, i) => (
          <View key={i} style={i > 0 && verticalGap > 0 ? { marginTop: verticalGap } : undefined}>
            {child}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View
      className={className}
      style={[
        {
          flexDirection: 'row',
          flexWrap: 'wrap',
          // Negative outer margin cancels the per-cell padding, so the grid's own edges line up
          // with everything else in the column rather than being inset by half a gap.
          marginHorizontal: -gap / 2,
        },
        style,
      ]}>
      {items.map((child, i) => (
        <View
          key={i}
          style={{
            width: `${100 / columnCount}%`,
            paddingHorizontal: gap / 2,
            // Bottom gap on every cell rather than "all but the last row" — the last row's count
            // depends on the item count, and getting it wrong leaves a ragged bottom edge.
            paddingBottom: verticalGap,
          }}>
          {child}
        </View>
      ))}
    </View>
  );
}
