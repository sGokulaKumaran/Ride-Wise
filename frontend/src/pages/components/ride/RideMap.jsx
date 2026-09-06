// ============================================================
// 🗺️ RideMap.jsx — Full-screen MapLibre GL map (Navigation Edition)
//
// ── FEATURES ─────────────────────────────────────────────
//   • Thick BLUE route line (Google Maps style — white border + blue fill)
//   • Faded GREY "already traveled" dashed line that shrinks as user moves
//   • Pulsing blue GPS dot with BEARING ARROW that rotates to face direction
//     of travel — so the marker acts like a real navigation chevron
//   • Camera-follow mode — map auto-pans + tilts to keep user centred
//   • Green A-pin at start, red B-pin at destination (with popups)
//   • Popup on A-pin: start area name + ride type badge
//   • Popup on B-pin: destination name + live remaining km & ETA
//
// ── BEARING / HEADING ─────────────────────────────────────
//   The GPS marker's outer arrow ring rotates using CSS transform:rotate().
//   The bearing is calculated via bearingBetween(prevLoc, currentLoc) each
//   GPS tick and stored in bearingRef.current. The makeMeEl() function now
//   renders a chevron-style arrow (▲) on top of the pulsing dot, mirroring
//   Google Maps' blue navigation arrow.
//
// ── CAMERA FOLLOW ─────────────────────────────────────────
//   When followRef.current = true (default when isLive=true), every GPS tick
//   runs map.easeTo({ center: [lng, lat], bearing, pitch: 20, duration: 600 })
//   to smoothly pan the map and keep the user centered. The user can drag the
//   map to temporarily disengage follow mode (followRef becomes false), and a
//   "Re-center" button appears to re-engage it.
//
// ── ROOT CAUSE FIX (stale closures) — unchanged from original ────────────
//   rideRef.current + isLiveRef.current are always-fresh refs updated on
//   every render so the map.on("load") closure sees the latest values.
//
// ── COORDINATE ORDER ─────────────────────────────────────
//   GPS gives: { lat, lng }
//   MapLibre / GeoJSON expect: [lng, lat]  ← longitude FIRST
//   This is applied consistently throughout this file.
//
// ── PROPS ────────────────────────────────────────────────
//   ride        — { fromLat, fromLng, fromName,
//                   destinationLat, destinationLng, destinationName,
//                   routeCoordinates (JSON "[[lng,lat],...] or array"),
//                   distanceMeters, durationSeconds, rideType }
//   myLocation  — { lat, lng, speed? (m/s), heading? (deg) } | null
//   isLive      — boolean (true = enable dynamic route trimming + follow)
//   onRecenter  — optional callback when map auto-re-centers
// ============================================================

import { useEffect, useRef, useCallback, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  formatDistance, formatDuration, haversineDistance, bearingBetween,
} from "../../../services/routingApi";

// ────────────────────────────────────────────────────────────
// MAP STYLE — OpenStreetMap raster tiles (free, no API key)
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

const DEFAULT_CENTER = [80.2707, 13.0827]; // [lng, lat] — Chennai
const DEFAULT_ZOOM   = 12;

// ── MapLibre source and layer IDs ──
const SRC_REMAINING   = "rw-remaining-src";
const SRC_TRAVELED    = "rw-traveled-src";
const LYR_REM_OUTLINE = "rw-rem-outline";
const LYR_REM_FILL    = "rw-rem-fill";
const LYR_TRV_LINE    = "rw-traveled-line";

// ── Inject GPS pulse + bearing arrow keyframe once into <head> ──
if (typeof document !== "undefined" && !document.getElementById("rw-kf")) {
  const s = document.createElement("style");
  s.id = "rw-kf";
  s.textContent = `
    @keyframes rw-gps-ring {
      0%   { transform: scale(0.8); opacity: 0.9; }
      70%  { transform: scale(2.6); opacity: 0;   }
      100% { transform: scale(0.8); opacity: 0;   }
    }
    @keyframes rw-bearing-pulse {
      0%, 100% { opacity: 0.9; }
      50%      { opacity: 0.6; }
    }
  `;
  document.head.appendChild(s);
}

