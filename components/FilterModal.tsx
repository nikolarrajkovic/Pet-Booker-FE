import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { BRAND_GREEN, useThemeColors } from '../hooks/useThemeColors';
import { useCurrency } from '../hooks/useCurrency';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEnums } from '../context/EnumsContext';
import { useLocale } from '../context/LocaleContext';
import { PetSpecies } from '../services/pets';
// No add-on catalog to import any more — extras are named by each provider, so the filter chips
// are derived from what the current result set actually offers (see the availableAddOns prop).

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApplyFilters: (filters: FilterState) => void;
  currentFilters: FilterState;
  /** Upper bound for the price slider — derived from the loaded services. */
  maxPrice: number;
  /**
   * Distinct extra names offered across the loaded services. Extras are provider-named free text
   * now, so there is no fixed catalog to render as chips — the options come from the data.
   */
  availableAddOns?: string[];
}

export interface FilterState {
  serviceTypes: number[]; // ServiceProviderType enum values
  petTypes: number[]; // PetSpeciesType FLAGS values (a service's acceptedSpecies must include one)
  addOns: string[]; // names of extras a service must offer (matched case-insensitively)
  priceRange: [number, number];
  minimumRating: string; // 'Any' | '3+' | '4+' | '5+'
}

// Rating thresholds are a fixed 0–5 review scale (a presentation choice), not a
// backend lookup — generated rather than spelled out as magic strings.
const RATING_THRESHOLDS = [3, 4, 5];
const RATING_OPTIONS = ['Any', ...RATING_THRESHOLDS.map((r) => `${r}+`)];

export default function FilterModal({
  visible,
  onClose,
  onApplyFilters,
  currentFilters,
  maxPrice,
  availableAddOns = [],
}: FilterModalProps) {
  const { isDarkMode, bgColor, cardBg, textColor, subtextColor, borderColor } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { enums } = useEnums();
  const { t, tEnum } = useLocale();
  const { money } = useCurrency();

  const [filters, setFilters] = useState<FilterState>(currentFilters);

  // Update internal state when currentFilters prop changes
  useEffect(() => {
    setFilters(currentFilters);
  }, [currentFilters]);

  // Every category below is sourced from /enums or the service add-on catalog —
  // nothing is hardcoded. Pet species drop None (0) and All (63) — they aren't
  // selectable filters.
  const serviceTypeOptions = enums?.serviceProviderType ?? [];
  const petTypeOptions = (enums?.petSpeciesType ?? []).filter(
    (e) => e.value > 0 && e.value !== PetSpecies.All
  );

  const toggleValue = (key: 'serviceTypes' | 'petTypes', value: number) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((v) => v !== value)
        : [...prev[key], value],
    }));
  };

  const toggleAddOn = (name: string) => {
    setFilters((prev) => ({
      ...prev,
      addOns: prev.addOns.includes(name)
        ? prev.addOns.filter((a) => a !== name)
        : [...prev.addOns, name],
    }));
  };

  const handleReset = () => {
    setFilters({
      serviceTypes: [],
      petTypes: [],
      addOns: [],
      priceRange: [0, maxPrice],
      minimumRating: 'Any',
    });
  };

  const handleApply = () => {
    onApplyFilters(filters);
    onClose();
  };

  // Shared chip styling for the multi-select pill rows.
  const chipClass = (active: boolean) =>
    `px-4 py-2 rounded-full border ${
      active
        ? `${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'} border-brand-500`
        : `${cardBg} ${borderColor}`
    }`;
  const chipTextClass = (active: boolean) =>
    `text-sm ${active ? 'text-brand-600 font-medium' : subtextColor}`;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View
        className="flex-1 justify-end"
        style={{ backgroundColor: isDarkMode ? '#0f1621' : '#ffffff' }}>
        <View className="absolute inset-0 bg-black/50" />
        <View className={`flex-1 ${bgColor} mt-16`}>
          {/* Header */}
          <View
            className={`flex-row items-center justify-between border-b px-6 py-4 ${borderColor}`}>
            <Text className={`text-xl font-bold ${textColor}`}>{t('shared.filters')}</Text>
            <TouchableOpacity onPress={onClose} className="h-8 w-8 items-center justify-center">
              <Ionicons name="close" size={24} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-6 py-4">
            {/* Service Type — serviceProviderType enum */}
            <View className="mb-6">
              <Text className={`text-base font-semibold ${textColor} mb-3`}>
                {t('shared.serviceType')}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {serviceTypeOptions.map((opt) => {
                  const active = filters.serviceTypes.includes(opt.value);
                  return (
                    <TouchableOpacity
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
              <Text className={`text-base font-semibold ${textColor} mb-3`}>
                {t('shared.acceptedPets')}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {petTypeOptions.map((opt) => {
                  const active = filters.petTypes.includes(opt.value);
                  return (
                    <TouchableOpacity
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

            {/* Additional Services — the extras actually offered in the current results. Names
                are provider-authored, so they're shown verbatim rather than translated. */}
            {availableAddOns.length > 0 && (
              <View className="mb-6">
                <Text className={`text-base font-semibold ${textColor} mb-3`}>
                  {t('shared.additionalServices')}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {availableAddOns.map((name) => {
                    const active = filters.addOns.includes(name);
                    return (
                      <TouchableOpacity
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
                <Text className={`text-base font-semibold ${textColor}`}>
                  {t('shared.priceRange')}
                </Text>
                {/* A filter bound isn't one provider's price, so it uses the user's currency. */}
                <Text className="text-sm font-medium text-brand-600">
                  {money(filters.priceRange[0])} - {money(filters.priceRange[1])}
                </Text>
              </View>
              <Slider
                minimumValue={0}
                maximumValue={maxPrice}
                step={5}
                value={filters.priceRange[1]}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    priceRange: [prev.priceRange[0], Math.round(value)],
                  }))
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
                <Text className="ml-auto text-sm font-medium text-brand-600">
                  {filters.minimumRating}
                </Text>
              </View>
              <View className="flex-row gap-2">
                {RATING_OPTIONS.map((rating) => (
                  <TouchableOpacity
                    key={rating}
                    onPress={() => setFilters((prev) => ({ ...prev, minimumRating: rating }))}
                    className={`flex-1 rounded-xl border py-2 ${
                      filters.minimumRating === rating
                        ? 'border-brand-500 bg-brand-500'
                        : `${cardBg} ${borderColor}`
                    }`}>
                    <Text
                      className={`text-center text-sm font-medium ${
                        filters.minimumRating === rating ? 'text-white' : subtextColor
                      }`}>
                      {rating === 'Any' ? t('shared.any') : rating}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className="h-24" />
          </ScrollView>

          {/* Footer Buttons */}
          <View
            className={`flex-row gap-3 border-t px-6 ${borderColor} ${bgColor}`}
            style={{ paddingTop: 16, paddingBottom: Math.max(insets.bottom, 16) }}>
            <TouchableOpacity
              onPress={handleReset}
              className={`flex-1 rounded-xl border py-3 ${borderColor} ${cardBg} items-center`}>
              <Text className={`${subtextColor} font-semibold`}>{t('shared.reset')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleApply}
              className="flex-1 items-center rounded-xl bg-brand-500 py-3">
              <Text className="font-semibold text-white">{t('shared.applyFilters')}</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom safe area background */}
          <View
            style={{
              position: 'absolute',
              bottom: -100,
              left: 0,
              right: 0,
              height: 100,
              backgroundColor: isDarkMode ? '#0f1621' : '#ffffff',
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
