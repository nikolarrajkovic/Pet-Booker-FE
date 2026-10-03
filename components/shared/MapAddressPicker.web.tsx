import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, themeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';
import {
  reverseGeocodeToAddress,
  forwardGeocode,
  getCurrentPosition,
  addressLabel,
  GeoPoint,
} from '../../services/geocoding';
import { AddressDto } from '../../services/service-providers';
import { createWebMap, type WebMap } from '../../services/web-map';

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
  isDarkMode: boolean;
  onClose: () => void;
  onSelect: (address: AddressDto, label: string) => void;
};

/**
 * Web map picker — a Google Map rendered into a plain div (OpenStreetMap via Leaflet when
 * Google is unavailable, see services/web-map.ts). The user can type an
 * address to jump to it, or pan the map under a fixed centre pin. On confirm the
 * centre is reverse-geocoded (Nominatim) into the booking AddressDto. Opens
 * centred on the user's current location when available.
 * (Native build: MapAddressPicker.tsx.)
 */
export default function MapAddressPicker({
  visible,
  title,
  initialRegion,
  locateOnOpen = true,
  isDarkMode,
  onClose,
  onSelect,
}: MapAddressPickerProps) {
  const { t, language } = useLocale();
  const { hex } = themeColors(isDarkMode);
  // State, not a ref: the div mounts inside the modal's portal, possibly a commit after `visible`
  // flips, and the map must be built once it exists.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const mapRef = useRef<WebMap | null>(null);
  const pendingRef = useRef<GeoPoint | null>(null);
  const [center, setCenter] = useState<GeoPoint>(initialRegion);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mapError, setMapError] = useState(false);

  const applyToMap = (p: GeoPoint) => {
    const map = mapRef.current;
    if (map) {
      map.setCenter({ lat: p.latitude, lng: p.longitude }, 16);
    } else {
      pendingRef.current = p;
    }
  };

  const recenter = (p: GeoPoint) => {
    setCenter(p);
    applyToMap(p);
  };

  // Create the map when the modal opens (the div only exists while visible).
  useEffect(() => {
    if (!visible || !container) {
      mapRef.current = null;
      return;
    }
    let cancelled = false;
    let created: WebMap | null = null;
    createWebMap(container, {
      center: { lat: center.latitude, lng: center.longitude },
      zoom: 15,
      language,
      isDarkMode,
    })
      .then((map) => {
        if (cancelled) {
          map.destroy();
          return;
        }
        created = map;
        // Track the centre under the fixed pin after every pan/zoom settles.
        map.onIdle(() => {
          const c = map.getCenter();
          setCenter({ latitude: c.lat, longitude: c.lng });
        });
        mapRef.current = map;
        if (pendingRef.current) {
          applyToMap(pendingRef.current);
          pendingRef.current = null;
        }
      })
      .catch(() => {
        if (!cancelled) setMapError(true);
      });
    return () => {
      cancelled = true;
      mapRef.current = null;
      created?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, container]);

  // Centre on the user's current location when the picker opens (unless told where to open).
  useEffect(() => {
    if (!locateOnOpen) return;
    let active = true;
    (async () => {
      const p = await getCurrentPosition();
      if (!active || !p) return;
      recenter(p);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const p = await forwardGeocode(query);
      if (p) recenter(p);
    } finally {
      setSearching(false);
    }
  };

  const locateMe = async () => {
    const p = await getCurrentPosition();
    if (p) recenter(p);
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const address = await reverseGeocodeToAddress(center);
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
            paddingTop: 24,
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
              onChangeText={setQuery}
              onSubmitEditing={runSearch}
              returnKeyType="search"
              placeholder={t('shared.searchAddress')}
              placeholderTextColor={hex.subtext}
              style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, color: hex.text } as any}
            />
            {searching ? <ActivityIndicator color={BRAND_GREEN} /> : null}
          </View>
        </View>

        {/* Map + fixed centre pin */}
        <View style={{ flex: 1 }}>
          {mapError ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="map-outline" size={48} color={hex.subtext} />
              <Text style={{ color: hex.subtext, marginTop: 12 }}>{t('shared.mapLoadFailed')}</Text>
            </View>
          ) : (
            <div ref={setContainer} style={{ width: '100%', height: '100%' }} />
          )}
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
