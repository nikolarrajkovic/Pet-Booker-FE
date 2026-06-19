import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { themeColors } from '../../hooks/useThemeColors';
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

/**
 * Web map picker — a Leaflet map in an iframe. The user can type an address to
 * jump to it, or pan the map under a fixed centre pin. The iframe reports its
 * centre on every pan and accepts re-centre messages (search / locate / current
 * location). On confirm the centre is reverse-geocoded (Nominatim) into the
 * booking AddressDto. Opens centred on the user's current location when available.
 */
export default function MapAddressPicker({
  visible,
  title,
  initialRegion,
  isDarkMode,
  onClose,
  onSelect,
}: MapAddressPickerProps) {
  const { hex } = themeColors(isDarkMode);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<GeoPoint | null>(null);
  const [center, setCenter] = useState<GeoPoint>(initialRegion);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);

  const postToMap = (p: GeoPoint) => {
    const w = iframeRef.current?.contentWindow;
    if (readyRef.current && w) {
      w.postMessage({ type: 'pb-set-center', lat: p.latitude, lng: p.longitude }, '*');
    } else {
      pendingRef.current = p;
    }
  };

  const recenter = (p: GeoPoint) => {
    setCenter(p);
    postToMap(p);
  };

  // Listen for centre updates and the map-ready handshake from the iframe.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === 'pb-map-center' && typeof d.lat === 'number') {
        setCenter({ latitude: d.lat, longitude: d.lng });
      } else if (d.type === 'pb-map-ready') {
        readyRef.current = true;
        if (pendingRef.current) {
          postToMap(pendingRef.current);
          pendingRef.current = null;
        }
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Centre on the user's current location when the picker opens.
  useEffect(() => {
    let active = true;
    (async () => {
      const p = await getCurrentPosition();
      if (!active || !p) return;
      setCenter(p);
      postToMap(p);
    })();
    return () => {
      active = false;
    };
  }, []);

  const srcdoc = useMemo(
    () => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <style>html,body,#map{margin:0;padding:0;width:100%;height:100%}</style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map', { zoomControl: true }).setView([${initialRegion.latitude}, ${initialRegion.longitude}], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    function postCenter() {
      const c = map.getCenter();
      parent.postMessage({ type: 'pb-map-center', lat: c.lat, lng: c.lng }, '*');
    }
    map.on('moveend', postCenter);
    window.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'pb-set-center') {
        map.setView([e.data.lat, e.data.lng], 16);
      }
    });
    parent.postMessage({ type: 'pb-map-ready' }, '*');
    postCenter();
  </script>
</body>
</html>`,
    [initialRegion.latitude, initialRegion.longitude],
  );

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
        <View style={{ paddingTop: 24, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: hex.card }}>
          <TouchableOpacity onPress={onClose} style={{ marginRight: 12 }}>
            <Ionicons name="close" size={24} color={hex.text} />
          </TouchableOpacity>
          <Text style={{ color: hex.text, fontSize: 18, fontWeight: '700' }}>{title}</Text>
        </View>

        {/* Search */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 12, backgroundColor: hex.card }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: hex.inputBg, borderRadius: 12, paddingHorizontal: 12 }}>
            <Ionicons name="search" size={18} color={hex.subtext} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={runSearch}
              returnKeyType="search"
              placeholder="Search address or place"
              placeholderTextColor={hex.subtext}
              style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, color: hex.text } as any}
            />
            {searching ? <ActivityIndicator color="#00C870" /> : null}
          </View>
        </View>

        {/* Map + fixed centre pin */}
        <View style={{ flex: 1 }}>
          <iframe ref={iframeRef} srcDoc={srcdoc} style={{ border: 0, width: '100%', height: '100%' }} title="Pick location" />
          <View
            pointerEvents="none"
            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="location" size={42} color="#00C870" style={{ marginBottom: 42 }} />
          </View>
          <TouchableOpacity
            onPress={locateMe}
            style={{ position: 'absolute', right: 16, bottom: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: hex.card, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4 }}
          >
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
            style={{ backgroundColor: '#00C870', paddingVertical: 16, borderRadius: 16, alignItems: 'center', opacity: busy ? 0.7 : 1 }}
          >
            {busy ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>Confirm location</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
