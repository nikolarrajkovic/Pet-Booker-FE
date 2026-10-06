import React, { useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useLocale } from '../../../context/LocaleContext';
import { createWebMap, type WebMap, type WebMapMarker } from '../../../services/web-map';
import { formatMoney } from '../../../services/currency';
import { serviceCurrency } from '../../../services/services';
import type { ServiceSearchItem } from './ListView';
import { groupByLocation, pinLabel, type PinGroup } from './pinGroups';
import { haversineKm } from '../../../services/distance';

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

// How far around the reader the opening view reaches for pins before settling for the nearest few.
const NEARBY_KM = 25;
const NEAREST_FALLBACK = 5;

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
 * The list a pin opens when several services share its spot: one row per service — the same
 * name/type/price the single card shows — that opens it, or in selection mode ticks it.
 * Built with DOM APIs (textContent), like the single card. Returns `refresh`, which redraws the
 * ticks in place when the selection changes (a closed popup's detached DOM just ignores it).
 */
function buildGroupCard(
  group: PinGroup,
  heading: string,
  isDarkMode: boolean,
  selectMode: boolean,
  isPicked: (id: number) => boolean,
  onRow: (item: ServiceSearchItem) => void
): { element: HTMLElement; refresh: (isPicked: (id: number) => boolean) => void } {
  const bg = isDarkMode ? '#1a2332' : '#ffffff';
  const text = isDarkMode ? '#ffffff' : '#111827';
  const subtext = isDarkMode ? '#9ca3af' : '#6b7280';
  const hover = isDarkMode ? '#243447' : '#f3f4f6';

  const card = document.createElement('div');
  Object.assign(card.style, {
    width: '260px',
    background: bg,
    borderRadius: '14px',
    overflow: 'hidden',
    fontFamily: 'system-ui, -apple-system, Arial, sans-serif',
    padding: '6px 0',
  });

  const title = document.createElement('div');
  title.textContent = heading;
  Object.assign(title.style, {
    color: subtext,
    fontSize: '12px',
    fontWeight: '600',
    padding: '6px 12px 4px',
  });
  card.appendChild(title);

  const list = document.createElement('div');
  Object.assign(list.style, { maxHeight: '240px', overflowY: 'auto' });
  card.appendChild(list);

  const boxes: { id: number; row: HTMLElement; box: HTMLElement }[] = [];
  const paint = (row: HTMLElement, box: HTMLElement, on: boolean) => {
    row.setAttribute('aria-checked', String(on));
    box.textContent = on ? '✓' : '';
    Object.assign(box.style, {
      background: on ? BRAND_GREEN : 'transparent',
      borderColor: on ? BRAND_GREEN : subtext,
    });
  };

  for (const item of group.items) {
    const row = document.createElement('div');
    row.setAttribute('role', selectMode ? 'checkbox' : 'button');
    row.setAttribute('title', item.name);
    row.onclick = () => onRow(item);
    row.onmouseenter = () => (row.style.background = hover);
    row.onmouseleave = () => (row.style.background = 'transparent');
    Object.assign(row.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '8px 12px',
      cursor: 'pointer',
    });

    if (selectMode) {
      const box = document.createElement('span');
      Object.assign(box.style, {
        width: '18px',
        height: '18px',
        flexShrink: '0',
        borderRadius: '5px',
        border: '2px solid',
        color: 'white',
        fontSize: '12px',
        fontWeight: '700',
        lineHeight: '14px',
        textAlign: 'center',
      });
      row.appendChild(box);
      boxes.push({ id: item.id, row, box });
      paint(row, box, isPicked(item.id));
    }

    const body = document.createElement('div');
    Object.assign(body.style, { flex: '1', minWidth: '0' });
    const name = document.createElement('div');
    name.textContent = item.name;
    // Two lines, not one: services at one spot are often one provider's, named alike, and what
    // tells them apart tends to come at the end.
    Object.assign(name.style, {
      color: text,
      fontSize: '13px',
      fontWeight: '700',
      display: '-webkit-box',
      webkitLineClamp: '2',
      webkitBoxOrient: 'vertical',
      overflow: 'hidden',
      wordBreak: 'break-word',
    });
    body.appendChild(name);
    if (item.service) {
      const type = document.createElement('div');
      type.textContent = item.service;
      Object.assign(type.style, { color: subtext, fontSize: '12px' });
      body.appendChild(type);
    }
    row.appendChild(body);

    const price = document.createElement('div');
    price.textContent = formatMoney(item.price, serviceCurrency(item.dto));
    Object.assign(price.style, {
      color: BRAND_GREEN,
      fontSize: '13px',
      fontWeight: '700',
      flexShrink: '0',
    });
    row.appendChild(price);

    list.appendChild(row);
  }

  return {
    element: card,
    refresh: (picked) => boxes.forEach(({ id, row, box }) => paint(row, box, picked(id))),
  };
}