// ════════════════════════════════════════════════════════════
// MODULE-LEVEL PURE HELPER FUNCTIONS (no React closures)
// ════════════════════════════════════════════════════════════

function parseCoords(routeCoordinates) {
  if (!routeCoordinates) return null;
  try {
    const arr = typeof routeCoordinates === "string"
      ? JSON.parse(routeCoordinates)
      : routeCoordinates;
    if (!Array.isArray(arr) || arr.length < 2) return null;
    return arr;
  } catch {
    return null;
  }
}

function buildLine(coordinates) {
  return {
    type: "Feature",
    geometry: { type: "LineString", coordinates },
    properties: {},
  };
}

function sliceRoute(fullCoords, userLng, userLat) {
  if (!fullCoords || fullCoords.length < 2) {
    return { traveled: [], remaining: [] };
  }
  let nearestIdx = 0;
  let minDist    = Infinity;
  for (let i = 0; i < fullCoords.length; i++) {
    const [lng, lat] = fullCoords[i];
    const d = haversineDistance(userLat, userLng, lat, lng);
    if (d < minDist) { minDist = d; nearestIdx = i; }
  }
  return {
    traveled:  fullCoords.slice(0, nearestIdx + 1),
    remaining: fullCoords.slice(nearestIdx),
  };
}

function buildFromHTML(ride) {
  const shortName = (ride.fromName || "Start").split(",")[0].trim();
  const fullName  = ride.fromName || "Start location";
  const typeEmoji = ride.rideType === "solo" ? "🏍️" : "👥";
  const typeLabel = ride.rideType === "solo" ? "Solo Ride" : "Group Ride";
  return `
    <div style="font-family:system-ui,sans-serif;min-width:170px;padding:4px 0">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span style="background:#22c55e;color:#fff;border-radius:50%;width:20px;height:20px;
          display:inline-flex;align-items:center;justify-content:center;
          font-size:10px;font-weight:900;flex-shrink:0">A</span>
        <strong style="font-size:14px;color:#111">${shortName}</strong>
      </div>
      <p style="margin:0 0 8px;font-size:11px;color:#555;line-height:1.4">${fullName}</p>
      <div style="height:1px;background:#eee;margin-bottom:8px"></div>
      <div style="display:inline-flex;align-items:center;gap:4px;
        background:#f0fdf4;border:1px solid #bbf7d0;border-radius:50px;
        padding:2px 10px;font-size:11px;color:#15803d">
        ${typeEmoji} ${typeLabel}
      </div>
    </div>
  `;
}

function buildToHTML(ride, myLocation) {
  const shortName = (ride.destinationName || "Destination").split(",")[0].trim();
  const fullName  = ride.destinationName || "Destination";
  let   distStr   = "—";
  let   timeStr   = "—";

  if (myLocation?.lat && ride.destinationLat) {
    const distM = haversineDistance(
      myLocation.lat, myLocation.lng,
      ride.destinationLat, ride.destinationLng
    );
    distStr = formatDistance(distM);
    if (ride.distanceMeters > 0 && ride.durationSeconds > 0) {
      const avgSpeed = ride.distanceMeters / ride.durationSeconds;
      timeStr = formatDuration(distM / avgSpeed);
    }
  } else if (ride.distanceMeters) {
    distStr = formatDistance(ride.distanceMeters);
    timeStr = formatDuration(ride.durationSeconds);
  }

  return `
    <div style="font-family:system-ui,sans-serif;min-width:190px;padding:4px 0">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span style="background:#ef4444;color:#fff;border-radius:50%;width:20px;height:20px;
          display:inline-flex;align-items:center;justify-content:center;
          font-size:10px;font-weight:900;flex-shrink:0">B</span>
        <strong style="font-size:14px;color:#111">${shortName}</strong>
      </div>
      <p style="margin:0 0 8px;font-size:11px;color:#555;line-height:1.4">${fullName}</p>
      <div style="height:1px;background:#eee;margin-bottom:8px"></div>
      <div style="display:flex;gap:12px">
        <div style="text-align:center">
          <div style="font-size:15px;font-weight:900;color:#ef4444">${distStr}</div>
          <div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-top:1px">Remaining</div>
        </div>
        <div style="width:1px;background:#eee;align-self:stretch"></div>
        <div style="text-align:center">
          <div style="font-size:15px;font-weight:900;color:#111">${timeStr}</div>
          <div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-top:1px">ETA</div>
        </div>
      </div>
    </div>
  `;
}

