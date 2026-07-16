import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from 'react-native-maps';
import { GeoPoint } from '../../../services/geocoding';
import { LocationPingDto } from '../../../services/live-location';

export type LiveTrackingMapProps = {
  /** Most recent provider fix — the moving marker. */
  latest: LocationPingDto | null;
  /** Route so far, chronological. */
  trail: GeoPoint[];
  isDarkMode: boolean;
};

/**
 * Owner-side live map: the provider's current position + the route walked so far.
 * Fed by useLiveLocationWatcher; the camera follows the latest fix after the
 * initial fit. (Web build: LiveTrackingMap.web.tsx.)
 */
export default function LiveTrackingMap({ latest, trail }: LiveTrackingMapProps) {
  const mapRef = useRef<MapView>(null);
  const didInitialFit = useRef(false);

  useEffect(() => {
    if (!latest) return;
    const target = { latitude: latest.latitude, longitude: latest.longitude };
    if (!didInitialFit.current) {
      didInitialFit.current = true;
      const points = trail.length > 1 ? trail : [target];
      mapRef.current?.fitToCoordinates(points, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: false,
      });
    } else {
      mapRef.current?.animateCamera({ center: target }, { duration: 800 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest?.latitude, latest?.longitude]);

  const initialRegion = latest
    ? {
        latitude: latest.latitude,
        longitude: latest.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }
    : undefined;

  return (
    <View style={{ flex: 1, borderRadius: 16, overflow: 'hidden' }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}>
        {trail.length > 1 ? (
          <Polyline coordinates={trail} strokeColor="#00C870" strokeWidth={4} />
        ) : null}
        {latest ? (
          <Marker
            coordinate={{ latitude: latest.latitude, longitude: latest.longitude }}
            title="Your provider"
            pinColor="#00C870"
            rotation={latest.heading ?? 0}
            anchor={{ x: 0.5, y: 0.5 }}
          />
        ) : null}
      </MapView>
    </View>
  );
}
