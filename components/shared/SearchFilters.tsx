import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { BRAND_GREEN, useThemeColors } from '../../hooks/useThemeColors';
import { useCurrency } from '../../hooks/useCurrency';
import { useEnums } from '../../context/EnumsContext';
import { useLocale } from '../../context/LocaleContext';
import { PetSpecies } from '../../services/pets';

/**
 * What the user has narrowed the catalogue to.
 *
 * Every field here is sent to the API as a query parameter — none of it is applied in the client.
 * The list pages itself as the user scrolls, so a predicate evaluated over the loaded rows would
 * only ever filter the part of the result set that happened to have arrived: a narrow filter
 * showed a handful of matches out of page one, and the result count described that subset rather
 * than the search. Adding a filter here therefore means adding it to the server too — see
 * `GetServicesParams` in `services/services.ts`.
 */
export interface FilterState {
  serviceTypes: number[]; // ServiceProviderType enum values
  petTypes: number[]; // PetSpeciesType FLAGS values (a service's acceptedSpecies must include one)
  addOns: string[]; // names of extras a service must offer (ALL of them)
  priceRange: [number, number];
  minimumRating: string; // 'Any' | '3+' | '4+' | '5+'
  /** Only services with a promotion running right now. */
  onSaleOnly: boolean;
}

export const EMPTY_FILTERS: Omit<FilterState, 'priceRange'> = {
  serviceTypes: [],
  petTypes: [],
  addOns: [],
  minimumRating: 'Any',
  onSaleOnly: false,
};

// Rating thresholds are a fixed 0–5 review scale (a presentation choice), not a
// backend lookup — generated rather than spelled out as magic strings.
const RATING_THRESHOLDS = [3, 4, 5];
export const RATING_OPTIONS = ['Any', ...RATING_THRESHOLDS.map((r) => `${r}+`)];

/** How many filters are narrowing the search — for the "Filters (3)" badge. */
export function activeFilterCount(filters: FilterState, maxPrice: number): number {
  return (
    filters.serviceTypes.length +
    filters.petTypes.length +
    filters.addOns.length +
    (filters.minimumRating !== 'Any' ? 1 : 0) +
    (filters.onSaleOnly ? 1 : 0) +
    (filters.priceRange[0] > 0 || filters.priceRange[1] < maxPrice ? 1 : 0)
  );
}

interface SearchFiltersProps {
  value: FilterState;
  onChange: (next: FilterState) => void;
  /** Upper bound for the price slider. */
  maxPrice: number;
  /**
   * Distinct extra names to offer as chips. Extras are provider-named free text, so there is no
   * fixed catalog — the options come from the data.
   */
  availableAddOns?: string[];
}

/**
 * The filter controls themselves, with no chrome around them.
 *
 * Extracted from `FilterModal` because the same controls now appear in two places: a full-screen
 * sheet on a phone, and a sticky rail beside the results on the web design. Keeping one copy is
 * what stops the two drifting into offering different filters — which, now that every filter is a
 * query parameter, would mean two different searches.
 *
 * It is fully controlled: each interaction reports the whole next state. The sticky rail applies
 * that straight away (a filter you can see is a filter you expect to act), while the sheet holds
 * it as a draft behind its Apply button.
 */
