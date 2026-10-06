// WEB-ONLY. Import from .web.tsx files only (it pulls in Leaflet and its stylesheet).
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { loadGoogleMaps, DEV_MAP_ID } from './google-maps';

/**
 * One map API for the four web maps, backed by Google Maps when it loads and by Leaflet +
 * OpenStreetMap tiles when it does not.
 *
 * Every web map used to talk to Google directly and render "Map failed to load" whenever the
 * Maps key was missing (a placeholder in `.env`), restricted to another origin, or blocked — so a
 * developer machine, a preview build on a new host, or an ad-blocked browser got no map at all,
 * on Search, in the address picker (which a booking or a group request may require) and in the
 * live session. Leaflet needs no key; it is already a dependency, and OpenStreetMap's tiles are
 * free for this volume with attribution, which the Leaflet control shows.
 *
 * Callers describe markers, lines and camera moves in this small vocabulary and never touch either
 * library, so the two backends cannot drift per screen. `createWebMap` decides once per map.
 */

export type LatLng = { lat: number; lng: number };

/** How a marker looks. */
export type MarkerVisual =
  /** An SVG drawn as the marker image, anchored at its centre (the search price pills). */
  | { kind: 'svg'; svg: string; width: number; height: number }
  /** A DOM element drawn as the marker (the live-session dot). */
  | { kind: 'element'; element: HTMLElement; width: number; height: number }
  /** A standard location pin, anchored at its tip. */
  | { kind: 'pin'; color?: string };

export interface WebMapMarker {
  setPosition(p: LatLng): void;
  setVisual(v: MarkerVisual): void;
  setTitle(title: string): void;
  remove(): void;
}

export interface WebMapLine {
  setPath(path: LatLng[]): void;
  remove(): void;
}

export interface WebMap {
  readonly provider: 'google' | 'leaflet';
  addMarker(opts: {
    position: LatLng;
    visual?: MarkerVisual;
    title?: string;
    onClick?: () => void;
  }): WebMapMarker;
  addLine(opts: {
    path: LatLng[];
    color: string;
    weight: number;
    opacity?: number;
    dashed?: boolean;
  }): WebMapLine;
  /** A popup with arbitrary content, anchored on a marker. */
  openPopup(marker: WebMapMarker, content: HTMLElement): void;
  fitBounds(points: LatLng[], padding?: number): void;
  setCenter(p: LatLng, zoom?: number): void;
  panTo(p: LatLng): void;
  setZoom(zoom: number): void;
  getCenter(): LatLng;
  /** Fires after a pan or zoom settles. */
  onIdle(fn: () => void): void;
  /** Leaflet refuses to re-initialise a container, so every map must be destroyed on teardown. */
  destroy(): void;
}

export type CreateWebMapOptions = {
  center: LatLng;
  zoom: number;
  language?: string;
  isDarkMode?: boolean;
  /**
   * Google only. Classic (styleable) markers with these declutter styles instead of a mapId with
   * Advanced Markers — inline styles are ignored once a mapId is set.
   */
  classicStyles?: unknown[];
};

/** The blue "you are here" dot. */
export const USER_DOT_VISUAL: MarkerVisual = {
  kind: 'svg',
  width: 22,
  height: 22,
  svg:
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22">' +
    '<circle cx="11" cy="11" r="8" fill="#4285F4" stroke="white" stroke-width="3"/>' +
    '</svg>',
};

const svgUrl = (svg: string) => 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);

/** A teardrop pin, the Leaflet stand-in for Google's PinElement. */
function pinSvg(color: string): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40">' +
    `<path d="M15 1C7.3 1 1 7.2 1 14.9 1 25.3 15 39 15 39s14-13.7 14-24.1C29 7.2 22.7 1 15 1z" fill="${color}" stroke="white" stroke-width="2"/>` +
    '<circle cx="15" cy="15" r="5" fill="white"/></svg>'
  );
}

const DEFAULT_PIN = '#00C870';

// ── Leaflet ─────────────────────────────────────────────────────────────────────────────────

function leafletIcon(visual: MarkerVisual | undefined): L.Icon | L.DivIcon {
  const v = visual ?? { kind: 'pin' };
  if (v.kind === 'svg') {
    return L.icon({
      iconUrl: svgUrl(v.svg),
      iconSize: [v.width, v.height],
      iconAnchor: [v.width / 2, v.height / 2],
      popupAnchor: [0, -v.height / 2],
    });
  }
  if (v.kind === 'element') {
    return L.divIcon({
      html: v.element,
      className: '',
      iconSize: [v.width, v.height],
      iconAnchor: [v.width / 2, v.height / 2],
    });
  }
  return L.icon({
    iconUrl: svgUrl(pinSvg(v.color ?? DEFAULT_PIN)),
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -38],
  });
}

let popupStyleInjected = false;

