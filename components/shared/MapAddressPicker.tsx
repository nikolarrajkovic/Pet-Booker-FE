import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, themeColors } from '../../hooks/useThemeColors';
import { useTopInset } from '../../hooks/useSafeAreaSpacing';
import { useLocale } from '../../context/LocaleContext';
import {
  reverseGeocodeToAddress,
  searchAddresses,
  getCurrentPosition,
  addressLabel,
  GeoPoint,
  type AddressSuggestion,
  type AddressDetails,
  cleanAddressDetails,
} from '../../services/geocoding';
import AddressDetailsInputs from './AddressDetailsInputs';
import { AddressDto } from '../../services/service-providers';

export type MapAddressPickerProps = {
  visible: boolean;
  title: string;
  initialRegion: GeoPoint;
  /**
   * Jump to the device's position once the picker opens (default). Pass false when
   * `initialRegion` is a place the user already chose — a saved address, a pin already dropped —
   * so the map opens there instead of wherever the device happens to be.
   */
  locateOnOpen?: boolean;
  /**
   * Ask where in the building (entrance, floor, flat, other details) under the pin (default).
   * False for a place that is only where to search from.
   */
  askDetails?: boolean;
  /** The address being changed, whose building details the fields start from. */
  initialAddress?: AddressDto | null;
  isDarkMode: boolean;
  onClose: () => void;
  onSelect: (address: AddressDto, label: string) => void;
};

const DELTA = { latitudeDelta: 0.01, longitudeDelta: 0.01 };

/**
 * Full-screen map picker. The user can type an address to jump to it, or pan the
 * map under a fixed centre pin; on confirm the centre coordinate is
 * reverse-geocoded into the AddressDto the booking endpoint needs. Opens centred
 * on the user's current location when available. (Web build: .web.tsx.)
 */
