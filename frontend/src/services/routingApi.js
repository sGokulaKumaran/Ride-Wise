// ============================================================
// 🗺️ routingApi.js — Geocoding + Route calculation + Geo Math
//
// GEOCODING  : Converts a place name like "Chennai" into
//              { lat, lng, name } using Nominatim (OpenStreetMap)
//
// ROUTING    : Calculates the road route between two lat/lng
//              points using OSRM (free routing engine).
//              Returns coordinates as [[lng, lat], ...] (GeoJSON order).
//              Also returns turn-by-turn steps when steps=true is used.
//
// GEO MATH   : haversineDistance — straight-line distance between
//              two lat/lng points (used for popup remaining-km display
//              and for snapping the user to the nearest route point).
//              bearingBetween — compass bearing A→B (used to rotate the
//              GPS marker to face the direction of travel).
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
//     steps: [...]         ← parsed turn-by-turn maneuver steps
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
  // steps=true       → include turn-by-turn maneuver steps for navigation
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `${OSRM}/${coords}?overview=full&geometries=geojson&steps=true`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Routing request failed (HTTP ${res.status})`);

  const data = await res.json();

  // OSRM returns a "code" field: "Ok" means success; "NoRoute" means no path
  if (data.code !== "Ok" || !data.routes || !data.routes.length) {
    throw new Error("No road route found between these locations.");
  }

  const route = data.routes[0]; // The best route is always the first element

  // Flatten all steps from all route legs into a single array
  const rawSteps = route.legs?.flatMap(leg => leg.steps || []) || [];

  return {
    coordinates: route.geometry.coordinates, // [[lng, lat], ...]
    distance:    route.distance,             // total metres
    duration:    route.duration,             // total seconds
    steps:       parseRouteSteps(rawSteps),  // UI-ready turn-by-turn steps
  };
}

// ============================================================
// PARSE ROUTE STEPS — convert raw OSRM step objects into
// clean, UI-ready instruction objects.
//
// Each output step:
//   {
//     instruction: "Turn left onto Main Street",
//     distance: 350,          ← metres for this step
//     duration: 42,           ← seconds for this step
//     icon: "fa-turn-left",   ← Font Awesome 6 icon class
//     maneuverType: "turn",
//     maneuverModifier: "left",
//     location: [lng, lat],   ← coordinate where this maneuver starts
//   }
// ============================================================
export function parseRouteSteps(rawSteps) {
  return rawSteps.map(step => {
    const maneuver = step.maneuver || {};
    const type     = maneuver.type     || "";
    const modifier = maneuver.modifier || "";
    const name     = step.name || "";

    return {
      instruction:      buildInstruction(type, modifier, name),
      distance:         step.distance  || 0,
      duration:         step.duration  || 0,
      icon:             getManeuverIcon(type, modifier),
      maneuverType:     type,
      maneuverModifier: modifier,
      location:         maneuver.location || null,  // [lng, lat]
    };
  });
}

// ============================================================
// BUILD INSTRUCTION — human-readable sentence from OSRM maneuver
// ============================================================
function buildInstruction(type, modifier, streetName) {
  const on = streetName ? ` onto ${streetName}` : "";

  switch (type) {
    case "depart":
      return streetName ? `Head on ${streetName}` : "Start your journey";
    case "arrive":
      return "You have arrived at your destination";
    case "turn": {
      const dir = modifier === "slight left"  ? "Slight left"
                : modifier === "slight right" ? "Slight right"
                : modifier === "sharp left"   ? "Sharp left"
                : modifier === "sharp right"  ? "Sharp right"
                : modifier === "left"         ? "Turn left"
                : modifier === "right"        ? "Turn right"
                : modifier === "uturn"        ? "Make a U-turn"
                : "Turn";
      return `${dir}${on}`;
    }
    case "new name":
      return streetName ? `Continue onto ${streetName}` : "Continue";
    case "merge":
      return `Merge${modifier ? " " + modifier : ""}${on}`;
    case "fork": {
      const side = modifier.includes("left")  ? "left"
                 : modifier.includes("right") ? "right" : "";
      return side ? `Keep ${side}${on}` : `Stay on route${on}`;
    }
    case "end of road":
      return modifier.includes("left")  ? `Turn left${on}`
           : modifier.includes("right") ? `Turn right${on}` : `Continue${on}`;
    case "roundabout":
    case "rotary": {
      const exit = type === "roundabout" ? undefined : undefined; // exit number in step.maneuver.exit
      return exit ? `Take exit ${exit} from the roundabout${on}` : `Take the roundabout${on}`;
    }
    case "continue":
      return `Continue straight${on}`;
    case "on ramp":
      return `Take the ramp${on}`;
    case "off ramp":
      return `Take the exit${on}`;
    default:
      return streetName ? `Continue on ${streetName}` : "Continue";
  }
}

// ============================================================
// GET MANEUVER ICON — returns a Font Awesome 6 class for the step
// ============================================================
export function getManeuverIcon(type, modifier = "") {
  if (type === "arrive")                          return "fa-flag-checkered";
  if (type === "depart")                          return "fa-location-dot";
  if (type === "roundabout" || type === "rotary") return "fa-rotate-right";
  if (type === "merge")                           return "fa-code-merge";
  if (type === "on ramp")                         return "fa-arrow-up-right-from-square";
  if (type === "off ramp")                        return "fa-arrow-turn-down";
  if (type === "fork") {
    return modifier.includes("left") ? "fa-turn-left" : "fa-turn-right";
  }
  if (type === "turn" || type === "end of road" || type === "new name") {
    if (modifier === "uturn")        return "fa-rotate-left";
    if (modifier === "sharp left")   return "fa-turn-left";
    if (modifier === "left")         return "fa-turn-left";
    if (modifier === "slight left")  return "fa-arrow-up-left";
    if (modifier === "sharp right")  return "fa-turn-right";
    if (modifier === "right")        return "fa-turn-right";
    if (modifier === "slight right") return "fa-arrow-up-right";
  }
  return "fa-arrow-up"; // straight / continue / unknown
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
// BEARING BETWEEN — compass bearing from point A → point B
//
// Returns degrees 0–360 (0 = North, 90 = East, 180 = South, 270 = West)
// Used to rotate the GPS marker arrow to face the direction of travel.
// ============================================================
export function bearingBetween(lat1, lng1, lat2, lng2) {
  const toRad = deg => (deg * Math.PI) / 180;
  const toDeg = rad => (rad * 180) / Math.PI;

  const dLng = toRad(lng2 - lng1);
  const y    = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x    =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// ============================================================
// FIND ACTIVE STEP — returns the index of the upcoming step
// that is closest (in distance) to the user's current position.
//
// Used by the navigation panel to highlight the next maneuver.
// ============================================================
export function findActiveStep(steps, userLat, userLng) {
  if (!steps?.length || userLat == null || userLng == null) return 0;

  let nearest = 0;
  let minDist  = Infinity;

  steps.forEach((step, i) => {
    const loc = step.location; // [lng, lat]
    if (!loc) return;
    const d = haversineDistance(userLat, userLng, loc[1], loc[0]);
    if (d < minDist) {
      minDist  = d;
      nearest  = i;
    }
  });

  return nearest;
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

// ============================================================
// FORMAT SPEED — m/s → km/h string
// ============================================================
export function formatSpeed(mps) {
  if (mps == null || mps < 0) return "0";
  return Math.round(mps * 3.6).toString(); // convert m/s to km/h
}
