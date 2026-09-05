// ============================================================
// 🗺️ RideMap.jsx — Full-screen MapLibre GL map
//
// ── WHAT THIS FILE DOES ───────────────────────────────────
//   Renders an interactive OSM map with:
//     • A thick BLUE route line from start → destination
//       (mimics Google Maps style — white border + blue fill)
//     • A faded "already traveled" grey segment that shrinks
//       as the user moves — the remaining blue line grows shorter
//     • A pulsing blue GPS dot that follows the user in real-time
//     • Green "A" pin at the start, red "B" pin at the destination
//     • Popup on the A pin: start area name + rider info
//     • Popup on the B pin: destination name + live remaining km/time
//
// ── DYNAMIC ROUTE (Google Maps-like behaviour) ────────────
//   Every time myLocation changes (GPS tick), we:
//     1. Find the closest point on the full route to the user
//     2. Slice the route from that point to the end
//     3. Push that slice into the "rw-remaining-source"
//        → only the ahead-of-user portion stays blue
//     4. Push the behind-user portion into "rw-traveled-source"
//        → the already-driven part becomes a faded grey line
//   This gives the same visual as Google Maps / Waze navigation.
//
// ── MARKER POPUPS ────────────────────────────────────────
//   Clicking the A pin shows:
//     • Start location name (first part before comma)
//     • Rider type badge (solo / group)
//   Clicking the B pin shows:
//     • Destination full name
//     • Remaining distance from current GPS position
//     • Remaining ETA from current GPS position
//
// ── RACE-CONDITION FIX ───────────────────────────────────
//   GeoJSON sources are created ONCE in the "load" event.
//   All subsequent updates use source.setData() — never
//   removeSource/addSource — which eliminates flicker and
//   all layer-referencing-missing-source errors.
//   readyRef gates every operation that touches map layers.
//
// ── COORDINATE ORDER ─────────────────────────────────────
//   GPS gives { lat, lng }
//   MapLibre / GeoJSON expect [lng, lat]  (longitude FIRST)
//   We consistently apply this everywhere in this file.
//
// ── PROPS ────────────────────────────────────────────────
//   ride        { fromLat, fromLng, fromName,
//                 destinationLat, destinationLng, destinationName,
//                 routeCoordinates (JSON string "[[lng,lat],...]]"),
//                 distanceMeters, durationSeconds, rideType }
//   myLocation  { lat, lng } | null   — live GPS position
//   isLive      boolean — true when showing active ride (enables trimming)
// ============================================================

