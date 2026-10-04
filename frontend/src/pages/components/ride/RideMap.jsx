// ============================================================
// RideMap.jsx — Leaflet Map (react-leaflet)
//
//   • MapContainer + TileLayer  → renders the map tiles
//   • DynamicRouteLine          → draws the road-following polyline from
//                                 stored OSRM coordinates; trims behind GPS
//   • L.Marker                  → A (start) and B (destination) pins
//   • Live GPS dot              → updates as myLocation changes
//   • Tile switcher overlay     → change map style at runtime
// ============================================================

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-rotate"; // enables map rotation (two-finger twist, shift+drag)
import { parseRouteSteps } from "../../../services/routingApi";
// NOTE: leaflet-routing-machine intentionally removed.
// We draw polylines directly from stored OSRM coordinates (DynamicRouteLine)
// so we don't need the routing-machine library at all.

// Fix Leaflet marker icon (broken in Vite — same fix as demo)
import markerIconPng   from "leaflet/dist/images/marker-icon.png";
import markerShadowPng from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl:       markerIconPng,
  shadowUrl:     markerShadowPng,
  iconRetinaUrl: markerIconPng,
});

// ---------------------------------------------------------------------------
// Tile options
//
// maxNativeZoom is the HIGHEST zoom the provider actually publishes tiles
// for; maxZoom is how far the LAYER is allowed to be driven.
//
// WHY THIS MATTERS — "the last zoom level goes blank/grey":
//   1. TileLayer's built-in default maxZoom is 18, and detectRetina drops it
//      further (to 17). MapContainer, however, allows the map to reach 19.
//      In GridLayer._setView(), a tileZoom above the layer's maxZoom sets
//      tileZoom = undefined, and with tileZoom undefined Leaflet requests NO
//      tiles at all — so the deepest zoom level(s) painted an empty pane.
//      The layer's maxZoom is therefore always set to match the map's.
//
//   2. detectRetina makes Leaflet request tiles at (zoom + 1), i.e. z20 here,
//      which no provider below publishes. Every one of those requests 404s.
//      It stays OFF so the tile URL always matches a level that exists.
//
//   3. maxNativeZoom tells Leaflet where each source genuinely stops, so past
//      that it upscales the deepest real tile instead of requesting a
//      zoom level that doesn't exist.
// ---------------------------------------------------------------------------
const MAP_MAX_ZOOM = 19;

const TILE_LAYERS = [
  { label: " Default",   url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attr: "© OpenStreetMap", maxNativeZoom: 19 },
  { label: " Cycle",     url: "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png", attr: "© CyclOSM", maxNativeZoom: 18 },
  { label: " Dark",      url: "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png", attr: "© Stadia", maxNativeZoom: 20 },
  { label: " Satellite", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attr: "© ArcGIS", maxNativeZoom: 19 },
  { label: " Terrain",   url: "https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png", attr: "© Stadia", maxNativeZoom: 20 },
];

// ---------------------------------------------------------------------------
// Custom pin icons
// ---------------------------------------------------------------------------
const RIDER_COLORS = [
  "#8b5cf6", // purple
  "#14b8a6", // teal
  "#f59e0b", // amber
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#f43f5e", // rose
  "#6366f1", // indigo
  "#84cc16", // lime
  "#e11d48", // crimson
];

