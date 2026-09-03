// ============================================================
// 🗺️ RideMap.jsx — Full-screen MapLibre GL map (bug-fixed)
//
// ── BUG FIXES in this version ────────────────────────────
//
// BUG 1 — Route not showing:
//   Root cause: Old code called map.removeLayer / removeSource
//   then re-added on every ride update. This caused race conditions
//   where the source was removed while the layer still referenced it.
//   Also, the "load" listener fired only once but Effect 2 ran
//   again later — when isStyleLoaded() returned true but the custom
//   source didn't exist yet because it was added in the load handler.
//
//   FIX: Create the GeoJSON source + layers ONCE in the "load" event.
//   On subsequent updates call source.setData() — zero flicker, zero
//   layer race conditions. A ref (readyRef) gates all updates.
//
// BUG 2 — Blue GPS dot appearing in wrong location:
//   Root cause: HTML injected via innerHTML into the marker element
//   had an absolutely positioned child with inset:-8px. This made
//   the element's actual bounding box larger than the visible dot,
//   so MapLibre's anchor:"center" calculation was off by ~8px.
//   The injected <style> tag also doesn't work reliably in all browsers.
//
//   FIX: Build marker DOM in pure JS (no innerHTML, no injected styles).
//   The keyframe is injected once into <head> at module load time.
//   The outer wrapper is exactly 40×40px. All rings are
//   position:absolute inside it so they don't expand the bounding box.
//   anchor:"center" now hits the exact GPS coordinate.
//
// BUG 3 — Route line width looks wrong at high/low zoom:
//   FIX: Use MapLibre zoom interpolate expressions so the line
//   maintains Google Maps-like constant visual width at all zoom levels.
//
// ── Tile provider ─────────────────────────────────────────
//   OpenStreetMap raster tiles — no API key, zoom 1–19 detail.
//   Swap the URL in OSM_RASTER_STYLE.sources.osm.tiles to change provider.
//
// ── Props ─────────────────────────────────────────────────
//   ride        { fromLat, fromLng, fromName,
//                 destinationLat, destinationLng, destinationName,
//                 routeCoordinates (JSON string "[[lng,lat],...]") }
//   myLocation  { lat, lng } | null
//   isLive      boolean
// ============================================================

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// ────────────────────────────────────────────────────────────
// MAP STYLE — OSM raster tiles
// To switch providers just change the tiles URL below.
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

// MapLibre source/layer IDs for the route line
const SRC_ROUTE   = "rw-route-source";
const LYR_OUTLINE = "rw-route-outline"; // white border under orange line
const LYR_FILL    = "rw-route-fill";    // orange line on top

