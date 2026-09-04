import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, themeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';
import { getCurrentPosition, GeoPoint } from '../../services/geocoding';
import { loadGoogleMaps, DEV_MAP_ID } from '../../services/google-maps';

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
 * Web directions preview — a Google Map showing the destination, the partner's
 * current location, and the driving route between them (OSRM, with a
 * straight-line fallback). A hand-off button opens Google Maps directions in a
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
  const { t, language } = useLocale();
  const { hex } = themeColors(isDarkMode);
  const containerRef = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState<GeoPoint | null>(null);
  const [located, setLocated] = useState(false);
  const [mapError, setMapError] = useState(false);

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

  // Build the map once the destination is known; rebuilt when the origin
  // resolves so the OSRM route and both markers appear.
  useEffect(() => {
    if (!visible || !destination) return;
    let cancelled = false;
    loadGoogleMaps(language)
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        const dest = { lat: destination.latitude, lng: destination.longitude };
        const map = new maps.Map(containerRef.current, {
          center: dest,
          zoom: 14,
          mapId: DEV_MAP_ID,
          disableDefaultUI: true,
          zoomControl: true,
          // Google's default zoom position is bottom-right; keep the old
          // MapLibre/Leaflet top-left placement.
          zoomControlOptions: { position: maps.ControlPosition.LEFT_TOP },
          colorScheme: isDarkMode ? maps.ColorScheme?.DARK : maps.ColorScheme?.LIGHT,
        });
        new maps.marker.AdvancedMarkerElement({
          map,
          position: dest,
          title: t('shared.destination'),
        });
        if (!origin) return;
        const from = { lat: origin.latitude, lng: origin.longitude };
        new maps.marker.AdvancedMarkerElement({
          map,
          position: from,
          title: t('shared.youAreHere'),
        });
        const fit = (path: { lat: number; lng: number }[]) => {
          const bounds = new maps.LatLngBounds();
          path.forEach((p) => bounds.extend(p));
          map.fitBounds(bounds, 50);
        };
        fit([from, dest]);
        // Straight dashed line when no driving route is available.
        const straight = () => {
          new maps.Polyline({
            map,
            path: [from, dest],
            strokeOpacity: 0,
            icons: [
              {
                icon: {
                  path: 'M 0,-1 0,1',
                  strokeOpacity: 1,
                  strokeColor: BRAND_GREEN,
                  strokeWeight: 4,
                  scale: 2,
                },
                offset: '0',
                repeat: '12px',
              },
            ],
          });
          fit([from, dest]);
        };
        fetch(
          `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`
        )
          .then((r) => r.json())
          .then((d) => {
            if (cancelled) return;
            const coords = d?.routes?.[0]?.geometry?.coordinates;
            if (coords?.length) {
              const path = coords.map((p: [number, number]) => ({ lat: p[1], lng: p[0] }));
              new maps.Polyline({ map, path, strokeColor: BRAND_GREEN, strokeWeight: 4 });
              fit(path);
            } else {
              straight();
            }
          })
          .catch(() => {
            if (!cancelled) straight();
          });
      })
      .catch(() => {
        if (!cancelled) setMapError(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, destination, origin]);

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
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            onPress={onClose}
            style={{ marginRight: 12 }}>
            <Ionicons name="close" size={24} color={hex.text} />
          </TouchableOpacity>
          <Text style={{ color: hex.text, fontSize: 18, fontWeight: '700' }}>{title}</Text>
        </View>

        {/* Map */}
        <View style={{ flex: 1 }}>
          {destination && mapError ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="map-outline" size={48} color={hex.subtext} />
              <Text style={{ color: hex.subtext, marginTop: 12 }}>{t('shared.mapLoadFailed')}</Text>
            </View>
          ) : destination ? (
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
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
              <ActivityIndicator size="small" color={BRAND_GREEN} />
              <Text style={{ color: hex.text, marginLeft: 8, fontSize: 13 }}>Finding route…</Text>
            </View>
          ) : null}
        </View>

        {/* Footer */}
        <View style={{ padding: 16, backgroundColor: hex.card }}>
          {destinationLabel ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="location" size={16} color={BRAND_GREEN} />
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
            accessibilityRole="button"
            onPress={openExternal}
            disabled={!destination}
            style={{
              backgroundColor: BRAND_GREEN,
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
