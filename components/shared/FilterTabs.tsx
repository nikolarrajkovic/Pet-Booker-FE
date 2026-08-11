import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export interface FilterTab<K extends string> {
  key: K;
  /** Translation key, resolved with `t()` at render — never a literal label. */
  labelKey: string;
  icon: IoniconName;
  /** Text + icon color, and the count-badge fill, while this tab is selected. */
  activeColor: string;
  /** Pill background while this tab is selected. */
  activeBg: string;
}

export interface FilterTabsProps<K extends string> {
  tabs: readonly FilterTab<K>[];
  activeKey: K;
  onChange: (key: K) => void;
  /** Row count per tab, shown in the trailing badge. */
  counts: Record<K, number>;
}

/**
 * The pill-shaped filter bar used above a moderation list: icon + label + count
 * badge per tab, the selected one tinted with its own status color.
 *
 * AdminNewRequestsScreen and AdminReviewsScreen carried byte-identical copies of
 * this markup (~60 lines each) plus identical `TABS` constants, differing only in
 * the third tab's label key — so a spacing tweak had to be made twice to avoid
 * the two admin screens drifting apart.
 */
export default function FilterTabs<K extends string>({
  tabs,
  activeKey,
  onChange,
  counts,
}: FilterTabsProps<K>) {
  const { cardBg, hex } = useThemeColors();
  const { t } = useLocale();

  return (
    <View
      style={{
        flexDirection: 'row',
        marginHorizontal: 16,
        marginTop: 20,
        marginBottom: 12,
        gap: 8,
      }}>
      {tabs.map((tab) => {
        const isActive = activeKey === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onChange(tab.key)}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: isActive ? tab.activeBg : cardBg,
              borderWidth: 1.5,
              borderColor: isActive ? tab.activeColor + '55' : hex.border,
            }}>
            <Ionicons name={tab.icon} size={14} color={isActive ? tab.activeColor : hex.subtext} />
            <Text
              style={{
                color: isActive ? tab.activeColor : hex.subtext,
                fontSize: 13,
                fontWeight: '600',
                marginLeft: 5,
              }}>
              {t(tab.labelKey as any)}
            </Text>
            <View
              style={{
                marginLeft: 5,
                backgroundColor: isActive ? tab.activeColor : hex.chipBg,
                borderRadius: 8,
                minWidth: 18,
                height: 18,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 4,
              }}>
              <Text
                style={{
                  color: isActive ? 'white' : hex.subtext,
                  fontSize: 10,
                  fontWeight: '700',
                }}>
                {counts[tab.key]}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** The three states every admin moderation queue has. */
export type ModerationTab = 'pending' | 'approved' | 'rejected';

/**
 * The shared pending/approved/rejected triad. The final tab's wording differs by
 * queue — an application is *rejected*, a review is *declined* — so its label key
 * is a parameter rather than being baked in.
 */
export function moderationTabs(rejectedLabelKey: string): readonly FilterTab<ModerationTab>[] {
  return [
    {
      key: 'pending',
      labelKey: 'admin.statusPending',
      icon: 'time-outline',
      activeColor: '#A16207',
      activeBg: '#FEF9C3',
    },
    {
      key: 'approved',
      labelKey: 'admin.statusApproved',
      icon: 'checkmark-circle-outline',
      activeColor: '#15803D',
      activeBg: '#DCFCE7',
    },
    {
      key: 'rejected',
      labelKey: rejectedLabelKey,
      icon: 'close-circle-outline',
      activeColor: '#B91C1C',
      activeBg: '#FEE2E2',
    },
  ] as const;
}