/** Popups carry their own card (photo, padding, background); drop Leaflet's chrome around it. */
function injectPopupStyle() {
  if (popupStyleInjected) return;
  popupStyleInjected = true;
  const style = document.createElement('style');
  style.textContent =
    '.pb-map-popup .leaflet-popup-content-wrapper{padding:0;overflow:hidden;border-radius:14px}' +
    '.pb-map-popup .leaflet-popup-content{margin:0;width:auto!important}';
  document.head.appendChild(style);
}

function createLeafletMap(container: HTMLElement, opts: CreateWebMapOptions): WebMap {
  injectPopupStyle();
  // Leaflet's keyboard handler focuses the container on mousedown. When the map is partly below
  // the fold, that focus scrolls the page's scroll view to reveal it, so the pin slides out from
  // under the cursor before mouseup and the first click on any pin did nothing. Keep the keyboard
  // panning, drop the scroll.
  const focus = container.focus.bind(container);
  container.focus = (options?: FocusOptions) => focus({ ...options, preventScroll: true });
  // Leaflet's panes and controls carry z-indexes of 400–1000. Without a stacking context of their
  // own they paint over the screen's overlays drawn on top of the map — the address picker's
  // centre pin and "locate me" button, the live map's status chip.
  container.style.isolation = 'isolate';
  const map = L.map(container, { zoomControl: true, attributionControl: true }).setView(
    [opts.center.lat, opts.center.lng],
    opts.zoom
  );
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  if (opts.isDarkMode) {
    // OSM has no dark tiles; dim them so the map does not glare out of a dark screen.
    const pane = map.getPane('tilePane');
    if (pane) pane.style.filter = 'brightness(0.7) contrast(1.1) saturate(0.8)';
  }
  // A map built inside a modal or a just-laid-out column sees a zero-sized container; recompute
  // whenever the container actually takes its size, or the tiles render into a sliver.
  const resize = new ResizeObserver(() => map.invalidateSize());
  resize.observe(container);

  const leafletMarkers = new WeakMap<WebMapMarker, L.Marker>();

  return {
    provider: 'leaflet',
    addMarker({ position, visual, title, onClick }) {
      const marker = L.marker([position.lat, position.lng], {
        icon: leafletIcon(visual),
        title: title ?? '',
        keyboard: true,
      }).addTo(map);
      if (onClick) marker.on('click', onClick);
      const handle: WebMapMarker = {
        setPosition: (p) => marker.setLatLng([p.lat, p.lng]),
        setVisual: (v) => marker.setIcon(leafletIcon(v)),
        setTitle: (t) => marker.getElement()?.setAttribute('title', t),
        remove: () => marker.remove(),
      };
      leafletMarkers.set(handle, marker);
      return handle;
    },
    addLine({ path, color, weight, opacity, dashed }) {
      const line = L.polyline(
        path.map((p) => [p.lat, p.lng] as [number, number]),
        { color, weight, opacity: opacity ?? 1, dashArray: dashed ? '8 10' : undefined }
      ).addTo(map);
      return {
        setPath: (next) => line.setLatLngs(next.map((p) => [p.lat, p.lng] as [number, number])),
        remove: () => line.remove(),
      };
    },
    openPopup(marker, content) {
      const m = leafletMarkers.get(marker);
      if (!m) return;
      // The marker as the popup's source, so it opens above the icon (its popupAnchor).
      L.popup({ closeButton: false, className: 'pb-map-popup' }, m)
        .setLatLng(m.getLatLng())
        .setContent(content)
        .openOn(map);
    },
    // Not animated: a map torn down mid-animation (the search map is rebuilt as results page in)
    // leaves Leaflet's zoom transition reading panes that are gone — "_leaflet_pos of undefined".
    fitBounds(points, padding = 50) {
      if (points.length === 0) return;
      if (points.length === 1) {
        map.setView([points[0].lat, points[0].lng], Math.max(map.getZoom(), 14), {
          animate: false,
        });
        return;
      }
      map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), {
        padding: [padding, padding],
        animate: false,
      });
    },
    setCenter: (p, zoom) => map.setView([p.lat, p.lng], zoom ?? map.getZoom()),
    panTo: (p) => map.panTo([p.lat, p.lng]),
    setZoom: (zoom) => map.setZoom(zoom),
    getCenter: () => {
      const c = map.getCenter();
      return { lat: c.lat, lng: c.lng };
    },
    onIdle: (fn) => {
      map.on('moveend', fn);
    },
    destroy: () => {
      resize.disconnect();
      map.remove();
    },
  };
}

// ── Google ──────────────────────────────────────────────────────────────────────────────────

