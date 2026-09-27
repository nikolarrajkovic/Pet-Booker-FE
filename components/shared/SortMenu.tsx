import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';

export type SortOption<V extends string | number> = {
  value: V;
  /** Translation key, resolved with `t()` at render. */
  labelKey: string;
};

type SortMenuProps<V extends string | number> = {
  value: V;
  options: readonly SortOption<V>[];
  onChange: (value: V) => void;
};

/**
 * A "Sort: …" pill that opens a short list of orders beneath it.
 *
 * The same control Search draws above its results, so a list that can be re-ordered looks the
 * same wherever it is. An inline panel rather than a modal: a two- or four-item choice does not
 * deserve a full-screen overlay.
 *
 * The panel opens downwards over whatever follows, so the row holding this has to out-rank the
 * rows beneath it in paint order — give that row `style={{ zIndex: 20 }}`. A z-index only
 * competes inside its own stacking context, and the list rows are later siblings of that row.
 */
export default function SortMenu<V extends string | number>({
  value,
  options,
  onChange,
}: SortMenuProps<V>) {
  const { cardBg, borderColor, textColor, subtextColor } = useThemeColors();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const activeLabel = options.find((o) => o.value === value)?.labelKey ?? options[0]?.labelKey;

  return (
    <View style={{ zIndex: 20 }}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${t('search.sortBy')}: ${t(activeLabel as any)}`}
        onPress={() => setOpen((o) => !o)}
        className={`flex-row items-center rounded-full border px-3 py-2 ${borderColor} ${cardBg}`}>
        <Ionicons name="swap-vertical" size={14} color="#6B7280" />
        <Text className={`ml-1.5 text-xs font-medium ${textColor}`} numberOfLines={1}>
          {t(activeLabel as any)}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={13}
          color="#6B7280"
          style={{ marginLeft: 4 }}
        />
      </TouchableOpacity>

      {open && (
        <View
          className={`absolute right-0 top-11 w-56 rounded-xl border py-1 ${borderColor} ${cardBg}`}
          style={{
            // Above the rows on every platform: zIndex for web/iOS, elevation for Android.
            zIndex: 30,
            shadowColor: '#000',
            shadowOpacity: 0.15,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 8,
          }}>
          {options.map((option) => {
            const active = option.value === value;
            return (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                key={String(option.value)}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className="flex-row items-center justify-between px-3 py-2.5">
                <Text
                  className={`text-xs ${active ? 'font-semibold text-brand-600' : subtextColor}`}>
                  {t(option.labelKey as any)}
                </Text>
                {active && <Ionicons name="checkmark" size={14} color="#16A34A" />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}
