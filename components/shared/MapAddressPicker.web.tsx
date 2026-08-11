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
import { loadGoogleMaps, DEV_MAP_ID } from '../../services/google-maps';

export type MapAddressPickerProps = {
  visible: boolean;
  title: string;
  initialRegion: GeoPoint;
  isDarkMode: boolean;
  onClose: () => void;
  onSelect: (address: AddressDto, label: string) => void;
};

/**
 * Web map picker — a Google Map rendered into a plain div. The user can type an
 * address to jump to it, or pan the map under a fixed centre pin. On confirm the
 * centre is reverse-geocoded (Nominatim) into the booking AddressDto. Opens
 * centred on the user's current location when available.
 * (Native build: MapAddressPicker.tsx.)
 */
export default function MapAddressPicker({
  visible,
  title,
  initialRegion,
  isDarkMode,
  onClose,
  onSelect,
}: MapAddressPickerProps) {
  const { t, language } = useLocale();
  const { hex } = themeColors(isDarkMode);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const pendingRef = useRef<GeoPoint | null>(null);
  const [center, setCenter] = useState<GeoPoint>(initialRegion);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mapError, setMapError] = useState(false);

  const applyToMap = (p: GeoPoint) => {
    const map = mapRef.current;
    if (map) {
      map.setCenter({ lat: p.latitude, lng: p.longitude });
      map.setZoom(16);
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
    if (!visible) {
      mapRef.current = null;
      return;
    }
    let cancelled = false;
    loadGoogleMaps(language)
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        const map = new maps.Map(containerRef.current, {
          center: { lat: center.latitude, lng: center.longitude },
          zoom: 15,
          mapId: DEV_MAP_ID,
          disableDefaultUI: true,
          zoomControl: true,
          // Google's default zoom position is bottom-right, which collides with
          // the "locate me" button; keep the old MapLibre top-left placement.
          zoomControlOptions: { position: maps.ControlPosition.LEFT_TOP },
          colorScheme: isDarkMode ? maps.ColorScheme?.DARK : maps.ColorScheme?.LIGHT,
        });
        // Track the centre under the fixed pin after every pan/zoom settles.
        map.addListener('idle', () => {
          const c = map.getCenter();
          if (c) setCenter({ latitude: c.lat(), longitude: c.lng() });
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Centre on the user's current location when the picker opens.
  useEffect(() => {
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
          <TouchableOpacity onPress={onClose} style={{ marginRight: 12 }}>
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
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
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
            Search, or move the map to place the pin on the exact spot.
          </Text>
          <TouchableOpacity
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
