import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ServicePhoto from '../../../components/shared/ServicePhoto';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import { formatMoney } from '../../../services/currency';
import { serviceCurrency } from '../../../services/services';
import type { ServiceSearchItem } from '../../search-screen/components/ListView';

type Props = {
  item: ServiceSearchItem;
  selected: boolean;
  /** Greyed and not tappable — "send to every matching provider" is on, which covers this row. */
  disabled?: boolean;
  onToggle: (item: ServiceSearchItem) => void;
};

/**
 * One candidate in the "who to ask" list: a checkbox row. The whole row is the hit target (a
 * checkbox alone is a 22px target on a phone), and it reads as a checkbox to a screen reader.
 * Browse rows are services, so the row names the service and the price it is shown at — picking
 * it names its provider on the request, with this service preselected for them.
 */
export default function ProviderPickRow({ item, selected, disabled, onToggle }: Props) {
  const { isDarkMode, cardBg, textColor, subtextColor, borderColor } = useThemeColors();
  const { t } = useLocale();
  const active = selected && !disabled;

  return (
    <TouchableOpacity
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active, disabled }}
      accessibilityLabel={item.name}
      disabled={disabled}
      activeOpacity={0.7}
      onPress={() => onToggle(item)}
      className={`mb-2 flex-row items-center rounded-2xl border-2 p-3 ${
        active
          ? `border-brand-500 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'}`
          : `${borderColor} ${cardBg}`
      } ${disabled ? 'opacity-50' : ''}`}>
      <Ionicons
        name={active ? 'checkbox' : 'square-outline'}
        size={22}
        color={active ? BRAND_GREEN : isDarkMode ? '#6B7280' : '#9CA3AF'}
      />
      <ServicePhoto
        uri={item.image}
        radiusClass="rounded-xl"
        iconSize={18}
        className="ml-3 h-12 w-12"
      />
      <View className="ml-3 flex-1">
        <Text numberOfLines={1} className={`text-sm font-semibold ${textColor}`}>
          {item.name}
        </Text>
        <View className="mt-0.5 flex-row items-center">
          {!!item.service && (
            <Text numberOfLines={1} className="text-xs text-brand-600">
              {item.service}
            </Text>
          )}
          {item.rating > 0 ? (
            <View className="ml-2 flex-row items-center">
              <Ionicons name="star" size={11} color="#FBBF24" />
              <Text className={`ml-0.5 text-xs ${subtextColor}`}>
                {item.rating.toFixed(1)}
                {item.reviews > 0 ? ` (${item.reviews})` : ''}
              </Text>
            </View>
          ) : (
            <Text className={`ml-2 text-xs ${subtextColor}`}>{t('groupRequest.noReviewsYet')}</Text>
          )}
        </View>
      </View>
      <View className="ml-2 items-end">
        <Text className={`text-[10px] ${subtextColor}`}>{t('groupRequest.from')}</Text>
        <Text className="text-sm font-bold text-brand-600">
          {formatMoney(item.price, serviceCurrency(item.dto))}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
