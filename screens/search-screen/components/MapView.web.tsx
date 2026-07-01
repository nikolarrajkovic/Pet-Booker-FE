import React, { useEffect, useMemo, useState } from 'react';

interface ServiceItem {
  id: number;
  name: string;
  service: string;
  price: number;
  latitude: number;
  longitude: number;
}

interface LocationData {
  latitude: number;
  longitude: number;
  loading: boolean;
}

interface MapViewComponentProps {
  services: ServiceItem[];
  location: LocationData;
}

export default function MapViewComponent({ services, location }: MapViewComponentProps) {
  const html = useMemo(() => {
    if (location.loading) return '';
    const { latitude, longitude } = location;

    // Embed the markers as data and build them in-page. Escape `<` so a service
    // name can't break out of the <script> block.
    const servicesJson = JSON.stringify(services).replace(/</g, '\\u003c');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css"/>
  <style>
    html,body,#map { margin:0; padding:0; width:100%; height:100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; }
    .maplibregl-popup-content { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; }
    .price-marker {
      width: 40px; height: 40px; border-radius: 50%;
      background: #00C870; border: 2px solid white;
      color: white; font-weight: bold; font-size: 11px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3); cursor: pointer;
    }
    .user-dot {
      width: 16px; height: 16px; background: #4285F4;
      border: 3px solid white; border-radius: 50%;
      box-shadow: 0 1px 4px rgba(0,0,0,0.4);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <script>
    // OpenFreeMap = free, keyless OpenMapTiles vector tiles. Vector labels let us
    // force Latin script (Serbian Latin) instead of the tiles' default Cyrillic.
    const map = new maplibregl.Map({
      container: 'map',
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [${longitude}, ${latitude}],
      zoom: 13,
      attributionControl: false
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

    // Prefer the Latin name (name:latin) on every label layer; OpenMapTiles ships
    // it precomputed for all features, so this is a field swap, not transliteration.
    map.on('load', function () {
      for (const layer of (map.getStyle().layers || [])) {
        if (layer.type === 'symbol' && layer.layout && 'text-field' in layer.layout) {
          map.setLayoutProperty(layer.id, 'text-field',
            ['coalesce', ['get', 'name:latin'], ['get', 'name']]);
        }
      }
    });

    function escapeHtml(str) {
      return String(str).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    // User location dot
    const userEl = document.createElement('div');
    userEl.className = 'user-dot';
    new maplibregl.Marker({ element: userEl })
      .setLngLat([${longitude}, ${latitude}])
      .setPopup(new maplibregl.Popup({ offset: 12 }).setText('You are here'))
      .addTo(map);

    // Service markers — green price pill + popup with name/service/price
    const services = ${servicesJson};
    services.forEach(function (s) {
      const el = document.createElement('div');
      el.className = 'price-marker';
      el.textContent = '$' + s.price;
      new maplibregl.Marker({ element: el })
        .setLngLat([s.longitude, s.latitude])
        .setPopup(new maplibregl.Popup({ offset: 22 }).setHTML(
          '<div><strong>' + escapeHtml(s.name) + '</strong><br/>' +
          escapeHtml(s.service) + ' — $' + s.price + '</div>'
        ))
        .addTo(map);
    });
  </script>
</body>
</html>`;
  }, [location, services]);

  // MapLibre GL can't spawn its Web Worker inside an iframe `srcDoc` document (the
  // worker's blob URL resolves against `about:srcdoc` and fails), so the map never
  // renders. Serving the HTML from a blob: URL gives the iframe a real origin.
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!html) {
      setMapUrl(null);
      return;
    }
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    setMapUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [html]);

  if (location.loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#6b7280' }}>Loading map...</span>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, height: '100%', width: '100%', minHeight: 400 }}>
      <iframe
        src={mapUrl ?? undefined}
        style={{ border: 0, width: '100%', height: '100%', minHeight: 400 }}
        title="Map"
      />
    </div>
  );
}