// ── Inject CSS keyframe ONCE into <head> at module import time ──
// This avoids putting <style> tags inside marker innerHTML which
// is unreliable across browsers. The animation name is unique
// (prefixed "rw-") so it doesn't clash with other CSS.
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
// Returns [[lng,lat], ...] array or null
// ────────────────────────────────────────────────────────────
function parseCoords(routeCoordinates) {
  if (!routeCoordinates) return null;
  try {
    const arr = typeof routeCoordinates === "string"
      ? JSON.parse(routeCoordinates)
      : routeCoordinates;               // accept pre-parsed arrays too
    if (!Array.isArray(arr) || arr.length < 2) return null;
    return arr;
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// makeFromMarker — green "A" pin for start location
// Returns a plain DOM element to pass to maplibregl.Marker()
// ────────────────────────────────────────────────────────────
function makeFromMarker() {
  const wrap = document.createElement("div");
  // Wrapper is 32×38 — same size as the visual pin
  wrap.style.cssText = "width:32px;height:38px;cursor:pointer;";

  const pin = document.createElement("div");
  // Drop-pin shape: circle with bottom-left corner squared (rotated square)
  pin.style.cssText = `
    width:32px;height:32px;
    background:linear-gradient(135deg,#22c55e,#15803d);
    border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);
    border:3px solid #fff;
    box-shadow:0 4px 14px rgba(34,197,94,0.55);
    display:flex;align-items:center;justify-content:center;
  `;

  // Letter inside the pin — rotated back to be upright
  const letter = document.createElement("span");
  letter.style.cssText = "transform:rotate(45deg);font-size:12px;font-weight:900;color:#fff;line-height:1;";
  letter.textContent = "A";

  pin.appendChild(letter);
  wrap.appendChild(pin);
  return wrap;
}

// ────────────────────────────────────────────────────────────
// makeToMarker — red "B" pin for destination
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
//   MapLibre's Marker positions the element so that its anchor point
//   (center, in our case) aligns with the lat/lng on the map.
//   The wrapper is EXACTLY 40×40. All pulsing rings are
//   position:absolute inside the wrapper — they do NOT expand
//   the wrapper's bounding box. This ensures anchor:"center"
//   places the dot exactly on the GPS coordinate. No offset bug.
// ────────────────────────────────────────────────────────────
function makeMeMarker() {
  // Outer wrapper: exactly 40×40px, flex-centered
  const wrap = document.createElement("div");
  wrap.style.cssText = `
    position:relative;
    width:40px;height:40px;
    display:flex;align-items:center;justify-content:center;
  `;

  // Outer ring — fast pulse
  const ring1 = document.createElement("div");
  ring1.style.cssText = `
    position:absolute;inset:0;
    border-radius:50%;
    background:rgba(59,130,246,0.3);
    animation:rw-gps-ring 2s ease-out infinite;
    pointer-events:none;
  `;
  wrap.appendChild(ring1);

  // Inner ring — slower pulse, offset start
  const ring2 = document.createElement("div");
  ring2.style.cssText = `
    position:absolute;inset:6px;
    border-radius:50%;
    background:rgba(59,130,246,0.2);
    animation:rw-gps-ring 2s ease-out 0.7s infinite;
    pointer-events:none;
  `;
  wrap.appendChild(ring2);

  // The actual blue dot (always visible, sits above the rings)
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

// ════════════════════════════════════════════════════════════
// RideMap component
// ════════════════════════════════════════════════════════════
export default function RideMap({ ride, myLocation }) {
  const containerRef  = useRef(null); // <div> the map renders into
  const mapRef        = useRef(null); // maplibregl.Map instance
  const readyRef      = useRef(false); // true once map "load" event has fired

  // Marker refs — we update position instead of removing+recreating
  // to avoid DOM flicker and position jumps
  const fromMarkerRef = useRef(null);
  const toMarkerRef   = useRef(null);
  const meMarkerRef   = useRef(null);

  // ════════════════════════════════════════════════════════
  // EFFECT 1 — Create the MapLibre map ONCE on mount
  //
  // The "load" event handler adds the GeoJSON source + layers.
  // Everything that touches the map MUST wait for "load" to fire.
  // We use readyRef as the gate.
  // ════════════════════════════════════════════════════════
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container:       containerRef.current,
      style:           OSM_RASTER_STYLE,
      center:          DEFAULT_CENTER,  // default to Chennai
      zoom:            DEFAULT_ZOOM,
      scrollZoom:      true,
      touchZoomRotate: true,
      doubleClickZoom: true,
    });
    mapRef.current = map;

    // Zoom +/- buttons + compass
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    // Distance scale bar
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    // ── "load" fires when style tiles are parsed + ready ──
    // Add our custom sources and layers here — guaranteed to be safe.
    map.on("load", () => {
      // Mark map as ready so other effects can draw
      readyRef.current = true;

      // ── Route GeoJSON source (empty initially) ──
      // We NEVER removeSource() or removeLayer() — we call setData()
      // to swap coordinates in place. This eliminates all race conditions.
      map.addSource(SRC_ROUTE, {
        type: "geojson",
        data: buildLineGeoJSON([]), // empty line — invisible until ride loads
      });

      // White outline drawn BELOW the orange line (Google Maps look)
      map.addLayer({
        id:     LYR_OUTLINE,
        type:   "line",
        source: SRC_ROUTE,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color":   "#ffffff",
          // zoom-interpolated width keeps visual thickness constant
          // regardless of zoom level — exactly like Google Maps
          "line-width":   ["interpolate", ["linear"], ["zoom"], 6,8, 12,12, 18,18],
          "line-opacity": 0.6,
        },
      });

      // Orange line drawn ON TOP of the white outline
      map.addLayer({
        id:     LYR_FILL,
        type:   "line",
        source: SRC_ROUTE,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color":   "#f97316",
          "line-width":   ["interpolate", ["linear"], ["zoom"], 6,5, 12,8, 18,13],
          "line-opacity": 0.97,
        },
      });

      // ── Draw the ride that was passed as a prop (may already be set) ──
      // This handles the case where ride prop arrives before "load" fires.
      if (ride) {
        applyRide(map, ride, fromMarkerRef, toMarkerRef);
      }
    });

    // Cleanup when component unmounts
    return () => {
      fromMarkerRef.current?.remove(); fromMarkerRef.current = null;
      toMarkerRef.current?.remove();   toMarkerRef.current   = null;
      meMarkerRef.current?.remove();   meMarkerRef.current   = null;
      map.remove();
      mapRef.current   = null;
      readyRef.current = false;
    };
  }, []); // ← empty deps: create map only once

  // ════════════════════════════════════════════════════════
  // EFFECT 2 — Redraw route + markers when ride prop changes
  //
  // "ride" changes when:
  //   • The user just created a new ride (in RideSetupFlow)
  //   • The user opens a historical ride from the history panel
  //   • The preview in RideSetupFlow updates
  // ════════════════════════════════════════════════════════
  useEffect(() => {
    // Gate: only run after the map style has loaded
    if (!mapRef.current || !readyRef.current) return;
    applyRide(mapRef.current, ride, fromMarkerRef, toMarkerRef);
  }, [ride]);

  // ════════════════════════════════════════════════════════
  // EFFECT 3 — Move the blue GPS dot when myLocation changes
  //
  // Strategy: MOVE an existing marker with setLngLat() instead of
  // removing and recreating it. This prevents:
  //   • Visual flicker as the old marker disappears
  //   • The dot "jumping" to [0,0] between updates
  //   • Re-triggering MapLibre's Marker animation on each GPS tick
  //
  // COORDINATE ORDER NOTE:
  //   navigator.geolocation gives:  { latitude, longitude }
  //   We map them to:               { lat, lng }
  //   MapLibre expects:             [lng, lat]   ← longitude FIRST
  //   Swapping lat/lng would put the dot in the wrong hemisphere.
  // ════════════════════════════════════════════════════════
  useEffect(() => {
    const map = mapRef.current;
    // Guard: need map + valid GPS coordinates
    if (!map || !myLocation?.lat || !myLocation?.lng) return;

    // MapLibre coordinate format: [longitude, latitude]
    const lngLat = [myLocation.lng, myLocation.lat];

    if (meMarkerRef.current) {
      // Marker already on map → just move it
      meMarkerRef.current.setLngLat(lngLat);
    } else {
      // First GPS fix → create the marker
      meMarkerRef.current = new maplibregl.Marker({
        element: makeMeMarker(), // 40×40 wrapper, anchor:"center"
        anchor:  "center",       // exact centre of the 40×40 wrapper = GPS point
      })
        .setLngLat(lngLat)
        .setPopup(
          new maplibregl.Popup({ offset: 24, closeButton: false })
            .setHTML("<b>📍 You</b>")
        )
        .addTo(map);
    }
  }, [myLocation]);

  return (
    // MapLibre renders into this div.
    // It must have explicit dimensions (width + height) — flex:1 in the
    // parent (ActiveRideOverlay) gives it 100% of the available height.
    <div ref={containerRef} style={{ width: "100%", height: "100%", background: "#1a1a2e" }} />
  );
}

