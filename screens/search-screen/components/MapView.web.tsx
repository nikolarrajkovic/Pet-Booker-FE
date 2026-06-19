import React, { useMemo } from 'react';

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
  const srcdoc = useMemo(() => {
    if (location.loading) return '';
    const { latitude, longitude } = location;

    const serviceMarkersJs = services.map((s) => `
      L.circleMarker([${s.latitude}, ${s.longitude}], {
        radius: 18,
        fillColor: '#00C870',
        fillOpacity: 1,
        color: 'white',
        weight: 2,
      })
      .bindPopup('<div><strong>${s.name.replace(/'/g, "\\'").replace(/"/g, '&quot;')}</strong><br/>${s.service} \u2014 $${s.price}</div>')
      .addTo(map)
      .bindTooltip('$${s.price}', { permanent: true, direction: 'center', className: 'price-label' });
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

    ${serviceMarkersJs}
  </script>
</body>
</html>`;
  }, [location, services]);

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

