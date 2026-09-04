import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, useThemeColors } from '../../hooks/useThemeColors';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * The centered pad every one of these states sits in. Kept at one size so the
 * list does not visibly jump as it moves from spinner → error → empty.
 */
function StatePad({ children }: { children: React.ReactNode }) {
  return <View className="items-center justify-center py-16">{children}</View>;
}

/** Full-width spinner, for a list that has not loaded yet. */
export function LoadingState() {
  return (
    <StatePad>
      <ActivityIndicator size="large" color={BRAND_GREEN} />
    </StatePad>
  );
}

/**
 * Icon + message, the shape both the error and the empty state take. Exported
 * for the handful of screens that need one on its own, outside a `ListState`.
 *
 * The icon sits in a **filled circular badge**, which is what makes this legible: these screens
 * are drawn over the pet pattern, and a bare muted-grey glyph on that ground reads as one more
 * piece of the wallpaper rather than as the page telling you something. The badge gives it a
 * solid backing and the tint carries the meaning. NotificationsScreen arrived at the same shape
 * independently; this is that shape, shared.
 */
export function MessageState({
  icon,
  message,
  tone = 'empty',
}: {
  icon: IoniconName;
  message: string;
  /** `error` tints the badge red — an empty list and a failed one must not look alike. */
  tone?: 'empty' | 'error';
}) {
  const { textColor, cardBg, isDarkMode } = useThemeColors();
  const isError = tone === 'error';
  const badgeBg = isError
    ? isDarkMode
      ? 'bg-[#3a1f24]'
      : 'bg-red-50'
    : isDarkMode
      ? // Deliberately NOT the card colour: the badge sits ON the card, so reusing #1a2332 made
        // the disc invisible in dark mode and left the icon floating. A dark brand tint keeps the
        // same read as bg-brand-50 does against white.
        'bg-[#14372a]'
      : 'bg-brand-50';

  return (
    <StatePad>
      {/* On a card, not loose on the page. Every other block of content on these screens sits on
          one, and against the pattern an uncontained state reads as part of the wallpaper. */}
      <View className={`${cardBg} mx-4 items-center self-stretch rounded-2xl px-6 py-10`}>
        <View className={`mb-4 h-20 w-20 items-center justify-center rounded-full ${badgeBg}`}>
          <Ionicons name={icon} size={36} color={isError ? '#EF4444' : BRAND_GREEN} />
        </View>
        <Text className={`${textColor} text-center text-base font-semibold`}>{message}</Text>
      </View>
    </StatePad>
  );
}

export interface ListStateProps {
  /** Data is still being fetched — takes priority over everything else. */
  isLoading?: boolean;
  /** Load failure message; `null` when the load succeeded. */
  error?: string | null;
  /** The load succeeded but produced no rows. */
  isEmpty?: boolean;
  /** Glyph for the empty state. Defaults to a neutral clipboard. */
  emptyIcon?: IoniconName;
  /** What to say when there is nothing to show — usually tab-specific. */
  emptyMessage?: string;
  /** Rendered only once loading, error and empty are all ruled out. */
  children?: React.ReactNode;
}

/**
 * The loading → error → empty → content ladder every list screen needs.
 *
 * This markup was duplicated almost verbatim in a dozen screens (three of them
 * had drifted onto inline `style` objects while the rest used classes, so the
 * "same" empty state rendered at two different icon sizes and two different
 * greys). Rendering it from here keeps those in step and drops ~20 lines per
 * screen.
 *
 * ```tsx
 * <ListState
 *   isLoading={isLoading}
 *   error={loadError}
 *   isEmpty={filtered.length === 0}
 *   emptyIcon="star-outline"
 *   emptyMessage={t('admin.noPendingReviews')}>
 *   {filtered.map((r) => <ReviewCard key={r.id} review={r} />)}
 * </ListState>
 * ```
 */
export default function ListState({
  isLoading,
  error,
  isEmpty,
  emptyIcon = 'clipboard-outline',
  emptyMessage,
  children,
}: ListStateProps) {
  if (isLoading) return <LoadingState />;
  if (error) return <MessageState icon="alert-circle-outline" message={error} tone="error" />;
  if (isEmpty && emptyMessage) return <MessageState icon={emptyIcon} message={emptyMessage} />;
  return <>{children}</>;
}