// ════════════════════════════════════════════════════════════
// applyRide — updates the map with new ride data
//
// Called from: Effect 2 AND the "load" handler in Effect 1.
// Does NOT create the source/layers (those are created in "load").
// Does NOT touch the live GPS marker (Effect 3 handles that).
//
// Receives the marker refs so it can create/move FROM and TO markers.
// ════════════════════════════════════════════════════════════
function applyRide(map, ride, fromRef, toRef) {
  if (!ride) {
    // No ride: clear the route line
    const src = map.getSource(SRC_ROUTE);
    if (src) src.setData(buildLineGeoJSON([]));
    return;
  }

  // ── Route line ──────────────────────────────────────────
  const coords = parseCoords(ride.routeCoordinates);
  const src = map.getSource(SRC_ROUTE);
  if (src) {
    // setData replaces the GeoJSON in place — no layer flicker
    src.setData(buildLineGeoJSON(coords || []));
  }

  // ── FROM marker (green A pin) ───────────────────────────
  if (ride.fromLat && ride.fromLng) {
    const lngLat = [ride.fromLng, ride.fromLat];
    if (fromRef.current) {
      fromRef.current.setLngLat(lngLat); // move existing marker
    } else {
      fromRef.current = new maplibregl.Marker({
        element: makeFromMarker(),
        anchor:  "bottom", // bottom of the pin touches the coordinate
      })
        .setLngLat(lngLat)
        .setPopup(
          new maplibregl.Popup({ offset: 40, closeButton: false })
            .setHTML(`<b>🟢 Start</b><br/><small>${ride.fromName || "From"}</small>`)
        )
        .addTo(map);
    }
  }

  // ── TO marker (red B pin) ────────────────────────────────
  if (ride.destinationLat && ride.destinationLng) {
    const lngLat = [ride.destinationLng, ride.destinationLat];
    if (toRef.current) {
      toRef.current.setLngLat(lngLat);
    } else {
      toRef.current = new maplibregl.Marker({
        element: makeToMarker(),
        anchor:  "bottom",
      })
        .setLngLat(lngLat)
        .setPopup(
          new maplibregl.Popup({ offset: 40, closeButton: false })
            .setHTML(`<b>🔴 End</b><br/><small>${ride.destinationName || "Destination"}</small>`)
        )
        .addTo(map);
    }
  }

  // ── Fit map bounds to show full route ────────────────────
  const bounds = new maplibregl.LngLatBounds();
  let hasPts = false;

  if (ride.fromLng && ride.fromLat) {
    bounds.extend([ride.fromLng, ride.fromLat]);
    hasPts = true;
  }
  if (ride.destinationLng && ride.destinationLat) {
    bounds.extend([ride.destinationLng, ride.destinationLat]);
    hasPts = true;
  }
  // Include every point in the route so the line fits the viewport
  if (coords) coords.forEach(c => bounds.extend(c));

  if (hasPts && !bounds.isEmpty()) {
    map.fitBounds(bounds, {
      padding:  { top: 80, bottom: 150, left: 60, right: 60 },
      duration: 800,
      maxZoom:  14,
    });
  }
}

// ────────────────────────────────────────────────────────────
// buildLineGeoJSON — helper to wrap a coordinates array in
// the GeoJSON FeatureCollection format that MapLibre expects
// ────────────────────────────────────────────────────────────
function buildLineGeoJSON(coordinates) {
  return {
    type: "Feature",
    geometry: {
      type:        "LineString",
      coordinates, // [[lng,lat], [lng,lat], ...]
    },
    properties: {},
  };
}
