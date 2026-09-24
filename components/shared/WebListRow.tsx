import React, { type ReactNode } from 'react';
import { View, Text, Pressable, TouchableOpacity, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, useThemeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';

/**
 * One column of a web list: a header label and how much of the row it takes.
 *
 * Declared once per list and handed to both the header and every row's cells, so the labels sit
 * exactly above their values — the difference between a list of cards and a table you can scan
 * down.
 */
export type WebColumn = {
  /** Translation key for the header label; omit for an unlabelled column (actions, chevron). */
  labelKey?: string;
  /** Share of the free width. */
  flex?: number;
  /** Fixed width instead, for columns whose content does not grow (a date, the buttons). */
  width?: number;
  /** `'right'` for trailing actions, so they line up on the row's far edge. */
  align?: 'left' | 'right';
};

/** Horizontal padding shared by the header and the rows, so the two line up. */
const ROW_PADDING_X = 20;
/** Space between cells, likewise shared. */
const CELL_GAP = 20;

function columnStyle(column: WebColumn): ViewStyle {
  return {
    ...(column.width != null ? { width: column.width } : { flex: column.flex ?? 1 }),
    // Lets a cell shrink below its content so long text ellipsises instead of pushing the row.
    minWidth: 0,
    alignItems: column.align === 'right' ? 'flex-end' : 'flex-start',
  };
}

/** The column labels above a web list. */
export function WebListHeader({ columns }: { columns: readonly WebColumn[] }) {
  const { subtextColor } = useThemeColors();
  const { t } = useLocale();

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: CELL_GAP,
        paddingHorizontal: ROW_PADDING_X,
        paddingBottom: 8,
      }}>
      {columns.map((column, i) => (
        <View key={i} style={columnStyle(column)}>
          {!!column.labelKey && (
            <Text
              className={`text-[11px] font-semibold uppercase ${subtextColor}`}
              style={{ letterSpacing: 0.6 }}>
              {t(column.labelKey as any)}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

/** A cell in a web list row, sized by its column. */
export function WebListCell({ column, children }: { column: WebColumn; children?: ReactNode }) {
  return <View style={columnStyle(column)}>{children}</View>;
}

type WebListRowProps = {
  children: ReactNode;
  /** Opens the row's detail. Buttons inside the row keep their own presses. */
  onPress?: () => void;
  accessibilityLabel?: string;
  /** A second line under the cells, full width — used where a narrower window drops columns. */
  footer?: ReactNode;
  /**
   * The row holds buttons of its own (approve, reject). It then stays a plain clickable surface
   * rather than a button: react-native-web renders a button role as `<button>`, which may not
   * contain buttons, and a screen reader should reach the row's own actions, not one blob.
   */
  hasActions?: boolean;
};

/**
 * One row of a web list: a card the full width of the page, its content laid out in columns.
 *
 * The phone's moderation cards are built for a 390px queue — a name, a chip, a stack of lines
 * and a full-width button — and on a 1400px page they became either 1120px bars or a two-column
 * grid of phone cards that still wasted most of each card. A row spends the width on columns
 * instead, so a reviewer reads everything that matters about an item on one line and scans a
 * page of them the way they would a table. The hover state is what a pointer user expects of a
 * row that opens something.
 */
export function WebListRow({
  children,
  onPress,
  accessibilityLabel,
  footer,
  hasActions = false,
}: WebListRowProps) {
  const { hex, isDarkMode } = useThemeColors();

  const frame = (hovered: boolean): ViewStyle => ({
    backgroundColor: hex.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: hovered ? BRAND_GREEN : hex.border,
    marginBottom: 10,
    paddingHorizontal: ROW_PADDING_X,
    paddingVertical: 16,
    // A lift on hover rather than a colour flood: the row's own status chips carry colour.
    shadowColor: '#000',
    shadowOpacity: hovered ? (isDarkMode ? 0.4 : 0.08) : 0,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  });
  const content = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: CELL_GAP }}>{children}</View>
      {footer}
    </>
  );

  // Nothing to open: a plain surface. A *disabled* Pressable would mark the whole row
  // aria-disabled, and with it every button inside — a moderator's Approve included.
  if (!onPress) return <View style={frame(false)}>{content}</View>;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={hasActions ? undefined : 'button'}
      accessibilityLabel={accessibilityLabel}
      style={({ hovered }: any) => frame(!!hovered)}>
      {content}
    </Pressable>
  );
}

/** The compact buttons at the end of a web row. */
export function WebRowButton({
  label,
  onPress,
  tone,
  icon,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  tone: 'primary' | 'danger' | 'neutral';
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  disabled?: boolean;
}) {
  const { hex, textColor } = useThemeColors();
  const filled = tone === 'primary';
  const color = tone === 'primary' ? 'white' : tone === 'danger' ? '#DC2626' : undefined;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.8}
      style={{
        height: 36,
        paddingHorizontal: 14,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: filled ? BRAND_GREEN : 'transparent',
        borderWidth: filled ? 0 : 1.5,
        borderColor: tone === 'danger' ? '#FCA5A5' : hex.border,
        opacity: disabled ? 0.5 : 1,
      }}>
      {icon && <Ionicons name={icon} size={15} color={color ?? hex.text} />}
      <Text
        className={color ? undefined : textColor}
        style={{ fontSize: 13, fontWeight: '600', ...(color ? { color } : null) }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
