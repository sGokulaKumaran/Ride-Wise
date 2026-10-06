// ============================================================
// FleetMapView.jsx — the map for WATCHING vehicles
//
// RideMap.jsx is the map of somebody navigating: one position (yours),
// turn arrows, the way back to the route. This is the other kind of map:
// you are looking at vehicles somebody else is driving — one bus you are
// waiting for, a whole fleet, or a trip being replayed.
//
// Like RideMap it only DRAWS. What is live, what is stale, how far along
// its route a vehicle is — all of that is decided by the screen and
// arrives as props.
//
// PROPS
//   vehicles     [{ id, code, type, lat, lng, heading, state }]
//                state: "live" | "stale" | "sos" | "starting" | "idle" | "off" | "replay"
//   selectedId   the highlighted vehicle
//   onSelect     (id) → a vehicle was tapped
//   route        { passed: [[lat,lng]…], ahead: [[lat,lng]…] } the planned road
//   planned      [[lat,lng]…]  a planned road shown faintly (replay)
//   track        [[lat,lng]…]  the path really driven (replay)
//   stops        [{ name, lat, lng, done, note }]
//   start        { lat, lng, name }
//   destination  { lat, lng, name }
//   me           { lat, lng }  the viewer's own position
//   alert        { lat, lng, radiusMeters }  the "tell me when near" circle
//   followId     keep this vehicle in view (released when the map is dragged)
//   fitKey       when it changes, the map shows everything again
//   padding      { top, bottom } pixels covered by the screen's own panels
//   compact      a small inline map: fewer controls
//   tc           theme classes
//   ref          { fit(), panTo(lat, lng), follow() }
// ============================================================

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { MapContainer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Icon from "../ui/Icon";
import { haversineDistance } from "../../../services/routingApi";
import {
  MAP_MAX_ZOOM,
  MAP_STYLES,
  MAP_STYLE_AUTO,
  ROUTE_COLORS,
  loadMapStyleChoice,
  resolveMapStyle,
  routeWeight,
  saveMapStyleChoice,
} from "../ride/mapStyles";

const WORLD_BOUNDS = L.latLngBounds(L.latLng(-85, -180), L.latLng(85, 180));
const GLIDE_MS = 1100;          // markers glide between positions
const GLIDE_MAX_VEHICLES = 40;  // …unless the fleet is large (then they step)
const FOLLOW_ZOOM = 15;

// Styles whose provider refused to serve tiles during this visit.
const brokenStyles = new Set();

// Same guard as RideMap: a canvas renderer that has already been removed
// must not be asked to repaint (Leaflet 1.9 throws when a map with
// canvas-drawn lines is closed). Idempotent — whichever map loads first
// installs it.
const redrawCanvas = L.Canvas.prototype._redraw;
if (!redrawCanvas.rwGuarded) {
  L.Canvas.prototype._redraw = function redrawIfAlive() {
    if (!this._ctx) { this._redrawRequest = null; return; }
    redrawCanvas.call(this);
  };
  L.Canvas.prototype._redraw.rwGuarded = true;
}

// Names and codes come from people — never put them into marker HTML raw.
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
  ));
}

// The vehicle glyphs of the icon family, as markup for Leaflet markers.
const GLYPH = {
  BUS: '<rect x="4.2" y="3.8" width="15.6" height="12.8" rx="2.6"/><path d="M4.2 10.8h15.6M12 3.8v7"/><path d="M7.2 16.6v1.9a.9.9 0 0 0 .9.9h.8a.9.9 0 0 0 .9-.9v-1.9M14.2 16.6v1.9a.9.9 0 0 0 .9.9h.8a.9.9 0 0 0 .9-.9v-1.9"/>',
  VAN: '<path d="M5.2 16.6H4.6a1.4 1.4 0 0 1-1.4-1.4V7.4A1.4 1.4 0 0 1 4.6 6h8.6v10.6M13.2 9h3.9l3.7 4v2.2a1.4 1.4 0 0 1-1.4 1.4h-.2M9.6 16.6h5.2"/><circle cx="7.4" cy="16.8" r="2.2"/><circle cx="17" cy="16.8" r="2.2"/>',
  AMBULANCE: '<path d="M5.2 16.6H4.6a1.4 1.4 0 0 1-1.4-1.4V7.4A1.4 1.4 0 0 1 4.6 6h8.6v10.6M13.2 9h3.9l3.7 4v2.2a1.4 1.4 0 0 1-1.4 1.4h-.2M9.6 16.6h5.2M8.2 8.4v3.6M6.4 10.2H10"/><circle cx="7.4" cy="16.8" r="2.2"/><circle cx="17" cy="16.8" r="2.2"/>',
  CAR: '<path d="M4.4 13.2 6.1 8.5a2 2 0 0 1 1.9-1.3h8a2 2 0 0 1 1.9 1.300l1.7 4.700"/><rect x="3.2" y="13.2" width="17.6" height="4.6" rx="1.6"/><path d="M6.4 17.8v1.5M17.6 17.8v1.5"/>',
  OTHER: '<circle cx="6.2" cy="16.600" r="3.200"/><circle cx="17.800" cy="16.600" r="3.200"/><path d="M9.400 16.600h5.200M14.600 16.600 11 8.800H8.200M11 8.800h4.200l2.600 7.800"/>',
};