function createGoogleMap(maps: any, container: HTMLElement, opts: CreateWebMapOptions): WebMap {
  const classic = opts.classicStyles != null;
  const map = new maps.Map(container, {
    center: opts.center,
    zoom: opts.zoom,
    disableDefaultUI: true,
    zoomControl: true,
    // Google's default zoom position is bottom-right; keep the top-left placement.
    zoomControlOptions: { position: maps.ControlPosition.LEFT_TOP },
    clickableIcons: false,
    ...(classic
      ? { styles: opts.classicStyles }
      : {
          mapId: DEV_MAP_ID,
          colorScheme: opts.isDarkMode ? maps.ColorScheme?.DARK : maps.ColorScheme?.LIGHT,
        }),
  });

  const classicIcon = (v: MarkerVisual | undefined) => {
    if (v?.kind === 'svg') {
      return {
        url: svgUrl(v.svg),
        scaledSize: new maps.Size(v.width, v.height),
        anchor: new maps.Point(v.width / 2, v.height / 2),
      };
    }
    if (v?.kind === 'pin' && v.color) {
      return {
        url: svgUrl(pinSvg(v.color)),
        scaledSize: new maps.Size(30, 40),
        anchor: new maps.Point(15, 40),
      };
    }
    return undefined; // Google's default red pin
  };

  const advancedContent = (v: MarkerVisual | undefined): HTMLElement | undefined => {
    if (!v) return undefined;
    if (v.kind === 'element') return v.element;
    if (v.kind === 'svg') {
      const img = document.createElement('img');
      img.src = svgUrl(v.svg);
      img.width = v.width;
      img.height = v.height;
      img.style.transform = 'translateY(50%)'; // centre-anchored like the classic icon
      return img;
    }
    return new maps.marker.PinElement({
      background: v.color ?? DEFAULT_PIN,
      borderColor: '#00A85A',
      glyphColor: '#ffffff',
    }).element;
  };

  const native = new WeakMap<WebMapMarker, any>();
  let info: any = null;

  return {
    provider: 'google',
    addMarker({ position, visual, title, onClick }) {
      const marker = classic
        ? new maps.Marker({ map, position, title, icon: classicIcon(visual) })
        : new maps.marker.AdvancedMarkerElement({
            map,
            position,
            title,
            content: advancedContent(visual),
          });
      if (onClick) marker.addListener(classic ? 'click' : 'gmp-click', onClick);
      const handle: WebMapMarker = {
        setPosition: (p) => (classic ? marker.setPosition(p) : (marker.position = p)),
        setVisual: (v) =>
          classic ? marker.setIcon(classicIcon(v)) : (marker.content = advancedContent(v)),
        setTitle: (t) => (classic ? marker.setTitle(t) : (marker.title = t)),
        remove: () => (classic ? marker.setMap(null) : (marker.map = null)),
      };
      native.set(handle, marker);
      return handle;
    },
    addLine({ path, color, weight, opacity, dashed }) {
      const line = new maps.Polyline(
        dashed
          ? {
              map,
              path,
              strokeOpacity: 0,
              icons: [
                {
                  icon: {
                    path: 'M 0,-1 0,1',
                    strokeOpacity: opacity ?? 1,
                    strokeColor: color,
                    strokeWeight: weight,
                    scale: 2,
                  },
                  offset: '0',
                  repeat: '12px',
                },
              ],
            }
          : { map, path, strokeColor: color, strokeWeight: weight, strokeOpacity: opacity ?? 1 }
      );
      return { setPath: (next) => line.setPath(next), remove: () => line.setMap(null) };
    },
    openPopup(marker, content) {
      const m = native.get(marker);
      if (!m) return;
      info = info ?? new maps.InfoWindow();
      info.setContent(content);
      info.open({ map, anchor: m });
    },
    fitBounds(points, padding = 50) {
      if (points.length === 0) return;
      const bounds = new maps.LatLngBounds();
      points.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, padding);
    },
    setCenter: (p, zoom) => {
      map.setCenter(p);
      if (zoom != null) map.setZoom(zoom);
    },
    panTo: (p) => map.panTo(p),
    setZoom: (zoom) => map.setZoom(zoom),
    getCenter: () => {
      const c = map.getCenter();
      return c ? { lat: c.lat(), lng: c.lng() } : opts.center;
    },
    onIdle: (fn) => {
      map.addListener('idle', fn);
    },
    destroy: () => {
      info?.close();
    },
  };
}

let warned = false;

/**
 * A map in `container`: Google when the Maps API loads, otherwise Leaflet + OpenStreetMap. Never
 * rejects for a missing or failing Google key — that is the case the fallback exists for.
 */
export async function createWebMap(
  container: HTMLElement,
  opts: CreateWebMapOptions
): Promise<WebMap> {
  try {
    const maps = await loadGoogleMaps(opts.language);
    return createGoogleMap(maps, container, opts);
  } catch (e) {
    if (!warned) {
      warned = true;
      console.info(
        `[map] Google Maps unavailable (${e instanceof Error ? e.message : String(e)}) — using OpenStreetMap.`
      );
    }
    return createLeafletMap(container, opts);
  }
}
