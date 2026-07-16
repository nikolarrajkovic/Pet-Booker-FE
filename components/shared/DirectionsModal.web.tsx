import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { themeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';
import { getCurrentPosition, GeoPoint } from '../../services/geocoding';

export type DirectionsModalProps = {
  visible: boolean;
  title: string;
  destination: GeoPoint | null;
  destinationLabel: string;
  isDarkMode: boolean;
  onClose: () => void;
};

function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Web directions preview — a Leaflet map in an iframe showing the destination,
 * the partner's current location, and the driving route between them (OSRM, with
 * a straight-line fallback). A hand-off button opens Google Maps directions in a
 * new tab for turn-by-turn. (Native build: DirectionsModal.tsx.)
 */
export default function DirectionsModal({
  visible,
  title,
  destination,
  destinationLabel,
  isDarkMode,
  onClose,
}: DirectionsModalProps) {
  const { t } = useLocale();
  const { hex } = themeColors(isDarkMode);
  const [origin, setOrigin] = useState<GeoPoint | null>(null);
  const [located, setLocated] = useState(false);

  // Resolve the partner's current location when the picker opens.
  useEffect(() => {
    if (!visible || !destination) return;
    let active = true;
    setLocated(false);
    setOrigin(null);
    (async () => {
      const o = await getCurrentPosition();
      if (!active) return;
      setOrigin(o);
      setLocated(true);
    })();
    return () => {
      active = false;
    };
  }, [visible, destination]);

  const km = origin && destination ? haversineKm(origin, destination) : null;

  // The map only renders once the destination is known; the origin (if any) is
  // baked in so the iframe can fetch the OSRM route and fit both points.
  const srcdoc = useMemo(() => {
    if (!destination) return '';
    const hasOrigin = !!origin;
    const o = origin ?? destination;
    return `<!DOCTYPE html>
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
    const dest = [${destination.latitude}, ${destination.longitude}];
    const hasOrigin = ${hasOrigin ? 'true' : 'false'};
    const origin = [${o.latitude}, ${o.longitude}];
    const map = L.map('map', { zoomControl: true }).setView(dest, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    L.marker(dest).addTo(map).bindPopup('Destination');
    function straight() {
      L.polyline([origin, dest], { color: '#00C870', weight: 4, dashArray: '6' }).addTo(map);
      map.fitBounds([origin, dest], { padding: [60, 60] });
    }
    if (hasOrigin) {
      L.marker(origin).addTo(map).bindPopup('You are here');
      map.fitBounds([origin, dest], { padding: [60, 60] });
      fetch('https://router.project-osrm.org/route/v1/driving/' + ${o.longitude} + ',' + ${o.latitude} + ';' + ${destination.longitude} + ',' + ${destination.latitude} + '?overview=full&geometries=geojson')
        .then(function (r) { return r.json(); })
        .then(function (d) {
          const c = d && d.routes && d.routes[0] && d.routes[0].geometry && d.routes[0].geometry.coordinates;
          if (c && c.length) {
            const latlngs = c.map(function (p) { return [p[1], p[0]]; });
            L.polyline(latlngs, { color: '#00C870', weight: 4 }).addTo(map);
            map.fitBounds(latlngs, { padding: [50, 50] });
          } else { straight(); }
        })
        .catch(function () { straight(); });
    }
  </script>
</body>
</html>`;
  }, [destination, origin]);

  const openExternal = () => {
    if (!destination) return;
    const { latitude, longitude } = destination;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
    Linking.openURL(url).catch(() => {});
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

        {/* Map */}
        <View style={{ flex: 1 }}>
          {destination ? (
            <iframe
              key={srcdoc.length}
              srcDoc={srcdoc}
              style={{ border: 0, width: '100%', height: '100%' }}
              title="Directions"
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="navigate-outline" size={48} color={hex.subtext} />
              <Text style={{ color: hex.subtext, marginTop: 12 }}>
                {t('shared.noNavigationTarget')}
              </Text>
            </View>
          )}
          {destination && !located ? (
            <View
              style={{
                position: 'absolute',
                top: 12,
                alignSelf: 'center',
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: hex.card,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
              }}>
              <ActivityIndicator size="small" color="#00C870" />
              <Text style={{ color: hex.text, marginLeft: 8, fontSize: 13 }}>Finding route…</Text>
            </View>
          ) : null}
        </View>

        {/* Footer */}
        <View style={{ padding: 16, backgroundColor: hex.card }}>
          {destinationLabel ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="location" size={16} color="#00C870" />
              <Text
                style={{ color: hex.text, fontSize: 14, marginLeft: 6, flex: 1 }}
                numberOfLines={2}>
                {destinationLabel}
              </Text>
            </View>
          ) : null}
          {km != null ? (
            <Text style={{ color: hex.subtext, fontSize: 13, marginBottom: 10 }}>
              {km.toFixed(1)} km away
            </Text>
          ) : null}
          <TouchableOpacity
            onPress={openExternal}
            disabled={!destination}
            style={{
              backgroundColor: '#00C870',
              paddingVertical: 16,
              borderRadius: 16,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              opacity: destination ? 1 : 0.6,
            }}>
            <Ionicons name="navigate" size={18} color="white" />
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '700', marginLeft: 8 }}>
              Open in Google Maps
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
