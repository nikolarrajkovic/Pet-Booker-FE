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
 */
export function MessageState({ icon, message }: { icon: IoniconName; message: string }) {
  const { subtextColor, hex } = useThemeColors();
  return (
    <StatePad>
      <Ionicons name={icon} size={64} color={hex.mutedIcon} />
      <Text className={`${subtextColor} mt-4 text-center text-base`}>{message}</Text>
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
  if (error) return <MessageState icon="alert-circle-outline" message={error} />;
  if (isEmpty && emptyMessage) return <MessageState icon={emptyIcon} message={emptyMessage} />;
  return <>{children}</>;
}
