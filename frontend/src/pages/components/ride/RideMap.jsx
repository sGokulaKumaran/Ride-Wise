// ============================================================
// RideMap.jsx — Leaflet Map (react-leaflet + leaflet-routing-machine)
//
// Copied from react-leaflet-demo approach:
//   • MapContainer + TileLayer  → renders the map tiles
//   • RoutingMachine control    → calls OSRM & draws the blue route line
//   • L.Marker                  → A (start) and B (destination) pins
//   • Live GPS dot              → updates as myLocation changes
//   • Tile switcher overlay     → change map style at runtime
// ============================================================

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

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
    .leaflet-routing-container { display:none !important; }
    .leaflet-container { width:100%; height:100%; }
    /* Push Leaflet controls down so they don't hide under the top panel */
    .leaflet-top { top: 80px !important; }
    /* Push Leaflet controls up so they don't hide under the bottom panel */
    .leaflet-bottom { bottom: 120px !important; }
    /* Make sure our custom overlay controls are always clickable and on top */
    .rw-custom-control { z-index: 9999 !important; pointer-events: auto !important; }
  `;
  document.head.appendChild(s);
}

// ===========================================================================
// RoutingMachine — exact same pattern as demo's RoutingComponent.jsx
// Must be inside <MapContainer> to use useMap()
// ===========================================================================
function RoutingMachine({ from, to }) {
  const map = useMap();
  const controlRef = useRef(null);

  useEffect(() => {
    if (!map || !from || !to) return;

    // Remove previous control if from/to changed
    if (controlRef.current) {
      try { map.removeControl(controlRef.current); } catch (_) {}
      controlRef.current = null;
    }

    // Exact same API as demo's createRoutineMachineLayer
    const control = L.Routing.control({
      waypoints: [
        L.latLng(from.lat, from.lng),
        L.latLng(to.lat,   to.lng),
      ],
      lineOptions: {
        styles: [
          { color: "#ffffff", weight: 20, opacity: 0.9 },
          { color: "#4285F4", weight: 12, opacity: 1.0 },
        ],
      },
      show:               false,
      addWaypoints:       false,
      routeWhileDragging: false,
      draggableWaypoints: false,
      fitSelectedRoutes:  true,
      showAlternatives:   false,
    });

    control.addTo(map);
    controlRef.current = control;

    return () => {
      if (controlRef.current) {
        try { map.removeControl(controlRef.current); } catch (_) {}
        controlRef.current = null;
      }
    };
  }, [map, from?.lat, from?.lng, to?.lat, to?.lng]); // eslint-disable-line

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
        center={center}
        zoom={12}
        scrollWheelZoom
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          url={TILE_LAYERS[0].url}
          attribution={TILE_LAYERS[0].attr}
        />

        {/* Route line — same as demo's RoutingComponent */}
        {from && to && <RoutingMachine from={from} to={to} />}

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
      <div className="rw-custom-control" style={{ position: "absolute", top: "80px", right: "10px", zIndex: 9999 }}>
        <button
          title="Switch map style"
          onClick={() => setShowTiles(v => !v)}
          style={{
            width: "34px", height: "34px", borderRadius: "8px",
            background: "rgba(255,255,255,0.95)",
            border: "2px solid rgba(200,200,200,0.6)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
            cursor: "pointer", fontSize: "15px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >🗺️</button>

        {showTiles && (
          <div style={{
            position: "absolute", top: 0, right: "42px",
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
            position: "absolute", bottom: "110px", right: "10px", zIndex: 9999,
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
