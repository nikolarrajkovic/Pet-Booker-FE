import React, { useMemo } from 'react';

interface Provider {
  id: number;
  name: string;
  service: string;
  price: number;
  verified: boolean;
  latitude: number;
  longitude: number;
}

interface LocationData {
  latitude: number;
  longitude: number;
  loading: boolean;
}

interface MapViewComponentProps {
  providers: Provider[];
  location: LocationData;
}

export default function MapViewComponent({ providers, location }: MapViewComponentProps) {
  const srcdoc = useMemo(() => {
    if (location.loading) return '';
    const { latitude, longitude } = location;

    const providerMarkersJs = providers.map((p) => `
      L.circleMarker([${p.latitude}, ${p.longitude}], {
        radius: 18,
        fillColor: '${p.verified ? '#00C870' : '#6B7280'}',
        fillOpacity: 1,
        color: 'white',
        weight: 2,
      })
      .bindPopup('<div><strong>${p.name.replace(/'/g, "\\'").replace(/"/g, '&quot;')}</strong><br/>${p.service} \u2014 $${p.price}${p.verified ? ' <span style=\\"display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:#00C870;color:white;font-size:10px;font-weight:bold;margin-left:2px\\">\u2713</span>' : ''}</div>')
      .addTo(map)
      .bindTooltip('$${p.price}', { permanent: true, direction: 'center', className: 'price-label' });
    `).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <style>
    html,body,#map { margin:0; padding:0; width:100%; height:100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; }
    .leaflet-popup-content { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; }
    .price-label {
      background: transparent; border: none; box-shadow: none;
      color: white; font-weight: bold; font-size: 11px;
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
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map').setView([${latitude}, ${longitude}], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    L.marker([${latitude}, ${longitude}], {
      icon: L.divIcon({ className: '', html: '<div class="user-dot"></div>', iconSize: [16,16], iconAnchor: [8,8] })
    }).addTo(map).bindPopup('You are here');

    ${providerMarkersJs}
  </script>
</body>
</html>`;
  }, [location, providers]);

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
        srcDoc={srcdoc}
        style={{ border: 0, width: '100%', height: '100%', minHeight: 400 }}
        title="Map"
      />
    </div>
  );
}

