import React, { Children, ReactNode } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, useThemeColors } from '../../hooks/useThemeColors';
import { useResponsive } from '../../hooks/useResponsive';
import { useLocale } from '../../context/LocaleContext';
import ResponsiveGrid from './ResponsiveGrid';

type RailProps = {
  title: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  /** The cards. On web they are laid out in a grid; on mobile, a horizontal scroller. */
  children: ReactNode;
  /** "See all" target. Omitted means the section has no more to show. */
  onSeeAll?: () => void;
  /**
   * Trailing element for the mobile scroller — the `SeeMoreCard` that ends each rail. Not
   * rendered on web, where the header's "See all" link does the same job without costing a
   * grid cell.
   */
  mobileTrailing?: ReactNode;
  /** Cap the grid at one row on web, so a rail stays a rail rather than becoming the page. */
  maxOnWeb?: number;
  className?: string;
};

/**
 * A titled section of cards: a horizontal rail on a phone, a grid on the web design.
 *
 * The rail is a phone pattern with a specific justification — the screen fits two cards, and
 * swiping sideways is cheaper than scrolling past twenty. On a desktop the same component shows
 * three cards in 1120px of width with the rest hidden behind a horizontal scrollbar nobody uses,
 * which is a worse way to show sixteen results than simply showing them.
 *
 * So on web the row becomes a grid and the trailing "See more" card becomes a **"See all" link in
 * the section header**, where a web user looks for it.
 */
export default function Rail({
  title,
  icon,
  children,
  onSeeAll,
  mobileTrailing,
  maxOnWeb = 4,
  className = '',
}: RailProps) {
  const { textColor } = useThemeColors();
  const { isWebLayout, isWide } = useResponsive();
  const { t } = useLocale();

  const header = (
    <View className="mb-3 flex-row items-center justify-between px-6">
      <View className="flex-row items-center">
        {icon && <Ionicons name={icon} size={20} color={BRAND_GREEN} />}
        <Text className={`${icon ? 'ml-2' : ''} text-base font-semibold ${textColor}`}>
          {title}
        </Text>
      </View>
      {isWebLayout && onSeeAll && (
        <Pressable
          onPress={onSeeAll}
          accessibilityRole="link"
          // Named after its row: four identical "See all" links on one page are
          // indistinguishable to a screen reader without it.
          accessibilityLabel={`${t('common.seeAll')}: ${title}`}
          style={({ hovered }: any) => ({
            flexDirection: 'row',
            alignItems: 'center',
            opacity: hovered ? 0.7 : 1,
            cursor: 'pointer',
          })}>
          <Text className="text-sm font-semibold text-brand-600">{t('common.seeAll')}</Text>
          <Ionicons name="chevron-forward" size={14} color={BRAND_GREEN} />
        </Pressable>
      )}
    </View>
  );

  if (isWebLayout) {
    // One row, not the whole result set — a rail is a teaser, and "See all" is the way in.
    const columns = isWide ? 4 : 3;
    const visible = Children.toArray(children).slice(0, Math.min(maxOnWeb, columns));

    return (
      <View className={`mb-8 ${className}`}>
        {header}
        <View className="px-6">
          <ResponsiveGrid columns={{ mobile: 1, tablet: 2, desktop: 3, wide: 4 }}>
            {visible}
          </ResponsiveGrid>
        </View>
      </View>
    );
  }

  return (
    <View className={`mb-6 ${className}`}>
      {header}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-6">
        <View className="flex-row gap-3">
          {children}
          {mobileTrailing}
        </View>
      </ScrollView>
    </View>
  );
}