import { useEffect, useRef, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { formatDistance, formatDuration, haversineDistance } from "../../../services/routingApi";

// ────────────────────────────────────────────────────────────
// MAP STYLE — OpenStreetMap raster tiles (no API key needed)
// Swap the tiles URL to use a different tile provider (e.g. Carto, Stamen).
// ────────────────────────────────────────────────────────────
const OSM_RASTER_STYLE = {
  version: 8,
  sources: {
    osm: {
      type:        "raster",
      tiles:       ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize:    256,
      maxzoom:     19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm-tiles", type: "raster", source: "osm" }],
};

const DEFAULT_CENTER = [80.2707, 13.0827]; // Chennai [lng, lat]
const DEFAULT_ZOOM   = 12;

// ── MapLibre layer/source ID constants ──
// Named with "rw-" prefix to avoid clashing with any OSM layer IDs.
const SRC_REMAINING  = "rw-remaining-source";  // Blue line: current pos → destination
const SRC_TRAVELED   = "rw-traveled-source";   // Grey line: start → current pos
const LYR_REM_OUTLINE= "rw-rem-outline";       // White border under the blue line
const LYR_REM_FILL   = "rw-rem-fill";          // Blue route line
const LYR_TRV_LINE   = "rw-traveled-line";     // Grey "already traveled" line

// ── Inject the GPS pulse keyframe ONCE into <head> at module load time ──
// We inject here (not inside JSX) because putting <style> inside
// an innerHTML marker element is unreliable across browsers.
// The animation name is prefixed "rw-" to avoid collisions.
if (typeof document !== "undefined" && !document.getElementById("rw-kf")) {
  const s = document.createElement("style");
  s.id = "rw-kf";
  s.textContent = `
    @keyframes rw-gps-ring {
      0%   { transform: scale(0.8); opacity: 0.9; }
      70%  { transform: scale(2.4); opacity: 0;   }
      100% { transform: scale(0.8); opacity: 0;   }
    }
  `;
  document.head.appendChild(s);
}

// ────────────────────────────────────────────────────────────
// parseCoords — safely parse routeCoordinates JSON string
// Accepts either a JSON string OR a pre-parsed array.
// Returns [[lng, lat], ...] or null if invalid / too short.
// ────────────────────────────────────────────────────────────
function parseCoords(routeCoordinates) {
  if (!routeCoordinates) return null;
  try {
    const arr = typeof routeCoordinates === "string"
      ? JSON.parse(routeCoordinates)
      : routeCoordinates;            // accept pre-parsed arrays too
    if (!Array.isArray(arr) || arr.length < 2) return null;
    return arr; // [[lng, lat], ...]
  } catch {
    return null; // JSON.parse failed → return null so we skip rendering
  }
}

// ────────────────────────────────────────────────────────────
// buildLineGeoJSON — wraps a coordinates array into the GeoJSON
// Feature format that MapLibre's "geojson" source expects.
// Pass an empty array [] to render an invisible (zero-point) line.
// ────────────────────────────────────────────────────────────
function buildLineGeoJSON(coordinates) {
  return {
    type: "Feature",
    geometry: {
      type:        "LineString",
      coordinates, // [[lng, lat], [lng, lat], ...]
    },
    properties: {},
  };
}

// ────────────────────────────────────────────────────────────
// sliceRouteFromUser — finds the nearest point on the full
// route to the user's current GPS position, then splits the
// route into two segments:
//   traveled  : points from index 0 up to (and including) nearest
//   remaining : points from nearest to the end
//
// This is the core of the "Google Maps-like" dynamic route.
//
// INPUT:
//   fullCoords  — [[lng, lat], ...] full route
//   userLng     — user's current longitude
//   userLat     — user's current latitude
//
// OUTPUT:
//   { traveled: [[lng,lat],...], remaining: [[lng,lat],...] }
// ────────────────────────────────────────────────────────────
function sliceRouteFromUser(fullCoords, userLng, userLat) {
  if (!fullCoords || fullCoords.length < 2) {
    // No route data — return empty slices
    return { traveled: [], remaining: [] };
  }

  let nearestIdx = 0;      // index of the closest route point
  let minDist    = Infinity;

  // Loop every route point and find the one closest to the user
  for (let i = 0; i < fullCoords.length; i++) {
    const [lng, lat] = fullCoords[i]; // GeoJSON: longitude first!
    // haversineDistance returns metres between two lat/lng pairs
    const d = haversineDistance(userLat, userLng, lat, lng);
    if (d < minDist) {
      minDist    = d;
      nearestIdx = i;
    }
  }

  // Slice: everything up-to-and-including nearest = already driven
  // Everything from nearest onward = still to drive
  const traveled  = fullCoords.slice(0, nearestIdx + 1);
  const remaining = fullCoords.slice(nearestIdx);

  return { traveled, remaining };
}

// ────────────────────────────────────────────────────────────
// makeFromMarker — green "A" pin for the start location
// Returns a plain DOM element for maplibregl.Marker()
// The pin is a rotated square with rounded corners → drop-pin shape.
// ────────────────────────────────────────────────────────────
function makeFromMarker() {
  const wrap = document.createElement("div");
  // 32×38 wrapper matches the visual pin size exactly
  wrap.style.cssText = "width:32px;height:38px;cursor:pointer;";

  const pin = document.createElement("div");
  // Rotated -45° square with one rounded corner → classic drop pin
  pin.style.cssText = `
    width:32px;height:32px;
    background:linear-gradient(135deg,#22c55e,#15803d);
    border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);
    border:3px solid #fff;
    box-shadow:0 4px 14px rgba(34,197,94,0.55);
    display:flex;align-items:center;justify-content:center;
  `;

  // Letter "A" inside the pin — counter-rotated 45° to appear upright
  const letter = document.createElement("span");
  letter.style.cssText = "transform:rotate(45deg);font-size:12px;font-weight:900;color:#fff;line-height:1;";
  letter.textContent = "A";

  pin.appendChild(letter);
  wrap.appendChild(pin);
  return wrap;
}

// ────────────────────────────────────────────────────────────
// makeToMarker — red "B" pin for the destination
// Same structure as makeFromMarker but with red gradient.
// ────────────────────────────────────────────────────────────
function makeToMarker() {
  const wrap = document.createElement("div");
  wrap.style.cssText = "width:32px;height:38px;cursor:pointer;";

  const pin = document.createElement("div");
  pin.style.cssText = `
    width:32px;height:32px;
    background:linear-gradient(135deg,#ef4444,#b91c1c);
    border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);
    border:3px solid #fff;
    box-shadow:0 4px 14px rgba(239,68,68,0.55);
    display:flex;align-items:center;justify-content:center;
  `;

  const letter = document.createElement("span");
  letter.style.cssText = "transform:rotate(45deg);font-size:12px;font-weight:900;color:#fff;line-height:1;";
  letter.textContent = "B";

  pin.appendChild(letter);
  wrap.appendChild(pin);
  return wrap;
}

// ────────────────────────────────────────────────────────────
// makeMeMarker — blue pulsing dot for live GPS location
//
// WHY 40×40 WRAPPER:
//   MapLibre positions the element so its anchor point aligns
//   with the lat/lng on the map.
//   All pulse rings are position:absolute INSIDE the 40×40 div —
//   they do NOT expand the wrapper's bounding box.
//   This makes anchor:"center" place the dot exactly on the GPS
//   coordinate — no 8px offset bug.
// ────────────────────────────────────────────────────────────
function makeMeMarker() {
  // Outer wrapper: exactly 40×40px, flex-centred
  const wrap = document.createElement("div");
  wrap.style.cssText = `
    position:relative;
    width:40px;height:40px;
    display:flex;align-items:center;justify-content:center;
  `;

  // Outer pulse ring — fast 2-second animation
  const ring1 = document.createElement("div");
  ring1.style.cssText = `
    position:absolute;inset:0;
    border-radius:50%;
    background:rgba(59,130,246,0.3);
    animation:rw-gps-ring 2s ease-out infinite;
    pointer-events:none;
  `;
  wrap.appendChild(ring1);

  // Inner pulse ring — slightly slower, delayed 0.7s to stagger with outer
  const ring2 = document.createElement("div");
  ring2.style.cssText = `
    position:absolute;inset:6px;
    border-radius:50%;
    background:rgba(59,130,246,0.2);
    animation:rw-gps-ring 2s ease-out 0.7s infinite;
    pointer-events:none;
  `;
  wrap.appendChild(ring2);

  // Solid blue dot — always visible, sits above the rings (z-index:1)
  const dot = document.createElement("div");
  dot.style.cssText = `
    position:relative;
    width:18px;height:18px;
    background:linear-gradient(135deg,#60a5fa,#1d4ed8);
    border-radius:50%;
    border:3px solid #fff;
    box-shadow:0 0 0 2px rgba(59,130,246,0.4), 0 4px 12px rgba(59,130,246,0.7);
    z-index:1;
  `;
  wrap.appendChild(dot);

  return wrap;
}

// ────────────────────────────────────────────────────────────
// buildFromPopupHTML — HTML for the green A-pin popup
//
// Shows:
//   • Start location area name (trimmed to first segment before comma)
//   • Full address on second line
//   • Ride type badge (🏍️ Solo / 👥 Group)
//
// The popup has a dark glass-morphism style injected inline
// since MapLibre's popup body is in a shadow-like container.
// ────────────────────────────────────────────────────────────
function buildFromPopupHTML(ride) {
  // Show only the first part of the name (e.g. "Chennai Central")
  const shortName = (ride.fromName || "Start").split(",")[0].trim();
  const fullName  = ride.fromName || "Start location";
  const typeEmoji = ride.rideType === "solo" ? "🏍️" : "👥";
  const typeLabel = ride.rideType === "solo" ? "Solo Ride" : "Group Ride";

  return `
    <div style="
      font-family: system-ui, sans-serif;
      min-width: 170px;
      padding: 4px 0;
    ">
      <!-- Start area badge -->
      <div style="
        display:flex; align-items:center; gap:6px; margin-bottom:6px;
      ">
        <span style="
          background:#22c55e; color:#fff;
          border-radius:50%; width:20px; height:20px;
          display:inline-flex; align-items:center; justify-content:center;
          font-size:10px; font-weight:900; flex-shrink:0;
        ">A</span>
        <strong style="font-size:14px; color:#111;">${shortName}</strong>
      </div>

      <!-- Full address -->
      <p style="
        margin:0 0 8px; font-size:11px; color:#555; line-height:1.4;
      ">${fullName}</p>

      <!-- Divider -->
      <div style="height:1px; background:#eee; margin-bottom:8px;"></div>

      <!-- Ride type badge -->
      <div style="
        display:inline-flex; align-items:center; gap:4px;
        background:#f0fdf4; border:1px solid #bbf7d0;
        border-radius:50px; padding:2px 10px; font-size:11px; color:#15803d;
      ">
        ${typeEmoji} ${typeLabel}
      </div>
    </div>
  `;
}

// ────────────────────────────────────────────────────────────
// buildToPopupHTML — HTML for the red B-pin popup
//
// Shows:
//   • Destination area name
//   • Full destination address
//   • Remaining distance from user's current GPS position
//   • Remaining ETA from user's current GPS position
//
// When myLocation is null (no GPS fix yet), shows the total
// ride distance/duration from the ride object as a fallback.
// ────────────────────────────────────────────────────────────
function buildToPopupHTML(ride, myLocation) {
  const shortName = (ride.destinationName || "Destination").split(",")[0].trim();
  const fullName  = ride.destinationName || "Destination";

  let remainDistStr = "—";
  let remainTimeStr = "—";

  if (myLocation && ride.destinationLat && ride.destinationLng) {
    // Calculate straight-line distance from user to destination
    // (OSRM recalculation would be more accurate but requires a network call;
    //  for the popup tooltip haversine is fast and good enough)
    const distM = haversineDistance(
      myLocation.lat, myLocation.lng,
      ride.destinationLat, ride.destinationLng
    );
    remainDistStr = formatDistance(distM);

    // Estimate remaining time using the original average speed:
    //   speed = totalDistance / totalDuration (m/s)
    // Then: remainingTime = remainingDistance / speed
    if (ride.distanceMeters && ride.durationSeconds && ride.distanceMeters > 0) {
      const avgSpeedMps = ride.distanceMeters / ride.durationSeconds; // metres/second
      const remainSec   = distM / avgSpeedMps;                        // estimated seconds
      remainTimeStr = formatDuration(remainSec);
    }
  } else if (ride.distanceMeters || ride.durationSeconds) {
    // Fallback: no GPS, show the original total distance/time
    remainDistStr = formatDistance(ride.distanceMeters);
    remainTimeStr = formatDuration(ride.durationSeconds);
  }

  return `
    <div style="
      font-family: system-ui, sans-serif;
      min-width: 190px;
      padding: 4px 0;
    ">
      <!-- Destination badge -->
      <div style="
        display:flex; align-items:center; gap:6px; margin-bottom:6px;
      ">
        <span style="
          background:#ef4444; color:#fff;
          border-radius:50%; width:20px; height:20px;
          display:inline-flex; align-items:center; justify-content:center;
          font-size:10px; font-weight:900; flex-shrink:0;
        ">B</span>
        <strong style="font-size:14px; color:#111;">${shortName}</strong>
      </div>

      <!-- Full destination address -->
      <p style="
        margin:0 0 8px; font-size:11px; color:#555; line-height:1.4;
      ">${fullName}</p>

      <!-- Divider -->
      <div style="height:1px; background:#eee; margin-bottom:8px;"></div>

      <!-- Remaining stats row -->
      <div style="display:flex; gap:12px;">
        <!-- Remaining distance -->
        <div style="text-align:center;">
          <div style="font-size:15px; font-weight:900; color:#ef4444;">${remainDistStr}</div>
          <div style="font-size:9px; color:#888; text-transform:uppercase; letter-spacing:0.5px; margin-top:1px;">Remaining</div>
        </div>
        <!-- Separator -->
        <div style="width:1px; background:#eee; align-self:stretch;"></div>
        <!-- Remaining ETA -->
        <div style="text-align:center;">
          <div style="font-size:15px; font-weight:900; color:#111;">${remainTimeStr}</div>
          <div style="font-size:9px; color:#888; text-transform:uppercase; letter-spacing:0.5px; margin-top:1px;">ETA</div>
        </div>
      </div>
    </div>
  `;
}

// ════════════════════════════════════════════════════════════
// RideMap component
//
// Props:
//   ride       — ride object with coordinates and metadata
//   myLocation — { lat, lng } from GPS, or null
//   isLive     — boolean; enables dynamic route trimming
// ════════════════════════════════════════════════════════════
export default function RideMap({ ride, myLocation, isLive = false }) {
  const containerRef  = useRef(null);  // <div> the map renders into
  const mapRef        = useRef(null);  // maplibregl.Map instance
  const readyRef      = useRef(false); // true after map "load" event fires

  // Marker refs — we reuse them by calling setLngLat() instead of
  // creating new markers, which prevents DOM flicker and animation restarts.
  const fromMarkerRef = useRef(null);
  const toMarkerRef   = useRef(null);
  const meMarkerRef   = useRef(null);

  // Popup refs — so we can update their HTML content when myLocation changes
  // without removing and re-adding the popup (which causes flicker).
  const fromPopupRef  = useRef(null);
  const toPopupRef    = useRef(null);

  // Full parsed route coordinates — stored so we can slice on every GPS tick
  // without reparsing the JSON string each time.
  const fullCoordsRef = useRef(null);

  // ════════════════════════════════════════════════════════
  // EFFECT 1 — Create the MapLibre map ONCE on mount
  //
  // The "load" callback is the ONLY safe place to add sources
  // and layers. We set readyRef=true here and also call applyRide
  // in case the ride prop already arrived before "load" fired.
  // ════════════════════════════════════════════════════════
  useEffect(() => {
    // Guard: don't re-create if already created
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container:       containerRef.current,
      style:           OSM_RASTER_STYLE,
      center:          DEFAULT_CENTER,  // Default to Chennai
      zoom:            DEFAULT_ZOOM,
      scrollZoom:      true,
      touchZoomRotate: true,
      doubleClickZoom: true,
    });
    mapRef.current = map;

    // ── Navigation control (zoom +/− buttons + compass) ──
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    // ── Scale bar in metric ──
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    // ── "load" fires when all style resources are parsed and ready ──
    // We MUST add custom sources/layers here — not before.
    map.on("load", () => {
      readyRef.current = true; // unlock all other effects

      // ── REMAINING ROUTE source (blue line: user → destination) ──
      // We call setData() later — never removeSource/addSource.
      // This prevents "layer references missing source" race conditions.
      map.addSource(SRC_REMAINING, {
        type: "geojson",
        data: buildLineGeoJSON([]), // empty until ride is loaded
      });

      // White border/outline drawn BELOW the blue line (Google Maps look)
      map.addLayer({
        id:     LYR_REM_OUTLINE,
        type:   "line",
        source: SRC_REMAINING,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#ffffff",
          // zoom interpolation keeps visual thickness constant at all zoom levels
          "line-width": ["interpolate", ["linear"], ["zoom"], 6, 10, 12, 14, 18, 20],
          "line-opacity": 0.65,
        },
      });

      // Blue route line on TOP of the white outline — Google Maps blue (#4285F4)
      map.addLayer({
        id:     LYR_REM_FILL,
        type:   "line",
        source: SRC_REMAINING,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#4285F4",  // Google Maps signature blue
          // Slightly thinner than the outline so the white edge shows through
          "line-width": ["interpolate", ["linear"], ["zoom"], 6, 6, 12, 10, 18, 15],
          "line-opacity": 0.95,
        },
      });

      // ── TRAVELED ROUTE source (faded grey: start → user position) ──
      map.addSource(SRC_TRAVELED, {
        type: "geojson",
        data: buildLineGeoJSON([]), // empty until ride + GPS are both ready
      });

      // Faded grey line for the already-driven portion
      map.addLayer({
        id:     LYR_TRV_LINE,
        type:   "line",
        source: SRC_TRAVELED,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#9ca3af",  // grey-400
          "line-width": ["interpolate", ["linear"], ["zoom"], 6, 4, 12, 7, 18, 10],
          "line-opacity": 0.5,      // faded so it doesn't compete with the blue line
          "line-dasharray": [2, 2], // dashes to clearly distinguish from the blue
        },
      });

      // ── If ride prop arrived before "load", draw it now ──
      // (handles the case where ride was set in parent before map was ready)
      if (ride) {
        _applyRide(map, ride, null); // null myLocation on initial load
      }
    });

    // Cleanup when component unmounts — remove markers and map instance
    return () => {
      fromMarkerRef.current?.remove(); fromMarkerRef.current = null;
      toMarkerRef.current?.remove();   toMarkerRef.current   = null;
      meMarkerRef.current?.remove();   meMarkerRef.current   = null;
      fromPopupRef.current = null;
      toPopupRef.current   = null;
      map.remove();
      mapRef.current   = null;
      readyRef.current = false;
      fullCoordsRef.current = null;
    };
  }, []); // ← empty deps: create map only once

  // ════════════════════════════════════════════════════════
  // EFFECT 2 — Redraw when the ride prop changes
  //
  // This fires when:
  //   • User creates a new ride (RideSetupFlow → onRideCreated)
  //   • User opens a historical ride from the history panel
  //   • Preview map in RideSetupFlow step 3
  // ════════════════════════════════════════════════════════
  useEffect(() => {
    // Guard: map must be loaded before we can call setData()
    if (!mapRef.current || !readyRef.current) return;
    _applyRide(mapRef.current, ride, myLocation);
  }, [ride]); // eslint-disable-line react-hooks/exhaustive-deps
  // Note: myLocation intentionally excluded — handled by Effect 3

  // ════════════════════════════════════════════════════════
  // EFFECT 3 — Move the GPS dot + update route trimming
  //
  // Fires every time the user's GPS position changes.
  // Performs:
  //   1. Create or move the blue pulsing GPS dot marker
  //   2. Slice the stored route at the nearest point → update the
  //      remaining (blue) and traveled (grey) GeoJSON sources
  //   3. Update the destination popup HTML with fresh remaining km/time
  //
  // COORDINATE ORDER NOTE:
  //   navigator.geolocation → { latitude, longitude }
  //   We store as:            { lat, lng }
  //   MapLibre expects:       [lng, lat]  ← longitude FIRST
  // ════════════════════════════════════════════════════════
  useEffect(() => {
    const map = mapRef.current;
    // Guard: need a loaded map and valid GPS coords
    if (!map || !myLocation?.lat || !myLocation?.lng) return;

    const lngLat = [myLocation.lng, myLocation.lat]; // MapLibre format

    // ── Create or move the blue GPS dot marker ──
    if (meMarkerRef.current) {
      // Already exists — just move it (no flicker, no animation restart)
      meMarkerRef.current.setLngLat(lngLat);
    } else {
      // First GPS fix → create the marker
      meMarkerRef.current = new maplibregl.Marker({
        element: makeMeMarker(), // 40×40 wrapper, no bounding-box overflow
        anchor:  "center",       // exact centre of wrapper = GPS coordinate
      })
        .setLngLat(lngLat)
        .setPopup(
          new maplibregl.Popup({ offset: 24, closeButton: false })
            .setHTML("<b>📍 You are here</b>")
        )
        .addTo(map);
    }

    // ── Dynamic route trimming (only when ride is active + has GPS) ──
    if (isLive && readyRef.current && fullCoordsRef.current) {
      // Slice the full route at the user's current position
      const { traveled, remaining } = sliceRouteFromUser(
        fullCoordsRef.current,
        myLocation.lng,
        myLocation.lat
      );

      // Push the two segments into their respective MapLibre sources
      const remSrc = map.getSource(SRC_REMAINING);
      const trvSrc = map.getSource(SRC_TRAVELED);
      if (remSrc) remSrc.setData(buildLineGeoJSON(remaining));
      if (trvSrc) trvSrc.setData(buildLineGeoJSON(traveled));

      // ── Update destination popup with fresh remaining distance/time ──
      // We call setHTML on the existing Popup instead of creating a new one.
      if (toPopupRef.current && ride) {
        toPopupRef.current.setHTML(buildToPopupHTML(ride, myLocation));
      }
    }
  }, [myLocation, isLive, ride]);

  // ════════════════════════════════════════════════════════
  // _applyRide — internal helper
  //
  // Called from:
  //   • Effect 2 (ride prop changed)
  //   • The "load" handler (ride already set when tiles finish)
  //
  // Does NOT create sources/layers — those are created ONCE in "load".
  // Does NOT touch the live GPS dot — Effect 3 handles that.
  //
  // Tasks:
  //   1. Parse routeCoordinates → store in fullCoordsRef
  //   2. Set the full route into SRC_REMAINING source
  //   3. Create or move the From (A) and To (B) markers with popups
  //   4. Fit the map bounds to show the full route
  // ════════════════════════════════════════════════════════
  const _applyRide = useCallback((map, rideObj, currentLoc) => {
    if (!rideObj) {
      // No ride → clear both route lines
      const remSrc = map.getSource(SRC_REMAINING);
      const trvSrc = map.getSource(SRC_TRAVELED);
      if (remSrc) remSrc.setData(buildLineGeoJSON([]));
      if (trvSrc) trvSrc.setData(buildLineGeoJSON([]));
      fullCoordsRef.current = null;
      return;
    }

    // ── 1. Parse + store route coordinates ──
    const coords = parseCoords(rideObj.routeCoordinates);
    fullCoordsRef.current = coords; // store for future GPS-tick slicing

    // ── 2. Push full route to the remaining-route source ──
    // If we already have a GPS position, slice immediately;
    // otherwise show the entire route as "remaining" (no traveled yet).
    const remSrc = map.getSource(SRC_REMAINING);
    if (remSrc) {
      if (isLive && currentLoc && coords) {
        // Slice at current position right away
        const { remaining } = sliceRouteFromUser(coords, currentLoc.lng, currentLoc.lat);
        remSrc.setData(buildLineGeoJSON(remaining));
      } else {
        // Static preview or first load without GPS → show full route in blue
        remSrc.setData(buildLineGeoJSON(coords || []));
      }
    }

    // ── 3a. FROM marker (green A pin) ──
    if (rideObj.fromLat && rideObj.fromLng) {
      const fromLngLat = [rideObj.fromLng, rideObj.fromLat]; // MapLibre: [lng, lat]
      const fromPopupHTML = buildFromPopupHTML(rideObj);

      if (fromMarkerRef.current) {
        // Marker already exists → just move it and refresh popup content
        fromMarkerRef.current.setLngLat(fromLngLat);
        fromPopupRef.current?.setHTML(fromPopupHTML);
      } else {
        // First time → create marker + popup and attach to map
        const popup = new maplibregl.Popup({
          offset:      40,            // distance above the pin tip
          closeButton: false,         // no ✕ button (cleaner look)
          maxWidth:    "260px",       // prevent very long addresses from overflowing
        }).setHTML(fromPopupHTML);

        fromPopupRef.current = popup;

        fromMarkerRef.current = new maplibregl.Marker({
          element: makeFromMarker(), // custom green A-pin DOM element
          anchor:  "bottom",         // bottom of pin element = the coordinate
        })
          .setLngLat(fromLngLat)
          .setPopup(popup) // clicking the pin toggles this popup
          .addTo(map);
      }
    }

    // ── 3b. TO marker (red B pin) ──
    if (rideObj.destinationLat && rideObj.destinationLng) {
      const toLngLat    = [rideObj.destinationLng, rideObj.destinationLat];
      const toPopupHTML = buildToPopupHTML(rideObj, currentLoc);

      if (toMarkerRef.current) {
        // Move existing marker + refresh popup
        toMarkerRef.current.setLngLat(toLngLat);
        toPopupRef.current?.setHTML(toPopupHTML);
      } else {
        const popup = new maplibregl.Popup({
          offset:      40,
          closeButton: false,
          maxWidth:    "280px",
        }).setHTML(toPopupHTML);

        toPopupRef.current = popup;

        toMarkerRef.current = new maplibregl.Marker({
          element: makeToMarker(), // custom red B-pin DOM element
          anchor:  "bottom",
        })
          .setLngLat(toLngLat)
          .setPopup(popup)
          .addTo(map);
      }
    }

    // ── 4. Fit the map viewport to show the entire route ──
    const bounds  = new maplibregl.LngLatBounds();
    let   hasPts  = false;

    if (rideObj.fromLng && rideObj.fromLat) {
      bounds.extend([rideObj.fromLng, rideObj.fromLat]);
      hasPts = true;
    }
    if (rideObj.destinationLng && rideObj.destinationLat) {
      bounds.extend([rideObj.destinationLng, rideObj.destinationLat]);
      hasPts = true;
    }
    // Include route waypoints so the full line fits in the viewport
    if (coords) coords.forEach(c => bounds.extend(c));

    if (hasPts && !bounds.isEmpty()) {
      map.fitBounds(bounds, {
        padding:  { top: 80, bottom: 160, left: 60, right: 60 },
        duration: 800,   // smooth animation in ms
        maxZoom:  15,    // don't zoom in TOO close for short routes
      });
    }
  }, [isLive]); // isLive changes rarely (only on mount context)

  // ────────────────────────────────────────────────────────
  // RENDER — a single <div> that MapLibre renders into.
  // Must have explicit dimensions — the parent flex container
  // (ActiveRideOverlay) provides height via flex:1.
  // The dark background (#1a1a2e) is the fallback before tiles load.
  // ────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", background: "#1a1a2e" }}
    />
  );
}