function makeFromEl() {
  const wrap = document.createElement("div");
  wrap.style.cssText = "width:32px;height:38px;cursor:pointer";
  const pin = document.createElement("div");
  pin.style.cssText = `
    width:32px;height:32px;
    background:linear-gradient(135deg,#22c55e,#15803d);
    border-radius:50% 50% 50% 0;transform:rotate(-45deg);
    border:3px solid #fff;box-shadow:0 4px 14px rgba(34,197,94,.55);
    display:flex;align-items:center;justify-content:center
  `;
  const lbl = document.createElement("span");
  lbl.style.cssText = "transform:rotate(45deg);font-size:12px;font-weight:900;color:#fff;line-height:1";
  lbl.textContent = "A";
  pin.appendChild(lbl);
  wrap.appendChild(pin);
  return wrap;
}

function makeToEl() {
  const wrap = document.createElement("div");
  wrap.style.cssText = "width:32px;height:38px;cursor:pointer";
  const pin = document.createElement("div");
  pin.style.cssText = `
    width:32px;height:32px;
    background:linear-gradient(135deg,#ef4444,#b91c1c);
    border-radius:50% 50% 50% 0;transform:rotate(-45deg);
    border:3px solid #fff;box-shadow:0 4px 14px rgba(239,68,68,.55);
    display:flex;align-items:center;justify-content:center
  `;
  const lbl = document.createElement("span");
  lbl.style.cssText = "transform:rotate(45deg);font-size:12px;font-weight:900;color:#fff;line-height:1";
  lbl.textContent = "B";
  pin.appendChild(lbl);
  wrap.appendChild(pin);
  return wrap;
}

// ── GPS marker with bearing arrow ──────────────────────────
// Returns { wrap, arrow } so we can rotate `arrow` on bearing changes
// without rebuilding the DOM.
function makeMeEl() {
  const wrap = document.createElement("div");
  wrap.style.cssText = [
    "position:relative",
    "width:56px",
    "height:56px",
    "display:flex",
    "align-items:center",
    "justify-content:center",
  ].join(";");

  // Outer pulse ring
  const r1 = document.createElement("div");
  r1.style.cssText = "position:absolute;inset:0;border-radius:50%;background:rgba(59,130,246,.25);animation:rw-gps-ring 2.2s ease-out infinite;pointer-events:none";
  wrap.appendChild(r1);

  // Inner pulse ring (offset)
  const r2 = document.createElement("div");
  r2.style.cssText = "position:absolute;inset:8px;border-radius:50%;background:rgba(59,130,246,.18);animation:rw-gps-ring 2.2s ease-out 0.8s infinite;pointer-events:none";
  wrap.appendChild(r2);

  // Bearing direction arrow — an upward-pointing triangle above the dot.
  // We rotate this element's parent (arrowWrap) via bearingRef.
  const arrowWrap = document.createElement("div");
  arrowWrap.id = "rw-arrow-wrap";
  arrowWrap.style.cssText = [
    "position:absolute",
    "inset:0",
    "display:flex",
    "align-items:flex-start",   // arrow sits at top of wrapper
    "justify-content:center",
    "pointer-events:none",
    "transition:transform 0.5s ease-out", // smooth rotation
  ].join(";");

  const arrow = document.createElement("div");
  arrow.style.cssText = [
    "width:0",
    "height:0",
    "border-left:6px solid transparent",
    "border-right:6px solid transparent",
    "border-bottom:14px solid rgba(96,165,250,0.9)",
    "margin-top:2px",         // gap between arrow tip and dot edge
    "filter:drop-shadow(0 0 4px rgba(59,130,246,0.8))",
    "animation:rw-bearing-pulse 2s ease-in-out infinite",
  ].join(";");

  arrowWrap.appendChild(arrow);
  wrap.appendChild(arrowWrap);

  // Solid blue dot — always on top
  const dot = document.createElement("div");
  dot.style.cssText = [
    "position:relative",
    "width:20px",
    "height:20px",
    "background:linear-gradient(135deg,#60a5fa,#1d4ed8)",
    "border-radius:50%",
    "border:3px solid #fff",
    "box-shadow:0 0 0 2px rgba(59,130,246,.4),0 4px 14px rgba(59,130,246,.8)",
    "z-index:1",
  ].join(";");
  wrap.appendChild(dot);

  return { wrap, arrowWrap };
}