function makeRiderIcon(color, letter, name) {
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.4))">
      <div style="position:relative;width:44px;height:44px;background:${color};border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 0 ${color}66;animation:rw-rider-pulse 3s infinite">
        <span style="font-size:14px;font-weight:900;color:#fff;font-family:system-ui">${letter}</span>
      </div>
      <div style="margin-top:4px;background:rgba(0,0,0,0.6);padding:2px 6px;border-radius:4px;color:#fff;font-size:11px;font-family:system-ui;white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,0.8)">
        ${name}
      </div>
    </div>`,
    iconSize:    [44, 60],
    iconAnchor:  [22, 30],
    popupAnchor: [0, -30],
  });
}

function makePinIcon(color, letter) {
  return L.divIcon({
    className: "",
    html: `<div style="width:36px;height:44px;display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 4px 10px ${color}88)">
      <div style="width:36px;height:36px;background:linear-gradient(145deg,${color},${color}cc);border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;display:flex;align-items:center;justify-content:center;box-sizing:border-box">
        <span style="transform:rotate(45deg);font-size:14px;font-weight:900;color:#fff;line-height:1;font-family:system-ui">${letter}</span>
      </div>
    </div>`,
    iconSize:    [36, 44],
    iconAnchor:  [18, 44],
    popupAnchor: [0, -44],
  });
}

const ICON_A = makePinIcon("#22c55e", "A");
const ICON_B = makePinIcon("#ef4444", "B");

const GPS_ICON = L.divIcon({
  className: "",
  html: `<div style="position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center">
    <div style="position:absolute;inset:0;border-radius:50%;background:rgba(66,133,244,0.2);animation:rw-pulse 2.2s ease-out infinite"></div>
    <div style="position:relative;z-index:2;width:20px;height:20px;background:linear-gradient(145deg,#60a5fa,#1d4ed8);border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 3px rgba(66,133,244,0.35),0 3px 12px rgba(66,133,244,0.75)"></div>
  </div>`,
  iconSize:    [52, 52],
  iconAnchor:  [26, 26],
  popupAnchor: [0, -28],
});

// ===========================================================================
// MAP ROTATION SWITCH
//
// Rotation (two-finger twist on touch, Shift+wheel on desktop) comes from the
// `leaflet-rotate` plugin. It has an OPEN upstream bug — issue #43, "Rotate
// mobile device path don't follow" — where vector layers (our route line and
// its white outline) lag behind / drift off the roads while a rotate or zoom
// gesture is in progress, while markers stay perfectly correct. The re-sync in
// MapBehavior below counteracts it (it refreshes the vector renderer whenever
// the map rotates / zooms / moves).
//
// If the route line ever looks misaligned again, set this to `false`: rotation
// is switched off everywhere (no twist, no Shift+wheel, nothing to desync) and
// the route line is guaranteed to sit exactly on the roads. Panning, pinch
// zoom, double-tap zoom and drag all keep working.
// ===========================================================================
const ENABLE_MAP_ROTATION = false;

// Inject animation CSS
if (typeof document !== "undefined" && !document.getElementById("rw-leaflet-css")) {
  const s = document.createElement("style");
  s.id = "rw-leaflet-css";
  s.textContent = `
    @keyframes rw-pulse { 0%{transform:scale(0.85);opacity:0.9} 60%{transform:scale(2.6);opacity:0} 100%{transform:scale(0.85);opacity:0} }
    @keyframes rw-rider-pulse { 0%{box-shadow:0 0 0 0 rgba(255,255,255,0.4)} 70%{box-shadow:0 0 0 10px rgba(255,255,255,0)} 100%{box-shadow:0 0 0 0 rgba(255,255,255,0)} }
    .leaflet-container { width:100%; height:100%; -webkit-tap-highlight-color: transparent; }
    /* Hide Leaflet controls at the top (zoom buttons, default rotate compass) */
    .leaflet-top { display: none !important; }
    /* Push Leaflet controls (attribution) up so they clear the stats bar. */
    .leaflet-bottom { bottom: calc(var(--rw-bottom-bar-h, 140px) + 8px) !important; }
    /* Make sure our custom overlay controls are always clickable and on top */
    .rw-custom-control { z-index: 9999 !important; pointer-events: auto !important; }
    /* Compass needle transition */
    .rw-compass-needle { transition: transform 0.25s ease-out; }
    /* ── Tile rendering artifact fixes ── */
    .leaflet-tile-container img.leaflet-tile {
      mix-blend-mode: plus-lighter;
    }
    .leaflet-fade-anim .leaflet-tile {
      will-change: opacity;
    }
    /* ── GPU compositing for smoother mobile transforms ── */
    .leaflet-map-pane,
    .leaflet-tile-pane,
    .leaflet-overlay-pane {
      will-change: transform;
    }
    /* ── Canvas renderer: keep crisp on retina displays ── */
    .leaflet-canvas-container canvas {
      image-rendering: -webkit-optimize-contrast;
    }
    /* ── Prevent touch delay / tap highlight on mobile ── */
    .leaflet-container * {
      -webkit-tap-highlight-color: transparent;
    }
  `;
  document.head.appendChild(s);
}

// ── Camera-follow tuning (see the GPS dot effect below) ──────────────
// Ignore GPS jitter: only pan when the rider actually moved, or when the map
// has drifted far enough that they would walk off screen.
const FOLLOW_MIN_MOVE_M  = 5;    // metres of real movement before re-centring
const FOLLOW_MAX_DRIFT_PX = 45;  // px the rider may drift from the centre
const FOLLOW_ZOOM        = 16;   // zoom applied once, when following starts

// ===========================================================================
// DynamicRouteLine — Smart route drawing:
//   • ON-ROUTE  (within 300m of saved path) → trims polyline behind GPS
//   • OFF-ROUTE (more than 300m away)       → fetches fresh OSRM road route
//                                             from current GPS to destination
// ===========================================================================

// How far (metres) the GPS must be from the saved route before we reroute
const OFF_ROUTE_THRESHOLD_M = 300;
// Only call OSRM reroute again if GPS moved more than this since last call
const REROUTE_DEBOUNCE_M    = 150;
// OSRM endpoint (same as routingApi.js)
const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

// Haversine distance in metres (self-contained — no external import needed)
function getDistance(lat1, lon1, lat2, lon2) {
  const R  = 6371e3;
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a  = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Draw (or redraw) a two-layer polyline (white outline + blue fill)
function drawPolyline(map, routeRef, coords) {
  if (routeRef.current) { map.removeLayer(routeRef.current); }
  const outline = L.polyline(coords, { color: "#ffffff", weight: 20, opacity: 0.9 });
  const inline  = L.polyline(coords, { color: "#4285F4", weight: 12, opacity: 1.0 });
  routeRef.current = L.layerGroup([outline, inline]).addTo(map);
}

// Draw (or redraw) a two-layer polyline (white outline + purple dashed fill)
// Used for off-route "rejoin" lines that guide a rider back to the main route.
function drawRejoinPolyline(map, ref, coords, color = "#8b5cf6") {
  if (ref.current) { map.removeLayer(ref.current); }
  if (!coords || coords.length < 2) return;
  const outline = L.polyline(coords, { color: "#ffffff", weight: 16, opacity: 0.7 });
  const inline  = L.polyline(coords, { color, weight: 8, opacity: 0.9, dashArray: "12 8" });
  ref.current = L.layerGroup([outline, inline]).addTo(map);
}

function DynamicRouteLine({ ride, myLocation, isLive, onRouteStatus }) {
  const map = useMap();

  // Refs — we use refs (not state) to avoid re-render loops
  const routeRef              = useRef(null); // blue main route layer group
  const rejoinRef             = useRef(null); // purple rejoin layer group
  const reroutedRef           = useRef(null); // cached off-route OSRM rejoin coords
  const rejoinStepsRef        = useRef(null); // cached rejoin turn-by-turn steps
  const lastReroutePos        = useRef(null); // GPS position of last OSRM call
  const isFetchingRef         = useRef(false);// guard against concurrent fetches

  useEffect(() => {
    if (!map || !ride?.routeCoordinates) return;

    // ── 1. Parse the saved OSRM coordinates ──────────────────────────────
    let savedCoords; // [[lat,lng], ...] for Leaflet
    try {
      const raw = typeof ride.routeCoordinates === "string"
        ? JSON.parse(ride.routeCoordinates)
        : ride.routeCoordinates;
      // OSRM stores [lng, lat] — flip to Leaflet's [lat, lng]
      savedCoords = raw.map(pt => [pt[1], pt[0]]);
    } catch (e) {
      console.error("[DynamicRouteLine] Failed to parse routeCoordinates:", e);
      return;
    }

    // ── 2. Non-live / no GPS → draw full saved route, clear any rejoin ───
    if (!isLive || !myLocation?.lat) {
      drawPolyline(map, routeRef, savedCoords);
      if (rejoinRef.current) { map.removeLayer(rejoinRef.current); rejoinRef.current = null; }
      rejoinStepsRef.current = null;
      if (onRouteStatus) onRouteStatus({ isOffRoute: false, rejoinSteps: null, rejoinDistance: null });
      return;
    }

    // ── 3. Find the closest point on the saved route to current GPS ───────
    let minDist      = Infinity;
    let closestIndex = 0;
    for (let i = 0; i < savedCoords.length; i++) {
      const d = getDistance(myLocation.lat, myLocation.lng, savedCoords[i][0], savedCoords[i][1]);
      if (d < minDist) { minDist = d; closestIndex = i; }
    }

    // ── 4. ON-ROUTE: trim the saved polyline behind GPS, clear purple ─────
    if (minDist <= OFF_ROUTE_THRESHOLD_M) {
      // Clear any cached reroute — we're back on the original path
      reroutedRef.current    = null;
      lastReroutePos.current = null;
      rejoinStepsRef.current = null;

      // Remove purple rejoin line
      if (rejoinRef.current) { map.removeLayer(rejoinRef.current); rejoinRef.current = null; }

      // Slice off everything behind us; add exact GPS as first point
      const trimmed = [
        [myLocation.lat, myLocation.lng],
        ...savedCoords.slice(closestIndex),
      ];
      drawPolyline(map, routeRef, trimmed);
      if (onRouteStatus) onRouteStatus({ isOffRoute: false, rejoinSteps: null, rejoinDistance: null });
      return;
    }

    // ── 5. OFF-ROUTE: draw remaining main route as blue ───────────────────
    const remainingBlue = savedCoords.slice(closestIndex);
    drawPolyline(map, routeRef, remainingBlue);

    // ── 6. OFF-ROUTE: draw cached rejoin (purple) while fetching new one ──
    if (reroutedRef.current) {
      drawRejoinPolyline(map, rejoinRef, reroutedRef.current);
    }

    // Report off-route status with cached steps (or null if first time)
    if (onRouteStatus) onRouteStatus({ isOffRoute: true, rejoinSteps: rejoinStepsRef.current, rejoinDistance: minDist });

    // ── 7. OFF-ROUTE: debounce — only call OSRM if moved enough ──────────
    const lastPos = lastReroutePos.current;
    const movedSinceLastReroute = !lastPos
      || getDistance(myLocation.lat, myLocation.lng, lastPos.lat, lastPos.lng) > REROUTE_DEBOUNCE_M;

    if (!movedSinceLastReroute || isFetchingRef.current) return;

    // ── 8. OFF-ROUTE: fetch road route from GPS → nearest main route point ─
    isFetchingRef.current  = true;
    lastReroutePos.current = { lat: myLocation.lat, lng: myLocation.lng };

    const joinLat = savedCoords[closestIndex][0];
    const joinLng = savedCoords[closestIndex][1];
    const url = `${OSRM_BASE}/${myLocation.lng},${myLocation.lat};${joinLng},${joinLat}?overview=full&geometries=geojson&steps=true`;

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (data.code === "Ok" && data.routes?.[0]) {
          const route = data.routes[0];
          // Flip [lng,lat] → [lat,lng] for Leaflet
          const newCoords = route.geometry.coordinates.map(pt => [pt[1], pt[0]]);
          reroutedRef.current = newCoords;
          drawRejoinPolyline(map, rejoinRef, newCoords);

          // Parse rejoin turn-by-turn steps for the navigation bar
          const rawSteps = route.legs?.flatMap(leg => leg.steps || []) || [];
          const parsed = parseRouteSteps(rawSteps);
          // Override the last step's instruction to say "rejoin" instead of "arrive"
          if (parsed.length > 0) {
            const last = parsed[parsed.length - 1];
            if (last.maneuverType === "arrive") {
              last.instruction = "Rejoin the main route";
            }
          }
          rejoinStepsRef.current = parsed;
          if (onRouteStatus) onRouteStatus({ isOffRoute: true, rejoinSteps: parsed, rejoinDistance: route.distance || minDist });
        }
      })
      .catch(err => {
        console.warn("[DynamicRouteLine] Rejoin route fetch failed:", err.message);
        // Fallback: draw straight purple line from GPS → nearest main route point
        const fallback = [
          [myLocation.lat, myLocation.lng],
          savedCoords[closestIndex],
        ];
        drawRejoinPolyline(map, rejoinRef, fallback);
        if (onRouteStatus) onRouteStatus({ isOffRoute: true, rejoinSteps: null, rejoinDistance: minDist });
      })
      .finally(() => { isFetchingRef.current = false; });

  }, [map, ride?.routeCoordinates, ride?.destinationLat, ride?.destinationLng, isLive, myLocation?.lat, myLocation?.lng, onRouteStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (routeRef.current) { map?.removeLayer(routeRef.current); }
      if (rejoinRef.current) { map?.removeLayer(rejoinRef.current); }
    };
  }, [map]);

  return null;
}

// ===========================================================================
// RiderRejoinLines — Purple dashed lines for off-route GROUP RIDERS
//
// For each participant (not self) whose GPS is >300m from the main route,
// fetches an OSRM road route from their position to the nearest point on
// the main route and draws it as a purple dashed polyline.
// The line disappears when the rider gets back on route.
// ===========================================================================
function RiderRejoinLines({ participants, currentUserId, routeCoordinates }) {
  const map = useMap();
  const linesRef    = useRef({});  // userId → L.layerGroup
  const lastPosRef  = useRef({});  // userId → { lat, lng } of last OSRM call
  const fetchingRef = useRef({});  // userId → boolean

  useEffect(() => {
    if (!map || !routeCoordinates || !participants?.length) return;

    // Parse saved route coords
    let savedCoords;
    try {
      const raw = typeof routeCoordinates === "string"
        ? JSON.parse(routeCoordinates) : routeCoordinates;
      savedCoords = raw.map(pt => [pt[1], pt[0]]); // flip to [lat, lng]
    } catch { return; }

    const activeIds = new Set();

    // Stagger OSRM fetches to avoid rate-limiting
    let fetchDelay = 0;

    participants.forEach(p => {
      // Skip self — DynamicRouteLine handles the current user's rejoin line
      if (String(p.userId) === String(currentUserId)) return;
      // No GPS fix → skip (no line to draw)
      if (!p.lat || !p.lng) return;

      const key = String(p.userId);
      activeIds.add(key);

      // Find distance to nearest main route point
      let minDist = Infinity;
      let closestIdx = 0;
      for (let i = 0; i < savedCoords.length; i++) {
        const d = getDistance(p.lat, p.lng, savedCoords[i][0], savedCoords[i][1]);
        if (d < minDist) { minDist = d; closestIdx = i; }
      }

      // ON-ROUTE: remove any existing purple line for this rider
      if (minDist <= OFF_ROUTE_THRESHOLD_M) {
        if (linesRef.current[key]) {
          map.removeLayer(linesRef.current[key]);
          delete linesRef.current[key];
          delete lastPosRef.current[key];
        }
        return;
      }

      // OFF-ROUTE: check if rider moved enough to warrant a new OSRM fetch
      const last = lastPosRef.current[key];
      const moved = !last || getDistance(p.lat, p.lng, last.lat, last.lng) > REROUTE_DEBOUNCE_M;
      if (!moved || fetchingRef.current[key]) return;

      fetchingRef.current[key] = true;
      lastPosRef.current[key] = { lat: p.lat, lng: p.lng };

      const joinLat = savedCoords[closestIdx][0];
      const joinLng = savedCoords[closestIdx][1];
      const url = `${OSRM_BASE}/${p.lng},${p.lat};${joinLng},${joinLat}?overview=full&geometries=geojson`;
      const riderColor = p.color || "#8b5cf6";

      // Stagger fetches by 200ms per rider to avoid OSRM rate limits
      const delay = fetchDelay;
      fetchDelay += 200;

      setTimeout(() => {
        fetch(url)
          .then(r => r.json())
          .then(data => {
            if (data.code === "Ok" && data.routes?.[0]) {
              const coords = data.routes[0].geometry.coordinates.map(pt => [pt[1], pt[0]]);
              if (linesRef.current[key]) map.removeLayer(linesRef.current[key]);
              const outline = L.polyline(coords, { color: "#ffffff", weight: 14, opacity: 0.6 });
              const inline  = L.polyline(coords, { color: riderColor, weight: 7, opacity: 0.85, dashArray: "10 6" });
              linesRef.current[key] = L.layerGroup([outline, inline]).addTo(map);
            }
          })
          .catch(() => {
            // Fallback: straight line from rider → nearest route point
            if (linesRef.current[key]) map.removeLayer(linesRef.current[key]);
            const fallback = [[p.lat, p.lng], savedCoords[closestIdx]];
            const outline = L.polyline(fallback, { color: "#ffffff", weight: 14, opacity: 0.6 });
            const inline  = L.polyline(fallback, { color: riderColor, weight: 7, opacity: 0.85, dashArray: "10 6" });
            linesRef.current[key] = L.layerGroup([outline, inline]).addTo(map);
          })
          .finally(() => { fetchingRef.current[key] = false; });
      }, delay);
    });

    // Clean up lines for riders who left or are no longer in participants
    Object.keys(linesRef.current).forEach(key => {
      if (!activeIds.has(key)) {
        map.removeLayer(linesRef.current[key]);
        delete linesRef.current[key];
        delete lastPosRef.current[key];
      }
    });
  }, [map, participants, currentUserId, routeCoordinates]);

  // Cleanup all on unmount
  useEffect(() => {
    return () => {
      Object.values(linesRef.current).forEach(layer => {
        try { map?.removeLayer(layer); } catch {}
      });
      linesRef.current = {};
    };
  }, [map]);

  return null;
}

// ===========================================================================
// MapInternals — all hook-based components inside MapContainer
// ===========================================================================
function MapInternals({ ride, myLocation, isLive, tileLayerRef, activeTileIdx, participants = [], currentUserId = null }) {
  const map = useMap();
  const markerARef = useRef(null);
  const markerBRef = useRef(null);
  const gpsDotRef  = useRef(null);
  // Camera-follow state. `followRef` = "keep the map centred on me?".
  // It starts ON (navigation mode) and is switched OFF by the rider the moment
  // they touch the map, and back ON only when they press the re-center button.
  const followRef  = useRef(true);
  const lastFollowPosRef = useRef(null);   // last position we centred on
  const didInitialZoomRef = useRef(false); // one-time navigation zoom per ride
  const riderMarkersRef = useRef({});

  // ── Group Rider Markers ──
  // Real live positions: a member's marker is created on first fix, moved as
  // new fixes arrive, and removed when they leave or their position goes
  // stale (ActiveRideOverlay passes lat/lng = null in that case).
  //
  // Each marker is keyed by `userId`. When a rider's appearance changes
  // (color, username) the old marker is destroyed and a fresh one is placed,
  // so the icon always matches the panel.
  const riderMetaRef = useRef({}); // userId → { color, username } last used

  useEffect(() => {
    if (!map) return;
    
    const currentMarkerIds = new Set();
    
    participants.forEach((p, index) => {
      // Skip self — the blue GPS dot already shows my position
      if (p.userId === currentUserId) return;
      // No coordinates → rider is stale/unavailable, skip (marker will be removed below)
      if (!p.lat || !p.lng) return;
      
      const key = String(p.userId);
      currentMarkerIds.add(key);

      const color = p.color || RIDER_COLORS[index % RIDER_COLORS.length];
      const letter = p.avatarLetter || (p.username ? p.username.charAt(0).toUpperCase() : "?");
      const name = p.username || "Rider";

      // Check if the marker's visual identity changed (color or name)
      const prevMeta = riderMetaRef.current[key];
      const metaChanged = prevMeta && (prevMeta.color !== color || prevMeta.name !== name);

      // If appearance changed, destroy the old marker so a fresh icon is created
      if (metaChanged && riderMarkersRef.current[key]) {
        riderMarkersRef.current[key].remove();
        delete riderMarkersRef.current[key];
      }
      
      if (riderMarkersRef.current[key]) {
        // Existing marker — smoothly move it to the newest position
        riderMarkersRef.current[key].setLatLng([p.lat, p.lng]);
      } else {
        // New marker — create with the rider's icon and popup
        const icon = makeRiderIcon(color, letter, name);
        
        const marker = L.marker([p.lat, p.lng], {
          icon,
          zIndexOffset: 500,
          interactive: true,
        }).addTo(map);
        
        marker.bindPopup(`
          <div style="font-family:system-ui;text-align:center;padding:2px 0">
            <div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:4px">
              <span style="width:24px;height:24px;border-radius:50%;background:${color};display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:11px">${letter}</span>
              <strong style="font-size:13px">${name}</strong>
            </div>
            <span style="font-size:11px;color:#666;font-weight:600">${p.role === "admin" ? " Ride Admin" : " Rider"}</span>
          </div>
        `);
        
        riderMarkersRef.current[key] = marker;
      }

      // Record the visual identity for the next render cycle
      riderMetaRef.current[key] = { color, name };
    });
    
    // Remove markers for participants no longer in the list (left / went stale)
    Object.keys(riderMarkersRef.current).forEach(key => {
      if (!currentMarkerIds.has(key)) {
        riderMarkersRef.current[key].remove();
        delete riderMarkersRef.current[key];
        delete riderMetaRef.current[key];
      }
    });
    
  }, [map, participants, currentUserId]);

  // Cleanup all rider markers on unmount
  useEffect(() => {
    return () => {
      Object.values(riderMarkersRef.current).forEach(m => m.remove());
      riderMarkersRef.current = {};
    };
  }, []);

  // Store tile layer ref
  useEffect(() => {
    if (!map) return;
    map.eachLayer(l => { if (l instanceof L.TileLayer) tileLayerRef.current = l; });
  }, [map, activeTileIdx]); // re-check when tile changes

  // ====================================================================
  // FOLLOW MODE — released by the rider, re-armed only by the re-center button
  //
  // BUG FIXED ("rubber band"): the map used to snap back to the rider
  // forever, even while the rider tried to pan away.
  //   • follow was ONLY switched off by a `dragstart` event;
  //   • but Leaflet silently refuses to start a drag while the map pane
  //     carries the `leaflet-zoom-anim` class (see Draggable._onDown), and
  //     our old follow code forced a zoom animation on every GPS tick — so
  //     drags kept being dropped, `dragstart` never fired, and follow was
  //     never released;
  //   • a drag that began on the GPS dot (an interactive marker) also never
  //     reached Leaflet's drag handler.
  //
  // Listening to the RAW pointer/wheel events on the map container fixes all
  // of that: the very first touch, scroll or double-tap releases follow,
  // no matter what Leaflet decides to do with that gesture.
  //
  // Listeners sit on `map.getContainer()` — NOT on the outer wrapper — so our
  // own on-map buttons (re-center, map style, compass) never release follow.
  // ====================================================================
  useEffect(() => {
    if (!map) return;
    const container = map.getContainer();
    const release = () => {
      followRef.current = false;
      lastFollowPosRef.current = null;
    };

    container.addEventListener("pointerdown", release, { passive: true });
    container.addEventListener("touchstart",  release, { passive: true });
    container.addEventListener("wheel",       release, { passive: true });
    container.addEventListener("dblclick",    release);
    map.on("dragstart", release);            // second safety net

    return () => {
      container.removeEventListener("pointerdown", release);
      container.removeEventListener("touchstart",  release);
      container.removeEventListener("wheel",       release);
      container.removeEventListener("dblclick",    release);
      map.off("dragstart", release);
    };
  }, [map]);

  // ====================================================================
  // CAMERA REQUESTS — three different intents, three different events
  //
  //   rw-follow-me → the rider PRESSED the re-center button:
  //                  switch follow back ON and snap to their position.
  //   rw-pan-to    → someone tapped a rider in the group panel:
  //                  look at that rider ONCE, follow stays as it is.
  //   rw-recenter  → a position update arrived (cached fix / fresh hardware
  //                  fix / restored position). This one must NEVER re-arm
  //                  follow by itself, which is what used to yank the map
  //                  back to the rider seconds AFTER they had panned away
  //                  (`getCurrentPosition` can answer up to 15s later).
  // ====================================================================
  useEffect(() => {
    if (!map) return;

    const panToPoint = (lat, lng) =>
      map.setView([lat, lng], map.getZoom(), { animate: true, duration: 0.5 });

    const handleFollowMe = () => {
      followRef.current = true;          // explicit rider request
      lastFollowPosRef.current = null;
      if (myLocation?.lat) panToPoint(myLocation.lat, myLocation.lng);
    };

    const handlePanTo = (e) => {
      const { lat, lng } = e.detail || {};
      if (typeof lat === "number" && typeof lng === "number") panToPoint(lat, lng);
    };

    const handleRecenter = (e) => {
      if (!followRef.current) return;    // rider is exploring → hands off
      const { lat, lng } = e.detail || {};
      if (typeof lat === "number" && typeof lng === "number") panToPoint(lat, lng);
    };

    window.addEventListener("rw-follow-me", handleFollowMe);
    window.addEventListener("rw-pan-to",    handlePanTo);
    window.addEventListener("rw-recenter",  handleRecenter);
    return () => {
      window.removeEventListener("rw-follow-me", handleFollowMe);
      window.removeEventListener("rw-pan-to",    handlePanTo);
      window.removeEventListener("rw-recenter",  handleRecenter);
    };
  }, [map, myLocation?.lat, myLocation?.lng]);

  // A marker (start)
  useEffect(() => {
    if (!map || !ride?.fromLat) return;
    const ll   = [ride.fromLat, ride.fromLng];
    const name = (ride.fromName || "Start").split(",")[0];
    if (markerARef.current) {
      markerARef.current.setLatLng(ll);
    } else {
      markerARef.current = L.marker(ll, { icon: ICON_A })
        .addTo(map)
        .bindPopup(`<div style="font-family:system-ui;padding:4px 0;min-width:130px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="background:#22c55e;color:#fff;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:900">A</span>
            <strong style="color:#111;font-size:14px">${name}</strong>
          </div>
          <span style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:50px;padding:2px 8px;font-size:11px;color:#166534;font-weight:600">
            ${ride.rideType === "solo" ? " Solo Ride" : " Group Ride"}
          </span>
        </div>`);
    }
    return () => { markerARef.current?.remove(); markerARef.current = null; };
  }, [map, ride?.fromLat, ride?.fromLng]); // eslint-disable-line

  // B marker (destination)
  useEffect(() => {
    if (!map || !ride?.destinationLat) return;
    const ll   = [ride.destinationLat, ride.destinationLng];
    const name = (ride.destinationName || "Destination").split(",")[0];
    const dist = ride.distanceMeters
      ? ride.distanceMeters >= 1000
        ? (ride.distanceMeters / 1000).toFixed(1) + " km"
        : Math.round(ride.distanceMeters) + " m"
      : "—";
    const eta = ride.durationSeconds
      ? ride.durationSeconds >= 3600
        ? Math.floor(ride.durationSeconds / 3600) + "h " + Math.floor((ride.durationSeconds % 3600) / 60) + "m"
        : Math.round(ride.durationSeconds / 60) + " min"
      : "—";

    if (markerBRef.current) {
      markerBRef.current.setLatLng(ll);
    } else {
      markerBRef.current = L.marker(ll, { icon: ICON_B })
        .addTo(map)
        .bindPopup(`<div style="font-family:system-ui;padding:4px 0;min-width:160px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="background:#ef4444;color:#fff;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:900">B</span>
            <strong style="color:#111;font-size:14px">${name}</strong>
          </div>
          <div style="display:flex;gap:14px;padding-top:4px;border-top:1px solid #f0f0f0">
            <div style="text-align:center">
              <div style="font-size:16px;font-weight:900;color:#ef4444">${dist}</div>
              <div style="font-size:9px;color:#999;text-transform:uppercase">Distance</div>
            </div>
            <div style="width:1px;background:#f0f0f0"></div>
            <div style="text-align:center">
              <div style="font-size:16px;font-weight:900;color:#333">${eta}</div>
              <div style="font-size:9px;color:#999;text-transform:uppercase">ETA</div>
            </div>
          </div>
        </div>`);
    }
    return () => { markerBRef.current?.remove(); markerBRef.current = null; };
  }, [map, ride?.destinationLat, ride?.destinationLng]); // eslint-disable-line

  // GPS dot (live position)
  // NOT draggable: the dot always shows the rider's REAL GPS fix. Dragging
  // it used to fire a fake "simulate-gps" position, which could publish an
  // invented location to the rider's group (requirement 9).
  useEffect(() => {
    if (!map || !myLocation?.lat) return;
    const ll = [myLocation.lat, myLocation.lng];
       if (gpsDotRef.current) {
      gpsDotRef.current.setLatLng(ll);
    } else {
      gpsDotRef.current = L.marker(ll, {
        icon: GPS_ICON,
        zIndexOffset: 1000,
        interactive: true,
      })
      .addTo(map)
      .bindPopup("<div style='font-family:system-ui;font-size:13px;font-weight:700'> You are here</div>");
    }
    // ── Camera follow (only while the rider has not taken the map) ──
    // See the FOLLOW MODE block above for the full "rubber band" story.
    //   • one navigation zoom (FOLLOW_ZOOM) when follow starts, so the map
    //     still opens at street level — the rider's own zoom is never
    //     overridden afterwards;
    //   • pan-only animation: same zoom => Leaflet takes the pan path and the
    //     map pane never gets `leaflet-zoom-anim`, the class that silently
    //     blocks dragging;
    //   • GPS jitter is ignored — pan only after real movement, or once the
    //     rider has drifted too far from the centre of the screen.
    if (!isLive || !followRef.current) return;

    const driftPx = map.getSize().divideBy(2)
      .distanceTo(map.latLngToContainerPoint(ll));   // rotation-aware
    const movedM = lastFollowPosRef.current
      ? getDistance(lastFollowPosRef.current[0], lastFollowPosRef.current[1], ll[0], ll[1])
      : Infinity;

    if (!didInitialZoomRef.current) {
      didInitialZoomRef.current = true;
      lastFollowPosRef.current = ll;
      map.setView(ll, Math.max(map.getZoom(), FOLLOW_ZOOM), { animate: true, duration: 0.6 });
      return;
    }

    if (movedM >= FOLLOW_MIN_MOVE_M || driftPx > FOLLOW_MAX_DRIFT_PX) {
      lastFollowPosRef.current = ll;
      map.setView(ll, map.getZoom(), { animate: true, duration: 0.4 });
    }

    return () => { gpsDotRef.current?.remove(); gpsDotRef.current = null; };
  }, [map, myLocation?.lat, myLocation?.lng, isLive]); // eslint-disable-line

  return null;
}

// ===========================================================================
// MapBehavior — enforces Google Maps-like constraints from inside the map
//
//   • Listens to `rotate` events from leaflet-rotate and reports the
//     current bearing (degrees) to the parent via onBearingChange().
//   • Re-applies maxBounds after rotation so the map can't drift past
//     the world boundary when the user spins it.
// ===========================================================================
function MapBehavior({ onBearingChange }) {
  const map = useMap();

  // ====================================================================
  // VECTOR RE-SYNC — keeps the route line glued to the map
  //
  // leaflet-rotate has an OPEN upstream bug (issue #43): during gestures,
  // Leaflet's renderer skips updates (_animatingZoom guard), so vectors
  // drift. We use TWO strategies:
  //   A) Event-based: fire on rotate/zoomend/moveend/resize
  //   B) RAF-based: during ACTIVE touch/pointer gestures, run a
  //      requestAnimationFrame loop that forces renderer._update()
  //      every frame, keeping vectors aligned in real-time.
  // ====================================================================
  useEffect(() => {
    if (!map) return;

    const realignVectors = () => {
      // Force the map's default renderer (Canvas or SVG) to re-sync
      const renderer = map._renderer;
      if (renderer && typeof renderer._update === "function") {
        try { renderer._update(); }
        catch (err) { /* silent — no-op when nothing drifts */ }
      }
    };

    // ── A) Event-based re-sync (fires on gesture completion) ──
    map.on("rotate",  realignVectors);
    map.on("zoomend", realignVectors);
    map.on("moveend", realignVectors);
    map.on("resize",  realignVectors);

    // ── B) RAF-based mid-gesture re-sync (fires every frame) ──
    let rafId = null;
    let gestureActive = 0; // counter, not boolean (multi-touch)

    const rafLoop = () => {
      realignVectors();
      if (gestureActive > 0) {
        rafId = requestAnimationFrame(rafLoop);
      } else {
        rafId = null;
      }
    };

    const startGestureSync = () => {
      gestureActive++;
      if (!rafId) {
        rafId = requestAnimationFrame(rafLoop);
      }
    };

    const stopGestureSync = () => {
      gestureActive = Math.max(0, gestureActive - 1);
      if (gestureActive === 0) {
        // One final re-sync after the gesture ends
        realignVectors();
      }
    };

    const container = map.getContainer();
    container.addEventListener("touchstart",  startGestureSync, { passive: true });
    container.addEventListener("touchend",    stopGestureSync,  { passive: true });
    container.addEventListener("touchcancel", stopGestureSync,  { passive: true });
    container.addEventListener("pointerdown", startGestureSync, { passive: true });
    container.addEventListener("pointerup",   stopGestureSync,  { passive: true });
    container.addEventListener("pointercancel",stopGestureSync,  { passive: true });

    return () => {
      map.off("rotate",  realignVectors);
      map.off("zoomend", realignVectors);
      map.off("moveend", realignVectors);
      map.off("resize",  realignVectors);
      container.removeEventListener("touchstart",   startGestureSync);
      container.removeEventListener("touchend",     stopGestureSync);
      container.removeEventListener("touchcancel",  stopGestureSync);
      container.removeEventListener("pointerdown",  startGestureSync);
      container.removeEventListener("pointerup",    stopGestureSync);
      container.removeEventListener("pointercancel",stopGestureSync);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [map]);

  // ====================================================================
  // MIDDLE-CLICK ROTATION — Google Earth-style desktop control
  //
  // Hold middle mouse button and drag horizontally to rotate the map.
  // Sensitivity: 0.5° per pixel of horizontal mouse movement.
  // Only activates when ENABLE_MAP_ROTATION is true.
  // ====================================================================
  useEffect(() => {
    if (!map || !ENABLE_MAP_ROTATION) return;
    if (typeof map.setBearing !== "function") return;

    let isRotating = false;
    let startX = 0;
    let startBearing = 0;

    const onMouseDown = (e) => {
      if (e.button !== 1) return; // middle click only
      e.preventDefault();
      e.stopPropagation();
      isRotating = true;
      startX = e.clientX;
      startBearing = typeof map.getBearing === "function" ? map.getBearing() : 0;
      map.getContainer().style.cursor = "grabbing";
    };

    const onMouseMove = (e) => {
      if (!isRotating) return;
      e.preventDefault();
      const dx = e.clientX - startX;
      const newBearing = startBearing + dx * 0.5;
      map.setBearing(newBearing);
    };

    const onMouseUp = (e) => {
      if (!isRotating) return;
      if (e.button !== 1) return;
      isRotating = false;
      map.getContainer().style.cursor = "";
    };

    // Prevent the default middle-click auto-scroll behavior
    const preventAutoScroll = (e) => {
      if (e.button === 1) e.preventDefault();
    };

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

  // ====================================================================
  // BEARING TRACKING — report rotation to parent + compass reset
  // ====================================================================
  useEffect(() => {
    if (!map) return;

    const handleRotate = () => {
      const b = typeof map.getBearing === "function" ? map.getBearing() : 0;
      onBearingChange(Math.round(b * 10) / 10);
    };

    const handleResetBearing = () => {
      if (typeof map.setBearing === "function") {
        map.setBearing(0);
      }
    };

    map.on("rotate", handleRotate);
    window.addEventListener("rw-reset-bearing", handleResetBearing);
    handleRotate();

    return () => {
      map.off("rotate", handleRotate);
      window.removeEventListener("rw-reset-bearing", handleResetBearing);
    };
  }, [map, onBearingChange]);

  return null;
}

// ===========================================================================
// RideMap — exported component (same props as before, no parent changes)
//
// Google Maps-like behavior:
//   • minZoom 3  / maxZoom 19 — prevents zooming to planet or pixel level
//   • maxBounds  — hard world boundary, no infinite horizontal scroll
//   • rotate     — two-finger twist on touch, Shift+drag on desktop
//   • compass    — shows current bearing, click to snap back to north
// ===========================================================================

// World boundary — prevent panning past the edges of the real world.
// The slight overshoot (±2° lat, ±Infinity lng is NOT used) keeps the
// map from snapping awkwardly when a route is near the antimeridian.
const WORLD_BOUNDS = L.latLngBounds(
  L.latLng(-85, -180),
  L.latLng(85, 180),
);

export default function RideMap({ ride, myLocation, isLive = false, participants = [], currentUserId = null, onRouteStatus }) {
  const tileLayerRef  = useRef(null);
  const [showTiles,   setShowTiles]  = useState(false);
  const [activeTile,  setActiveTile] = useState(0);
  const [bearing,     setBearing]    = useState(0); // current map rotation in degrees

  const from = ride?.fromLat        ? { lat: ride.fromLat,        lng: ride.fromLng }        : null;
  const center = from ? [from.lat, from.lng] : [13.0827, 80.2707];

  const switchTile = (i) => {
    setActiveTile(i);
    setShowTiles(false);
    if (tileLayerRef.current) {
      const layer = TILE_LAYERS[i];
      const tl = tileLayerRef.current;
      // maxNativeZoom is per-provider — carry it across with the URL, then
      // redraw so Leaflet re-clamps the tile zoom to the new source's limit.
      tl.options.maxNativeZoom = layer.maxNativeZoom;
      tl.setUrl(layer.url);
      tl.redraw();
    }
  };

  return (
    <div style={{ position: "absolute", inset: 0 }}>

      <MapContainer
        attributionControl={false /* hides the built-in OpenStreetMap attribution box */}
        center={center}
        zoom={12}
        scrollWheelZoom
        /* ── Zoom limits (Google Maps-like) ──
           MAP_MAX_ZOOM is shared with the TileLayer below, so the deepest zoom
           the map allows is always one the tiles can actually paint. */
        minZoom={3}
        maxZoom={MAP_MAX_ZOOM}
        /* ── Integer zoom snapping — prevents fractional zoom tile artifacts ── */
        zoomSnap={1}
        zoomDelta={1}
        /* ── World boundary — no infinite scroll ── */
        maxBounds={WORLD_BOUNDS}
        maxBoundsViscosity={1.0}  /* hard wall — map springs back immediately */
        /* ── Canvas renderer — GPU-accelerated, no SVG drift on mobile ── */
        renderer={L.canvas({ padding: 0.5 })}
        /* ── Rotation (leaflet-rotate plugin) ──
              Individual switches mirror ENABLE_MAP_ROTATION so the whole
              feature can be turned off from one place (see the constant at
              the top of this file + the vector re-sync in MapBehavior). */
        rotate={ENABLE_MAP_ROTATION}
        touchRotate={ENABLE_MAP_ROTATION}   /* two-finger twist on mobile */
        shiftKeyRotate={ENABLE_MAP_ROTATION} /* Shift+wheel on desktop */
        rotateControl={false}    /* we render our own compass */
        bearing={0}
        /* ── Mobile gesture tuning (Google Maps-like feel) ── */
        inertiaDeceleration={2000}
        inertiaMaxSpeed={1500}
        bounceAtZoomLimits={false}
        tap={true}
        tapTolerance={15}
        wheelPxPerZoomLevel={120}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          url={TILE_LAYERS[0].url}
          attribution={TILE_LAYERS[0].attr}
          noWrap={true}           /* prevents tile repetition at the edges */
          /* detectRetina OFF on purpose — see the TILE_LAYERS comment. It asks
             for (zoom + 1) tiles, which none of these providers publish. */
          updateWhenZooming={false} /* don't reload tiles mid-zoom animation */
          keepBuffer={4}          /* keep 4 rows of off-screen tiles loaded */
          /* maxZoom MUST match the map's maxZoom. Leaflet's TileLayer default
             is 18 (17 with detectRetina) while the map allows 19; anything past
             the layer limit makes GridLayer request zero tiles, which is what
             blanked the deepest zoom level. */
          maxZoom={MAP_MAX_ZOOM}
          /* Where this provider genuinely stops publishing. Beyond it Leaflet
             upscales the deepest real tile instead of 404ing. */
          maxNativeZoom={TILE_LAYERS[0].maxNativeZoom}
        />

        {/* Dynamic Route line — trims based on myLocation; draws purple rejoin when off-route */}
        <DynamicRouteLine ride={ride} myLocation={myLocation} isLive={isLive} onRouteStatus={onRouteStatus} />

        {/* Purple rejoin lines for off-route group riders */}
        {participants.length > 0 && (
          <RiderRejoinLines
            participants={participants}
            currentUserId={currentUserId}
            routeCoordinates={ride?.routeCoordinates}
          />
        )}

        {/* Track bearing changes from the map and push to parent state */}
        <MapBehavior onBearingChange={setBearing} />

        {/* Markers + GPS dot + tile ref capture */}
        <MapInternals
          ride={ride}
          myLocation={myLocation}
          isLive={isLive}
          tileLayerRef={tileLayerRef}
          activeTileIdx={activeTile}
          participants={participants}
          currentUserId={currentUserId}
        />
      </MapContainer>

      {/* ── Tile switcher (overlay, outside MapContainer so pointer events work) ── */}
      <div className="rw-custom-control" style={{ position: "absolute", top: "110px", left: "10px", zIndex: 9999 }}>
        <button
          title="Switch map style"
          onClick={() => setShowTiles(v => !v)}
          style={{
            width: "40px", height: "40px", borderRadius: "8px",
            background: "rgba(255,255,255,0.95)",
            border: "2px solid rgba(200,200,200,0.6)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
            cursor: "pointer", fontSize: "15px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >🗺️</button>

        {showTiles && (
          <div style={{
            position: "absolute", top: 0, left: "42px",
            background: "rgba(15,15,26,0.96)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "12px", padding: "4px 0",
            minWidth: "175px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.55)",
          }}>
            {TILE_LAYERS.map((t, i) => (
              <button key={i} onClick={() => switchTile(i)} style={{
                width: "100%", padding: "9px 16px",
                background: "transparent", border: "none",
                borderBottom: i < TILE_LAYERS.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                color: "white", cursor: "pointer",
                textAlign: "left", fontSize: "13px",
                fontWeight: activeTile === i ? 700 : 400,
                display: "flex", alignItems: "center", gap: "8px",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <span style={{ flex: 1 }}>{t.label}</span>
                {activeTile === i && <span style={{ color: "#f97316", fontWeight: 900 }}>✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Compass button — only visible when the map is rotated ── */}
      {bearing !== 0 && (
        <button
          className="rw-custom-control"
          title={`Map rotated ${Math.abs(Math.round(bearing))}° — click to reset to north`}
          onClick={() => {
            // Reset bearing to 0 (north-up). We dispatch a custom event that
            // MapBehavior picks up, since we can't call useMap() from here.
            window.dispatchEvent(new CustomEvent("rw-reset-bearing"));
          }}
          style={{
            position: "absolute", top: "158px", left: "10px", zIndex: 9999,
            width: "40px", height: "40px", borderRadius: "8px",
            background: "rgba(255,255,255,0.95)",
            border: "2px solid rgba(200,200,200,0.6)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 0,
          }}
        >
          {/* SVG compass needle — rotates opposite to map bearing */}
          <svg
            className="rw-compass-needle"
            width="22" height="22" viewBox="0 0 24 24"
            style={{ transform: `rotate(${-bearing}deg)` }}
          >
            {/* North pointer (red) */}
            <polygon points="12,2 15,12 12,10 9,12" fill="#ef4444" />
            {/* South pointer (grey) */}
            <polygon points="12,22 15,12 12,14 9,12" fill="#9ca3af" />
          </svg>
        </button>
      )}

       {/* ── Re-center button (live rides only) ── */}
      {isLive && myLocation?.lat && (
        <button
          className="rw-custom-control"
          title="Re-center on your location"
          onClick={() => {
            // Re-arm camera-follow and snap instantly (rw-follow-me), THEN ask
            // the hardware for a fresh fix (resume-real-gps → rw-recenter).
            // The fresh fix can no longer drag the camera back if the rider
            // touched the map in the meantime — rw-recenter only moves the
            // camera while follow is still switched on.
            window.dispatchEvent(new Event("rw-follow-me"));
            window.dispatchEvent(new Event("resume-real-gps"));
          }}
          style={{
            position: "absolute", bottom: "calc(var(--rw-bottom-bar-h, 140px) + 16px)", left: "10px", zIndex: 9999,
            width: "46px", height: "46px", borderRadius: "13px",
            background: "rgba(255,255,255,0.95)",
            border: "2px solid rgba(66,133,244,0.6)",
            color: "#4285F4", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "18px", boxShadow: "0 2px 16px rgba(0,0,0,0.2)",
          }}
        >
          <i className="fa fa-location-crosshairs" />
        </button>
      )}
    </div>
  );
}
