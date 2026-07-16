import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { themeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';
import {
  reverseGeocodeToAddress,
  forwardGeocode,
  getCurrentPosition,
  addressLabel,
  GeoPoint,
} from '../../services/geocoding';
import { AddressDto } from '../../services/service-providers';

export type MapAddressPickerProps = {
  visible: boolean;
  title: string;
  initialRegion: GeoPoint;
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
  isDarkMode,
  onClose,
  onSelect,
}: MapAddressPickerProps) {
  const { t } = useLocale();
  const { hex } = themeColors(isDarkMode);
  const mapRef = useRef<MapView>(null);
  const [center, setCenter] = useState<GeoPoint>(initialRegion);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);

  const region: Region = { ...initialRegion, ...DELTA };

  const recenter = (p: GeoPoint) => {
    setCenter(p);
    mapRef.current?.animateToRegion({ ...p, ...DELTA }, 500);
  };

  // Centre on the user's current location when the picker opens.
  useEffect(() => {
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
            paddingTop: 48,
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
              style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, color: hex.text }}
            />
            {searching ? <ActivityIndicator color="#00C870" /> : null}
          </View>
        </View>

        {/* Map + fixed centre pin */}
        <View style={{ flex: 1 }}>
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
            <Ionicons name="location" size={42} color="#00C870" style={{ marginBottom: 42 }} />
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
            <Ionicons name="locate" size={22} color="#00C870" />
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
              backgroundColor: '#00C870',
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
