// ============================================================
// 🗺️ RideMap.jsx — Full-screen MapLibre GL map
//
// This is the core map component used for:
//   1. LIVE rides  → shows route + live GPS marker + source/dest pins
//   2. HISTORY     → shows saved route (no live GPS)
//
// MAP TILE PROVIDER:
//   Uses OpenStreetMap raster tiles via a custom MapLibre style.
//   This gives full-detail zoom from world level all the way to
//   street level — exactly like Google Maps behaviour.
//   WHY RASTER TILES: More reliable than vector tiles for deep zoom.
//   The tiles load from osm.org CDN which is very well-maintained.
//
// MARKERS:
//   🟢 Green  = source / "from" location
//   🔴 Red    = destination
//   🔵 Blue pulsing = your live GPS location
//
// ROUTE:
//   Orange line drawn along actual roads (from OSRM routing data)
//
// PROPS:
//   ride        — object with { fromLat, fromLng, fromName,
//                               destinationLat, destinationLng, destinationName,
//                               routeCoordinates (JSON string) }
//   myLocation  — { lat, lng } or null   (live GPS, only during active ride)
//   isLive      — boolean  (true = show live GPS dot, false = history view)
//   onClose     — function called when the X button is pressed
//   onMinimize  — function called when the minimize button is pressed
//   onEnd       — function called when "End Ride" is pressed (only when isLive)
// ============================================================

