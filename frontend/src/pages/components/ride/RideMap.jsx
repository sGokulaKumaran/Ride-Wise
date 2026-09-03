// ============================================================
// 🗺️ RideMap — MapLibre map showing ride route + markers
//
// Props:
//   ride       — ride object { from, destination, route }
//   myLocation — { lat, lng } or null (current rider position)
//   height     — CSS height (default "400px")
//
// This component:
//   1. Initializes a MapLibre map
//   2. Adds a green marker at "from"
//   3. Adds a red marker at "destination"
//   4. Draws the route line (if route.coordinates exists)
//   5. Draws the current rider marker (if myLocation exists)
//   6. Fits the map bounds to show everything
//
// STAGE: This is Stage 1-7 implementation. Backend-ready
// because route data comes from the ride object passed in.
// ============================================================

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Free public map style from OpenFreeMap
// (no API key needed — OpenStreetMap data, free for low-traffic use)
const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

export default function RideMap({ ride, myLocation, height = "400px" }) {
  // Refs to the map container and the map instance
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const markersRef   = useRef({ from: null, to: null, me: null });

  // ---- Initialize the map ONCE on mount ----
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style:     MAP_STYLE,
      center:    [80.2707, 13.0827], // Default: Chennai
      zoom:      10,
    });
    mapRef.current = map;

    // Add zoom controls (top-right corner)
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    // Cleanup when component unmounts
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ---- Update markers + route when ride changes ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ride) return;

    // Wait for the map style to load before adding sources/layers
    const apply = () => {
      // ---- FROM marker (green) ----
      if (ride.from?.lat && ride.from?.lng) {
        markersRef.current.from?.remove();
        markersRef.current.from = new maplibregl.Marker({ color: "#22c55e" })
          .setLngLat([ride.from.lng, ride.from.lat])
          .setPopup(new maplibregl.Popup().setText(`🟢 ${ride.from.name || "From"}`))
          .addTo(map);
      }

      // ---- DESTINATION marker (red) ----
      if (ride.destination?.lat && ride.destination?.lng) {
        markersRef.current.to?.remove();
        markersRef.current.to = new maplibregl.Marker({ color: "#ef4444" })
          .setLngLat([ride.destination.lng, ride.destination.lat])
          .setPopup(new maplibregl.Popup().setText(`🔴 ${ride.destination.name || "Destination"}`))
          .addTo(map);
      }

      // ---- ROUTE LINE ----
      // Remove old route layer/source if they exist
      if (map.getLayer("route"))  map.removeLayer("route");
      if (map.getSource("route")) map.removeSource("route");

      // Add the new route if we have coordinates
      if (ride.route?.coordinates?.length) {
        map.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: ride.route.coordinates },
          },
        });
        map.addLayer({
          id:     "route",
          type:   "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint:  {
            "line-color":   "#f97316", // Orange — RideWise brand
            "line-width":   5,
            "line-opacity": 0.85,
          },
        });
      }

      // ---- FIT BOUNDS to show everything ----
      const bounds = new maplibregl.LngLatBounds();
      if (ride.from?.lng)        bounds.extend([ride.from.lng,        ride.from.lat]);
      if (ride.destination?.lng) bounds.extend([ride.destination.lng, ride.destination.lat]);
      if (myLocation?.lng)       bounds.extend([myLocation.lng,       myLocation.lat]);

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 80, duration: 800, maxZoom: 14 });
      }
    };

    // If style is loaded, apply now; otherwise wait for it
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [ride, myLocation]);

  // ---- Update current rider marker when location changes ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !myLocation?.lng) return;

    markersRef.current.me?.remove();
    markersRef.current.me = new maplibregl.Marker({ color: "#3b82f6" })
      .setLngLat([myLocation.lng, myLocation.lat])
      .setPopup(new maplibregl.Popup().setText("📍 You"))
      .addTo(map);
  }, [myLocation]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%" }}
      className="rounded-2xl overflow-hidden border border-white/10"
    />
  );
}