/**
 * Search results map (web) — a Google Map (OpenStreetMap via Leaflet when Google is
 * unavailable, see services/web-map.ts) with the user's location dot and a green
 * price-pill marker per service. Clicking a pin opens a styled popup card
 * (photo / name / type / rating / price) that navigates to ServiceDetail. Services at the same
 * spot share one pin ("3 · 900 RSD+", see pinGroups.ts) that opens a list of them.
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
  const markersRef = useRef<Map<string, { marker: WebMapMarker; group: PinGroup }>>(new Map());
  // The group list currently open, so a selection change can redraw its ticks in place.
  const openGroupRefresh = useRef<((isPicked: (id: number) => boolean) => void) | null>(null);
  const selectedKey = (selectedIds ?? []).join(',');
  // The current selection, readable from inside the (async) marker build: when the markers are
  // rebuilt — more results paging in, the location resolving late — a pin that is already picked
  // must be drawn picked, or it reverts to an outline while still counted as selected.
  const pickedRef = useRef<Set<number>>(new Set());
  pickedRef.current = new Set(selectedIds ?? []);

  const pinFor = (group: PinGroup, isPicked: (id: number) => boolean) => {
    const label = pinLabel(group, selectMode, isPicked);
    return {
      kind: 'svg' as const,
      ...pricePinSvg(label.text, label.filled ? 'filled' : 'outline'),
    };
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

        // Service markers — one per spot: a price pill and a styled card, or for several services
        // at the same spot a count pill and a list of them.
        markersRef.current = new Map();
        const groups = groupByLocation(services);
        const open = (s: ServiceSearchItem) =>
          (navigation as any).navigate('ServiceDetail', serviceDetailParams(s.dto));
        const isPicked = (id: number) => pickedRef.current.has(id);
        groups.forEach((group) => {
          const only = group.items.length === 1 ? group.items[0] : null;
          const marker: WebMapMarker = m.addMarker({
            position: { lat: group.latitude, lng: group.longitude },
            visual: pinFor(group, isPicked),
            title: group.items.map((i) => i.name).join(', '),
            onClick: () => {
              if (only) {
                openGroupRefresh.current = null;
                if (toggleRef.current) toggleRef.current(only);
                else
                  m.openPopup(
                    marker,
                    buildInfoCard(only, isDarkMode, () => open(only))
                  );
                return;
              }
              const card = buildGroupCard(
                group,
                t('search.servicesHere', { count: group.items.length }),
                isDarkMode,
                selectMode,
                isPicked,
                (item) => (toggleRef.current ? toggleRef.current(item) : open(item))
              );
              openGroupRefresh.current = card.refresh;
              m.openPopup(marker, card.element);
            },
          });
          markersRef.current.set(group.key, { marker, group });
        });

        // Bring the pins into view. Centred on the reader alone at a fixed zoom, results a few
        // kilometres away sat just past the edge and the map read as empty. Fit the reader and
        // the pins around them — or, with nothing that close, the nearest few.
        if (groups.length > 0) {
          const here = { latitude: userPos.lat, longitude: userPos.lng };
          const byDistance = groups
            .map((g) => ({
              g,
              km: haversineKm(here, { latitude: g.latitude, longitude: g.longitude }),
            }))
            .sort((a, b) => a.km - b.km);
          const nearby = byDistance.filter((d) => d.km <= NEARBY_KM);
          const shown = (nearby.length > 0 ? nearby : byDistance.slice(0, NEAREST_FALLBACK)).map(
            (d) => ({ lat: d.g.latitude, lng: d.g.longitude })
          );
          m.fitBounds([userPos, ...shown], 60);
        }
      })
      .catch(() => {
        if (!cancelled) setMapError(true);
      });
    return () => {
      cancelled = true;
      markersRef.current = new Map();
      openGroupRefresh.current = null;
      map?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, location.loading, location.latitude, location.longitude, isDarkMode, selectMode]);

  // Selection mode: restyle the pins (and an open group list) in place as the selection changes.
  useEffect(() => {
    if (!selectMode) return;
    const picked = new Set(selectedKey ? selectedKey.split(',').map(Number) : []);
    const isPicked = (id: number) => picked.has(id);
    markersRef.current.forEach(({ marker, group }) => marker.setVisual(pinFor(group, isPicked)));
    openGroupRefresh.current?.(isPicked);
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