// ────────────────────────────────────────────────────────────
// applyRide — draw route + markers onto the map (no React closure)
// ────────────────────────────────────────────────────────────
function applyRide(map, ride, currentLoc, isLive, refs) {
  const { fromMarkerRef, toMarkerRef, fromPopupRef, toPopupRef, fullCoordsRef } = refs;

  if (!ride) {
    const remSrc = map.getSource(SRC_REMAINING);
    const trvSrc = map.getSource(SRC_TRAVELED);
    if (remSrc) remSrc.setData(buildLine([]));
    if (trvSrc) trvSrc.setData(buildLine([]));
    fullCoordsRef.current = null;
    return;
  }

  const coords = parseCoords(ride.routeCoordinates);
  fullCoordsRef.current = coords;

  const remSrc = map.getSource(SRC_REMAINING);
  if (remSrc) {
    if (isLive && currentLoc && coords) {
      const { remaining } = sliceRoute(coords, currentLoc.lng, currentLoc.lat);
      remSrc.setData(buildLine(remaining));
    } else {
      remSrc.setData(buildLine(coords || []));
    }
  }

  // FROM marker
  if (ride.fromLat && ride.fromLng) {
    const ll      = [ride.fromLng, ride.fromLat];
    const popHTML = buildFromHTML(ride);
    if (fromMarkerRef.current) {
      fromMarkerRef.current.setLngLat(ll);
      fromPopupRef.current?.setHTML(popHTML);
    } else {
      const popup = new maplibregl.Popup({ offset: 40, closeButton: false, maxWidth: "260px" })
        .setHTML(popHTML);
      fromPopupRef.current = popup;
      fromMarkerRef.current = new maplibregl.Marker({ element: makeFromEl(), anchor: "bottom" })
        .setLngLat(ll).setPopup(popup).addTo(map);
    }
  }

  // TO marker
  if (ride.destinationLat && ride.destinationLng) {
    const ll      = [ride.destinationLng, ride.destinationLat];
    const popHTML = buildToHTML(ride, currentLoc);
    if (toMarkerRef.current) {
      toMarkerRef.current.setLngLat(ll);
      toPopupRef.current?.setHTML(popHTML);
    } else {
      const popup = new maplibregl.Popup({ offset: 40, closeButton: false, maxWidth: "280px" })
        .setHTML(popHTML);
      toPopupRef.current = popup;
      toMarkerRef.current = new maplibregl.Marker({ element: makeToEl(), anchor: "bottom" })
        .setLngLat(ll).setPopup(popup).addTo(map);
    }
  }

  // Fit viewport
  const bounds = new maplibregl.LngLatBounds();
  let hasPts = false;
  if (ride.fromLng && ride.fromLat)              { bounds.extend([ride.fromLng, ride.fromLat]); hasPts = true; }
  if (ride.destinationLng && ride.destinationLat){ bounds.extend([ride.destinationLng, ride.destinationLat]); hasPts = true; }
  if (coords) coords.forEach(c => bounds.extend(c));

  if (hasPts && !bounds.isEmpty()) {
    map.fitBounds(bounds, {
      padding:  { top: 80, bottom: 200, left: 60, right: 60 },
      duration: 800,
      maxZoom:  15,
    });
  }
}

