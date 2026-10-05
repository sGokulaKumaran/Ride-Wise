// ============================================================
// RideMap.jsx — the Leaflet map for a ride
//
// This component only DRAWS. It makes no routing decisions and no
// network calls of its own: where the rider is on the route, whether
// they are off it and which way leads back all arrive ready-made in
// the `nav` prop (pages/hooks/useNavigation.js → services/navigation.js).
//
// WHAT IT DRAWS
//   • the basemap, in a style that follows the app theme by default
//   • the route in three parts: ridden (grey) · ahead (blue) · and, when
//     the rider is off it, the purple dashed way back plus the faded
//     stretch that will be skipped
//   • start and destination markers
//   • the rider: position dot, heading arrow and GPS accuracy ring,
//     gliding between fixes instead of jumping
//   • the other riders of a group, with their own way back when they
//     are off the route
//   • the map controls
//
// PROPS
//   ride            ride object (endpoints, names, stored route)
//   nav             live navigation state — omit for a static preview
//   isLive          true while navigating an active ride
//   gpsState        GPS.* from locationService (greys the dot when lost)
//   participants    group riders with { userId, lat, lng, color, … }
//   riderLines      { userId: [[lat, lng], …] } ways back for those riders
//   riderStatus     { userId: { offRoute, distance } }
//   compact         small preview map: only the style switcher is shown
//   padding         { top, bottom } pixels covered by the overlay's bars
//   extraControls   extra buttons for the top-right control rail
//   tc              theme classes (resolved here when omitted)
//   ref             { panTo(lat, lng), followMe(), fitRoute() }
// ============================================================

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { MapContainer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-rotate"; // map rotation plugin (kept loaded; see ENABLE_MAP_ROTATION)
import Icon from "../ui/Icon";
import { useAuth } from "../../../context/AuthContext";
import { useTheme } from "../../hooks/useTheme";
import { buildNavRoute, sliceRoute, routeLatLngs } from "../../../services/navigation";
import {
  formatDistance,
  formatDuration,
  haversineDistance,
  shortPlaceName,
} from "../../../services/routingApi";
import { GPS, getLastKnownLocation, requestFreshFix } from "../../../services/locationService";
import {
  MAP_MAX_ZOOM,
  MAP_STYLES,
  MAP_STYLE_AUTO,
  RIDER_COLORS,
  ROUTE_COLORS,
  loadMapStyleChoice,
  resolveMapStyle,
  routeWeight,
  saveMapStyleChoice,
} from "./mapStyles";

// ===========================================================================
// MAP ROTATION SWITCH
//
// Rotation (two-finger twist on touch, Shift+wheel on desktop) comes from the
// `leaflet-rotate` plugin. It has an OPEN upstream bug — issue #43, "Rotate
// mobile device path don't follow" — where vector layers (the route lines)
// lag behind / drift off the roads while a rotate or zoom gesture is in
// progress, while markers stay perfectly correct. The re-sync in MapBehavior
// below counteracts it.
//
// It stays `false`: rotation is switched off everywhere and the route line is
// guaranteed to sit exactly on the roads. Panning, pinch zoom, double-tap
// zoom and drag all keep working.
// ===========================================================================
const ENABLE_MAP_ROTATION = false;

// ── Camera-follow tuning ─────────────────────────────────────
// Ignore GPS jitter: only pan when the rider actually moved, or when the map
// has drifted far enough that they would leave the visible area.
const FOLLOW_MIN_MOVE_M = 5;     // metres of real movement before re-centring
const FOLLOW_MAX_DRIFT_PX = 45;  // px the rider may drift from their spot
const FOLLOW_ZOOM = 16;          // zoom applied once, when following starts
const GLIDE_MS = 900;            // the position dot glides between fixes

// World boundary — no panning past the edges of the real world.
const WORLD_BOUNDS = L.latLngBounds(L.latLng(-85, -180), L.latLng(85, 180));

// Tile styles whose provider refused to serve us during this visit; their
// key-less fallback is used straight away the next time they are picked.
const brokenStyles = new Set();

// ---------------------------------------------------------------------------
// LEAFLET 1.9 — closing a map with canvas-drawn lines
//
// map.remove() takes its layers away one by one. A line that is removed
// AFTER the canvas renderer itself still asks that renderer to repaint; the
// renderer no longer has a canvas, and the next animation frame threw
// "Cannot read properties of undefined (reading 'save')" — once for every
// map that was closed. A renderer without a canvas has nothing to repaint.
// ---------------------------------------------------------------------------
const redrawCanvas = L.Canvas.prototype._redraw;
if (!redrawCanvas.rwGuarded) {
  L.Canvas.prototype._redraw = function redrawIfAlive() {
    if (!this._ctx) { this._redrawRequest = null; return; }
    redrawCanvas.call(this);
  };
  L.Canvas.prototype._redraw.rwGuarded = true; // survives hot reloads without double wrapping
}

// ---------------------------------------------------------------------------
// Text that goes into Leaflet popups / marker HTML is built as a string, so
// anything that came from a user or a geocoder MUST be escaped. Place names
// are stored with a ride and shown to every member of a group ride — without
// this, a crafted name would run as script in a friend's browser.
// ---------------------------------------------------------------------------
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
  ));
}

// ---------------------------------------------------------------------------
// Marker artwork
// ---------------------------------------------------------------------------
const START_ICON = L.divIcon({
  className: "",
  html: '<div class="rw-start"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -12],
});

const DESTINATION_ICON = L.divIcon({
  className: "",
  html: `<svg class="rw-destination" width="32" height="40" viewBox="0 0 32 40" aria-hidden="true">
    <path d="M16 38.5S29 26.6 29 15.5a13 13 0 1 0-26 0C3 26.6 16 38.5 16 38.5Z"
      fill="#111827" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="16" cy="15.5" r="4.6" fill="#fff"/>
  </svg>`,
  iconSize: [32, 40],
  iconAnchor: [16, 39],
  popupAnchor: [0, -38],
});

