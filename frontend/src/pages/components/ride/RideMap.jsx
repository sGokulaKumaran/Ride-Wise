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
// Tile options (same as demo's MapTilesContainer)
// ---------------------------------------------------------------------------
const TILE_LAYERS = [
  { label: "🗺️ Default",   url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attr: "© OpenStreetMap" },
  { label: "🚴 Cycle",     url: "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png", attr: "© CyclOSM" },
  { label: "🌑 Dark",      url: "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png", attr: "© Stadia" },
  { label: "🛰️ Satellite", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attr: "© ArcGIS" },
  { label: "🏔️ Terrain",   url: "https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png", attr: "© Stadia" },
];

// ---------------------------------------------------------------------------
// Custom pin icons
// ---------------------------------------------------------------------------
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

// Inject animation CSS
if (typeof document !== "undefined" && !document.getElementById("rw-leaflet-css")) {
  const s = document.createElement("style");
  s.id = "rw-leaflet-css";
  s.textContent = `
    @keyframes rw-pulse { 0%{transform:scale(0.85);opacity:0.9} 60%{transform:scale(2.6);opacity:0} 100%{transform:scale(0.85);opacity:0} }
    .leaflet-container { width:100%; height:100%; }
    /* Hide Leaflet controls at the top */
    .leaflet-top { display: none !important; }
    /* Push Leaflet controls up so they don't hide under the bottom panel */
    .leaflet-bottom { bottom: 120px !important; }
    /* Make sure our custom overlay controls are always clickable and on top */
    .rw-custom-control { z-index: 9999 !important; pointer-events: auto !important; }
  `;
  document.head.appendChild(s);
}

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

function DynamicRouteLine({ ride, myLocation, isLive }) {
  const map = useMap();

  // Refs — we use refs (not state) to avoid re-render loops
  const routeRef              = useRef(null); // current drawn layer group
  const reroutedRef           = useRef(null); // cached off-route OSRM coords
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

    // ── 2. Non-live / no GPS → draw full saved route ──────────────────────
    if (!isLive || !myLocation?.lat) {
      drawPolyline(map, routeRef, savedCoords);
      return;
    }

    // ── 3. Find the closest point on the saved route to current GPS ───────
    let minDist      = Infinity;
    let closestIndex = 0;
    for (let i = 0; i < savedCoords.length; i++) {
      const d = getDistance(myLocation.lat, myLocation.lng, savedCoords[i][0], savedCoords[i][1]);
      if (d < minDist) { minDist = d; closestIndex = i; }
    }

    // ── 4. ON-ROUTE: trim the saved polyline ──────────────────────────────
    if (minDist <= OFF_ROUTE_THRESHOLD_M) {
      // Clear any cached reroute — we're back on the original path
      reroutedRef.current    = null;
      lastReroutePos.current = null;

      // Slice off everything behind us; add exact GPS as first point for smooth connection
      const trimmed = [
        [myLocation.lat, myLocation.lng],
        ...savedCoords.slice(closestIndex),
      ];
      drawPolyline(map, routeRef, trimmed);
      return;
    }

    // ── 5. OFF-ROUTE: use cached reroute while fetching ───────────────────
    if (reroutedRef.current) {
      // We already have a rerouted path — draw it immediately so map isn't blank
      drawPolyline(map, routeRef, reroutedRef.current);
    }

    // ── 6. OFF-ROUTE: debounce — only call OSRM if moved enough ──────────
    const lastPos = lastReroutePos.current;
    const movedSinceLastReroute = !lastPos
      || getDistance(myLocation.lat, myLocation.lng, lastPos.lat, lastPos.lng) > REROUTE_DEBOUNCE_M;

    if (!movedSinceLastReroute || isFetchingRef.current) return;

    // ── 7. OFF-ROUTE: fetch fresh road route from OSRM ───────────────────
    isFetchingRef.current  = true;
    lastReroutePos.current = { lat: myLocation.lat, lng: myLocation.lng };

    const destLat = ride.destinationLat;
    const destLng = ride.destinationLng;
    const url     = `${OSRM_BASE}/${myLocation.lng},${myLocation.lat};${destLng},${destLat}?overview=full&geometries=geojson`;

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (data.code === "Ok" && data.routes?.[0]) {
          // Flip [lng,lat] → [lat,lng] for Leaflet
          const newCoords = data.routes[0].geometry.coordinates.map(pt => [pt[1], pt[0]]);
          reroutedRef.current = newCoords;
          drawPolyline(map, routeRef, newCoords);
        }
      })
      .catch(err => {
        console.warn("[DynamicRouteLine] Reroute fetch failed:", err.message);
        // Fallback: draw straight remaining segment so map isn't blank
        const fallback = [
          [myLocation.lat, myLocation.lng],
          ...savedCoords.slice(closestIndex),
        ];
        drawPolyline(map, routeRef, fallback);
      })
      .finally(() => { isFetchingRef.current = false; });

  }, [map, ride?.routeCoordinates, ride?.destinationLat, ride?.destinationLng, isLive, myLocation?.lat, myLocation?.lng]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (routeRef.current) { map?.removeLayer(routeRef.current); }
    };
  }, [map]);

  return null;
}



