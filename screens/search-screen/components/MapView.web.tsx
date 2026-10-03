import React, { useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useLocale } from '../../../context/LocaleContext';
import { createWebMap, type WebMap, type WebMapMarker } from '../../../services/web-map';
import { formatMoney } from '../../../services/currency';
import { serviceCurrency } from '../../../services/services';
import type { ServiceSearchItem } from './ListView';

import { BRAND_GREEN } from '../../../hooks/useThemeColors';
import { serviceDetailParams } from '../../../navigation/linking';
interface LocationData {
  latitude: number;
  longitude: number;
  loading: boolean;
}

interface MapViewComponentProps {
  services: ServiceSearchItem[];
  location: LocationData;
  isDarkMode?: boolean;
  /** Selection mode - see MapView.tsx. Clicking a pin toggles it instead of opening a card. */
  selectedIds?: number[];
  onToggleSelect?: (item: ServiceSearchItem) => void;
  /** Native only (card placement); accepted here so both variants share one signature. */
  bottomOffset?: number;
}

// Google only: hide POI icons/labels and transit clutter so the service pins stand out.
// Labels-only for POIs keeps park/landscape fills (relevant for walkers).
// Inline `styles` are only honored on a map WITHOUT a mapId — which is why this
// map asks for classic markers (SVG icons) instead of AdvancedMarkerElement
// (that requires a mapId, and the dev DEMO_MAP_ID can't be styled from code).
const MAP_DECLUTTER_STYLE = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Green price-pill marker icon as an SVG data URI — the classic-Marker equivalent of the
// old AdvancedMarkerElement div. It's a WIDTH-FITTED pill rather than a fixed circle: a
// formatted price carries its currency ("1200 RSD", "52 €"), which a 40px circle clipped.
function pricePinSvg(
  label: string,
  variant: 'filled' | 'outline' = 'filled'
): { svg: string; width: number; height: number } {
  const text = escapeXml(label);
  // Selection mode draws an unpicked pin as an outline, so what is picked reads at a glance.
  const fill = variant === 'filled' ? BRAND_GREEN : 'white';
  const ink = variant === 'filled' ? 'white' : BRAND_GREEN;
  const stroke = variant === 'filled' ? 'white' : BRAND_GREEN;
  const height = 30;
  // ~6.6px per character at font-size 11 bold, plus padding; never narrower than a circle.
  const width = Math.max(40, Math.round(label.length * 6.6) + 16);
  return {
    width,
    height,
    svg:
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="${(height - 2) / 2}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>` +
      `<text x="${width / 2}" y="${height / 2 + 4}" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="${ink}">${text}</text>` +
      '</svg>',
  };
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
  price.textContent = formatMoney(s.price, serviceCurrency(s.dto));
  Object.assign(price.style, { color: BRAND_GREEN, fontSize: '16px', fontWeight: '700' });
  row.appendChild(price);

  body.appendChild(row);
  card.appendChild(body);
  return card;
}

/**
 * Search results map (web) — a Google Map (OpenStreetMap via Leaflet when Google is
 * unavailable, see services/web-map.ts) with the user's location dot and a green
 * price-pill marker per service. Clicking a pin opens a styled popup card
 * (photo / name / type / rating / price) that navigates to ServiceDetail.
 * Only services with a geocoded address (non-null coords) get a pin.
 * (Native build: MapView.tsx.)
 */
export default function MapViewComponent({
  services,
  location,
  isDarkMode = false,
  selectedIds,
  onToggleSelect,
}: MapViewComponentProps) {
  const navigation = useNavigation();
  const { t, language } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState(false);
  const selectMode = onToggleSelect != null;
  // Read through refs inside the marker listeners, so a selection change restyles the pins
  // (effect below) without tearing the whole map down and losing the reader's pan and zoom.
  const toggleRef = useRef(onToggleSelect);
  toggleRef.current = onToggleSelect;
  const markersRef = useRef<Map<number, { marker: WebMapMarker; item: ServiceSearchItem }>>(
    new Map()
  );
  const selectedKey = (selectedIds ?? []).join(',');
  // The current selection, readable from inside the (async) marker build: when the markers are
  // rebuilt — more results paging in, the location resolving late — a pin that is already picked
  // must be drawn picked, or it reverts to an outline while still counted as selected.
  const pickedRef = useRef<Set<number>>(new Set());
  pickedRef.current = new Set(selectedIds ?? []);

  const pinFor = (s: ServiceSearchItem, picked: boolean) => {
    const pin = pricePinSvg(
      `${picked ? '✓ ' : ''}${formatMoney(s.price, serviceCurrency(s.dto))}`,
      selectMode && !picked ? 'outline' : 'filled'
    );
    return { kind: 'svg' as const, ...pin };
  };

  useEffect(() => {
    if (location.loading || !containerRef.current) return;
    let cancelled = false;
    let map: WebMap | null = null;
    const userPos = { lat: location.latitude, lng: location.longitude };
    createWebMap(containerRef.current, {
      center: userPos,
      zoom: 13,
      language,
      isDarkMode,
      classicStyles: MAP_DECLUTTER_STYLE,
    })
      .then((m) => {
        if (cancelled) {
          m.destroy();
          return;
        }
        map = m;

        // User location dot
        m.addMarker({
          position: userPos,
          title: t('shared.youAreHere'),
          visual: { kind: 'svg', svg: USER_DOT_SVG, width: 22, height: 22 },
        });

        // Service markers — price pill + a styled card on click.
        markersRef.current = new Map();
        services
          .filter((s) => s.latitude != null && s.longitude != null)
          .forEach((s) => {
            const marker: WebMapMarker = m.addMarker({
              position: { lat: s.latitude!, lng: s.longitude! },
              visual: pinFor(s, selectMode && pickedRef.current.has(s.id)),
              title: s.name,
              onClick: () => {
                if (toggleRef.current) {
                  toggleRef.current(s);
                  return;
                }
                const card = buildInfoCard(s, isDarkMode, () =>
                  (navigation as any).navigate('ServiceDetail', serviceDetailParams(s.dto))
                );
                m.openPopup(marker, card);
              },
            });
            markersRef.current.set(s.id, { marker, item: s });
          });
      })
      .catch(() => {
        if (!cancelled) setMapError(true);
      });
    return () => {
      cancelled = true;
      markersRef.current = new Map();
      map?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, location.loading, location.latitude, location.longitude, isDarkMode, selectMode]);

  // Selection mode: restyle the pins in place as the selection changes.
  useEffect(() => {
    if (!selectMode) return;
    const picked = new Set(selectedKey ? selectedKey.split(',').map(Number) : []);
    markersRef.current.forEach(({ marker, item }, id) => {
      marker.setVisual(pinFor(item, picked.has(id)));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectMode, selectedKey, services]);

  if (location.loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#6b7280' }}>{t('shared.loadingMap')}</span>
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