const MERGE_ICON = L.divIcon({
  className: "",
  html: '<div class="rw-merge"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const PUCK_ICON = L.divIcon({
  className: "",
  html: `<div class="rw-puck rw-puck--no-heading">
    <div class="rw-puck__halo"></div>
    <div class="rw-puck__pulse"></div>
    <div class="rw-puck__cone"><svg viewBox="0 0 44 44" aria-hidden="true"><path d="M22 2.5 28.5 14.5h-13Z"/></svg></div>
    <div class="rw-puck__dot"></div>
  </div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  popupAnchor: [0, -16],
});

function riderIcon(color, letter, name, offRoute) {
  return L.divIcon({
    className: "",
    html: `<div class="rw-rider${offRoute ? " rw-rider--off" : ""}" style="--rw-rider:${escapeHtml(color)}">
      <div class="rw-rider__dot">${escapeHtml(letter)}</div>
      <div class="rw-rider__name">${escapeHtml(name)}</div>
    </div>`,
    iconSize: [44, 58],
    iconAnchor: [22, 20],
    popupAnchor: [0, -22],
  });
}

// ---------------------------------------------------------------------------
// Map CSS (injected once)
// ---------------------------------------------------------------------------
if (typeof document !== "undefined" && !document.getElementById("rw-map-css")) {
  const style = document.createElement("style");
  style.id = "rw-map-css";
  style.textContent = `
    .leaflet-container { width:100%; height:100%; background:#E5E7EB; font:inherit; -webkit-tap-highlight-color:transparent; }
    .rw-map--dark .leaflet-container { background:#15171C; }
    /* Leaflet's own controls are not used — RideWise draws its own. */
    .leaflet-top, .leaflet-bottom { display:none !important; }

    /* ── Tile rendering artifact fixes ── */
    .leaflet-tile-container img.leaflet-tile { mix-blend-mode: plus-lighter; }
    .leaflet-fade-anim .leaflet-tile { will-change: opacity; }
    /* ── GPU compositing for smoother mobile transforms ── */
    .leaflet-map-pane, .leaflet-tile-pane, .leaflet-overlay-pane { will-change: transform; }
    /* ── Canvas renderer: keep crisp on retina displays ── */
    .leaflet-canvas-container canvas { image-rendering: -webkit-optimize-contrast; }
    .leaflet-container * { -webkit-tap-highlight-color: transparent; }

    /* A dark map made from the standard tiles (fallback for the Dark style) */
    .rw-tiles-invert .leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.92); }

    /* ── Start / destination / merge markers ── */
    .rw-start { width:22px; height:22px; border-radius:50%; background:#fff; border:6px solid #111827;
      box-sizing:border-box; box-shadow:0 0 0 2px #fff, 0 2px 6px rgba(0,0,0,0.35); }
    .rw-destination { display:block; filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35)); }
    .rw-merge { width:16px; height:16px; border-radius:50%; background:#fff; border:4px solid var(--rw-rejoin,#7C3AED);
      box-sizing:border-box; box-shadow:0 1px 4px rgba(0,0,0,0.35); }

    /* ── The rider ── */
    .rw-puck { position:relative; width:44px; height:44px; }
    .rw-puck__halo { position:absolute; left:50%; top:50%; width:0; height:0; border-radius:50%;
      transform:translate(-50%,-50%); background:var(--rw-puck-soft,rgba(47,111,237,0.14));
      border:1px solid var(--rw-puck-line,rgba(47,111,237,0.32)); box-sizing:border-box; pointer-events:none; }
    .rw-puck__pulse { position:absolute; inset:9px; border-radius:50%; background:var(--rw-puck,#2F6FED);
      opacity:0.35; animation:rw-pulse 2.4s ease-out infinite; }
    .rw-puck__cone { position:absolute; inset:0; transform:rotate(var(--rw-heading,0deg)); transition:transform 0.5s ease-out; }
    .rw-puck__cone svg { display:block; width:44px; height:44px; fill:var(--rw-puck,#2F6FED); }
    .rw-puck__dot { position:absolute; left:13px; top:13px; width:18px; height:18px; border-radius:50%;
      background:var(--rw-puck,#2F6FED); border:3px solid #fff; box-sizing:border-box;
      box-shadow:0 1px 5px rgba(0,0,0,0.4); }
    .rw-puck--no-heading .rw-puck__cone { display:none; }
    .rw-puck--stale .rw-puck__dot, .rw-puck--stale .rw-puck__cone svg { background:#9CA3AF; fill:#9CA3AF; }
    .rw-puck--stale .rw-puck__pulse { display:none; }
    @keyframes rw-pulse { 0% { transform:scale(0.9); opacity:0.4; } 70%,100% { transform:scale(2.4); opacity:0; } }

    /* ── Other riders ── */
    .rw-rider { display:flex; flex-direction:column; align-items:center; width:44px; }
    .rw-rider__dot { width:36px; height:36px; border-radius:50%; background:var(--rw-rider,#8B5CF6); color:#fff;
      border:2.5px solid #fff; box-sizing:border-box; display:flex; align-items:center; justify-content:center;
      font:700 14px/1 Inter,system-ui,sans-serif; box-shadow:0 2px 6px rgba(0,0,0,0.4); }
    .rw-rider--off .rw-rider__dot { outline:2px dashed var(--rw-rider,#8B5CF6); outline-offset:2px; }
    .rw-rider__name { margin-top:5px; max-width:96px; padding:2px 7px; border-radius:999px; background:rgba(17,24,39,0.86);
      color:#fff; font:600 11px/1.3 Inter,system-ui,sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

    /* ── Popups ── */
    .rw-popup .leaflet-popup-content-wrapper { border-radius:12px; box-shadow:0 6px 24px rgba(0,0,0,0.22);
      background:#fff; color:#111113; border:1px solid #E4E4E7; }
    .rw-popup .leaflet-popup-content { margin:10px 12px; font:500 13px/1.4 Inter,system-ui,sans-serif; }
    .rw-popup .leaflet-popup-tip { background:#fff; }
    .rw-map--dark .rw-popup .leaflet-popup-content-wrapper { background:#141416; color:#F4F4F5; border-color:#26262B; }
    .rw-map--dark .rw-popup .leaflet-popup-tip { background:#141416; }
    .rw-popup a.leaflet-popup-close-button { color:inherit; opacity:0.55; }
    .rw-popup__title { font-weight:700; font-size:14px; }
    .rw-popup__meta { margin-top:2px; font-size:12px; opacity:0.68; }
    .rw-popup__stats { display:flex; gap:14px; margin-top:8px; padding-top:8px; border-top:1px solid rgba(128,128,128,0.25); }
    .rw-popup__stats b { display:block; font-size:14px; }
    .rw-popup__stats span { font-size:10px; letter-spacing:0.06em; text-transform:uppercase; opacity:0.6; }

    /* Compass needle */
    .rw-compass-needle { transition: transform 0.25s ease-out; }
    /* Zoom buttons are for mouse users; touch users pinch. */
    @media (hover: none), (pointer: coarse) { .rw-pointer-only { display:none !important; } }
  `;
  document.head.appendChild(style);
}

// ===========================================================================
// MapBehavior — keeps vector layers aligned and reports the map bearing
//
// leaflet-rotate has an OPEN upstream bug (issue #43): during gestures,
// Leaflet's renderer skips updates (_animatingZoom guard), so vectors drift.
// Two strategies keep the route line glued to the roads:
//   A) Event-based: re-sync on rotate / zoomend / moveend / resize
//   B) RAF-based: during ACTIVE touch/pointer gestures, force the renderer
//      to update every frame.
// ===========================================================================
function MapBehavior({ onBearingChange }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return undefined;

    const realignVectors = () => {
      const renderer = map._renderer;
      if (renderer && typeof renderer._update === "function") {
        try { renderer._update(); } catch { /* nothing to re-sync */ }
      }
    };

    // ── A) Event-based re-sync (fires on gesture completion) ──
    map.on("rotate", realignVectors);
    map.on("zoomend", realignVectors);
    map.on("moveend", realignVectors);
    map.on("resize", realignVectors);

    // ── B) RAF-based mid-gesture re-sync (fires every frame) ──
    let rafId = null;
    let gestureActive = 0; // counter, not boolean (multi-touch)

    const rafLoop = () => {
      realignVectors();
      rafId = gestureActive > 0 ? requestAnimationFrame(rafLoop) : null;
    };
    const startGestureSync = () => {
      gestureActive += 1;
      if (!rafId) rafId = requestAnimationFrame(rafLoop);
    };
    const stopGestureSync = () => {
      gestureActive = Math.max(0, gestureActive - 1);
      if (gestureActive === 0) realignVectors(); // one final re-sync
    };

    const container = map.getContainer();
    container.addEventListener("touchstart", startGestureSync, { passive: true });
    container.addEventListener("touchend", stopGestureSync, { passive: true });
    container.addEventListener("touchcancel", stopGestureSync, { passive: true });
    container.addEventListener("pointerdown", startGestureSync, { passive: true });
    container.addEventListener("pointerup", stopGestureSync, { passive: true });
    container.addEventListener("pointercancel", stopGestureSync, { passive: true });

    return () => {
      map.off("rotate", realignVectors);
      map.off("zoomend", realignVectors);
      map.off("moveend", realignVectors);
      map.off("resize", realignVectors);
      container.removeEventListener("touchstart", startGestureSync);
      container.removeEventListener("touchend", stopGestureSync);
      container.removeEventListener("touchcancel", stopGestureSync);
      container.removeEventListener("pointerdown", startGestureSync);
      container.removeEventListener("pointerup", stopGestureSync);
      container.removeEventListener("pointercancel", stopGestureSync);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [map]);

  // MIDDLE-CLICK ROTATION — only when ENABLE_MAP_ROTATION is true.
  useEffect(() => {
    if (!map || !ENABLE_MAP_ROTATION || typeof map.setBearing !== "function") return undefined;

    let rotating = false;
    let startX = 0;
    let startBearing = 0;

    const onMouseDown = (e) => {
      if (e.button !== 1) return; // middle click only
      e.preventDefault();
      e.stopPropagation();
      rotating = true;
      startX = e.clientX;
      startBearing = typeof map.getBearing === "function" ? map.getBearing() : 0;
      map.getContainer().style.cursor = "grabbing";
    };
    const onMouseMove = (e) => {
      if (!rotating) return;
      e.preventDefault();
      map.setBearing(startBearing + (e.clientX - startX) * 0.5);
    };
    const onMouseUp = (e) => {
      if (!rotating || e.button !== 1) return;
      rotating = false;
      map.getContainer().style.cursor = "";
    };
    const preventAutoScroll = (e) => { if (e.button === 1) e.preventDefault(); };

    const container = map.getContainer();
    container.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    container.addEventListener("auxclick", preventAutoScroll);
    return () => {
      container.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      container.removeEventListener("auxclick", preventAutoScroll);
    };
  }, [map]);

  // BEARING TRACKING — report rotation to the parent
  useEffect(() => {
    if (!map) return undefined;
    const handleRotate = () => {
      const bearing = typeof map.getBearing === "function" ? map.getBearing() : 0;
      onBearingChange(Math.round(bearing * 10) / 10);
    };
    map.on("rotate", handleRotate);
    return () => map.off("rotate", handleRotate);
  }, [map, onBearingChange]);

  return null;
}

// ===========================================================================
// RideMap
// ===========================================================================
export default function RideMap({
  ride,
  nav = null,
  isLive = false,
  gpsState = GPS.OK,
  participants = [],
  currentUserId = null,
  riderLines = null,
  riderStatus = null,
  compact = false,
  padding = null,
  extraControls = null,
  tc: tcProp,
  ref,
}) {
  const { user } = useAuth();
  const { tc: themeTc } = useTheme(user?.id);
  const tc = tcProp || themeTc;

  const wrapperRef = useRef(null);
  const [map, setMap] = useState(null);           // the Leaflet map instance
  const [bearing, setBearing] = useState(0);
  const [following, setFollowing] = useState(isLive);
  const [showStyles, setShowStyles] = useState(false);
  const [styleChoice, setStyleChoice] = useState(loadMapStyleChoice);
  const [fallbackFor, setFallbackFor] = useState(null);

  // ── Basemap ────────────────────────────────────────────────
  const styleDef = resolveMapStyle(styleChoice, tc.isDark);
  const usingFallback =
    Boolean(styleDef.fallback) && (fallbackFor === styleDef.id || brokenStyles.has(styleDef.id));
  const tiles = usingFallback ? { ...styleDef, ...styleDef.fallback } : styleDef;
  const palette = ROUTE_COLORS[styleDef.dark ? "dark" : "light"];

  // ── Route geometry ─────────────────────────────────────────
  // Live: the navigation hook already indexed it. Preview: index it here.
  const navRoute = nav?.route ?? null;
  const previewRoute = useMemo(
    () => (navRoute ? null : buildNavRoute(ride?.routeCoordinates, null)),
    [navRoute, ride?.routeCoordinates],
  );
  const route = navRoute ?? previewRoute;

  const position = isLive ? nav?.position ?? null : null;
  const heading = isLive ? nav?.heading ?? null : null;

  // ── Latest values for callbacks that must not change identity ──
  const live = useRef({ nav, route, position, padding, ride });
  useEffect(() => {
    live.current = { nav, route, position, padding, ride };
  });

  const followRef = useRef(isLive);          // "keep the map centred on me?"
  const lastFollowRef = useRef(null);        // last position the camera centred on
  const zoomedInRef = useRef(false);         // one-time navigation zoom per map
  const fittedRef = useRef(null);            // what the initial "fit route" was done for

  const setFollow = useCallback((value) => {
    followRef.current = value;
    if (!value) lastFollowRef.current = null;
    setFollowing(value);
  }, []);

  // ====================================================================
  // CAMERA
  // ====================================================================

  // Where the map centre must be so that `lat,lng` appears in the middle of
  // the area NOT covered by the overlay's top and bottom bars.
  const centerFor = useCallback((lat, lng, zoom) => {
    const pad = live.current.padding;
    const shift = ((pad?.bottom ?? 0) - (pad?.top ?? 0)) / 2;
    if (!map || !shift) return L.latLng(lat, lng);
    return map.unproject(map.project([lat, lng], zoom).add([0, shift]), zoom);
  }, [map]);

  // Show the rest of the trip: what is still ahead, the way back when off
  // the route, and the rider.
  const fitRoute = useCallback(({ animate = true, release = true } = {}) => {
    if (!map) return;
    const { nav: currentNav, route: currentRoute, position: here, padding: pad, ride: currentRide } = live.current;

    const points = [];
    if (currentRoute) {
      const from = isLive && currentNav?.progress != null ? currentNav.progress : 0;
      const ahead = sliceRoute(currentRoute, from, currentRoute.total);
      points.push(...(ahead.length ? ahead : routeLatLngs(currentRoute)));
    } else {
      if (Number.isFinite(currentRide?.fromLat)) points.push([currentRide.fromLat, currentRide.fromLng]);
      if (Number.isFinite(currentRide?.destinationLat)) {
        points.push([currentRide.destinationLat, currentRide.destinationLng]);
      }
    }
    if (isLive && currentNav?.rejoin?.line) points.push(...currentNav.rejoin.line);
    if (isLive && here) points.push([here.lat, here.lng]);
    if (!points.length) return;

    if (release) setFollow(false);
    const top = pad?.top ?? 0;
    const bottom = pad?.bottom ?? 0;
    const margin = compact ? 22 : 36;
    map.fitBounds(L.latLngBounds(points), {
      paddingTopLeft: [margin, top + margin],
      paddingBottomRight: [compact ? margin : margin + 36, bottom + margin],
      maxZoom: 17,
      animate,
    });
  }, [map, isLive, compact, setFollow]);

  // Re-arm follow mode and jump to the rider (the re-center button).
  const followMe = useCallback(() => {
    if (!map) return;
    setFollow(true);
    const here = live.current.position ?? getLastKnownLocation();
    if (here) {
      const zoom = Math.max(map.getZoom(), FOLLOW_ZOOM);
      lastFollowRef.current = [here.lat, here.lng];
      map.setView(centerFor(here.lat, here.lng, zoom), zoom, { animate: true, duration: 0.5 });
    }
    // Also ask the hardware for a brand-new fix; it reaches the map through
    // the normal position stream, which only moves the camera while follow
    // is still on — so it can never yank the map back after the rider pans.
    requestFreshFix();
  }, [map, centerFor, setFollow]);

  // Look at a place once (a rider in the group panel). Follow is released.
  const panTo = useCallback((lat, lng) => {
    if (!map || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setFollow(false);
    map.setView([lat, lng], Math.max(map.getZoom(), 14), { animate: true, duration: 0.5 });
  }, [map, setFollow]);

  useImperativeHandle(ref, () => ({ panTo, followMe, fitRoute }), [panTo, followMe, fitRoute]);

  // ── Keep the map sized to its container ──
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

  // ── First view: the whole route ──
  // (Preview maps used to open at zoom 12 on the start point, so a long
  // route was mostly off screen.)
  const fitKey = route ?? `${ride?.fromLat},${ride?.fromLng}|${ride?.destinationLat},${ride?.destinationLng}`;
  useEffect(() => {
    if (!map || fittedRef.current === fitKey) return;
    fittedRef.current = fitKey;
    if (isLive && live.current.position) return; // already following the rider
    map.invalidateSize({ pan: false });
    fitRoute({ animate: false, release: false });
    // A live ride shows the overview only until the rider's position is
    // known: the next fix zooms in on them again. (Without this, a route
    // that finished loading AFTER the first fix left the map zoomed out
    // on the whole trip while "following".)
    zoomedInRef.current = false;
  }, [map, fitKey, isLive, fitRoute]);

  // ====================================================================
  // FOLLOW MODE — released by the rider, re-armed only by the re-center button
  //
  // Listening to the RAW pointer/wheel events on the map container releases
  // follow on the very first touch, scroll or double-tap, no matter what
  // Leaflet decides to do with that gesture. (A `dragstart`-only listener
  // missed drags that Leaflet silently refused — the "rubber band" bug.)
  //
  // Listeners sit on `map.getContainer()` — NOT on the outer wrapper — so
  // RideWise's own on-map buttons never release follow.
  // ====================================================================
  useEffect(() => {
    if (!map) return undefined;
    const container = map.getContainer();
    const release = () => { if (followRef.current) setFollow(false); };

    container.addEventListener("pointerdown", release, { passive: true });
    container.addEventListener("touchstart", release, { passive: true });
    container.addEventListener("wheel", release, { passive: true });
    container.addEventListener("dblclick", release);
    map.on("dragstart", release); // second safety net
    return () => {
      container.removeEventListener("pointerdown", release);
      container.removeEventListener("touchstart", release);
      container.removeEventListener("wheel", release);
      container.removeEventListener("dblclick", release);
      map.off("dragstart", release);
    };
  }, [map, setFollow]);

  // ── Follow the rider ──
  //   • one navigation zoom when follow starts — the rider's own zoom is
  //     never overridden afterwards;
  //   • pan-only afterwards: same zoom ⇒ Leaflet takes the pan path and the
  //     map pane never gets `leaflet-zoom-anim`, the class that silently
  //     blocks dragging;
  //   • GPS jitter is ignored.
  const lat = position?.lat;
  const lng = position?.lng;
  useEffect(() => {
    if (!map || !isLive || lat == null || lng == null || !followRef.current) return;

    if (!zoomedInRef.current) {
      zoomedInRef.current = true;
      lastFollowRef.current = [lat, lng];
      const zoom = Math.max(map.getZoom(), FOLLOW_ZOOM);
      map.setView(centerFor(lat, lng, zoom), zoom, { animate: true, duration: 0.6 });
      return;
    }

    const zoom = map.getZoom();
    const target = centerFor(lat, lng, zoom);
    const driftPx = map.getSize().divideBy(2).distanceTo(map.latLngToContainerPoint(target));
    const last = lastFollowRef.current;
    const movedM = last ? haversineDistance(last[0], last[1], lat, lng) : Infinity;

    if (movedM >= FOLLOW_MIN_MOVE_M || driftPx > FOLLOW_MAX_DRIFT_PX) {
      lastFollowRef.current = [lat, lng];
      map.setView(target, zoom, { animate: true, duration: 0.8, easeLinearity: 1 });
    }
  }, [map, isLive, lat, lng, centerFor]);

  // ====================================================================
  // BASEMAP TILES
  // ====================================================================
  useEffect(() => {
    if (!map) return undefined;

    const layer = L.tileLayer(tiles.url, {
      noWrap: true,               // no tile repetition at the world's edges
      updateWhenZooming: false,   // don't reload tiles mid-zoom animation
      keepBuffer: 4,              // keep 4 rows of off-screen tiles loaded
      // maxZoom MUST match the map's maxZoom. Leaflet's TileLayer default is
      // 18 while the map allows 19; anything past the layer limit makes
      // GridLayer request zero tiles, which blanked the deepest zoom level.
      // (detectRetina stays OFF: it asks for zoom + 1, which nobody serves.)
      maxZoom: MAP_MAX_ZOOM,
      maxNativeZoom: tiles.maxNativeZoom,
    });

    // The provider refuses us (no tile loaded, several failed) → switch to
    // this style's key-less fallback instead of leaving the map blank.
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
    container.classList.toggle("rw-tiles-invert", Boolean(tiles.invert));
    return () => {
      map.removeLayer(layer);
      container.classList.remove("rw-tiles-invert");
    };
  }, [map, tiles.url, tiles.maxNativeZoom, tiles.invert, styleDef.id, styleDef.fallback, usingFallback]);

  const chooseStyle = (choice) => {
    setStyleChoice(choice);
    saveMapStyleChoice(choice);
    setShowStyles(false);
  };

  // ====================================================================
  // ROUTE LINES
  //
  // Six persistent polylines, updated in place (the old code destroyed and
  // re-created every line on each GPS tick). Bottom to top:
  //   passed · skipped · route casing · route · rejoin casing · rejoin
  // ====================================================================
  const linesRef = useRef(null);
  useEffect(() => {
    if (!map) return undefined;
    const make = () => L.polyline([], {
      interactive: false, // never intercept taps meant for the map
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);

    const lines = {
      passed: make(),
      skipped: make(),
      casing: make(),
      route: make(),
      rejoinCasing: make(),
      rejoin: make(),
    };
    linesRef.current = lines;
    return () => {
      Object.values(lines).forEach((line) => map.removeLayer(line));
      linesRef.current = null;
    };
  }, [map]);

  // Colours follow the basemap; widths follow the zoom.
  useEffect(() => {
    const lines = linesRef.current;
    if (!map || !lines) return undefined;

    const restyle = () => {
      const width = routeWeight(map.getZoom());
      lines.casing.setStyle({ color: palette.casing, weight: width + 4, opacity: 0.95 });
      lines.route.setStyle({ color: palette.route, weight: width, opacity: 1 });
      lines.passed.setStyle({ color: palette.passed, weight: Math.max(3, width - 3), opacity: 0.8 });
      lines.skipped.setStyle({ color: palette.route, weight: Math.max(3, width - 2), opacity: 0.32 });
      lines.rejoinCasing.setStyle({ color: palette.casing, weight: width + 3, opacity: 0.9 });
      lines.rejoin.setStyle({
        color: palette.rejoin,
        weight: Math.max(4, width - 1),
        opacity: 1,
        dashArray: `${width + 2} ${width + 7}`,
      });
    };
    restyle();
    map.on("zoomend", restyle);
    return () => map.off("zoomend", restyle);
  }, [map, palette]);

  // Geometry.
  const status = isLive ? nav?.status ?? "locating" : "preview";
  const progress = isLive ? nav?.progress ?? null : null;
  const mergeProgress = isLive ? nav?.mergeProgress ?? null : null;
  const rejoinLine = isLive ? nav?.rejoin?.line ?? null : null;
  const fromLat = ride?.fromLat;
  const fromLng = ride?.fromLng;
  const destLat = ride?.destinationLat;
  const destLng = ride?.destinationLng;
  const routePending = Boolean(ride?.routePending);

  useEffect(() => {
    const lines = linesRef.current;
    if (!map || !lines) return;

    let passed = [];
    let skipped = [];
    let ahead = [];
    let rejoin = [];

    if (!route) {
      // No stored geometry (older rides): a plain line between the endpoints
      // so the map still shows where the ride went. Not while the real
      // route is still on its way, though.
      if (!routePending && [fromLat, fromLng, destLat, destLng].every(Number.isFinite)) {
        ahead = [[fromLat, fromLng], [destLat, destLng]];
      }
    } else if (status === "preview" || status === "locating") {
      ahead = routeLatLngs(route);
    } else if (status === "arrived") {
      passed = routeLatLngs(route);
    } else {
      const done = progress ?? 0;
      passed = sliceRoute(route, 0, done);
      if (status === "off-route") {
        const merge = Math.max(done, mergeProgress ?? done);
        skipped = sliceRoute(route, done, merge);
        ahead = sliceRoute(route, merge, route.total);
        rejoin = rejoinLine ?? [];
      } else {
        ahead = sliceRoute(route, done, route.total);
      }
    }

    lines.passed.setLatLngs(passed);
    lines.skipped.setLatLngs(skipped);
    lines.casing.setLatLngs(ahead);
    lines.route.setLatLngs(ahead);
    lines.rejoinCasing.setLatLngs(rejoin);
    lines.rejoin.setLatLngs(rejoin);
    // A missing route is drawn dashed: it is a guide, not the real road.
    lines.route.setStyle({ dashArray: route ? null : "2 12" });
    lines.casing.setStyle({ opacity: route ? 0.95 : 0 });
  }, [map, route, status, progress, mergeProgress, rejoinLine, fromLat, fromLng, destLat, destLng, routePending]);

  // Where the way back meets the route.
  const mergePoint = isLive && status === "off-route" ? nav?.rejoin?.mergePoint ?? null : null;
  const mergeLat = mergePoint?.lat;
  const mergeLng = mergePoint?.lng;
  useEffect(() => {
    if (!map || mergeLat == null || mergeLng == null) return undefined;
    const marker = L.marker([mergeLat, mergeLng], {
      icon: MERGE_ICON,
      interactive: false,
      keyboard: false,
      zIndexOffset: 300,
    }).addTo(map);
    return () => marker.remove();
  }, [map, mergeLat, mergeLng]);

  // ====================================================================
  // START + DESTINATION MARKERS
  // ====================================================================
  const fromName = shortPlaceName(ride?.fromName, "Start");
  const destName = shortPlaceName(ride?.destinationName, "Destination");
  const rideType = ride?.rideType;
  const plannedDistance = ride?.distanceMeters;
  const plannedDuration = ride?.durationSeconds;

  useEffect(() => {
    if (!map || !Number.isFinite(fromLat) || !Number.isFinite(fromLng)) return undefined;
    const marker = L.marker([fromLat, fromLng], { icon: START_ICON, keyboard: false, zIndexOffset: 200 })
      .addTo(map)
      .bindPopup(
        `<div class="rw-popup__title">${escapeHtml(fromName)}</div>
         <div class="rw-popup__meta">Start${rideType ? ` · ${escapeHtml(rideType === "group" ? "Group ride" : "Solo ride")}` : ""}</div>`,
        { className: "rw-popup" },
      );
    return () => marker.remove();
  }, [map, fromLat, fromLng, fromName, rideType]);

  useEffect(() => {
    if (!map || !Number.isFinite(destLat) || !Number.isFinite(destLng)) return undefined;
    const marker = L.marker([destLat, destLng], { icon: DESTINATION_ICON, keyboard: false, zIndexOffset: 250 })
      .addTo(map)
      .bindPopup(
        `<div class="rw-popup__title">${escapeHtml(destName)}</div>
         <div class="rw-popup__meta">Destination</div>
         <div class="rw-popup__stats">
           <div><b>${escapeHtml(formatDistance(plannedDistance))}</b><span>Route</span></div>
           <div><b>${escapeHtml(formatDuration(plannedDuration))}</b><span>Ride time</span></div>
         </div>`,
        { className: "rw-popup" },
      );
    return () => marker.remove();
  }, [map, destLat, destLng, destName, plannedDistance, plannedDuration]);

  // ====================================================================
  // THE RIDER — position dot, heading arrow, accuracy ring
  //
  // The dot always shows the rider's REAL GPS fix (never a snapped or
  // invented position) and is not draggable.
  // ====================================================================
  const puckRef = useRef(null); // { marker, frame }
  useEffect(() => {
    if (!map || !isLive) return undefined;
    const puck = { marker: null, frame: 0 };
    puckRef.current = puck;
    return () => {
      cancelAnimationFrame(puck.frame);
      puck.marker?.remove();
      puckRef.current = null;
    };
  }, [map, isLive]);

  // Move it — gliding from the previous fix to the new one.
  useEffect(() => {
    const puck = puckRef.current;
    if (!map || !puck || lat == null || lng == null) return;

    if (!puck.marker) {
      puck.marker = L.marker([lat, lng], { icon: PUCK_ICON, zIndexOffset: 1000, keyboard: false })
        .addTo(map)
        .bindPopup('<div class="rw-popup__title">You are here</div>', { className: "rw-popup" });
      return;
    }

    cancelAnimationFrame(puck.frame);
    const from = puck.marker.getLatLng();
    const reduceMotion = document.documentElement.classList.contains("rw-reduce-motion");
    const far = haversineDistance(from.lat, from.lng, lat, lng) > 400; // a jump, not a glide
    if (reduceMotion || far) {
      puck.marker.setLatLng([lat, lng]);
      return;
    }

    const startedAt = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - startedAt) / GLIDE_MS);
      puck.marker?.setLatLng([from.lat + (lat - from.lat) * k, from.lng + (lng - from.lng) * k]);
      if (k < 1) puck.frame = requestAnimationFrame(step);
    };
    puck.frame = requestAnimationFrame(step);
  }, [map, lat, lng]);

  // Heading arrow, GPS-lost state, accuracy ring and colours.
  const accuracy = position?.accuracy ?? null;
  const gpsLost = gpsState === GPS.LOST || gpsState === GPS.DENIED;
  useEffect(() => {
    const puck = puckRef.current;
    const element = puck?.marker?.getElement()?.querySelector(".rw-puck");
    if (!map || !element || lat == null) return undefined;

    element.style.setProperty("--rw-puck", palette.puck);
    element.classList.toggle("rw-puck--stale", gpsLost);
    element.classList.toggle("rw-puck--no-heading", !Number.isFinite(heading));
    if (Number.isFinite(heading)) element.style.setProperty("--rw-heading", `${heading}deg`);

    // The accuracy ring is a DOM element sized in pixels, so resizing it
    // never forces the route canvas to redraw.
    const halo = element.querySelector(".rw-puck__halo");
    const sizeHalo = () => {
      if (!halo) return;
      const metresPerPixel =
        (40_075_016.686 * Math.cos((lat * Math.PI) / 180)) / 2 ** (map.getZoom() + 8);
      const diameter = Number.isFinite(accuracy) ? (accuracy * 2) / metresPerPixel : 0;
      const shown = diameter >= 30 ? Math.min(diameter, 720) : 0; // tiny ring = good fix, no clutter
      halo.style.width = `${shown}px`;
      halo.style.height = `${shown}px`;
    };
    sizeHalo();
    map.on("zoomend", sizeHalo);
    return () => map.off("zoomend", sizeHalo);
  }, [map, lat, lng, heading, accuracy, gpsLost, palette]);

  // ====================================================================
  // GROUP RIDERS — markers
  //
  // A member's marker is created on their first fix, moved as new fixes
  // arrive, and removed when they leave or their position goes stale
  // (the overlay passes lat/lng = null then). No position is ever invented.
  // ====================================================================
  const riderMarkersRef = useRef(new Map()); // userId → { marker, signature }
  useEffect(() => {
    if (!map) return;
    const markers = riderMarkersRef.current;
    const seen = new Set();

    participants.forEach((rider, index) => {
      if (String(rider.userId) === String(currentUserId)) return; // my own dot shows me
      if (!Number.isFinite(rider.lat) || !Number.isFinite(rider.lng)) return;

      const id = String(rider.userId);
      seen.add(id);

      const color = rider.color || RIDER_COLORS[index % RIDER_COLORS.length];
      const name = rider.username || "Rider";
      const letter = rider.avatarLetter || name.charAt(0).toUpperCase();
      const info = riderStatus?.[id];
      const offRoute = Boolean(info?.offRoute);
      const signature = `${color}|${name}|${letter}|${offRoute}|${rider.role}`;

      let entry = markers.get(id);
      if (entry && entry.signature !== signature) {
        entry.marker.remove();
        markers.delete(id);
        entry = null;
      }

      if (entry) {
        entry.marker.setLatLng([rider.lat, rider.lng]);
      } else {
        const marker = L.marker([rider.lat, rider.lng], {
          icon: riderIcon(color, letter, name, offRoute),
          zIndexOffset: 500,
          keyboard: false,
        }).addTo(map);
        marker.bindPopup(
          `<div class="rw-popup__title">${escapeHtml(name)}</div>
           <div class="rw-popup__meta">${rider.role === "admin" ? "Ride admin" : "Rider"}${
             offRoute ? ` · ${escapeHtml(formatDistance(info.distance))} off the route` : " · on the route"
           }</div>`,
          { className: "rw-popup" },
        );
        markers.set(id, { marker, signature });
      }
    });

    // Riders no longer in the list (left / went stale)
    for (const [id, entry] of markers) {
      if (!seen.has(id)) {
        entry.marker.remove();
        markers.delete(id);
      }
    }
  }, [map, participants, currentUserId, riderStatus]);

  useEffect(() => {
    const markers = riderMarkersRef.current;
    return () => {
      markers.forEach((entry) => entry.marker.remove());
      markers.clear();
    };
  }, [map]);

  // ── GROUP RIDERS — their way back to the route (dashed, their colour) ──
  const riderLinesRef = useRef(new Map()); // userId → { casing, line }
  useEffect(() => {
    if (!map) return;
    const drawn = riderLinesRef.current;
    const wanted = riderLines || {};
    const width = Math.max(3, routeWeight(map.getZoom()) - 3);

    for (const [id, points] of Object.entries(wanted)) {
      if (!Array.isArray(points) || points.length < 2) continue;
      const index = participants.findIndex((rider) => String(rider.userId) === id);
      const color = participants[index]?.color || RIDER_COLORS[Math.max(0, index) % RIDER_COLORS.length];

      let entry = drawn.get(id);
      if (!entry) {
        const options = { interactive: false, lineCap: "round", lineJoin: "round" };
        entry = {
          casing: L.polyline(points, options).addTo(map),
          line: L.polyline(points, options).addTo(map),
        };
        drawn.set(id, entry);
      } else {
        entry.casing.setLatLngs(points);
        entry.line.setLatLngs(points);
      }
      entry.casing.setStyle({ color: palette.casing, weight: width + 3, opacity: 0.7 });
      entry.line.setStyle({ color, weight: width, opacity: 0.95, dashArray: `${width + 1} ${width + 6}` });
    }

    for (const [id, entry] of drawn) {
      if (!Array.isArray(wanted[id]) || wanted[id].length < 2) {
        map.removeLayer(entry.casing);
        map.removeLayer(entry.line);
        drawn.delete(id);
      }
    }
  }, [map, riderLines, participants, palette]);

  useEffect(() => {
    const drawn = riderLinesRef.current;
    return () => {
      drawn.forEach((entry) => { entry.casing.remove(); entry.line.remove(); });
      drawn.clear();
    };
  }, [map]);

  // ====================================================================
  // RENDER
  // ====================================================================
  const initialCenter = Number.isFinite(fromLat) && Number.isFinite(fromLng)
    ? [fromLat, fromLng]
    : [13.0827, 80.2707];

  const top = (padding?.top ?? 0) + 12;
  const bottom = (padding?.bottom ?? 0) + 12;
  const control =
    `border rounded-full flex items-center justify-center transition-colors ${tc.mapControl}`;
  const controlSize = compact ? "h-9 w-9" : "h-11 w-11";
  const selectedStyleId = styleChoice === MAP_STYLE_AUTO ? MAP_STYLE_AUTO : styleDef.id;

  return (
    <div
      ref={wrapperRef}
      className={styleDef.dark ? "rw-map--dark" : "rw-map--light"}
      style={{ position: "absolute", inset: 0, "--rw-rejoin": palette.rejoin }}
    >
      <MapContainer
        ref={setMap}
        attributionControl={false /* credit is shown in RideWise's own line below */}
        zoomControl={false}
        center={initialCenter}
        zoom={12}
        scrollWheelZoom
        /* ── Zoom limits ── MAP_MAX_ZOOM is shared with the tile layer, so the
           deepest zoom the map allows is always one the tiles can paint. */
        minZoom={3}
        maxZoom={MAP_MAX_ZOOM}
        /* Integer zoom snapping — prevents fractional-zoom tile artifacts */
        zoomSnap={1}
        zoomDelta={1}
        /* World boundary — no infinite scroll */
        maxBounds={WORLD_BOUNDS}
        maxBoundsViscosity={1.0}
        /* Canvas renderer — GPU-accelerated, no SVG drift on mobile */
        renderer={L.canvas({ padding: 0.5 })}
        /* Rotation (leaflet-rotate) — all switches mirror ENABLE_MAP_ROTATION */
        rotate={ENABLE_MAP_ROTATION}
        touchRotate={ENABLE_MAP_ROTATION}
        shiftKeyRotate={ENABLE_MAP_ROTATION}
        rotateControl={false}
        bearing={0}
        /* Mobile gesture tuning */
        inertiaDeceleration={2000}
        inertiaMaxSpeed={1500}
        bounceAtZoomLimits={false}
        tap={true}
        tapTolerance={15}
        wheelPxPerZoomLevel={120}
        style={{ width: "100%", height: "100%" }}
      >
        <MapBehavior onBearingChange={setBearing} />
      </MapContainer>

      {/* ── Top-right rail: map style · extras from the overlay · zoom ── */}
      <div
        className="absolute z-[1000] flex flex-col items-end gap-2"
        style={{ top: `${top}px`, right: "12px" }}
      >
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
              {/* click-away layer */}
              <div className="fixed inset-0 z-[1]" onClick={() => setShowStyles(false)} />
              <div
                role="menu"
                className={`absolute right-0 z-[2] mt-2 w-56 overflow-hidden rounded-xl border py-1 shadow-lg ${tc.card} ${tc.text}`}
              >
                <p className={`px-3.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider ${tc.sub}`}>
                  Map style
                </p>
                {[{ id: MAP_STYLE_AUTO, label: "Automatic", hint: "Matches your theme" }, ...MAP_STYLES].map((option) => {
                  const selected = selectedStyleId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selected}
                      onClick={() => chooseStyle(option.id)}
                      className={`flex w-full items-center gap-3 px-3.5 py-2 text-left transition-colors ${
                        selected ? tc.navActive : tc.cardHover
                      }`}
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

        {!compact && extraControls}

        {!compact && (
          <div className={`rw-pointer-only flex flex-col overflow-hidden rounded-full border ${tc.mapControl}`}>
            <button
              type="button"
              title="Zoom in"
              aria-label="Zoom in"
              onClick={() => map?.zoomIn()}
              className={`flex h-10 w-11 items-center justify-center transition-colors ${tc.cardHover}`}
            >
              <Icon name="plus" size={18} />
            </button>
            <span className={`mx-2 h-px ${tc.hairline}`} />
            <button
              type="button"
              title="Zoom out"
              aria-label="Zoom out"
              onClick={() => map?.zoomOut()}
              className={`flex h-10 w-11 items-center justify-center transition-colors ${tc.cardHover}`}
            >
              <Icon name="minus" size={18} />
            </button>
          </div>
        )}

        {/* Compass — only when the map is rotated; tap to face north again */}
        {bearing !== 0 && (
          <button
            type="button"
            title="Face north"
            aria-label="Face north"
            onClick={() => map?.setBearing?.(0)}
            className={`${control} ${controlSize}`}
          >
            <span className="rw-compass-needle flex" style={{ transform: `rotate(${-bearing}deg)` }}>
              <Icon name="compass" size={19} />
            </span>
          </button>
        )}
      </div>

      {/* ── Bottom-right: whole route · re-center (live rides) ── */}
      {isLive && !compact && (
        <div
          className="absolute z-[1000] flex flex-col items-end gap-2"
          style={{ bottom: `${bottom}px`, right: "12px" }}
        >
          <button
            type="button"
            title="Show the whole route"
            aria-label="Show the whole route"
            onClick={() => fitRoute()}
            className={`${control} ${controlSize}`}
          >
            <Icon name="overview" size={19} />
          </button>

          {following ? (
            <button
              type="button"
              title="Following your position"
              aria-label="Following your position"
              aria-pressed="true"
              onClick={followMe}
              className={`${control} ${controlSize} ${tc.accent}`}
            >
              <Icon name="navigate" size={19} />
            </button>
          ) : (
            // The map is no longer following → say so, with a labelled button
            <button
              type="button"
              onClick={followMe}
              className={`flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold shadow-sm transition-colors ${tc.btnAccent}`}
            >
              <Icon name="recenter" size={18} />
              Re-center
            </button>
          )}
        </div>
      )}

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