// ===========================================================================
// MapInternals — all hook-based components inside MapContainer
// ===========================================================================
function MapInternals({ ride, myLocation, isLive, tileLayerRef, activeTileIdx }) {
  const map = useMap();
  const markerARef = useRef(null);
  const markerBRef = useRef(null);
  const gpsDotRef  = useRef(null);
  const followRef  = useRef(true);

  // Store tile layer ref
  useEffect(() => {
    if (!map) return;
    map.eachLayer(l => { if (l instanceof L.TileLayer) tileLayerRef.current = l; });
  }, [map, activeTileIdx]); // re-check when tile changes

  // Stop camera follow on drag
  useEffect(() => {
    if (!map) return;
    const stop = () => { followRef.current = false; };
    map.on("dragstart", stop);
    return () => map.off("dragstart", stop);
  }, [map]);

  // Listen for the custom "re-center" event
  useEffect(() => {
    if (!map) return;
    const handleRecenter = (e) => {
      const { lat, lng } = e.detail;
      followRef.current = true; // Re-enable follow mode
      map.setView([lat, lng], Math.max(map.getZoom(), 16), { animate: true, duration: 0.5 });
    };
    window.addEventListener("rw-recenter", handleRecenter);
    return () => window.removeEventListener("rw-recenter", handleRecenter);
  }, [map]);

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
            ${ride.rideType === "solo" ? "🏍️ Solo Ride" : "👥 Group Ride"}
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
  useEffect(() => {
    if (!map || !myLocation?.lat) return;
    const ll = [myLocation.lat, myLocation.lng];
    if (gpsDotRef.current) {
      gpsDotRef.current.setLatLng(ll);
    } else {
      gpsDotRef.current = L.marker(ll, { icon: GPS_ICON, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup("<div style='font-family:system-ui;font-size:13px;font-weight:700'>📍 You are here</div>");
    }
    if (isLive && followRef.current) {
      map.setView(ll, Math.max(map.getZoom(), 16), { animate: true, duration: 0.5 });
    }
    return () => { gpsDotRef.current?.remove(); gpsDotRef.current = null; };
  }, [map, myLocation?.lat, myLocation?.lng, isLive]); // eslint-disable-line

  return null;
}

// ===========================================================================
// RideMap — exported component (same props as before, no parent changes)
// ===========================================================================
export default function RideMap({ ride, myLocation, isLive = false }) {
  const tileLayerRef  = useRef(null);
  const [showTiles,   setShowTiles]  = useState(false);
  const [activeTile,  setActiveTile] = useState(0);

  const from = ride?.fromLat        ? { lat: ride.fromLat,        lng: ride.fromLng }        : null;
  const to   = ride?.destinationLat ? { lat: ride.destinationLat, lng: ride.destinationLng } : null;
  const center = from ? [from.lat, from.lng] : [13.0827, 80.2707];

  const switchTile = (i) => {
    setActiveTile(i);
    setShowTiles(false);
    if (tileLayerRef.current) {
      tileLayerRef.current.setUrl(TILE_LAYERS[i].url);
    }
  };

  return (
    <div style={{ position: "absolute", inset: 0 }}>

      <MapContainer
        attributionControl={false /* hides the built-in OpenStreetMap attribution box */}
        center={center}
        zoom={12}
        scrollWheelZoom
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          url={TILE_LAYERS[0].url}
          attribution={TILE_LAYERS[0].attr}
        />

        {/* Dynamic Route line — automatically trims based on myLocation */}
        <DynamicRouteLine ride={ride} myLocation={myLocation} isLive={isLive} />

        {/* Markers + GPS dot + tile ref capture */}
        <MapInternals
          ride={ride}
          myLocation={myLocation}
          isLive={isLive}
          tileLayerRef={tileLayerRef}
          activeTileIdx={activeTile}
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

      {/* ── Re-center button (live rides only) ── */}
      {isLive && myLocation?.lat && (
        <button
          className="rw-custom-control"
          title="Re-center on your location"
          onClick={() => {
            /* trigger via map ref is tricky outside MapContainer —
               so we just dispatch a custom event that MapInternals listens to */
            window.dispatchEvent(new CustomEvent("rw-recenter", {
              detail: { lat: myLocation.lat, lng: myLocation.lng }
            }));
          }}
          style={{
            position: "absolute", bottom: "130px", left: "10px", zIndex: 9999,
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
