import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GeoPoint } from '../../../services/geocoding';
import { haversineKm } from '../../../services/distance';
import { fetchRoutePath } from '../../../services/route-path';
import { loadGoogleMaps, DEV_MAP_ID } from '../../../services/google-maps';
import { themeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';

export type LiveDirectionsMapProps = {
  /** Moving end of the route: the partner's GPS, or the tracked provider. */
  origin: GeoPoint | null;
  /**
   * The location lookup finished without a position (permission denied, timed
   * out, unavailable) — as opposed to still resolving. Drives the Retry state.
   */
  originFailed?: boolean;
  onRetryLocate?: () => void;
  destination: GeoPoint | null;
  destinationLabel: string;
  /** Path already travelled — drawn faded behind the route (booker mode). */
  trail?: GeoPoint[];
  /** Title of the moving marker. Defaults to "You are here" (partner mode). */
  originLabel?: string;
  /** Overlay text while the origin resolves. Defaults to "Locating you…". */
  waitingLabel?: string;
  /** Reports the resolved route's distance/ETA so the parent can label it. */
  onRouteSummary?: (summary: { km: number; mins: number | null } | null) => void;
  isDarkMode: boolean;
};

const REROUTE_THRESHOLD_KM = 0.08;

/** Floating status pill centred over the map (locating / error). */
const chipStyle = (bg: string) =>
  ({
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: bg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  }) as const;

/** A small blue dot for the moving position (Advanced Marker content). */
function makeYouDot(): HTMLDivElement {
  const dot = document.createElement('div');
  dot.style.width = '16px';
  dot.style.height = '16px';
  dot.style.borderRadius = '50%';
  dot.style.background = '#2563EB';
  dot.style.border = '3px solid #fff';
  dot.style.boxShadow = '0 0 0 2px rgba(37,99,235,0.35)';
  return dot;
}

/**
 * Inline live-session directions map (web), shared by both sides of a booking: a
 * Google Map built ONCE and mutated in place — the moving marker follows the
 * origin (the partner's own GPS, or the tracked provider's position for the
 * booker), the destination pin marks the route end, and the driving route (OSRM,
 * with a straight-line fallback) is re-pathed as things change. Mutating in place
 * (instead of rebuilding) keeps the map smooth as fixes stream in.
 * (Native build: LiveDirectionsMap.tsx.)
 */
export default function LiveDirectionsMap({
  origin,
  originFailed,
  onRetryLocate,
  destination,
  destinationLabel,
  trail,
  originLabel,
  waitingLabel,
  onRouteSummary,
  isDarkMode,
}: LiveDirectionsMapProps) {
  const { t, language } = useLocale();
  const { hex } = themeColors(isDarkMode);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapsRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const youMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const trailPolylineRef = useRef<any>(null);
  const fittedRef = useRef(false);
  // Zoom is applied only on the first destination-less centring so the viewer can
  // still zoom out while the camera follows the moving marker.
  const zoomedRef = useRef(false);
  const routedFrom = useRef<GeoPoint | null>(null);
  const routedTo = useRef<GeoPoint | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  // Build the map once.
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps(language)
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        const map = new maps.Map(containerRef.current, {
          center: { lat: 44.8176, lng: 20.457 },
          zoom: 13,
          mapId: DEV_MAP_ID,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: { position: maps.ControlPosition.LEFT_TOP },
          colorScheme: isDarkMode ? maps.ColorScheme?.DARK : maps.ColorScheme?.LIGHT,
        });
        mapsRef.current = maps;
        mapRef.current = map;
        // Travelled path sits under the route so the road ahead stays dominant.
        trailPolylineRef.current = new maps.Polyline({
          map,
          path: [],
          strokeColor: '#2563EB',
          strokeOpacity: 0.35,
          strokeWeight: 3,
        });
        polylineRef.current = new maps.Polyline({
          map,
          path: [],
          strokeColor: '#00C870',
          strokeWeight: 4,
        });
        setMapReady(true);
      })
      .catch(() => {
        if (!cancelled) setMapError(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Place / move the destination pin and reset the fit when it changes.
  useEffect(() => {
    if (!mapReady) return;
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!destination) {
      if (destMarkerRef.current) destMarkerRef.current.map = null;
      destMarkerRef.current = null;
      polylineRef.current?.setPath([]);
      routedFrom.current = null;
      routedTo.current = null;
      onRouteSummary?.(null);
      return;
    }
    const pos = { lat: destination.latitude, lng: destination.longitude };
    if (!destMarkerRef.current) {
      const pin = new maps.marker.PinElement({
        background: '#00C870',
        borderColor: '#00A85A',
        glyphColor: '#ffffff',
      });
      destMarkerRef.current = new maps.marker.AdvancedMarkerElement({
        map,
        position: pos,
        title: destinationLabel || t('shared.destination'),
        content: pin.element,
      });
    } else {
      destMarkerRef.current.position = pos;
      destMarkerRef.current.title = destinationLabel || t('shared.destination');
    }
    // A new destination re-frames the map next time the route resolves.
    fittedRef.current = false;
    if (!origin) {
      map.setCenter(pos);
    }
    // `origin` is read but intentionally NOT a dep: this effect owns the
    // destination pin, and re-running it on every GPS tick would reset the fit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, destination, destinationLabel]);

  // Draw the travelled path behind the route (booker mode).
  useEffect(() => {
    if (!mapReady || !trailPolylineRef.current) return;
    trailPolylineRef.current.setPath(
      (trail ?? []).map((p) => ({ lat: p.latitude, lng: p.longitude }))
    );
  }, [mapReady, trail]);

  // Move the marker and (throttled) re-fetch + draw the driving route.
  useEffect(() => {
    if (!mapReady || !origin) return;
    const maps = mapsRef.current;
    const map = mapRef.current;
    const pos = { lat: origin.latitude, lng: origin.longitude };
    if (!youMarkerRef.current) {
      youMarkerRef.current = new maps.marker.AdvancedMarkerElement({
        map,
        position: pos,
        title: originLabel || t('shared.youAreHere'),
        content: makeYouDot(),
      });
    } else {
      youMarkerRef.current.position = pos;
    }

    if (!destination) {
      // Nothing to frame — follow the moving marker instead.
      map.panTo(pos);
      if (!zoomedRef.current) {
        zoomedRef.current = true;
        map.setZoom(15);
      }
      return;
    }

    const destChanged =
      !routedTo.current ||
      routedTo.current.latitude !== destination.latitude ||
      routedTo.current.longitude !== destination.longitude;
    const movedFar =
      !routedFrom.current || haversineKm(routedFrom.current, origin) > REROUTE_THRESHOLD_KM;
    if (!destChanged && !movedFar) return;

    let cancelled = false;
    (async () => {
      const path = await fetchRoutePath(origin, destination);
      if (cancelled || !polylineRef.current) return;
      routedFrom.current = origin;
      routedTo.current = destination;
      polylineRef.current.setPath(path.coords.map((p) => ({ lat: p.latitude, lng: p.longitude })));
      onRouteSummary?.({ km: path.km, mins: path.mins });
      if (!fittedRef.current) {
        fittedRef.current = true;
        const bounds = new maps.LatLngBounds();
        path.coords.forEach((p) => bounds.extend({ lat: p.latitude, lng: p.longitude }));
        map.fitBounds(bounds, 50);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, origin, destination]);

  return (
    <View style={{ flex: 1, borderRadius: 16, overflow: 'hidden' }}>
      {mapError ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="map-outline" size={40} color={hex.subtext} />
          <Text style={{ color: hex.subtext, marginTop: 10 }}>{t('shared.mapLoadFailed')}</Text>
        </View>
      ) : (
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      )}
      {!mapError && !origin ? (
        <View style={chipStyle(hex.card)}>
          {originFailed ? (
            <>
              <Ionicons name="location-outline" size={14} color="#F97316" />
              <Text style={{ color: hex.text, marginLeft: 6, fontSize: 12 }}>
                {t('liveSession.locationUnavailable')}
              </Text>
              {onRetryLocate ? (
                <TouchableOpacity onPress={onRetryLocate} style={{ marginLeft: 10 }}>
                  <Text style={{ color: '#00A85A', fontSize: 12, fontWeight: '700' }}>
                    {t('common.retry')}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : (
            <>
              <ActivityIndicator size="small" color="#00C870" />
              <Text style={{ color: hex.text, marginLeft: 8, fontSize: 12 }}>
                {waitingLabel || t('liveSession.locatingYou')}
              </Text>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}
