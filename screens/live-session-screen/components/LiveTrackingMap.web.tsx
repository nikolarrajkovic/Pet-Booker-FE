import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { GeoPoint } from '../../../services/geocoding';
import { LocationPingDto } from '../../../services/live-location';

export type LiveTrackingMapProps = {
  latest: LocationPingDto | null;
  trail: GeoPoint[];
  isDarkMode: boolean;
};

/**
 * Owner-side live map (web): Leaflet in an iframe, like DirectionsModal.web.tsx —
 * but built ONCE and updated via postMessage instead of rebuilding the srcDoc per
 * change (pings arrive every ~2 s; a rebuild would reload the map constantly).
 * (Native build: LiveTrackingMap.tsx.)
 */
export default function LiveTrackingMap({ latest, trail }: LiveTrackingMapProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mapReady, setMapReady] = useState(false);

  // Static document — the initial center is only a placeholder until the first
  // position message lands (Belgrade fallback, matching hooks/useLocation.ts).
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
    const map = L.map('map', { zoomControl: true }).setView([44.8176, 20.4570], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    let marker = null;
    const polyline = L.polyline([], { color: '#00C870', weight: 4 }).addTo(map);
    let fitted = false;
    window.addEventListener('message', function (e) {
      const d = e.data || {};
      if (d.type !== 'live-tracking-update' || !d.latest) return;
      const pos = [d.latest.latitude, d.latest.longitude];
      if (!marker) marker = L.marker(pos).addTo(map).bindPopup('Your provider');
      else marker.setLatLng(pos);
      polyline.setLatLngs((d.trail || []).map(function (p) { return [p.latitude, p.longitude]; }));
      if (!fitted) {
        fitted = true;
        const pts = (d.trail && d.trail.length > 1)
          ? d.trail.map(function (p) { return [p.latitude, p.longitude]; })
          : [pos];
        if (pts.length > 1) map.fitBounds(pts, { padding: [50, 50] });
        else map.setView(pos, 16);
      } else {
        map.panTo(pos);
      }
    });
    // Tell the parent the map is ready to receive updates.
    window.parent.postMessage({ type: 'live-tracking-ready' }, '*');
  </script>
</body>
</html>`,
    []
  );

  // Handshake: the iframe announces readiness so early pings aren't lost.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'live-tracking-ready') setMapReady(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (!mapReady || !latest) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'live-tracking-update', latest, trail },
      '*'
    );
  }, [mapReady, latest, trail]);

  return (
    <View style={{ flex: 1, borderRadius: 16, overflow: 'hidden' }}>
      <iframe
        ref={iframeRef}
        srcDoc={srcdoc}
        style={{ border: 0, width: '100%', height: '100%' }}
        title="Live tracking"
      />
    </View>
  );
}
