// ============================================================
// 🗺️ routingApi.js — Geocoding + Route calculation
//
// GEOCODING  : Converts a place name like "Chennai" into
//              { lat, lng, name } using Nominatim (OpenStreetMap)
//
// ROUTING    : Calculates the road route between two lat/lng
//              points using OSRM (free routing engine)
//
// FORMAT HELPERS: formatDistance / formatDuration convert
//              raw meters/seconds into human-readable strings
// ============================================================

// ---------------------------------------------------------------------------
// Nominatim — free OpenStreetMap geocoding API (no API key required)
// Rate limit: 1 request per second, respect their usage policy
// ---------------------------------------------------------------------------
const NOMINATIM = "https://nominatim.openstreetmap.org/search";

// ---------------------------------------------------------------------------
// OSRM — free Open Source Routing Machine (OSM road network data)
// Returns the fastest driving route between two coordinates
// ---------------------------------------------------------------------------
const OSRM = "https://router.project-osrm.org/route/v1/driving";

// ============================================================
// GEOCODE — convert a place name to coordinates
//
// INPUT:  "Chennai"
// OUTPUT: { name: "Chennai, Tamil Nadu, India", lat: 13.08, lng: 80.27 }
//         OR null if the place was not found
// ============================================================
export async function geocode(query) {
  // Guard: don't query with empty string
  if (!query || !query.trim()) return null;

  // Build the URL — limit=1 means we only want the top result
  const url = `${NOMINATIM}?q=${encodeURIComponent(query.trim())}&format=json&limit=1&addressdetails=1`;

  const res = await fetch(url, {
    headers: {
      // Nominatim requires a meaningful User-Agent to identify your app
      "Accept-Language": "en",
      "User-Agent": "RideWise/1.0",
    },
  });

  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);

  const data = await res.json();

  // If no results found, return null so the caller can show an error
  if (!data || !data.length) return null;

  const first = data[0];
  return {
    name: first.display_name,           // Full readable name
    lat:  parseFloat(first.lat),        // Latitude (north-south)
    lng:  parseFloat(first.lon),        // Longitude (east-west)
  };
}

// ============================================================
// GET ROUTE — calculate the fastest road route
//
// INPUT:  from = { lat, lng }, to = { lat, lng }
// OUTPUT: {
//   coordinates: [[lng, lat], [lng, lat], ...],  (GeoJSON order)
//   distance: 150000,   (meters)
//   duration: 5400,     (seconds)
// }
//
// NOTE: GeoJSON uses [lng, lat] order (opposite of what you'd expect).
//       MapLibre expects [lng, lat] for coordinates — so we don't flip.
// ============================================================
export async function getRoute(from, to) {
  // Guard: need both endpoints
  if (!from || !to) return null;

  // OSRM URL format: /route/v1/driving/{lng1},{lat1};{lng2},{lat2}
  // overview=full = include the complete route geometry (not simplified)
  // geometries=geojson = return coordinates as GeoJSON [[lng,lat],...] array
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `${OSRM}/${coords}?overview=full&geometries=geojson`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Routing failed (${res.status})`);

  const data = await res.json();

  // Check for OSRM error codes (e.g., "NoRoute")
  if (data.code !== "Ok" || !data.routes || !data.routes.length) {
    throw new Error("No route found between these locations.");
  }

  const route = data.routes[0]; // Best route is always first

  return {
    coordinates: route.geometry.coordinates, // [[lng, lat], ...]
    distance:    route.distance,             // meters (number)
    duration:    route.duration,             // seconds (number)
  };
}

// ============================================================
// FORMAT DISTANCE — meters → human-readable string
// Examples:  850   → "850 m"
//            3500  → "3.5 km"
//            150000 → "150.0 km"
// ============================================================
export function formatDistance(meters) {
  if (!meters && meters !== 0) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

// ============================================================
// FORMAT DURATION — seconds → human-readable string
// Examples:  45    → "45 min"
//            3600  → "1 h"
//            5400  → "1 h 30 min"
// ============================================================
export function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return "—";
  const h = Math.floor(seconds / 3600);              // full hours
  const m = Math.floor((seconds % 3600) / 60);       // remaining minutes
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