import { useEffect, useRef, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// ---------------------------------------------------------------------------
// MAP STYLE — uses OpenStreetMap raster tiles
//
// We build a custom MapLibre style object that references the OSM tile CDN.
// This approach gives proper zoom detail at ALL levels (1–19).
// The tile URL {z}/{x}/{y} is the standard slippy-map tile format.
// ---------------------------------------------------------------------------
const OSM_RASTER_STYLE = {
  // MapLibre style version (always 8 for current spec)
  version: 8,

  // Tile sources — "osm" is just the name we give this source
  sources: {
    osm: {
      type:        "raster",                    // raster = PNG image tiles
      tiles: [
        // OpenStreetMap tile CDN — uses {z}/{x}/{y} placeholders
        // These are replaced by MapLibre with the actual tile coordinates
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize:    256,   // each tile is 256×256 pixels (standard)
      maxzoom:     19,    // OSM provides tiles up to zoom level 19 (street level)
      attribution: "© OpenStreetMap contributors",
    },
  },

  // Layers tell MapLibre what to draw and how
  layers: [
    {
      id:     "osm-tiles",   // unique layer id
      type:   "raster",      // draw raster image tiles
      source: "osm",         // use the "osm" source defined above
      // No paint overrides needed — raster tiles are drawn as-is
    },
  ],
};

// ---------------------------------------------------------------------------
// Default center — Chennai, Tamil Nadu (fallback when no ride data)
// ---------------------------------------------------------------------------
const DEFAULT_CENTER = [80.2707, 13.0827]; // [lng, lat]
const DEFAULT_ZOOM   = 12;

export default function RideMap({
  ride,
  myLocation,
  isLive,
  onClose,
  onMinimize,
  onEnd,
}) {
  // ---- Refs so we don't re-create the map on every render ----
  const containerRef = useRef(null); // the <div> MapLibre renders into
  const mapRef       = useRef(null); // the MapLibre Map instance
  const markersRef   = useRef({      // holds the Marker objects so we can remove/update them
    from:    null,
    to:      null,
    me:      null,
  });

  // ---- Parse route coordinates from the JSON string stored in DB ----
  // routeCoordinates is stored as a JSON string: "[[lng,lat],[lng,lat],...]"
  const routeCoords = useCallback(() => {
    if (!ride?.routeCoordinates) return null;
    try {
      const parsed = JSON.parse(ride.routeCoordinates);
      // Validate that it's an array of [lng, lat] pairs
      if (!Array.isArray(parsed) || !parsed.length) return null;
      return parsed;
    } catch {
      return null; // silently fail if JSON is malformed
    }
  }, [ride?.routeCoordinates]);

  // ====================================================================
  // EFFECT 1 — Initialize the map ONCE on mount
  // Only runs when the component first appears in the DOM
  // ====================================================================
  useEffect(() => {
    // Guard: container must exist and map must not already be created
    if (!containerRef.current || mapRef.current) return;

    // Create the MapLibre map instance
    const map = new maplibregl.Map({
      container: containerRef.current,  // the DOM element to render into
      style:     OSM_RASTER_STYLE,      // our custom raster tile style
      center:    DEFAULT_CENTER,        // initial center (lng, lat)
      zoom:      DEFAULT_ZOOM,          // initial zoom level
      // These settings give smooth zoom like Google Maps:
      scrollZoom:    true,   // scroll wheel zooms
      touchZoomRotate: true, // pinch to zoom on mobile
      doubleClickZoom: true, // double-click zooms in
    });

    // Save the map reference so other effects can use it
    mapRef.current = map;

    // Add the standard zoom + compass controls to the top-right corner
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true }),
      "top-right"
    );

    // Add a scale bar at the bottom-left (like Google Maps has)
    map.addControl(
      new maplibregl.ScaleControl({ unit: "metric" }),
      "bottom-left"
    );

    // Cleanup: remove the map when the component unmounts
    // This prevents memory leaks
    return () => {
      // Remove all markers before removing the map
      Object.values(markersRef.current).forEach(m => m?.remove());
      map.remove();
      mapRef.current = null;
    };
  }, []); // empty deps = run once on mount

  // ====================================================================
  // EFFECT 2 — Draw route + markers whenever `ride` changes
  // Runs after the map is initialized and whenever the ride prop updates
  // ====================================================================
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ride) return; // nothing to draw yet

    // We need the style to be loaded before adding sources/layers
    const drawRideData = () => {
      // ---- FROM marker (green pin) ----
      if (ride.fromLat && ride.fromLng) {
        // Remove the old marker if it exists (e.g. after re-running a ride)
        markersRef.current.from?.remove();

        // Create a custom green marker element using Font Awesome icon
        const fromEl = document.createElement("div");
        fromEl.innerHTML = `
          <div style="
            width: 36px; height: 36px;
            background: linear-gradient(135deg, #22c55e, #16a34a);
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(34,197,94,0.5);
            display: flex; align-items: center; justify-content: center;
          ">
            <span style="transform: rotate(45deg); font-size: 14px;">🏁</span>
          </div>
        `;

        markersRef.current.from = new maplibregl.Marker({ element: fromEl })
          .setLngLat([ride.fromLng, ride.fromLat])
          .setPopup(
            // Popup shown when marker is clicked
            new maplibregl.Popup({ offset: 25, closeButton: false })
              .setHTML(`<strong>📍 Start</strong><br/><small>${ride.fromName || "From"}</small>`)
          )
          .addTo(map);
      }

      // ---- DESTINATION marker (red pin) ----
      if (ride.destinationLat && ride.destinationLng) {
        markersRef.current.to?.remove();

        // Create a custom red marker element
        const toEl = document.createElement("div");
        toEl.innerHTML = `
          <div style="
            width: 36px; height: 36px;
            background: linear-gradient(135deg, #ef4444, #dc2626);
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(239,68,68,0.5);
            display: flex; align-items: center; justify-content: center;
          ">
            <span style="transform: rotate(45deg); font-size: 14px;">🏴</span>
          </div>
        `;

        markersRef.current.to = new maplibregl.Marker({ element: toEl })
          .setLngLat([ride.destinationLng, ride.destinationLat])
          .setPopup(
            new maplibregl.Popup({ offset: 25, closeButton: false })
              .setHTML(`<strong>🏁 End</strong><br/><small>${ride.destinationName || "Destination"}</small>`)
          )
          .addTo(map);
      }

      // ---- ROUTE LINE (orange) ----
      // Remove the old route layer and source if they already exist
      // (happens when re-running or updating a ride)
      if (map.getLayer("ride-route-line"))    map.removeLayer("ride-route-line");
      if (map.getLayer("ride-route-outline")) map.removeLayer("ride-route-outline");
      if (map.getSource("ride-route"))        map.removeSource("ride-route");

      const coords = routeCoords(); // parse JSON → [[lng,lat], ...]
      if (coords && coords.length > 1) {
        // Add the route as a GeoJSON source
        map.addSource("ride-route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type:        "LineString",
              coordinates: coords, // [[lng, lat], ...]
            },
          },
        });

        // Draw a white outline under the route (like Google Maps does)
        // This makes the route visible on light AND dark map backgrounds
        map.addLayer({
          id:     "ride-route-outline",
          type:   "line",
          source: "ride-route",
          layout: {
            "line-join": "round",  // smooth corners
            "line-cap":  "round",  // rounded endpoints
          },
          paint: {
            "line-color":   "#ffffff",  // white outline
            "line-width":   9,          // slightly wider than the orange line
            "line-opacity": 0.6,
          },
        });

        // Draw the orange route on top of the white outline
        map.addLayer({
          id:     "ride-route-line",
          type:   "line",
          source: "ride-route",
          layout: {
            "line-join": "round",
            "line-cap":  "round",
          },
          paint: {
            "line-color":   "#f97316",  // RideWise brand orange
            "line-width":   6,
            "line-opacity": 0.95,
          },
        });
      }

      // ---- FIT MAP BOUNDS to show all markers + route ----
      // Collect all coordinate points we want to be visible
      const bounds = new maplibregl.LngLatBounds();
      let hasPoints = false;

      if (ride.fromLng    && ride.fromLat)         { bounds.extend([ride.fromLng,         ride.fromLat]);        hasPoints = true; }
      if (ride.destinationLng && ride.destinationLat) { bounds.extend([ride.destinationLng,  ride.destinationLat]); hasPoints = true; }

      // Also extend bounds with every route coordinate so the whole path is visible
      if (coords) coords.forEach(c => bounds.extend(c));

      if (hasPoints && !bounds.isEmpty()) {
        map.fitBounds(bounds, {
          padding: { top: 80, bottom: 120, left: 60, right: 60 }, // leave room for UI overlays
          duration: 1000,    // 1 second smooth animation
          maxZoom:  15,      // don't zoom in more than level 15 (street level)
        });
      }
    };

    // If the map style (tiles) is already loaded, draw immediately
    // Otherwise wait for the "load" event (fires when all resources are ready)
    if (map.isStyleLoaded()) {
      drawRideData();
    } else {
      map.once("load", drawRideData);
    }
  }, [ride, routeCoords]); // re-run when ride changes

  // ====================================================================
  // EFFECT 3 — Update the live location marker whenever GPS changes
  // This runs much more frequently than Effect 2
  // ====================================================================
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !myLocation?.lat || !myLocation?.lng) return;

    // Remove the old "me" marker
    markersRef.current.me?.remove();

    // Create a custom animated pulse marker for "you"
    // This mimics the blue pulsing dot on Google Maps
    const meEl = document.createElement("div");
    meEl.innerHTML = `
      <div style="position: relative; width: 24px; height: 24px;">
        <!-- Outer pulsing ring -->
        <div style="
          position: absolute; inset: -8px;
          background: rgba(59,130,246,0.25);
          border-radius: 50%;
          animation: gps-pulse 2s ease-in-out infinite;
        "></div>
        <!-- Inner solid blue dot -->
        <div style="
          width: 24px; height: 24px;
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 4px 12px rgba(59,130,246,0.6);
        "></div>
      </div>
      <style>
        @keyframes gps-pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50%       { transform: scale(1.5); opacity: 0.2; }
        }
      </style>
    `;

    // Place the marker at the current GPS coordinates
    markersRef.current.me = new maplibregl.Marker({ element: meEl, anchor: "center" })
      .setLngLat([myLocation.lng, myLocation.lat])
      .setPopup(
        new maplibregl.Popup({ offset: 20, closeButton: false })
          .setHTML("<strong>📍 You</strong>")
      )
      .addTo(map);
  }, [myLocation]); // re-run whenever location changes

  // ====================================================================
  // RENDER — the map container div fills the full parent
  // The parent (.ride-map-fullscreen) is positioned fixed in Home.jsx
  // ====================================================================
  return (
    // Full-height container — MapLibre renders into this div
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", background: "#1a1a2e" }}
    />
  );
}
