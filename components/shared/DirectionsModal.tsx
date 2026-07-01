import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { themeColors } from '../../hooks/useThemeColors';
import { getCurrentPosition, GeoPoint } from '../../services/geocoding';

export type DirectionsModalProps = {
  visible: boolean;
  title: string;
  /** Where the partner needs to drive (pickup/drop-off location). */
  destination: GeoPoint | null;
  destinationLabel: string;
  isDarkMode: boolean;
  onClose: () => void;
};

const EDGE = { top: 90, right: 70, bottom: 200, left: 70 };

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
 * Best-effort driving route from the public OSRM demo server. Returns the route
 * polyline + distance/duration, or null on any failure (the caller falls back to
 * a straight line). No API key required — fine for this app's scale.
 */
async function fetchRoute(
  o: GeoPoint,
  d: GeoPoint
): Promise<{ coords: GeoPoint[]; km: number; mins: number } | null> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${o.longitude},${o.latitude};${d.longitude},${d.latitude}` +
      `?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const r = data?.routes?.[0];
    if (!r?.geometry?.coordinates) return null;
    const coords: GeoPoint[] = r.geometry.coordinates.map(([lng, lat]: [number, number]) => ({
      latitude: lat,
      longitude: lng,
    }));
    return { coords, km: r.distance / 1000, mins: r.duration / 60 };
  } catch {
    return null;
  }
}

/**
 * In-app directions preview for a live session. Reuses the app's map (react-native
 * -maps native / Leaflet web) to show the partner's current location, the
 * destination pin, and the driving route between them, plus a hand-off button to
 * open the system maps app for turn-by-turn. (Web build: .web.tsx.)
 */
export default function DirectionsModal({
  visible,
  title,
  destination,
  destinationLabel,
  isDarkMode,
  onClose,
}: DirectionsModalProps) {
  const { hex } = themeColors(isDarkMode);
  const mapRef = useRef<MapView>(null);
  const [origin, setOrigin] = useState<GeoPoint | null>(null);
  const [route, setRoute] = useState<GeoPoint[] | null>(null);
  const [summary, setSummary] = useState<{ km: number; mins: number } | null>(null);
  const [loading, setLoading] = useState(false);

  // Resolve the partner's current location + route whenever the picker opens.
  useEffect(() => {
    if (!visible || !destination) return;
    let active = true;
    setLoading(true);
    setRoute(null);
    setSummary(null);
    (async () => {
      const o = await getCurrentPosition();
      if (!active) return;
      setOrigin(o);
      if (o) {
        const r = await fetchRoute(o, destination);
        if (!active) return;
        if (r) {
          setRoute(r.coords);
          setSummary({ km: r.km, mins: r.mins });
        } else {
          setRoute([o, destination]);
          setSummary({ km: haversineKm(o, destination), mins: 0 });
        }
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [visible, destination]);

  const fitAll = () => {
    const pts = [origin, destination].filter(Boolean) as GeoPoint[];
    if (pts.length >= 2)
      mapRef.current?.fitToCoordinates(pts, { edgePadding: EDGE, animated: true });
  };

  // Re-fit once the origin/route resolve (the map may already be ready by then).
  useEffect(() => {
    fitAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, destination]);

  const openExternal = () => {
    if (!destination) return;
    const { latitude, longitude } = destination;
    // Universal Google Maps directions URL — opens the maps app on device and
    // uses the current location as the origin automatically.
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
    Linking.openURL(url).catch(() => {});
  };

  const initialRegion = destination
    ? { ...destination, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : undefined;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: hex.bg }}>
        {/* Header */}
        <View
          style={{
            paddingTop: Platform.OS === 'ios' ? 48 : 24,
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
            <MapView
              ref={mapRef}
              style={{ flex: 1 }}
              provider={PROVIDER_GOOGLE}
              initialRegion={initialRegion}
              onMapReady={fitAll}
              showsUserLocation>
              <Marker
                coordinate={destination}
                title={destinationLabel || 'Destination'}
                pinColor="#00C870"
              />
              {origin ? (
                <Marker coordinate={origin} title="You are here" pinColor="#2563EB" />
              ) : null}
              {route && route.length > 1 ? (
                <Polyline coordinates={route} strokeColor="#00C870" strokeWidth={4} />
              ) : null}
            </MapView>
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="navigate-outline" size={48} color={hex.subtext} />
              <Text style={{ color: hex.subtext, marginTop: 12 }}>No location to navigate to.</Text>
            </View>
          )}
          {loading ? (
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
                elevation: 4,
                shadowColor: '#000',
                shadowOpacity: 0.15,
                shadowRadius: 4,
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
          {summary ? (
            <Text style={{ color: hex.subtext, fontSize: 13, marginBottom: 10 }}>
              {summary.km.toFixed(1)} km away
              {summary.mins ? ` · about ${Math.round(summary.mins)} min by car` : ''}
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
              Open in Maps app
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