export default function MapAddressPicker({
  visible,
  title,
  initialRegion,
  locateOnOpen = true,
  askDetails = true,
  initialAddress,
  isDarkMode,
  onClose,
  onSelect,
}: MapAddressPickerProps) {
  const { t } = useLocale();
  const { hex } = themeColors(isDarkMode);
  const topInset = useTopInset();
  const mapRef = useRef<MapView>(null);
  const [center, setCenter] = useState<GeoPoint>(initialRegion);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<AddressSuggestion[] | null>(null);
  const [details, setDetails] = useState<AddressDetails>(() =>
    cleanAddressDetails(initialAddress ?? {})
  );
  const [busy, setBusy] = useState(false);

  const region: Region = { ...initialRegion, ...DELTA };

  const recenter = (p: GeoPoint) => {
    setCenter(p);
    mapRef.current?.animateToRegion({ ...p, ...DELTA }, 500);
  };

  // Centre on the user's current location when the picker opens (unless told where to open).
  useEffect(() => {
    if (!locateOnOpen) return;
    let active = true;
    (async () => {
      const p = await getCurrentPosition();
      if (!active || !p) return;
      setCenter(p);
      mapRef.current?.animateToRegion({ ...p, ...DELTA }, 500);
    })();
    return () => {
      active = false;
    };
  }, [locateOnOpen]);

  // A search lists what matched; the person picks one (the first match used to be taken).
  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      setResults(await searchAddresses(query, center));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const pick = (s: AddressSuggestion) => {
    setResults(null);
    setQuery(s.title);
    recenter(s.point);
  };

  const locateMe = async () => {
    const p = await getCurrentPosition();
    if (p) recenter(p);
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const found = await reverseGeocodeToAddress(center);
      const address = askDetails ? { ...found, ...cleanAddressDetails(details) } : found;
      onSelect(address, addressLabel(address));
      onClose();
    } catch {
      // Leave the picker open so the user can retry.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: hex.bg }}>
        {/* Header */}
        <View
          style={{
            // A full-screen Modal covers the status bar, so its own header has to clear it. This
            // was a fixed 48 — one device's status bar written down as a constant.
            paddingTop: topInset + 12,
            paddingHorizontal: 16,
            paddingBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: hex.card,
          }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            onPress={onClose}
            style={{ marginRight: 12 }}>
            <Ionicons name="close" size={24} color={hex.text} />
          </TouchableOpacity>
          <Text style={{ color: hex.text, fontSize: 18, fontWeight: '700' }}>{title}</Text>
        </View>

        {/* Search */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 12, backgroundColor: hex.card }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: hex.inputBg,
              borderRadius: 12,
              paddingHorizontal: 12,
            }}>
            <Ionicons name="search" size={18} color={hex.subtext} />
            <TextInput
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                setResults(null);
              }}
              onSubmitEditing={runSearch}
              returnKeyType="search"
              placeholder={t('shared.searchAddress')}
              placeholderTextColor={hex.subtext}
              style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, color: hex.text }}
            />
            {searching ? (
              <ActivityIndicator color={BRAND_GREEN} />
            ) : query.trim() ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('common.search')}
                onPress={runSearch}
                hitSlop={8}>
                <Ionicons name="arrow-forward-circle" size={26} color={BRAND_GREEN} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Map + fixed centre pin */}
        <View style={{ flex: 1 }}>
          {results ? (
            <View
              testID="address-suggestions"
              style={{
                position: 'absolute',
                top: 0,
                left: 16,
                right: 16,
                backgroundColor: hex.card,
                borderRadius: 12,
                paddingVertical: 4,
                elevation: 6,
                shadowColor: '#000',
                shadowOpacity: 0.18,
                shadowRadius: 8,
                zIndex: 10,
              }}>
              {results.length === 0 ? (
                <Text style={{ color: hex.subtext, padding: 14 }}>
                  {t('shared.noAddressMatch')}
                </Text>
              ) : (
                results.map((s, index) => (
                  <TouchableOpacity
                    key={`${s.point.latitude},${s.point.longitude},${index}`}
                    accessibilityRole="button"
                    onPress={() => pick(s)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderTopWidth: index > 0 ? 1 : 0,
                      borderTopColor: hex.border,
                    }}>
                    <Ionicons name="location-outline" size={18} color={BRAND_GREEN} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{ color: hex.text, fontWeight: '600' }} numberOfLines={1}>
                        {s.title}
                      </Text>
                      {s.subtitle ? (
                        <Text style={{ color: hex.subtext, fontSize: 12 }} numberOfLines={1}>
                          {s.subtitle}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          ) : null}
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            provider={PROVIDER_GOOGLE}
            initialRegion={region}
            onRegionChangeComplete={(r) =>
              setCenter({ latitude: r.latitude, longitude: r.longitude })
            }
            showsUserLocation
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="location" size={42} color={BRAND_GREEN} style={{ marginBottom: 42 }} />
          </View>
          <TouchableOpacity
            accessibilityLabel={t('common.useMyLocation')}
            accessibilityRole="button"
            onPress={locateMe}
            style={{
              position: 'absolute',
              right: 16,
              bottom: 16,
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: hex.card,
              alignItems: 'center',
              justifyContent: 'center',
              elevation: 4,
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 4,
            }}>
            <Ionicons name="locate" size={22} color={BRAND_GREEN} />
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={{ padding: 16, backgroundColor: hex.card }}>
          <Text style={{ color: hex.subtext, fontSize: 13, marginBottom: 10, textAlign: 'center' }}>
            {t('shared.mapPickerHint')}
          </Text>
          {askDetails ? (
            <AddressDetailsInputs value={details} onChange={setDetails} isDarkMode={isDarkMode} />
          ) : null}
          <TouchableOpacity
            accessibilityRole="button"
            onPress={confirm}
            disabled={busy}
            style={{
              backgroundColor: BRAND_GREEN,
              paddingVertical: 16,
              borderRadius: 16,
              alignItems: 'center',
              opacity: busy ? 0.7 : 1,
            }}>
            {busy ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>
                {t('shared.confirmLocation')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
