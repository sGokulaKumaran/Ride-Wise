// ============================================================
// 🗺️ routingApi.js — Geocoding + Routing
//
// Geocoding: place name (e.g. "Chennai") → { lat, lng }
// Routing:   from + to coordinates → array of route coordinates
//
// CURRENT: uses public OSRM + Nominatim (free OpenStreetMap services)
// PRODUCTION: replace with self-hosted or paid services
// ============================================================

// OSRM public demo server (rate-limited — fine for prototype)
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

// Nominatim for geocoding (respect usage policy: max 1 req/sec)
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

// ============================================================
// GEOCODING — convert place name to coordinates
// ============================================================
//
// INPUT:  "Chennai"
// OUTPUT: { name: "Chennai, India", lat: 13.0827, lng: 80.2707 }
// BACKEND: GET /api/geocode?q=Chennai
export async function geocode(query) {
  if (!query || !query.trim()) return null;

  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { "Accept-Language": "en" },
  });
  if (!res.ok) throw new Error("Geocoding failed");
  const data = await res.json();
  if (!data.length) return null;

  const first = data[0];
  return {
    name: first.display_name,
    lat:  parseFloat(first.lat),
    lng:  parseFloat(first.lon),
  };
}

// ============================================================
// ROUTING — calculate a driving route between two points
// ============================================================
//
// INPUT:  from = { lat, lng }, to = { lat, lng }
// OUTPUT: { coordinates: [[lng, lat], ...], distance: meters, duration: seconds }
// BACKEND: GET /api/route?fromLat=..&fromLng=..&toLat=..&toLng=..
export async function getRoute(from, to) {
  if (!from || !to) return null;

  // OSRM expects "lng,lat;lng,lat" format
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `${OSRM_URL}/${coords}?overview=full&geometries=geojson`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Routing failed");
  const data = await res.json();
  if (!data.routes || !data.routes.length) return null;

  const route = data.routes[0];
  return {
    coordinates: route.geometry.coordinates, // [[lng, lat], ...]
    distance:    route.distance,             // in meters
    duration:    route.duration,             // in seconds
  };
}

// Format helpers (so UI doesn't have to do math)
export function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