export default function SearchFilters({
  value,
  onChange,
  maxPrice,
  availableAddOns = [],
}: SearchFiltersProps) {
  const { isDarkMode, cardBg, textColor, subtextColor, borderColor } = useThemeColors();
  const { enums } = useEnums();
  const { t, tEnum } = useLocale();
  const { money } = useCurrency();

  // Every category is sourced from /enums or the data — nothing is hardcoded. Pet species drop
  // None (0) and All (63): neither is a selectable filter.
  const serviceTypeOptions = enums?.serviceProviderType ?? [];
  const petTypeOptions = (enums?.petSpeciesType ?? []).filter(
    (e) => e.value > 0 && e.value !== PetSpecies.All
  );

  const toggleValue = (key: 'serviceTypes' | 'petTypes', option: number) => {
    const current = value[key];
    onChange({
      ...value,
      [key]: current.includes(option) ? current.filter((v) => v !== option) : [...current, option],
    });
  };

  const toggleAddOn = (name: string) => {
    onChange({
      ...value,
      addOns: value.addOns.includes(name)
        ? value.addOns.filter((a) => a !== name)
        : [...value.addOns, name],
    });
  };

  const chipClass = (active: boolean) =>
    `px-4 py-2 rounded-full border ${
      active
        ? `${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'} border-brand-500`
        : `${cardBg} ${borderColor}`
    }`;
  const chipTextClass = (active: boolean) =>
    `text-sm ${active ? 'text-brand-600 font-medium' : subtextColor}`;

  const sectionTitle = (label: string) => (
    <Text className={`text-base font-semibold ${textColor} mb-3`}>{label}</Text>
  );

  return (
    <View>
      {/* On sale — a single switch, first because it is the one filter people reach for by
          habit and it costs one tap. */}
      <TouchableOpacity
        accessibilityRole="switch"
        accessibilityState={{ checked: value.onSaleOnly }}
        onPress={() => onChange({ ...value, onSaleOnly: !value.onSaleOnly })}
        className={`mb-6 flex-row items-center justify-between rounded-xl border p-3 ${
          value.onSaleOnly ? 'border-brand-500' : borderColor
        } ${cardBg}`}>
        <View className="flex-row items-center">
          <Ionicons name="pricetag" size={16} color="#EF4444" />
          <Text className={`ml-2 text-sm font-medium ${textColor}`}>{t('home.specialDeals')}</Text>
        </View>
        <View
          className={`h-5 w-5 items-center justify-center rounded border ${
            value.onSaleOnly ? 'border-brand-500 bg-brand-500' : borderColor
          }`}>
          {value.onSaleOnly && <Ionicons name="checkmark" size={13} color="white" />}
        </View>
      </TouchableOpacity>

      {/* Service Type — serviceProviderType enum */}
      <View className="mb-6">
        {sectionTitle(t('shared.serviceType'))}
        <View className="flex-row flex-wrap gap-2">
          {serviceTypeOptions.map((opt) => {
            const active = value.serviceTypes.includes(opt.value);
            return (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                key={opt.value}
                onPress={() => toggleValue('serviceTypes', opt.value)}
                className={chipClass(active)}>
                <Text className={chipTextClass(active)}>
                  {tEnum('serviceProviderType', opt.value, opt.name)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Accepted Pets — petSpeciesType enum */}
      <View className="mb-6">
        {sectionTitle(t('shared.acceptedPets'))}
        <View className="flex-row flex-wrap gap-2">
          {petTypeOptions.map((opt) => {
            const active = value.petTypes.includes(opt.value);
            return (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                key={opt.value}
                onPress={() => toggleValue('petTypes', opt.value)}
                className={chipClass(active)}>
                <Text className={chipTextClass(active)}>
                  {tEnum('petSpeciesType', opt.value, opt.name)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Additional Services. Names are provider-authored, so they're shown verbatim rather than
          translated. Selecting two asks for a service that offers both. */}
      {availableAddOns.length > 0 && (
        <View className="mb-6">
          {sectionTitle(t('shared.additionalServices'))}
          <View className="flex-row flex-wrap gap-2">
            {availableAddOns.map((name) => {
              const active = value.addOns.includes(name);
              return (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={name}
                  onPress={() => toggleAddOn(name)}
                  className={chipClass(active)}>
                  <Text className={chipTextClass(active)}>{name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Price Range */}
      <View className="mb-6">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className={`text-base font-semibold ${textColor}`}>{t('shared.priceRange')}</Text>
          {/* A filter bound isn't one provider's price, so it uses the user's currency — and the
              server is told which currency that is, so it can compare against what it stores. */}
          <Text className="text-sm font-medium text-brand-600">
            {money(value.priceRange[0])} - {money(value.priceRange[1])}
          </Text>
        </View>
        <Slider
          minimumValue={0}
          maximumValue={maxPrice}
          step={5}
          value={value.priceRange[1]}
          onValueChange={(next) =>
            onChange({ ...value, priceRange: [value.priceRange[0], Math.round(next)] })
          }
          minimumTrackTintColor={BRAND_GREEN}
          maximumTrackTintColor={isDarkMode ? '#374151' : '#E5E7EB'}
          thumbTintColor={BRAND_GREEN}
        />
      </View>

      {/* Minimum Rating */}
      <View className="mb-6">
        <View className="mb-3 flex-row items-center">
          <Ionicons name="star" size={18} color="#F59E0B" />
          <Text className={`text-base font-semibold ${textColor} ml-2`}>
            {t('shared.minimumRating')}
          </Text>
          <Text className="ml-auto text-sm font-medium text-brand-600">{value.minimumRating}</Text>
        </View>
        <View className="flex-row gap-2">
          {RATING_OPTIONS.map((rating) => (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: value.minimumRating === rating }}
              key={rating}
              onPress={() => onChange({ ...value, minimumRating: rating })}
              className={`flex-1 rounded-xl border py-2 ${
                value.minimumRating === rating
                  ? 'border-brand-500 bg-brand-500'
                  : `${cardBg} ${borderColor}`
              }`}>
              <Text
                className={`text-center text-sm font-medium ${
                  value.minimumRating === rating ? 'text-white' : subtextColor
                }`}>
                {rating === 'Any' ? t('shared.any') : rating}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}
