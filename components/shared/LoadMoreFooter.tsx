import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { BRAND_GREEN, useThemeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';

/**
 * True when a ScrollView is scrolled to within `threshold` px of its end — the trigger for
 * loading the next page.
 *
 * This is a phone-first app, so a long list should page itself as you scroll rather than make you
 * hunt for a button. These screens are `ScrollView` + `.map()`, not `FlatList`, so there is no
 * `onEndReached`; this is its equivalent, wired through `onScroll`. `LoadMoreFooter` still renders
 * a tappable fallback for when auto-load hasn't fired (a short list, a fast fling, a failed page).
 *
 * Pair with `scrollEventThrottle={16}` on the ScrollView, and let `usePagedList.loadMore` swallow
 * the repeat calls a scroll gesture inevitably produces.
 */
export function isNearBottom(e: NativeSyntheticEvent<NativeScrollEvent>, threshold = 320): boolean {
  const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
  return layoutMeasurement.height + contentOffset.y >= contentSize.height - threshold;
}

interface LoadMoreFooterProps {
  /** Rows currently rendered. */
  loaded: number;
  /** Rows matching the query across all pages. */
  total: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}

/**
 * The bottom of a paged list: how much of it you are looking at, and a way to get the rest.
 *
 * The count is not decoration — a list that silently stopped at its first page is exactly the bug
 * this replaces, so the footer always states what you are seeing. It renders nothing for a list
 * that fits on one page.
 */
export default function LoadMoreFooter({
  loaded,
  total,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: LoadMoreFooterProps) {
  const { subtextColor, borderColor } = useThemeColors();
  const { t } = useLocale();

  // A single complete page needs no footer at all.
  if (!hasMore && !isLoadingMore && loaded >= total) return null;

  return (
    <View className="items-center px-6 pb-2 pt-3">
      {isLoadingMore ? (
        // 44pt-tall box so the list doesn't jump when the spinner swaps for the button.
        <View className="h-11 justify-center">
          <ActivityIndicator size="small" color={BRAND_GREEN} />
        </View>
      ) : hasMore ? (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={onLoadMore}
          className={`h-11 justify-center rounded-full border px-6 ${borderColor}`}
          activeOpacity={0.8}
          // Comfortable touch target (iOS HIG minimum) plus slop, since this sits at the very
          // bottom of a scroll where thumbs are least precise.
          hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}>
          <Text className="text-sm font-semibold text-brand-600">{t('common.loadMore')}</Text>
        </TouchableOpacity>
      ) : null}
      <Text className={`text-xs ${subtextColor} mt-2`}>
        {t('common.showingOf', { loaded, total })}
      </Text>
    </View>
  );
}
