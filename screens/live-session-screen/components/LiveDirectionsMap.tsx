import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { GeoPoint } from '../../../services/geocoding';
import { haversineKm } from '../../../services/distance';
import { fetchRoutePath } from '../../../services/route-path';
import { BRAND_GREEN, themeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';

export type LiveDirectionsMapProps = {
  /**
   * The moving end of the route: the partner's own GPS in partner mode, the
   * provider's streamed position in booker mode.
   */
  origin: GeoPoint | null;
  /**
   * The location lookup finished without a position (permission denied, timed
   * out, unavailable). Distinguishes a real failure from "still resolving" so
   * the overlay can offer Retry instead of spinning forever.
   */
  originFailed?: boolean;
  onRetryLocate?: () => void;
  /** The selected pickup/drop-off location — the destination pin + route end. */
  destination: GeoPoint | null;
  destinationLabel: string;
  /**
   * Path already travelled, chronological — drawn faded behind the route. Used
   * booker-side to show where the provider has been (from the tracking trail).
   */
  trail?: GeoPoint[];
  /** Title of the moving marker. Defaults to "You are here" (partner mode). */
  originLabel?: string;
  /** Overlay text while the origin resolves. Defaults to "Locating you…". */
  waitingLabel?: string;
  /** Reports the resolved route's distance/ETA so the parent can label it. */
  onRouteSummary?: (summary: { km: number; mins: number | null } | null) => void;
  isDarkMode: boolean;
};

const EDGE = { top: 50, right: 50, bottom: 50, left: 50 };
// Re-fetch the driving route only after the partner has moved this far since the
// last route request — the GPS stream ticks every few seconds, and re-routing on
// every tick would hammer the OSRM demo server for no visible gain.
const REROUTE_THRESHOLD_KM = 0.08;

/** Floating status pill centred over the map (locating / route / error). */
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
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
  }) as const;

/**
 * Inline live-session directions map, shared by both sides of a booking: it draws
 * the driving road from a moving origin to a fixed destination, with a marker at
 * each end. Partner mode routes their own GPS to the selected pickup/drop-off;
 * booker mode routes the provider's streamed position to the booker's location
 * (plus the trail the provider has already covered). The route re-draws when the
 * destination changes and refreshes as the origin moves.
 * (Web build: LiveDirectionsMap.web.tsx.)
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
  const { t } = useLocale();
  const { hex } = themeColors(isDarkMode);
  const mapRef = useRef<MapView>(null);
  const [route, setRoute] = useState<GeoPoint[] | null>(null);
  // The origin/destination the current route was computed for — used to throttle
  // re-fetches to real destination changes + meaningful origin movement.
  const routedFrom = useRef<GeoPoint | null>(null);
  const routedTo = useRef<GeoPoint | null>(null);

  useEffect(() => {
    if (!destination) {
      setRoute(null);
      routedFrom.current = null;
      routedTo.current = null;
      onRouteSummary?.(null);
      return;
    }
    if (!origin) return;
    const destChanged =
      !routedTo.current ||
      routedTo.current.latitude !== destination.latitude ||
      routedTo.current.longitude !== destination.longitude;
    const movedFar =
      !routedFrom.current || haversineKm(routedFrom.current, origin) > REROUTE_THRESHOLD_KM;
    if (!destChanged && !movedFar) return;

    let active = true;
    (async () => {
      const path = await fetchRoutePath(origin, destination);
      if (!active) return;
      routedFrom.current = origin;
      routedTo.current = destination;
      setRoute(path.coords);
      onRouteSummary?.({ km: path.km, mins: path.mins });
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, destination]);

  // Frame the whole route (or both endpoints) when the destination or route
  // changes — but not on every origin tick, so the camera doesn't jitter while
  // the partner drives.
  useEffect(() => {
    if (!destination) return;
    const pts =
      route && route.length > 1 ? route : ([origin, destination].filter(Boolean) as GeoPoint[]);
    if (pts.length >= 2) {
      mapRef.current?.fitToCoordinates(pts, { edgePadding: EDGE, animated: true });
    } else if (pts.length === 1) {
      mapRef.current?.animateCamera({ center: pts[0] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, destination]);

  // With no destination there's nothing to frame, so the camera simply follows
  // the moving origin (booker watching a provider whose destination we couldn't
  // resolve). Gated on `destination` so it never fights the fit above.
  useEffect(() => {
    if (destination || !origin) return;
    mapRef.current?.animateCamera({ center: origin }, { duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination, origin?.latitude, origin?.longitude]);

  const center = destination ?? origin;
  const initialRegion = center
    ? {
        latitude: center.latitude,
        longitude: center.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : undefined;

  return (
    <View style={{ flex: 1, borderRadius: 16, overflow: 'hidden' }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}>
        {trail && trail.length > 1 ? (
          <Polyline coordinates={trail} strokeColor="rgba(37,99,235,0.35)" strokeWidth={3} />
        ) : null}
        {route && route.length > 1 ? (
          <Polyline coordinates={route} strokeColor={BRAND_GREEN} strokeWidth={4} />
        ) : null}
        {destination ? (
          <Marker
            coordinate={destination}
            title={destinationLabel || t('shared.destination')}
            pinColor={BRAND_GREEN}
          />
        ) : null}
        {origin ? (
          <Marker
            coordinate={origin}
            title={originLabel || t('shared.youAreHere')}
            pinColor="#2563EB"
            anchor={{ x: 0.5, y: 0.5 }}
          />
        ) : null}
      </MapView>
      {!origin ? (
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
              <ActivityIndicator size="small" color={BRAND_GREEN} />
              <Text style={{ color: hex.text, marginLeft: 8, fontSize: 12 }}>
                {waitingLabel || t('liveSession.locatingYou')}
              </Text>
            </>
          )}
        </View>
      ) : destination && !route ? (
        <View style={chipStyle(hex.card)}>
          <Ionicons name="navigate-outline" size={14} color={BRAND_GREEN} />
          <Text style={{ color: hex.text, marginLeft: 6, fontSize: 12 }}>
            {t('liveSession.findingRoute')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
