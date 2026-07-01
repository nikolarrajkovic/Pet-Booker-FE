import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COUNTRIES, Country, DEFAULT_COUNTRY, detectCountry, parsePhone } from './countries';
import CountryFlag from './CountryFlag';

interface PhoneInputProps {
  /** Stored phone value (dial code + national number, e.g. "+38164 123 4567"). */
  value: string;
  /** Emits the combined phone string whenever the country or number changes. */
  onChangeText: (value: string) => void;
  /** Emits the selected country's ISO code whenever it resolves or changes. */
  onChangeCountry?: (iso: string) => void;
  /** Auto-detect the user's country on mount when no value is set. Default true. */
  autoDetect?: boolean;
  isDarkMode: boolean;
  textColor: string;
  subtextColor: string;
  inputBg: string;
  inputText: string;
  borderColor: string;
  placeholderColor: string;
  cardBg: string;
}

/**
 * Combines a country dial code with the national number into the stored/sent
 * value. No space between the dial code and the number (e.g. "+38164 123 4567")
 * — any spacing the user typed inside the national part is preserved as-is.
 */
function buildPhone(country: Country, national: string): string {
  const n = national.trim();
  return n ? `${country.dialCode}${n}` : country.dialCode;
}

/**
 * Phone number input with a searchable country dial-code picker. Self-contained:
 * it owns the selected country + national number and emits the combined value
 * via `onChangeText`. On mount it seeds from `value` (parsing the dial code) or,
 * when empty, auto-detects the user's country from their current location.
 */
export default function PhoneInput({
  value,
  onChangeText,
  onChangeCountry,
  autoDetect = true,
  isDarkMode,
  textColor,
  subtextColor,
  inputBg,
  inputText,
  borderColor,
  placeholderColor,
  cardBg,
}: PhoneInputProps) {
  const parsed = parsePhone(value);
  const [country, setCountry] = useState<Country>(parsed.country ?? DEFAULT_COUNTRY);
  const [national, setNational] = useState<string>(parsed.national);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [search, setSearch] = useState('');
  const didInit = useRef(false);

  // One-time seed: report the country (from an existing value or by detecting it
  // from the user's location) and, when empty, push the dial-code prefix up too.
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    if (parsed.country || parsed.national) {
      if (parsed.country) onChangeCountry?.(parsed.country.iso);
      return; // already seeded from value
    }
    if (!autoDetect) {
      onChangeText(buildPhone(DEFAULT_COUNTRY, ''));
      onChangeCountry?.(DEFAULT_COUNTRY.iso);
      return;
    }
    let cancelled = false;
    (async () => {
      const detected = await detectCountry();
      if (cancelled) return;
      setCountry(detected);
      onChangeText(buildPhone(detected, ''));
      onChangeCountry?.(detected.iso);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync internal state when the `value` prop changes from the outside
  // (e.g. a "prefill from my account" action, or a record loaded after mount).
  // Skips no-op updates so typing — which round-trips through the parent — never
  // fights this effect.
  useEffect(() => {
    if (!value) return;
    const current = buildPhone(country, national);
    if (value === current) return;
    const next = parsePhone(value);
    if (next.country) {
      setCountry(next.country);
      onChangeCountry?.(next.country.iso);
    }
    setNational(next.national);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const selectCountry = (next: Country) => {
    setCountry(next);
    setPickerVisible(false);
    setSearch('');
    onChangeText(buildPhone(next, national));
    onChangeCountry?.(next.iso);
  };

  const onChangeNational = (text: string) => {
    setNational(text);
    onChangeText(buildPhone(country, text));
  };

  const query = search.trim().toLowerCase();
  const filtered = query
    ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(query) || c.dialCode.includes(query))
    : COUNTRIES;

  return (
    <View>
      <View className={`flex-row items-center ${inputBg} rounded-xl border ${borderColor}`}>
        {/* Country selector */}
        <TouchableOpacity
          onPress={() => setPickerVisible(true)}
          className="flex-row items-center py-3 pl-4 pr-3"
          accessibilityRole="button"
          accessibilityLabel="Select country calling code">
          <CountryFlag iso={country.iso} width={26} />
          <Text className={`ml-2 font-semibold ${inputText}`}>{country.dialCode}</Text>
          <Ionicons
            name="chevron-down"
            size={16}
            color={placeholderColor}
            style={{ marginLeft: 4 }}
          />
        </TouchableOpacity>

        <View className={`my-2 self-stretch border-l ${borderColor}`} />

        {/* National number */}
        <TextInput
          className={`flex-1 px-3 py-3 ${inputText}`}
          placeholder="64 123 4567"
          placeholderTextColor={placeholderColor}
          keyboardType="phone-pad"
          value={national}
          onChangeText={onChangeNational}
        />
      </View>

      {/* Country picker modal */}
      <Modal
        visible={pickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerVisible(false)}>
        <Pressable
          className="flex-1 justify-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onPress={() => setPickerVisible(false)}>
          <Pressable
            className={`${cardBg} rounded-t-3xl`}
            style={{ maxHeight: '80%' }}
            onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View className="flex-row items-center justify-between px-5 pb-3 pt-5">
              <Text className={`text-lg font-bold ${textColor}`}>Select Country</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Ionicons name="close" size={24} color={placeholderColor} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View className="px-5 pb-3">
              <View
                className={`flex-row items-center ${inputBg} rounded-xl border px-4 py-2.5 ${borderColor}`}>
                <Ionicons
                  name="search"
                  size={18}
                  color={placeholderColor}
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  className={`flex-1 ${inputText}`}
                  placeholder="Search country"
                  placeholderTextColor={placeholderColor}
                  value={search}
                  onChangeText={setSearch}
                  autoCorrect={false}
                />
              </View>
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(c) => c.iso}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const selected = item.iso === country.iso;
                return (
                  <TouchableOpacity
                    onPress={() => selectCountry(item)}
                    className="flex-row items-center px-5 py-3">
                    <CountryFlag iso={item.iso} width={30} />
                    <Text className={`ml-3 flex-1 ${textColor}`}>{item.name}</Text>
                    <Text className={`${subtextColor} mr-2`}>{item.dialCode}</Text>
                    {selected && <Ionicons name="checkmark" size={18} color="#00C870" />}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text className={`py-8 text-center ${subtextColor}`}>No matches</Text>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
