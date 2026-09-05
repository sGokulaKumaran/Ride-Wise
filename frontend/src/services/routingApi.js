// ============================================================
// 🗺️ routingApi.js — Geocoding + Route calculation + Geo Math
//
// GEOCODING  : Converts a place name like "Chennai" into
//              { lat, lng, name } using Nominatim (OpenStreetMap)
//
// ROUTING    : Calculates the road route between two lat/lng
//              points using OSRM (free routing engine).
//              Returns coordinates as [[lng, lat], ...] (GeoJSON order).
//
// GEO MATH   : haversineDistance — straight-line distance between
//              two lat/lng points (used for popup remaining-km display
//              and for snapping the user to the nearest route point).
//
// FORMAT HELPERS: formatDistance / formatDuration convert
//              raw meters/seconds into human-readable strings.
// ============================================================

// ---------------------------------------------------------------------------
// Nominatim — free OpenStreetMap geocoding API (no API key required)
// Rate limit: 1 request per second; respect their usage policy.
// ---------------------------------------------------------------------------
const NOMINATIM = "https://nominatim.openstreetmap.org/search";

// ---------------------------------------------------------------------------
// OSRM — free Open Source Routing Machine (OSM road network data)
// Returns the fastest driving route between two coordinates.
// ---------------------------------------------------------------------------
const OSRM = "https://router.project-osrm.org/route/v1/driving";

// ---------------------------------------------------------------------------
// Earth's mean radius in metres — used by the Haversine formula.
// ---------------------------------------------------------------------------
const EARTH_RADIUS_M = 6_371_000;

// ============================================================
// GEOCODE — convert a place name to coordinates
//
// INPUT:  "Chennai"
// OUTPUT: { name: "Chennai, Tamil Nadu, India", lat: 13.08, lng: 80.27 }
//         OR null if the place was not found
// ============================================================
export async function geocode(query) {
  // Guard: don't query with an empty or whitespace-only string
  if (!query || !query.trim()) return null;

  // Build the URL — limit=1 means we only want the top result
  // addressdetails=1 makes Nominatim return structured address components
  const url = `${NOMINATIM}?q=${encodeURIComponent(query.trim())}&format=json&limit=1&addressdetails=1`;

  const res = await fetch(url, {
    headers: {
      // Nominatim policy: every request must include a meaningful User-Agent
      "Accept-Language": "en",
      "User-Agent":      "RideWise/1.0 (ridewise.app)",
    },
  });

  if (!res.ok) throw new Error(`Geocoding failed (HTTP ${res.status})`);

  const data = await res.json();

  // No results found → return null so the caller can show an error message
  if (!data || !data.length) return null;

  const first = data[0];
  return {
    name: first.display_name,          // Full readable address
    lat:  parseFloat(first.lat),       // Latitude  (north-south)
    lng:  parseFloat(first.lon),       // Longitude (east-west)
  };
}

// ============================================================
// GET ROUTE — calculate the fastest road route between two points
//
// INPUT:
//   from = { lat, lng }   — start coordinate
//   to   = { lat, lng }   — end coordinate
//
// OUTPUT:
//   {
//     coordinates: [[lng, lat], [lng, lat], ...],  ← GeoJSON order (lng first)
//     distance: 150000,    ← metres (number)
//     duration: 5400,      ← seconds (number)
//   }
//   OR throws an Error if no route is found.
//
// NOTE ON COORDINATE ORDER:
//   navigator.geolocation returns  { latitude, longitude }
//   We store internally as         { lat, lng }
//   OSRM API URL format:           {lng},{lat} (longitude first in the URL)
//   OSRM JSON response (GeoJSON):  [lng, lat] (longitude first in the array)
//   MapLibre expects:              [lng, lat]
//   → We do NOT need to flip the OSRM output; it's already in the right order.
// ============================================================
export async function getRoute(from, to) {
  // Guard: need both endpoints with valid coordinates
  if (!from || !to) return null;

  // OSRM URL format: /route/v1/driving/{lng1},{lat1};{lng2},{lat2}
  // overview=full    → return the complete route geometry (not simplified)
  // geometries=geojson → coordinates as [[lng,lat],...] array
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `${OSRM}/${coords}?overview=full&geometries=geojson`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Routing request failed (HTTP ${res.status})`);

  const data = await res.json();

  // OSRM returns a "code" field: "Ok" means success; "NoRoute" means no path
  if (data.code !== "Ok" || !data.routes || !data.routes.length) {
    throw new Error("No road route found between these locations.");
  }

  const route = data.routes[0]; // The best route is always the first element

  return {
    coordinates: route.geometry.coordinates, // [[lng, lat], ...]
    distance:    route.distance,             // total metres
    duration:    route.duration,             // total seconds
  };
}

// ============================================================
// HAVERSINE DISTANCE — straight-line distance between two points
//
// Uses the Haversine formula, which accounts for the Earth's curvature.
// Accurate to within ~0.5% for distances under 1000 km.
//
// INPUT:
//   lat1, lng1 — first point (decimal degrees)
//   lat2, lng2 — second point (decimal degrees)
//
// OUTPUT:
//   Distance in metres (number)
//
// USAGE:
//   • RideMap.jsx uses this to find the closest route point to the user
//   • Destination popup uses this for the "remaining km" display
// ============================================================
export function haversineDistance(lat1, lng1, lat2, lng2) {
  // Convert degrees to radians (the trig functions in JS use radians)
  const toRad = deg => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1); // Δlatitude in radians
  const dLng = toRad(lng2 - lng1); // Δlongitude in radians

  // Haversine formula:
  // a = sin²(Δlat/2) + cos(lat1)·cos(lat2)·sin²(Δlng/2)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  // c = 2·atan2(√a, √(1−a))   ← angular distance in radians
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_M * c; // distance in metres
}

// ============================================================
// FORMAT DISTANCE — meters → human-readable string
//
// Examples:  850    → "850 m"
//            3500   → "3.5 km"
//            150000 → "150.0 km"
// ============================================================
export function formatDistance(meters) {
  if (meters == null) return "—";            // null / undefined → dash
  if (meters < 1000)  return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

// ============================================================
// FORMAT DURATION — seconds → human-readable string
//
// Examples:  45   → "45 min"
//            3600 → "1 h"
//            5400 → "1 h 30 min"
// ============================================================
export function formatDuration(seconds) {
  if (seconds == null) return "—";           // null / undefined → dash
  const h = Math.floor(seconds / 3600);     // full hours
  const m = Math.floor((seconds % 3600) / 60); // remaining minutes
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
