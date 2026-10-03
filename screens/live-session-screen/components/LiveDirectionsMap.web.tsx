import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GeoPoint } from '../../../services/geocoding';
import { haversineKm } from '../../../services/distance';
import { fetchRoutePath } from '../../../services/route-path';
import {
  createWebMap,
  type MarkerVisual,
  type WebMap,
  type WebMapLine,
  type WebMapMarker,
} from '../../../services/web-map';
import { BRAND_GREEN, themeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import { DEFAULT_LOCATION } from '../../../hooks/useLocation';

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

/** A small blue dot for the moving position. */
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

const youDot = (): MarkerVisual => ({
  kind: 'element',
  element: makeYouDot(),
  width: 22,
  height: 22,
});
const DEST_PIN: MarkerVisual = { kind: 'pin', color: BRAND_GREEN };

/**
 * Inline live-session directions map (web), shared by both sides of a booking: a
 * Google Map (OpenStreetMap via Leaflet when Google is unavailable, see
 * services/web-map.ts) built ONCE and mutated in place — the moving marker follows the
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
  const mapRef = useRef<WebMap | null>(null);
  const youMarkerRef = useRef<WebMapMarker | null>(null);
  const destMarkerRef = useRef<WebMapMarker | null>(null);
  const polylineRef = useRef<WebMapLine | null>(null);
  const trailPolylineRef = useRef<WebMapLine | null>(null);
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
    let created: WebMap | null = null;
    if (!containerRef.current) return;
    createWebMap(containerRef.current, {
      center: { lat: DEFAULT_LOCATION.latitude, lng: DEFAULT_LOCATION.longitude },
      zoom: 13,
      language,
      isDarkMode,
    })
      .then((map) => {
        if (cancelled) {
          map.destroy();
          return;
        }
        created = map;
        mapRef.current = map;
        // Travelled path sits under the route so the road ahead stays dominant.
        trailPolylineRef.current = map.addLine({
          path: [],
          color: '#2563EB',
          opacity: 0.35,
          weight: 3,
        });
        polylineRef.current = map.addLine({ path: [], color: BRAND_GREEN, weight: 4 });
        setMapReady(true);
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
  }, []);

  // Place / move the destination pin and reset the fit when it changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    if (!destination) {
      destMarkerRef.current?.remove();
      destMarkerRef.current = null;
      polylineRef.current?.setPath([]);
      routedFrom.current = null;
      routedTo.current = null;
      onRouteSummary?.(null);
      return;
    }
    const pos = { lat: destination.latitude, lng: destination.longitude };
    if (!destMarkerRef.current) {
      destMarkerRef.current = map.addMarker({
        position: pos,
        title: destinationLabel || t('shared.destination'),
        visual: DEST_PIN,
      });
    } else {
      destMarkerRef.current.setPosition(pos);
      destMarkerRef.current.setTitle(destinationLabel || t('shared.destination'));
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
    const map = mapRef.current;
    if (!mapReady || !map || !origin) return;
    const pos = { lat: origin.latitude, lng: origin.longitude };
    if (!youMarkerRef.current) {
      youMarkerRef.current = map.addMarker({
        position: pos,
        title: originLabel || t('shared.youAreHere'),
        visual: youDot(),
      });
    } else {
      youMarkerRef.current.setPosition(pos);
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
        map.fitBounds(
          path.coords.map((p) => ({ lat: p.latitude, lng: p.longitude })),
          50
        );
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
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={onRetryLocate}
                  style={{ marginLeft: 10 }}>
                  <Text style={{ color: '#00A85A', fontSize: 12, fontWeight: '700' }}>
                    {t('common.retry')}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : (
            <>
              <ActivityIndicator size="small" color={BRAND_GREEN} />
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