// ════════════════════════════════════════════════════════════
// RideMap — React component
// ════════════════════════════════════════════════════════════
export default function RideMap({ ride, myLocation, isLive = false }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const readyRef     = useRef(false);

  // Always-fresh refs (avoids stale closures in async handlers)
  const rideRef      = useRef(ride);
  const isLiveRef    = useRef(isLive);
  rideRef.current    = ride;
  isLiveRef.current  = isLive;

  // Marker / popup refs
  const fromMarkerRef = useRef(null);
  const toMarkerRef   = useRef(null);
  const meMarkerRef   = useRef(null);
  const meArrowRef    = useRef(null);   // arrowWrap div for rotation
  const fromPopupRef  = useRef(null);
  const toPopupRef    = useRef(null);

  const fullCoordsRef = useRef(null);

  // Bearing / camera-follow state
  const bearingRef    = useRef(0);     // current map/marker bearing (degrees)
  const prevLocRef    = useRef(null);  // previous GPS location for bearing calc
  const followRef     = useRef(true);  // camera follow mode enabled?

  const [isFollowing, setIsFollowing] = useState(true); // mirrors followRef for UI

  const markerRefs = { fromMarkerRef, toMarkerRef, fromPopupRef, toPopupRef, fullCoordsRef };

  // Re-engage camera follow when user taps the re-center button
  const reCenter = useCallback(() => {
    followRef.current = true;
    setIsFollowing(true);
    if (mapRef.current && myLocation?.lat) {
      mapRef.current.easeTo({
        center:   [myLocation.lng, myLocation.lat],
        bearing:  bearingRef.current,
        pitch:    isLive ? 30 : 0,
        zoom:     isLive ? 16 : DEFAULT_ZOOM,
        duration: 700,
      });
    }
  }, [myLocation, isLive]);

  // ════════════════════════════════════════════════════════
  // EFFECT 1 — Create the map exactly once
  // ════════════════════════════════════════════════════════
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container:       containerRef.current,
      style:           OSM_RASTER_STYLE,
      center:          DEFAULT_CENTER,
      zoom:            DEFAULT_ZOOM,
      scrollZoom:      true,
      touchZoomRotate: true,
      doubleClickZoom: true,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }),         "bottom-left");

    // Disengage camera follow when user manually pans
    map.on("dragstart", () => {
      followRef.current = false;
      setIsFollowing(false);
    });

    map.on("load", () => {
      readyRef.current = true;

      // ── REMAINING route source + layers ──
      map.addSource(SRC_REMAINING, { type: "geojson", data: buildLine([]) });

      // White border (Google Maps style)
      map.addLayer({
        id:     LYR_REM_OUTLINE,
        type:   "line",
        source: SRC_REMAINING,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color":   "#ffffff",
          "line-width":   ["interpolate", ["linear"], ["zoom"], 6, 12, 12, 16, 18, 22],
          "line-opacity": 0.75,
        },
      });

      // Blue fill (Google Maps #4285F4)
      map.addLayer({
        id:     LYR_REM_FILL,
        type:   "line",
        source: SRC_REMAINING,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color":   "#4285F4",
          "line-width":   ["interpolate", ["linear"], ["zoom"], 6, 7, 12, 12, 18, 17],
          "line-opacity": 0.97,
        },
      });

      // ── TRAVELED route source + layer ──
      map.addSource(SRC_TRAVELED, { type: "geojson", data: buildLine([]) });

      // Faded grey dashed line for already-driven portion
      map.addLayer({
        id:     LYR_TRV_LINE,
        type:   "line",
        source: SRC_TRAVELED,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color":     "#9ca3af",
          "line-width":     ["interpolate", ["linear"], ["zoom"], 6, 4, 12, 8, 18, 12],
          "line-opacity":   0.45,
          "line-dasharray": [2, 2],
        },
      });

      if (rideRef.current) {
        applyRide(map, rideRef.current, null, isLiveRef.current, markerRefs);
      }
    });

    return () => {
      fromMarkerRef.current?.remove(); fromMarkerRef.current = null;
      toMarkerRef.current?.remove();   toMarkerRef.current   = null;
      meMarkerRef.current?.remove();   meMarkerRef.current   = null;
      meArrowRef.current  = null;
      fromPopupRef.current = null;
      toPopupRef.current   = null;
      map.remove();
      mapRef.current    = null;
      readyRef.current  = false;
      fullCoordsRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ════════════════════════════════════════════════════════
  // EFFECT 2 — Redraw route when ride prop changes
  // ════════════════════════════════════════════════════════
  useEffect(() => {
    if (!mapRef.current || !readyRef.current) return;
    applyRide(mapRef.current, ride, myLocation, isLive, markerRefs);
  }, [ride]); // eslint-disable-line react-hooks/exhaustive-deps

  // ════════════════════════════════════════════════════════
  // EFFECT 3 — GPS tick: move dot + bearing arrow + trim route + follow
  // ════════════════════════════════════════════════════════
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !myLocation?.lat || !myLocation?.lng) return;

    const lngLat = [myLocation.lng, myLocation.lat];

    // ── Calculate bearing from previous → current position ──
    // Prefer the browser-provided heading if available (mobile sensors)
    let newBearing = bearingRef.current;
    if (myLocation.heading != null && !isNaN(myLocation.heading)) {
      // Browser compass heading (alpha) — already 0-360
      newBearing = myLocation.heading;
    } else if (prevLocRef.current) {
      const prev = prevLocRef.current;
      const distMoved = haversineDistance(prev.lat, prev.lng, myLocation.lat, myLocation.lng);
      // Only update bearing if user moved more than 5m (avoids jitter when stationary)
      if (distMoved > 5) {
        newBearing = bearingBetween(prev.lat, prev.lng, myLocation.lat, myLocation.lng);
      }
    }
    bearingRef.current = newBearing;
    prevLocRef.current = myLocation;

    // ── Move or create the blue GPS dot with bearing arrow ──
    if (meMarkerRef.current) {
      meMarkerRef.current.setLngLat(lngLat);
    } else {
      const { wrap, arrowWrap } = makeMeEl();
      meArrowRef.current = arrowWrap;
      meMarkerRef.current = new maplibregl.Marker({ element: wrap, anchor: "center" })
        .setLngLat(lngLat)
        .setPopup(
          new maplibregl.Popup({ offset: 28, closeButton: false })
            .setHTML("<b>📍 You are here</b>")
        )
        .addTo(map);
    }

    // Rotate the bearing arrow to face direction of travel
    if (meArrowRef.current) {
      meArrowRef.current.style.transform = `rotate(${newBearing}deg)`;
    }

    // ── Dynamic route trimming (isLive mode only) ──
    if (isLive && readyRef.current && fullCoordsRef.current) {
      const { traveled, remaining } = sliceRoute(
        fullCoordsRef.current,
        myLocation.lng,
        myLocation.lat
      );
      const remSrc = map.getSource(SRC_REMAINING);
      const trvSrc = map.getSource(SRC_TRAVELED);
      if (remSrc) remSrc.setData(buildLine(remaining));
      if (trvSrc) trvSrc.setData(buildLine(traveled));

      if (toPopupRef.current && ride) {
        toPopupRef.current.setHTML(buildToHTML(ride, myLocation));
      }
    }

    // ── Camera follow — smooth pan to user with bearing + slight pitch ──
    if (isLive && followRef.current) {
      map.easeTo({
        center:   lngLat,
        bearing:  newBearing,
        pitch:    25,          // slight 3D tilt for nav feel
        zoom:     16.5,        // street-level zoom while navigating
        duration: 600,         // smooth 600ms transition
      });
    }
  }, [myLocation, isLive, ride]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#1a1a2e" }}>
      {/* Map canvas */}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Re-center button — shown when user has manually panned away */}
      {isLive && !isFollowing && (
        <button
          onClick={reCenter}
          title="Re-center on your location"
          style={{
            position:       "absolute",
            bottom:         "100px",
            right:          "16px",
            zIndex:         20,
            width:          "44px",
            height:         "44px",
            borderRadius:   "12px",
            background:     "rgba(15,15,26,0.9)",
            backdropFilter: "blur(12px)",
            border:         "1.5px solid rgba(66,133,244,0.5)",
            color:          "#4285F4",
            cursor:         "pointer",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            fontSize:       "18px",
            boxShadow:      "0 4px 20px rgba(0,0,0,0.4)",
            animation:      "rcFadeIn 0.25s ease-out both",
          }}
        >
          <i className="fa fa-location-crosshairs" />
        </button>
      )}

      <style>{`
        @keyframes rcFadeIn {
          from { opacity:0; transform: scale(0.8); }
          to   { opacity:1; transform: scale(1);   }
        }
      `}</style>
    </div>
  );
}
