// ============================================================
// RideMap.jsx — MapLibre Map with OSRM Route + Live GPS Dot
//
// FIXES (this version):
//   Route line (blue OSRM path) always draws — sources/layers are
//   created BEFORE drawRoute() is ever called, eliminating the race.
//   Blue GPS pulsing dot always shows when myLocation is provided.
//   Direction arrow rotates correctly with bearing.
//   Fallback OSRM fetch works correctly for rides missing routeCoordinates.
// ============================================================
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  haversineDistance,
  bearingBetween,
  formatDistance,
  formatDuration,
  getRoute,
} from "../../../services/routingApi";

const MAP_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm-tiles", type: "raster", source: "osm" }],
};

const DEFAULT_CENTER = [80.2707, 13.0827];
const DEFAULT_ZOOM = 13;

const SRC_REM = "rw-remaining";
const SRC_TRV = "rw-traveled";
const LAYER_BORDER = "rw-rem-border";
const LAYER_REMAINING = "rw-rem-line";
const LAYER_TRAVELED = "rw-trv-line";

// Inject pulse + spin CSS once
(function injectCss() {
  if (typeof document === "undefined") return;
  if (document.getElementById("rw-gps-style")) return;
  const s = document.createElement("style");
  s.id = "rw-gps-style";
  s.textContent = `
    @keyframes rw-pulse {
      0%   { transform: scale(0.85); opacity: 0.9; }
      60%  { transform: scale(2.6);  opacity: 0;   }
      100% { transform: scale(0.85); opacity: 0;   }
    }
    @keyframes rw-spin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(s);
}());

// ── Pure helpers ────────────────────────────────────────────
function parseCoords(raw) {
  if (!raw) return null;
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr) || arr.length < 2) return null;
    if (!Array.isArray(arr[0]) || arr[0].length < 2) return null;
    return arr;
  } catch { return null; }
}

function buildGeoJSON(coords) {
  return { type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} };
}

function projectOnSegment(pLat, pLng, aLat, aLng, bLat, bLng) {
  const dx = bLng - aLng, dy = bLat - aLat;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { lat: aLat, lng: aLng };
  const t = Math.max(0, Math.min(1, ((pLng - aLng) * dx + (pLat - aLat) * dy) / lenSq));
  return { lat: aLat + t * dy, lng: aLng + t * dx };
}

function sliceRoute(fullCoords, userLng, userLat) {
  if (!fullCoords || fullCoords.length < 2)
    return { remaining: fullCoords || [], traveled: [], snapLng: userLng, snapLat: userLat };
  let bestIdx = 0, bestDist = Infinity, bestSnap = { lat: fullCoords[0][1], lng: fullCoords[0][0] };
  for (let i = 0; i < fullCoords.length - 1; i++) {
    const [lng1, lat1] = fullCoords[i], [lng2, lat2] = fullCoords[i + 1];
    const snap = projectOnSegment(userLat, userLng, lat1, lng1, lat2, lng2);
    const d = haversineDistance(userLat, userLng, snap.lat, snap.lng);
    if (d < bestDist) { bestDist = d; bestIdx = i; bestSnap = snap; }
  }
  const snapped = [bestSnap.lng, bestSnap.lat];
  return {
    remaining: [snapped, ...fullCoords.slice(bestIdx + 1)],
    traveled: [...fullCoords.slice(0, bestIdx + 1), snapped],
    snapLng: bestSnap.lng, snapLat: bestSnap.lat,
  };
}

// ── DOM marker builders ──────────────────────────────────────
function makeMarkerA() {
  const el = document.createElement("div");
  el.style.cssText = "width:36px;height:44px;display:flex;flex-direction:column;align-items:center;cursor:pointer;filter:drop-shadow(0 4px 10px rgba(34,197,94,0.55))";
  const pin = document.createElement("div");
  pin.style.cssText = "width:36px;height:36px;background:linear-gradient(145deg,#22c55e,#15803d);border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;display:flex;align-items:center;justify-content:center;box-sizing:border-box";
  const letter = document.createElement("span");
  letter.textContent = "A";
  letter.style.cssText = "transform:rotate(45deg);font-size:13px;font-weight:900;color:#fff;line-height:1;font-family:system-ui";
  pin.appendChild(letter); el.appendChild(pin); return el;
}

function makeMarkerB() {
  const el = document.createElement("div");
  el.style.cssText = "width:36px;height:44px;display:flex;flex-direction:column;align-items:center;cursor:pointer;filter:drop-shadow(0 4px 10px rgba(239,68,68,0.55))";
  const pin = document.createElement("div");
  pin.style.cssText = "width:36px;height:36px;background:linear-gradient(145deg,#ef4444,#b91c1c);border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;display:flex;align-items:center;justify-content:center;box-sizing:border-box";
  const letter = document.createElement("span");
  letter.textContent = "B";
  letter.style.cssText = "transform:rotate(45deg);font-size:13px;font-weight:900;color:#fff;line-height:1;font-family:system-ui";
  pin.appendChild(letter); el.appendChild(pin); return el;
}

function makeGpsDot() {
  const el = document.createElement("div");
  el.style.cssText = "position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center;";

  const ring1 = document.createElement("div");
  ring1.style.cssText = "position:absolute;inset:0;border-radius:50%;background:rgba(66,133,244,0.22);animation:rw-pulse 2.2s ease-out infinite;pointer-events:none;";
  el.appendChild(ring1);

  const ring2 = document.createElement("div");
  ring2.style.cssText = "position:absolute;inset:0;border-radius:50%;background:rgba(66,133,244,0.12);animation:rw-pulse 2.2s ease-out 1.1s infinite;pointer-events:none;";
  el.appendChild(ring2);

  const arrowEl = document.createElement("div");
  arrowEl.style.cssText = "position:absolute;inset:0;display:flex;align-items:flex-start;justify-content:center;pointer-events:none;transition:transform 0.55s cubic-bezier(0.4,0,0.2,1);";
  const arrow = document.createElement("div");
  arrow.style.cssText = "width:0;height:0;margin-top:2px;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:15px solid rgba(66,133,244,0.9);filter:drop-shadow(0 0 4px rgba(66,133,244,0.7));";
  arrowEl.appendChild(arrow);
  el.appendChild(arrowEl);

  const dotEl = document.createElement("div");
  dotEl.style.cssText = "position:relative;z-index:2;width:20px;height:20px;background:linear-gradient(145deg,#60a5fa,#1d4ed8);border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 3px rgba(66,133,244,0.35),0 3px 12px rgba(66,133,244,0.75);transition:background 0.4s;";
  el.appendChild(dotEl);

  return { el, arrowEl, dotEl };
}

// ── Popup HTML ───────────────────────────────────────────────
function popupHTML_A(ride) {
  const name = (ride?.fromName || "Start").split(",")[0].trim();
  const emoji = ride?.rideType === "solo" ? "🏍️" : "👥";
  const type = ride?.rideType === "solo" ? "Solo Ride" : "Group Ride";
  return `<div style="font-family:system-ui,sans-serif;min-width:160px;padding:4px 0"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="background:#22c55e;color:#fff;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;flex-shrink:0">A</span><strong style="font-size:14px;color:#111">${name}</strong></div><div style="display:inline-flex;align-items:center;gap:5px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:50px;padding:3px 10px;font-size:11px;color:#166534;font-weight:600">${emoji} ${type}</div></div>`;
}

function popupHTML_B(ride, myLoc) {
  const name = (ride?.destinationName || "Destination").split(",")[0].trim();
  let distStr = "—", etaStr = "—";
  if (myLoc?.lat && ride?.destinationLat) {
    const d = haversineDistance(myLoc.lat, myLoc.lng, ride.destinationLat, ride.destinationLng);
    distStr = formatDistance(d);
    if (ride.distanceMeters > 0 && ride.durationSeconds > 0)
      etaStr = formatDuration(d / (ride.distanceMeters / ride.durationSeconds));
  } else if (ride?.distanceMeters) {
    distStr = formatDistance(ride.distanceMeters);
    etaStr = formatDuration(ride.durationSeconds);
  }
  return `<div style="font-family:system-ui,sans-serif;min-width:180px;padding:4px 0"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="background:#ef4444;color:#fff;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;flex-shrink:0">B</span><strong style="font-size:14px;color:#111">${name}</strong></div><div style="display:flex;gap:16px;padding-top:4px;border-top:1px solid #f0f0f0"><div style="text-align:center"><div style="font-size:17px;font-weight:900;color:#ef4444">${distStr}</div><div style="font-size:9px;color:#999;text-transform:uppercase;letter-spacing:.5px;margin-top:2px">Remaining</div></div><div style="width:1px;background:#f0f0f0"></div><div style="text-align:center"><div style="font-size:17px;font-weight:900;color:#333">${etaStr}</div><div style="font-size:9px;color:#999;text-transform:uppercase;letter-spacing:.5px;margin-top:2px">ETA</div></div></div></div>`;
}

// ════════════════════════════════════════════════════════════
// RideMap component
// ════════════════════════════════════════════════════════════
export default function RideMap({ ride, myLocation, isLive = false }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  // true only after setupMapLayers() has run — gates all source.setData() calls
  const mapReadyRef  = useRef(false);

  // Always-fresh refs (avoid stale closures in async callbacks)
  const rideRef  = useRef(ride);  rideRef.current  = ride;
  const myLocRef = useRef(myLocation); myLocRef.current = myLocation;

  // MapLibre object refs
  const markerARef = useRef(null);
  const markerBRef = useRef(null);
  const gpsDotRef  = useRef(null);
  const arrowElRef = useRef(null);
  const dotElRef   = useRef(null);
  const popupBRef  = useRef(null);

  const coordsRef  = useRef(null); // full OSRM coords array
  const prevLocRef = useRef(null);
  const bearingRef = useRef(0);
  const followRef  = useRef(true);
  const fetchingRef = useRef(false);

  const [showReCenter, setShowReCenter] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);

  // ── setupMapLayers — called ONCE inside map.on("load") ────
  // Creates GeoJSON sources + three line layers.
  // Sets mapReadyRef = true so drawRoute/setData can run safely.
  function setupMapLayers(map) {
    map.addSource(SRC_REM, { type: "geojson", data: buildGeoJSON([]) });
    map.addSource(SRC_TRV, { type: "geojson", data: buildGeoJSON([]) });

    // White border — gives the Google Maps "road pill" appearance
    map.addLayer({
      id: LAYER_BORDER, type: "line", source: SRC_REM,
      layout: { "line-join": "round", "line-cap": "round" },
      paint:  { "line-color": "#ffffff", "line-width": 20, "line-opacity": 0.88 },
    });
    // Blue route line (remaining)
    map.addLayer({
      id: LAYER_REMAINING, type: "line", source: SRC_REM,
      layout: { "line-join": "round", "line-cap": "round" },
      paint:  { "line-color": "#4285F4", "line-width": 12, "line-opacity": 1.0 },
    });
    // Grey dashed traveled line
    map.addLayer({
      id: LAYER_TRAVELED, type: "line", source: SRC_TRV,
      layout: { "line-join": "round", "line-cap": "round" },
      paint:  { "line-color": "#9ca3af", "line-width": 8, "line-opacity": 0.45, "line-dasharray": [2, 3] },
    });

    mapReadyRef.current = true;
  }

  // ── drawRoute — update line data + A/B markers ─────────────
  // Safe to call only after setupMapLayers() has run.
  function drawRoute(map, rideData) {
    if (!map || !mapReadyRef.current) return;

    const coords = parseCoords(rideData?.routeCoordinates);
    coordsRef.current = coords;

    map.getSource(SRC_REM).setData(buildGeoJSON(coords || []));
    map.getSource(SRC_TRV).setData(buildGeoJSON([]));

    if (!rideData) return;

    // A marker
    if (rideData.fromLat && rideData.fromLng) {
      const ll = [rideData.fromLng, rideData.fromLat];
      if (markerARef.current) {
        markerARef.current.setLngLat(ll);
      } else {
        markerARef.current = new maplibregl.Marker({ element: makeMarkerA(), anchor: "bottom" })
          .setLngLat(ll)
          .setPopup(new maplibregl.Popup({ offset: 44, closeButton: false, maxWidth: "260px" }).setHTML(popupHTML_A(rideData)))
          .addTo(map);
      }
    }

    // B marker
    if (rideData.destinationLat && rideData.destinationLng) {
      const ll = [rideData.destinationLng, rideData.destinationLat];
      const popup = new maplibregl.Popup({ offset: 44, closeButton: false, maxWidth: "280px" })
        .setHTML(popupHTML_B(rideData, myLocRef.current));
      popupBRef.current = popup;
      if (markerBRef.current) {
        markerBRef.current.setLngLat(ll);
      } else {
        markerBRef.current = new maplibregl.Marker({ element: makeMarkerB(), anchor: "bottom" })
          .setLngLat(ll).setPopup(popup).addTo(map);
      }
    }

    // Fit viewport
    if (coords && coords.length >= 2) {
      const bounds = new maplibregl.LngLatBounds();
      coords.forEach(c => bounds.extend(c));
      if (rideData.fromLng)        bounds.extend([rideData.fromLng, rideData.fromLat]);
      if (rideData.destinationLng) bounds.extend([rideData.destinationLng, rideData.destinationLat]);
      map.fitBounds(bounds, { padding: { top: 90, bottom: 200, left: 60, right: 60 }, maxZoom: 15, duration: 900 });
    } else if (rideData.fromLat && rideData.destinationLat) {
      const bounds = new maplibregl.LngLatBounds();
      bounds.extend([rideData.fromLng, rideData.fromLat]);
      bounds.extend([rideData.destinationLng, rideData.destinationLat]);
      map.fitBounds(bounds, { padding: { top: 90, bottom: 200, left: 60, right: 60 }, maxZoom: 14, duration: 900 });
    }
  }

  // ── fetchAndDrawRoute — OSRM fallback ─────────────────────
  async function fetchAndDrawRoute(map, rideData) {
    if (!rideData?.fromLat || !rideData?.destinationLat) return;
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setRouteLoading(true);
    try {
      const route = await getRoute(
        { lat: rideData.fromLat, lng: rideData.fromLng },
        { lat: rideData.destinationLat, lng: rideData.destinationLng }
      );
      if (route?.coordinates && mapReadyRef.current) {
        rideRef.current = { ...rideData, routeCoordinates: JSON.stringify(route.coordinates) };
        coordsRef.current = route.coordinates;
        map.getSource(SRC_REM)?.setData(buildGeoJSON(route.coordinates));
        const bounds = new maplibregl.LngLatBounds();
        route.coordinates.forEach(c => bounds.extend(c));
        map.fitBounds(bounds, { padding: { top: 90, bottom: 200, left: 60, right: 60 }, maxZoom: 15, duration: 900 });
      }
    } catch (e) {
      console.warn("[RideMap] OSRM fetch failed:", e.message);
    } finally {
      setRouteLoading(false);
      fetchingRef.current = false;
    }
  }

  // ── placeGpsDot — create or move the GPS marker ───────────
  function placeGpsDot(map, loc) {
    const ll = [loc.lng, loc.lat];
    if (gpsDotRef.current) {
      gpsDotRef.current.setLngLat(ll);
    } else {
      const { el, arrowEl, dotEl } = makeGpsDot();
      arrowElRef.current = arrowEl;
      dotElRef.current   = dotEl;
      gpsDotRef.current  = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat(ll)
        .setPopup(new maplibregl.Popup({ offset: 28, closeButton: false }).setHTML("<div style='font-family:system-ui;font-size:13px;font-weight:700'>📍 You are here</div>"))
        .addTo(map);
    }
    if (dotElRef.current) {
      const acc = loc.accuracy ?? 9999;
      if (acc > 200) {
        dotElRef.current.style.background = "linear-gradient(145deg,#fb923c,#ea580c)";
        dotElRef.current.style.boxShadow  = "0 0 0 3px rgba(234,88,12,0.35),0 3px 12px rgba(234,88,12,0.75)";
      } else {
        dotElRef.current.style.background = "linear-gradient(145deg,#60a5fa,#1d4ed8)";
        dotElRef.current.style.boxShadow  = "0 0 0 3px rgba(66,133,244,0.35),0 3px 12px rgba(66,133,244,0.75)";
      }
    }
  }

  // ════════════════════════════════════════════════════════
  // EFFECT 1 — Create MapLibre map instance ONCE on mount
  //
  // CRITICAL ORDER inside map.on("load"):
  //   1. setupMapLayers()  ← creates sources + layers
  //   2. drawRoute()       ← safe now; sources exist
  //   3. fetchAndDrawRoute()  ← OSRM fallback if needed
  //   4. placeGpsDot()    ← draw dot if location already known
  // ════════════════════════════════════════════════════════
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      scrollZoom: true,
      touchZoomRotate: true,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("dragstart", () => {
      if (!isLive) return;
      followRef.current = false;
      setShowReCenter(true);
    });

    map.on("load", () => {
      setupMapLayers(map);                       // 1. sources + layers first
      drawRoute(map, rideRef.current);           // 2. draw stored coords
      const curr = rideRef.current;
      if (curr && !parseCoords(curr.routeCoordinates)) {
        fetchAndDrawRoute(map, curr);            // 3. fetch from OSRM if needed
      }
      const loc = myLocRef.current;
      if (loc?.lat && loc?.lng) {
        placeGpsDot(map, loc);                  // 4. draw dot if already known
      }
    });

    return () => {
      mapReadyRef.current = false;
      markerARef.current?.remove(); markerARef.current = null;
      markerBRef.current?.remove(); markerBRef.current = null;
      gpsDotRef.current?.remove();  gpsDotRef.current  = null;
      arrowElRef.current = null; dotElRef.current = null;
      popupBRef.current  = null; coordsRef.current = null;
      map.remove(); mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ════════════════════════════════════════════════════════
  // EFFECT 2 — Redraw when ride prop changes
  //
  // Only runs when map is already loaded (mapReadyRef = true).
  // If map not loaded yet, Effect 1's load handler uses rideRef.
  // ════════════════════════════════════════════════════════
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    drawRoute(map, ride);
    if (ride && !parseCoords(ride.routeCoordinates)) {
      fetchAndDrawRoute(map, ride);
    }
  }, [ride]); // eslint-disable-line react-hooks/exhaustive-deps

  // ════════════════════════════════════════════════════════
  // EFFECT 3 — GPS tick
  // ════════════════════════════════════════════════════════
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !myLocation?.lat || !myLocation?.lng) return;

    const doUpdate = () => {
      // Trim route line
      if (isLive && coordsRef.current && mapReadyRef.current) {
        const { remaining, traveled } = sliceRoute(coordsRef.current, myLocation.lng, myLocation.lat);
        map.getSource(SRC_REM)?.setData(buildGeoJSON(remaining));
        map.getSource(SRC_TRV)?.setData(buildGeoJSON(traveled));
        if (popupBRef.current && rideRef.current)
          popupBRef.current.setHTML(popupHTML_B(rideRef.current, myLocation));
      }

      // GPS dot
      placeGpsDot(map, myLocation);

      // Bearing + arrow rotation
      let bearing = bearingRef.current;
      if (myLocation.heading != null && !isNaN(myLocation.heading)) {
        bearing = myLocation.heading;
      } else if (prevLocRef.current) {
        const moved = haversineDistance(prevLocRef.current.lat, prevLocRef.current.lng, myLocation.lat, myLocation.lng);
        if (moved > 8)
          bearing = bearingBetween(prevLocRef.current.lat, prevLocRef.current.lng, myLocation.lat, myLocation.lng);
      }
      bearingRef.current = bearing;
      prevLocRef.current = myLocation;
      if (arrowElRef.current)
        arrowElRef.current.style.transform = `rotate(${bearing}deg)`;

      // Camera follow
      if (isLive && followRef.current) {
        map.easeTo({ center: [myLocation.lng, myLocation.lat], bearing, pitch: 28, zoom: 16.5, duration: 650 });
      }
    };

    if (map.isStyleLoaded()) {
      doUpdate();
    } else {
      map.once("load", doUpdate);
    }
  }, [myLocation, isLive]); // eslint-disable-line react-hooks/exhaustive-deps

  // ════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════
  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#e8e0d8" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {routeLoading && (
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          zIndex: 20, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)",
          borderRadius: "14px", padding: "12px 20px",
          display: "flex", alignItems: "center", gap: "10px",
          color: "white", fontSize: "13px", fontWeight: 700, fontFamily: "system-ui",
        }}>
          <div style={{
            width: "18px", height: "18px", borderRadius: "50%",
            border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "#4285F4",
            animation: "rw-spin 0.8s linear infinite",
          }} />
          Loading route…
        </div>
      )}

      {isLive && showReCenter && (
        <button
          title="Re-center on your location"
          onClick={() => {
            followRef.current = true;
            setShowReCenter(false);
            const loc = myLocRef.current;
            if (mapRef.current && loc)
              mapRef.current.easeTo({ center: [loc.lng, loc.lat], bearing: bearingRef.current, pitch: 28, zoom: 16.5, duration: 700 });
          }}
          style={{
            position: "absolute", bottom: "110px", right: "16px", zIndex: 20,
            width: "46px", height: "46px", borderRadius: "13px",
            background: "rgba(255,255,255,0.95)", backdropFilter: "blur(10px)",
            border: "2px solid rgba(66,133,244,0.6)", color: "#4285F4",
            cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: "18px",
            boxShadow: "0 2px 16px rgba(0,0,0,0.18)",
          }}
        >
          <i className="fa fa-location-crosshairs" />
        </button>
      )}
    </div>
  );
}