function vehicleIcon(vehicle, selected) {
  const heading = Number.isFinite(vehicle.heading) ? vehicle.heading : null;
  const moving = heading != null && (vehicle.state === "live" || vehicle.state === "sos" || vehicle.state === "replay");
  return L.divIcon({
    className: "",
    html: `<div class="rwf-v rwf-v--${escapeHtml(vehicle.state)}${selected ? " rwf-v--selected" : ""}${
      moving ? "" : " rwf-v--still"}" style="--rwf-heading:${heading ?? 0}deg">
      <div class="rwf-v__pulse"></div>
      <div class="rwf-v__arrow"><svg viewBox="0 0 52 52" aria-hidden="true"><path d="M26 1.5 32 11.5H20Z"/></svg></div>
      <div class="rwf-v__dot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPH[vehicle.type] || GLYPH.OTHER}</svg></div>
      <div class="rwf-v__code">${escapeHtml(vehicle.code)}</div>
    </div>`,
    iconSize: [52, 74],
    iconAnchor: [26, 26],
    popupAnchor: [0, -26],
  });
}

function stopIcon(index, done) {
  return L.divIcon({
    className: "",
    html: `<div class="rwf-stop${done ? " rwf-stop--done" : ""}">${index + 1}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  });
}

const START_ICON = L.divIcon({
  className: "", html: '<div class="rwf-start"></div>', iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -11],
});
const DESTINATION_ICON = L.divIcon({
  className: "",
  html: `<svg class="rwf-destination" width="30" height="38" viewBox="0 0 32 40" aria-hidden="true">
    <path d="M16 38.5S29 26.600 29 15.500a13 13 0 1 0-26 0C3 26.600 16 38.500 16 38.500Z"
      fill="#111827" stroke="#fff" stroke-width="2.500" stroke-linejoin="round"/>
    <circle cx="16" cy="15.500" r="4.600" fill="#fff"/></svg>`,
  iconSize: [30, 38], iconAnchor: [15, 37], popupAnchor: [0, -36],
});
const ME_ICON = L.divIcon({
  className: "", html: '<div class="rwf-me"><span></span></div>', iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -12],
});

if (typeof document !== "undefined" && !document.getElementById("rw-fleet-map-css")) {
  const style = document.createElement("style");
  style.id = "rw-fleet-map-css";
  style.textContent = `
    .rwf .leaflet-container { width:100%; height:100%; background:#E5E7EB; font:inherit; -webkit-tap-highlight-color:transparent; }
    .rwf--dark .leaflet-container { background:#15171C; }
    .rwf .leaflet-top, .rwf .leaflet-bottom { display:none !important; }
    .rwf-tiles-invert .leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.92); }

    /* ── A vehicle ── */
    .rwf-v { position:relative; width:52px; height:74px; --rwf-c:#374151; cursor:pointer; }
    .rwf-v--live, .rwf-v--replay { --rwf-c:#2F6FED; }
    .rwf-v--starting { --rwf-c:#2F6FED; }
    .rwf-v--sos { --rwf-c:#DC2626; }
    .rwf-v--stale { --rwf-c:#8E96A3; }
    .rwf-v--off { --rwf-c:#9CA3AF; }
    .rwf-v__dot { position:absolute; left:8px; top:8px; width:36px; height:36px; border-radius:50%;
      background:var(--rwf-c); color:#fff; border:2.5px solid #fff; box-sizing:border-box;
      display:flex; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(0,0,0,0.4); }
    .rwf-v__dot svg { width:20px; height:20px; display:block; }
    .rwf-v--idle .rwf-v__dot, .rwf-v--off .rwf-v__dot { background:#fff; color:var(--rwf-c); border-color:var(--rwf-c); }
    .rwf-v--starting .rwf-v__dot { background:#fff; color:var(--rwf-c); border-color:var(--rwf-c); border-style:dashed; }
    .rwf-v--selected .rwf-v__dot { box-shadow:0 0 0 3px #fff, 0 0 0 6px var(--rwf-c), 0 2px 8px rgba(0,0,0,0.45); }
    .rwf-v__arrow { position:absolute; left:0; top:0; width:52px; height:52px;
      transform:rotate(var(--rwf-heading,0deg)); transition:transform 0.6s ease-out; }
    .rwf-v__arrow svg { display:block; width:52px; height:52px; fill:var(--rwf-c); stroke:#fff; stroke-width:1.5; stroke-linejoin:round; }
    .rwf-v--still .rwf-v__arrow { display:none; }
    .rwf-v__pulse { display:none; position:absolute; left:8px; top:8px; width:36px; height:36px; border-radius:50%;
      background:var(--rwf-c); opacity:0.4; }
    .rwf-v--sos .rwf-v__pulse { display:block; animation:rwf-pulse 1.3s ease-out infinite; }
    .rwf-v--live.rwf-v--selected .rwf-v__pulse { display:block; animation:rwf-pulse 2.4s ease-out infinite; }
    @keyframes rwf-pulse { 0% { transform:scale(0.9); opacity:0.45; } 80%,100% { transform:scale(2.3); opacity:0; } }
    .rwf-v__code { position:absolute; left:50%; top:48px; transform:translateX(-50%); max-width:110px; padding:2px 7px;
      border-radius:999px; background:rgba(17,24,39,0.88); color:#fff; font:700 11px/1.3 Inter,system-ui,sans-serif;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .rwf-v--sos .rwf-v__code { background:#B91C1C; }
    .rwf--far .rwf-v__code { display:none; }
    .rwf--far .rwf-v--selected .rwf-v__code { display:block; }

    /* ── Stops, endpoints, the viewer ── */
    .rwf-stop { width:22px; height:22px; border-radius:50%; background:#fff; color:#111827; border:2.5px solid #111827;
      box-sizing:border-box; display:flex; align-items:center; justify-content:center;
      font:700 10px/1 Inter,system-ui,sans-serif; box-shadow:0 1px 4px rgba(0,0,0,0.35); }
    .rwf-stop--done { background:#8E96A3; border-color:#8E96A3; color:#fff; }
    .rwf-start { width:20px; height:20px; border-radius:50%; background:#fff; border:5px solid #111827;
      box-sizing:border-box; box-shadow:0 0 0 2px #fff, 0 2px 6px rgba(0,0,0,0.35); }
    .rwf-destination { display:block; filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35)); }
    .rwf-me { width:22px; height:22px; border-radius:50%; background:rgba(16,185,129,0.25);
      display:flex; align-items:center; justify-content:center; }
    .rwf-me span { width:12px; height:12px; border-radius:50%; background:#10B981; border:2.5px solid #fff;
      box-sizing:content-box; box-shadow:0 1px 4px rgba(0,0,0,0.4); }

    /* ── Popups ── */
    .rwf-popup .leaflet-popup-content-wrapper { border-radius:12px; box-shadow:0 6px 24px rgba(0,0,0,0.22);
      background:#fff; color:#111113; border:1px solid #E4E4E7; }
    .rwf-popup .leaflet-popup-content { margin:10px 12px; font:500 13px/1.4 Inter,system-ui,sans-serif; }
    .rwf-popup .leaflet-popup-tip { background:#fff; }
    .rwf--dark .rwf-popup .leaflet-popup-content-wrapper { background:#141416; color:#F4F4F5; border-color:#26262B; }
    .rwf--dark .rwf-popup .leaflet-popup-tip { background:#141416; }
    .rwf-popup a.leaflet-popup-close-button { color:inherit; opacity:0.55; }
    .rwf-popup b { display:block; font-size:14px; }
    .rwf-popup span { display:block; margin-top:2px; font-size:12px; opacity:0.68; }
    @media (hover: none), (pointer: coarse) { .rwf-pointer-only { display:none !important; } }
  `;
  document.head.appendChild(style);
}

const EMPTY = [];

export default function FleetMapView({
  vehicles = EMPTY,
  selectedId = null,
  onSelect,
  route = null,
  planned = null,
  track = null,
  stops = EMPTY,
  start = null,
  destination = null,
  me = null,
  alert = null,
  followId = null,
  fitKey = "default",
  padding = null,
  compact = false,
  tc,
  ref,
}) {
  const wrapperRef = useRef(null);
  const [map, setMap] = useState(null);
  const [following, setFollowing] = useState(followId != null);
  const [showStyles, setShowStyles] = useState(false);
  const [styleChoice, setStyleChoice] = useState(loadMapStyleChoice);
  const [fallbackFor, setFallbackFor] = useState(null);

  // ── Basemap (same choices and the same remembered choice as the ride map) ──
  const styleDef = resolveMapStyle(styleChoice, tc.isDark);
  const usingFallback =
    Boolean(styleDef.fallback) && (fallbackFor === styleDef.id || brokenStyles.has(styleDef.id));
  const tiles = usingFallback ? { ...styleDef, ...styleDef.fallback } : styleDef;
  const palette = ROUTE_COLORS[styleDef.dark ? "dark" : "light"];

  // ── Latest props for callbacks that must keep their identity ──
  const live = useRef({});
  useEffect(() => {
    live.current = { vehicles, route, planned, track, stops, start, destination, me, alert, padding, followId, onSelect };
  });

  const followRef = useRef(followId != null);
  const setFollow = useCallback((value) => {
    followRef.current = value;
    setFollowing(value);
  }, []);

  // ====================================================================
  // CAMERA
  // ====================================================================
  const centerFor = useCallback((lat, lng, zoom) => {
    const pad = live.current.padding;
    const shift = ((pad?.bottom ?? 0) - (pad?.top ?? 0)) / 2;
    if (!map || !shift) return L.latLng(lat, lng);
    return map.unproject(map.project([lat, lng], zoom).add([0, shift]), zoom);
  }, [map]);

  // Show everything there is to see.
  const fit = useCallback(({ animate = true, release = true } = {}) => {
    if (!map) return false;
    const now = live.current;
    const points = [];
    const add = (place) => {
      if (place && Number.isFinite(place.lat) && Number.isFinite(place.lng)) points.push([place.lat, place.lng]);
    };

    if (now.route) points.push(...(now.route.ahead?.length ? now.route.ahead : now.route.passed || []));
    if (now.track?.length) points.push(...now.track);
    else if (now.planned?.length) points.push(...now.planned);
    (now.vehicles || []).forEach(add);
    (now.stops || []).forEach(add);
    add(now.start);
    add(now.destination);
    add(now.me);
    add(now.alert);
    if (!points.length) return false;

    if (release) setFollow(false);
    const top = now.padding?.top ?? 0;
    const bottom = now.padding?.bottom ?? 0;
    const margin = compact ? 24 : 40;
    if (points.length === 1) {
      map.setView(centerFor(points[0][0], points[0][1], 15), 15, { animate });
    } else {
      map.fitBounds(L.latLngBounds(points), {
        paddingTopLeft: [margin, top + margin],
        paddingBottomRight: [compact ? margin : margin + 28, bottom + margin],
        maxZoom: 16,
        animate,
      });
    }
    return true;
  }, [map, compact, centerFor, setFollow]);

  const panTo = useCallback((lat, lng) => {
    if (!map || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setFollow(false);
    const zoom = Math.max(map.getZoom(), 15);
    map.setView(centerFor(lat, lng, zoom), zoom, { animate: true, duration: 0.5 });
  }, [map, centerFor, setFollow]);

  // Re-arm follow mode and jump to the followed vehicle.
  const follow = useCallback(() => {
    if (!map) return;
    const target = (live.current.vehicles || []).find((v) => v.id === live.current.followId);
    setFollow(true);
    if (target) {
      const zoom = Math.max(map.getZoom(), FOLLOW_ZOOM);
      map.setView(centerFor(target.lat, target.lng, zoom), zoom, { animate: true, duration: 0.5 });
    }
  }, [map, centerFor, setFollow]);

  useImperativeHandle(ref, () => ({ fit, panTo, follow }), [fit, panTo, follow]);

  // Keep the map sized to its container.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!map || !wrapper || typeof ResizeObserver === "undefined") return undefined;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    });
    observer.observe(wrapper);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [map]);

  // First view (and again whenever fitKey changes): everything, as soon as
  // there is something to show.
  const hasContent =
    vehicles.length > 0 || Boolean(route) || Boolean(track?.length) || Boolean(planned?.length) ||
    stops.length > 0 || Boolean(destination) || Boolean(me);
  const fittedRef = useRef(null);
  useEffect(() => {
    if (!map || !hasContent || fittedRef.current === fitKey) return;
    map.invalidateSize({ pan: false });
    // A followed vehicle takes the camera instead of the overview.
    const followed = followRef.current && (live.current.vehicles || []).some((v) => v.id === live.current.followId);
    if (followed || fit({ animate: false, release: false })) fittedRef.current = fitKey;
  }, [map, hasContent, fitKey, fit]);

  // Dragging, scrolling or pinching the map releases follow mode.
  useEffect(() => {
    if (!map) return undefined;
    const container = map.getContainer();
    const release = () => { if (followRef.current) setFollow(false); };
    container.addEventListener("pointerdown", release, { passive: true });
    container.addEventListener("touchstart", release, { passive: true });
    container.addEventListener("wheel", release, { passive: true });
    map.on("dragstart", release);
    return () => {
      container.removeEventListener("pointerdown", release);
      container.removeEventListener("touchstart", release);
      container.removeEventListener("wheel", release);
      map.off("dragstart", release);
    };
  }, [map, setFollow]);

  // Follow the chosen vehicle.
  const followed = followId != null ? vehicles.find((v) => v.id === followId) : null;
  const followLat = followed?.lat;
  const followLng = followed?.lng;
  const zoomedRef = useRef(false);
  useEffect(() => {
    if (!map || followLat == null || followLng == null || !followRef.current) return;
    if (!zoomedRef.current) {
      zoomedRef.current = true;
      const zoom = Math.max(map.getZoom(), FOLLOW_ZOOM);
      map.setView(centerFor(followLat, followLng, zoom), zoom, { animate: true, duration: 0.6 });
      return;
    }
    const zoom = map.getZoom();
    map.setView(centerFor(followLat, followLng, zoom), zoom, { animate: true, duration: 0.9, easeLinearity: 1 });
  }, [map, followLat, followLng, centerFor]);

  // ====================================================================
  // TILES
  // ====================================================================
  useEffect(() => {
    if (!map) return undefined;
    const layer = L.tileLayer(tiles.url, {
      noWrap: true,
      updateWhenZooming: false,
      keepBuffer: 3,
      maxZoom: MAP_MAX_ZOOM,
      maxNativeZoom: tiles.maxNativeZoom,
    });
    let loaded = 0;
    let failed = 0;
    layer.on("tileload", () => { loaded += 1; });
    layer.on("tileerror", () => {
      failed += 1;
      if (!usingFallback && styleDef.fallback && loaded === 0 && failed >= 3) {
        brokenStyles.add(styleDef.id);
        setFallbackFor(styleDef.id);
      }
    });
    layer.addTo(map);
    const container = map.getContainer();
    container.classList.toggle("rwf-tiles-invert", Boolean(tiles.invert));
    return () => {
      map.removeLayer(layer);
      container.classList.remove("rwf-tiles-invert");
    };
  }, [map, tiles.url, tiles.maxNativeZoom, tiles.invert, styleDef.id, styleDef.fallback, usingFallback]);

  const chooseStyle = (choice) => {
    setStyleChoice(choice);
    saveMapStyleChoice(choice);
    setShowStyles(false);
  };

  // ====================================================================
  // LINES — persistent polylines, updated in place
  //   planned (faint) · passed · casing · ahead · track casing · track
  // ====================================================================
  const linesRef = useRef(null);
  useEffect(() => {
    if (!map) return undefined;
    const make = () => L.polyline([], { interactive: false, lineCap: "round", lineJoin: "round" }).addTo(map);
    const lines = { planned: make(), passed: make(), casing: make(), ahead: make(), trackCasing: make(), track: make() };
    linesRef.current = lines;
    return () => {
      Object.values(lines).forEach((line) => map.removeLayer(line));
      linesRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const lines = linesRef.current;
    if (!map || !lines) return undefined;
    const restyle = () => {
      const width = compact ? Math.max(4, routeWeight(map.getZoom()) - 2) : routeWeight(map.getZoom());
      lines.planned.setStyle({ color: palette.route, weight: Math.max(3, width - 3), opacity: 0.35, dashArray: "2 9" });
      lines.passed.setStyle({ color: palette.passed, weight: Math.max(3, width - 3), opacity: 0.8 });
      lines.casing.setStyle({ color: palette.casing, weight: width + 4, opacity: 0.95 });
      lines.ahead.setStyle({ color: palette.route, weight: width, opacity: 1 });
      lines.trackCasing.setStyle({ color: palette.casing, weight: width + 3, opacity: 0.9 });
      lines.track.setStyle({ color: palette.route, weight: Math.max(4, width - 1), opacity: 1 });
      wrapperRef.current?.classList.toggle("rwf--far", map.getZoom() < 11);
    };
    restyle();
    map.on("zoomend", restyle);
    return () => map.off("zoomend", restyle);
  }, [map, palette, compact]);

  useEffect(() => {
    const lines = linesRef.current;
    if (!map || !lines) return;
    lines.planned.setLatLngs(planned || []);
    lines.passed.setLatLngs(route?.passed || []);
    lines.casing.setLatLngs(route?.ahead || []);
    lines.ahead.setLatLngs(route?.ahead || []);
    lines.trackCasing.setLatLngs(track || []);
    lines.track.setLatLngs(track || []);
  }, [map, route, planned, track]);

  // ====================================================================
  // FIXED PLACES — start, destination, stops, me, the alert circle
  // ====================================================================
  const startLat = start?.lat;
  const startLng = start?.lng;
  const startName = start?.name || "Start";
  useEffect(() => {
    if (!map || !Number.isFinite(startLat) || !Number.isFinite(startLng)) return undefined;
    const marker = L.marker([startLat, startLng], { icon: START_ICON, keyboard: false, zIndexOffset: 200 })
      .addTo(map)
      .bindPopup(`<b>${escapeHtml(startName)}</b><span>Start</span>`, { className: "rwf-popup" });
    return () => marker.remove();
  }, [map, startLat, startLng, startName]);

  const destLat = destination?.lat;
  const destLng = destination?.lng;
  const destName = destination?.name || "Destination";
  useEffect(() => {
    if (!map || !Number.isFinite(destLat) || !Number.isFinite(destLng)) return undefined;
    const marker = L.marker([destLat, destLng], { icon: DESTINATION_ICON, keyboard: false, zIndexOffset: 250 })
      .addTo(map)
      .bindPopup(`<b>${escapeHtml(destName)}</b><span>Destination</span>`, { className: "rwf-popup" });
    return () => marker.remove();
  }, [map, destLat, destLng, destName]);

  useEffect(() => {
    if (!map || !stops.length) return undefined;
    const markers = stops
      .filter((stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.lng))
      .map((stop, index) => L.marker([stop.lat, stop.lng], {
        icon: stopIcon(index, Boolean(stop.done)), keyboard: false, zIndexOffset: 300,
      })
        .addTo(map)
        .bindPopup(
          `<b>${escapeHtml(stop.name)}</b><span>${escapeHtml(stop.note || `Stop ${index + 1}`)}</span>`,
          { className: "rwf-popup" },
        ));
    return () => markers.forEach((marker) => marker.remove());
  }, [map, stops]);

  const meLat = me?.lat;
  const meLng = me?.lng;
  useEffect(() => {
    if (!map || !Number.isFinite(meLat) || !Number.isFinite(meLng)) return undefined;
    const marker = L.marker([meLat, meLng], { icon: ME_ICON, keyboard: false, zIndexOffset: 400 })
      .addTo(map)
      .bindPopup("<b>You are here</b>", { className: "rwf-popup" });
    return () => marker.remove();
  }, [map, meLat, meLng]);

  const alertLat = alert?.lat;
  const alertLng = alert?.lng;
  const alertRadius = alert?.radiusMeters;
  useEffect(() => {
    if (!map || !Number.isFinite(alertLat) || !Number.isFinite(alertLng) || !(alertRadius > 0)) return undefined;
    const circle = L.circle([alertLat, alertLng], {
      radius: alertRadius,
      color: "#F2690C",
      weight: 2,
      dashArray: "6 8",
      fillColor: "#F2690C",
      fillOpacity: 0.08,
      interactive: false,
    }).addTo(map);
    return () => circle.remove();
  }, [map, alertLat, alertLng, alertRadius]);

  // ====================================================================
  // VEHICLES — one marker each, created once, moved and restyled in place
  // ====================================================================
  const markersRef = useRef(new Map()); // id → { marker, signature, frame }
  useEffect(() => {
    if (!map) return;
    const markers = markersRef.current;
    const seen = new Set();
    const glide = vehicles.length <= GLIDE_MAX_VEHICLES &&
      !document.documentElement.classList.contains("rw-reduce-motion");

    vehicles.forEach((vehicle) => {
      if (!Number.isFinite(vehicle.lat) || !Number.isFinite(vehicle.lng)) return;
      seen.add(vehicle.id);
      const selected = vehicle.id === selectedId;
      const hasHeading = Number.isFinite(vehicle.heading);
      const signature = `${vehicle.code}|${vehicle.type}|${vehicle.state}|${selected}|${hasHeading}`;

      let entry = markers.get(vehicle.id);
      if (!entry) {
        const marker = L.marker([vehicle.lat, vehicle.lng], {
          icon: vehicleIcon(vehicle, selected),
          keyboard: false,
          zIndexOffset: selected ? 900 : vehicle.state === "sos" ? 800 : vehicle.state === "live" ? 600 : 500,
        }).addTo(map);
        const id = vehicle.id;
        marker.on("click", () => live.current.onSelect?.(id));
        entry = { marker, signature, frame: 0 };
        markers.set(vehicle.id, entry);
        return;
      }

      if (entry.signature !== signature) {
        entry.marker.setIcon(vehicleIcon(vehicle, selected));
        entry.marker.setZIndexOffset(selected ? 900 : vehicle.state === "sos" ? 800 : vehicle.state === "live" ? 600 : 500);
        entry.signature = signature;
      } else if (hasHeading) {
        entry.marker.getElement()?.querySelector(".rwf-v")?.style.setProperty("--rwf-heading", `${vehicle.heading}deg`);
      }

      const from = entry.marker.getLatLng();
      if (from.lat === vehicle.lat && from.lng === vehicle.lng) return;
      cancelAnimationFrame(entry.frame);
      const far = haversineDistance(from.lat, from.lng, vehicle.lat, vehicle.lng) > 500; // a jump, not a glide
      if (!glide || far) {
        entry.marker.setLatLng([vehicle.lat, vehicle.lng]);
        return;
      }
      const startedAt = performance.now();
      const target = entry;
      const step = (now) => {
        const k = Math.min(1, (now - startedAt) / GLIDE_MS);
        target.marker.setLatLng([from.lat + (vehicle.lat - from.lat) * k, from.lng + (vehicle.lng - from.lng) * k]);
        if (k < 1) target.frame = requestAnimationFrame(step);
      };
      target.frame = requestAnimationFrame(step);
    });

    for (const [id, entry] of markers) {
      if (!seen.has(id)) {
        cancelAnimationFrame(entry.frame);
        entry.marker.remove();
        markers.delete(id);
      }
    }
  }, [map, vehicles, selectedId]);

  useEffect(() => {
    const markers = markersRef.current;
    return () => {
      markers.forEach((entry) => { cancelAnimationFrame(entry.frame); entry.marker.remove(); });
      markers.clear();
    };
  }, [map]);

  // ====================================================================
  // RENDER
  // ====================================================================
  const top = (padding?.top ?? 0) + 12;
  const bottom = (padding?.bottom ?? 0) + 12;
  const control = `border rounded-full flex items-center justify-center transition-colors ${tc.mapControl}`;
  const controlSize = compact ? "h-9 w-9" : "h-11 w-11";
  const selectedStyleId = styleChoice === MAP_STYLE_AUTO ? MAP_STYLE_AUTO : styleDef.id;

  return (
    <div
      ref={wrapperRef}
      className={`rwf ${styleDef.dark ? "rwf--dark" : "rwf--light"}`}
      style={{ position: "absolute", inset: 0 }}
    >
      <MapContainer
        ref={setMap}
        attributionControl={false /* credit is shown in RideWise's own line below */}
        zoomControl={false}
        center={[13.0827, 80.2707]}
        zoom={11}
        scrollWheelZoom
        minZoom={3}
        maxZoom={MAP_MAX_ZOOM}
        zoomSnap={1}
        zoomDelta={1}
        maxBounds={WORLD_BOUNDS}
        maxBoundsViscosity={1.0}
        renderer={L.canvas({ padding: 0.5 })}
        rotate={false}
        touchRotate={false}
        shiftKeyRotate={false}
        rotateControl={false}
        bounceAtZoomLimits={false}
        style={{ width: "100%", height: "100%" }}
      />

      {/* ── Top-right: map style · zoom ── */}
      <div className="absolute z-[1000] flex flex-col items-end gap-2" style={{ top: `${top}px`, right: "12px" }}>
        <div className="relative">
          <button
            type="button"
            title="Map style"
            aria-label="Map style"
            aria-expanded={showStyles}
            onClick={() => setShowStyles((open) => !open)}
            className={`${control} ${controlSize}`}
          >
            <Icon name="layers" size={compact ? 16 : 19} />
          </button>
          {showStyles && (
            <>
              <div className="fixed inset-0 z-[1]" onClick={() => setShowStyles(false)} />
              <div role="menu" className={`absolute right-0 z-[2] mt-2 w-56 overflow-hidden rounded-xl border py-1 shadow-lg ${tc.card} ${tc.text}`}>
                <p className={`px-3.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider ${tc.sub}`}>Map style</p>
                {[{ id: MAP_STYLE_AUTO, label: "Automatic", hint: "Matches your theme" }, ...MAP_STYLES].map((option) => {
                  const selected = selectedStyleId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selected}
                      onClick={() => chooseStyle(option.id)}
                      className={`flex w-full items-center gap-3 px-3.5 py-2 text-left transition-colors ${selected ? tc.navActive : tc.cardHover}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{option.label}</span>
                        <span className={`block truncate text-xs ${tc.sub}`}>{option.hint}</span>
                      </span>
                      {selected && <Icon name="check" size={16} />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {!compact && (
          <div className={`rwf-pointer-only flex flex-col overflow-hidden rounded-full border ${tc.mapControl}`}>
            <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => map?.zoomIn()}
              className={`flex h-10 w-11 items-center justify-center transition-colors ${tc.cardHover}`}>
              <Icon name="plus" size={18} />
            </button>
            <span className={`mx-2 h-px ${tc.hairline}`} />
            <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => map?.zoomOut()}
              className={`flex h-10 w-11 items-center justify-center transition-colors ${tc.cardHover}`}>
              <Icon name="minus" size={18} />
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom-right: show everything · follow ── */}
      <div className="absolute z-[1000] flex flex-col items-end gap-2" style={{ bottom: `${bottom}px`, right: "12px" }}>
        <button type="button" title="Show everything" aria-label="Show everything" onClick={() => fit()}
          className={`${control} ${controlSize}`}>
          <Icon name="overview" size={compact ? 16 : 19} />
        </button>
        {followed && !compact && (following ? (
          <button type="button" title={`Following ${followed.code}`} aria-label={`Following ${followed.code}`}
            aria-pressed="true" onClick={follow} className={`${control} ${controlSize} ${tc.accent}`}>
            <Icon name="navigate" size={19} />
          </button>
        ) : (
          <button type="button" onClick={follow}
            className={`flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold shadow-sm transition-colors ${tc.btnAccent}`}>
            <Icon name="recenter" size={18} />
            Follow {followed.code}
          </button>
        ))}
      </div>

      {/* ── Map data credit (required by the tile providers' terms) ── */}
      <div
        className="pointer-events-none absolute left-2 z-[999] rounded px-1.5 py-0.5 text-[10px] leading-tight"
        style={{
          bottom: `${(padding?.bottom ?? 0) + 4}px`,
          background: styleDef.dark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.75)",
          color: styleDef.dark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.7)",
        }}
      >
        {tiles.credit}
      </div>
    </div>
  );
}
