import React, { useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useLocale } from '../../../context/LocaleContext';
import { loadGoogleMaps } from '../../../services/google-maps';
import type { ServiceSearchItem } from './ListView';

interface LocationData {
  latitude: number;
  longitude: number;
  loading: boolean;
}

interface MapViewComponentProps {
  services: ServiceSearchItem[];
  location: LocationData;
  isDarkMode?: boolean;
}

// Hide POI icons/labels and transit clutter so the service pins stand out.
// Labels-only for POIs keeps park/landscape fills (relevant for walkers).
// Inline `styles` are only honored on a map WITHOUT a mapId — which is why this
// map uses classic `maps.Marker` (SVG icons) instead of AdvancedMarkerElement
// (that requires a mapId, and the dev DEMO_MAP_ID can't be styled from code).
const MAP_DECLUTTER_STYLE = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

// Green price-pill marker icon ($ amount inside a circle) as an SVG data URI —
// the classic-Marker equivalent of the old AdvancedMarkerElement div.
function pricePinSvg(price: number): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">' +
    '<circle cx="20" cy="20" r="18" fill="#00C870" stroke="white" stroke-width="2"/>' +
    `<text x="20" y="24" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="white">$${price}</text>` +
    '</svg>'
  );
}

const USER_DOT_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22">' +
  '<circle cx="11" cy="11" r="8" fill="#4285F4" stroke="white" stroke-width="3"/>' +
  '</svg>';

/**
 * Builds the info-window card shown when a service pin is clicked: photo on top,
 * then name / type / rating / price. Built with DOM APIs (textContent), so a
 * service name can never inject HTML. The whole card is a button → onView().
 */
function buildInfoCard(s: ServiceSearchItem, isDarkMode: boolean, onView: () => void): HTMLElement {
  const bg = isDarkMode ? '#1a2332' : '#ffffff';
  const text = isDarkMode ? '#ffffff' : '#111827';
  const subtext = isDarkMode ? '#9ca3af' : '#6b7280';

  const card = document.createElement('div');
  Object.assign(card.style, {
    width: '220px',
    background: bg,
    borderRadius: '14px',
    overflow: 'hidden',
    cursor: 'pointer',
    fontFamily: 'system-ui, -apple-system, Arial, sans-serif',
  });
  card.setAttribute('role', 'button');
  card.onclick = onView;

  // Photo
  const img = document.createElement('img');
  img.src = s.image;
  img.alt = s.name;
  Object.assign(img.style, {
    width: '100%',
    height: '110px',
    objectFit: 'cover',
    display: 'block',
  });
  card.appendChild(img);

  // Body
  const body = document.createElement('div');
  Object.assign(body.style, { padding: '10px 12px 12px' });

  const name = document.createElement('div');
  name.textContent = s.name;
  Object.assign(name.style, {
    color: text,
    fontSize: '14px',
    fontWeight: '700',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  });
  body.appendChild(name);

  if (s.service) {
    const type = document.createElement('div');
    type.textContent = s.service;
    Object.assign(type.style, { color: subtext, fontSize: '12px', marginTop: '2px' });
    body.appendChild(type);
  }

  // Rating + price row
  const row = document.createElement('div');
  Object.assign(row.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '8px',
  });

  const rating = document.createElement('div');
  Object.assign(rating.style, { color: subtext, fontSize: '12px' });
  rating.textContent =
    s.rating > 0 ? `★ ${s.rating.toFixed(1)}${s.reviews > 0 ? ` (${s.reviews})` : ''}` : '';
  row.appendChild(rating);

  const price = document.createElement('div');
  price.textContent = `$${s.price}`;
  Object.assign(price.style, { color: '#00C870', fontSize: '16px', fontWeight: '700' });
  row.appendChild(price);

  body.appendChild(row);
  card.appendChild(body);
  return card;
}

/**
 * Search results map (web) — a Google Map with the user's location dot and a
 * green price-pill marker per service. Clicking a pin opens a styled info-window
 * card (photo / name / type / rating / price) that navigates to ServiceDetail.
 * Only services with a geocoded address (non-null coords) get a pin.
 * (Native build: MapView.tsx.)
 */
export default function MapViewComponent({
  services,
  location,
  isDarkMode = false,
}: MapViewComponentProps) {
  const navigation = useNavigation();
  const { t, language } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    if (location.loading) return;
    let cancelled = false;
    loadGoogleMaps(language)
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        const userPos = { lat: location.latitude, lng: location.longitude };
        const map = new maps.Map(containerRef.current, {
          center: userPos,
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
          // Google's default zoom position is bottom-right; keep the old
          // MapLibre/Leaflet top-left placement.
          zoomControlOptions: { position: maps.ControlPosition.LEFT_TOP },
          clickableIcons: false,
          styles: MAP_DECLUTTER_STYLE,
        });

        const svgIcon = (svg: string, size: number) => ({
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
          scaledSize: new maps.Size(size, size),
          anchor: new maps.Point(size / 2, size / 2),
        });

        // User location dot
        new maps.Marker({
          map,
          position: userPos,
          title: t('shared.youAreHere'),
          icon: svgIcon(USER_DOT_SVG, 22),
        });

        // Service markers — price pill + a styled info-window card on click.
        // Trim the InfoWindow's default white chrome so the card fills it.
        const info = new maps.InfoWindow();
        services
          .filter((s) => s.latitude != null && s.longitude != null)
          .forEach((s) => {
            const marker = new maps.Marker({
              map,
              position: { lat: s.latitude!, lng: s.longitude! },
              icon: svgIcon(pricePinSvg(s.price), 40),
            });
            marker.addListener('click', () => {
              const card = buildInfoCard(s, isDarkMode, () =>
                (navigation as any).navigate('ServiceDetail', { service: s.dto })
              );
              info.setContent(card);
              info.open({ map, anchor: marker });
            });
          });
      })
      .catch(() => {
        if (!cancelled) setMapError(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, location.loading, location.latitude, location.longitude, isDarkMode]);

  if (location.loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#6b7280' }}>Loading map...</span>
      </div>
    );
  }

  if (mapError) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#6b7280' }}>{t('shared.mapLoadFailed')}</span>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, height: '100%', width: '100%', minHeight: 400 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 400 }} />
    </div>
  );
}
