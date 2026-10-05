// ============================================================
// mapStyles.js — everything about how the ride map LOOKS
//
//   MAP_STYLES     the selectable basemaps (all work without an API key)
//   ROUTE_COLORS   line colours for light and dark basemaps
//   routeWeight()  line thickness for a zoom level
//   RIDER_COLORS   one identity colour per group rider
//
// Kept apart from RideMap.jsx so the map component only draws.
// ============================================================

// Deepest zoom the map allows. Each style also declares maxNativeZoom —
// where its provider really stops publishing tiles. Past that, Leaflet
// upscales the deepest real tile instead of requesting one that does not
// exist (which is what used to blank the last zoom level).
export const MAP_MAX_ZOOM = 19;

const OSM_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_CREDIT = "© OpenStreetMap contributors";

// `dark`      → the basemap is dark, so lines and markers use the
//               light-on-dark palette.
// `fallback`  → used automatically when the primary tiles fail to load.
//               Stadia serves anonymous requests only within limits, so
//               its two styles each have a provider that never needs a key.
// `invert`    → render the tiles through a CSS filter that turns the
//               standard OSM map into a dark one.
export const MAP_STYLES = [
  {
    id: "standard",
    label: "Standard",
    hint: "Streets and places",
    dark: false,
    url: OSM_TILES,
    maxNativeZoom: 19,
    credit: OSM_CREDIT,
  },
  {
    id: "dark",
    label: "Dark",
    hint: "Easy on the eyes at night",
    dark: true,
    url: "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
    maxNativeZoom: 20,
    credit: `© Stadia Maps · ${OSM_CREDIT}`,
    fallback: { url: OSM_TILES, maxNativeZoom: 19, invert: true, credit: OSM_CREDIT },
  },
  {
    id: "satellite",
    label: "Satellite",
    hint: "Aerial imagery",
    dark: true,
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxNativeZoom: 19,
    credit: "© Esri, Maxar, Earthstar Geographics",
  },
  {
    id: "terrain",
    label: "Terrain",
    hint: "Hills and elevation",
    dark: false,
    url: "https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png",
    maxNativeZoom: 18,
    credit: `© Stadia Maps · Stamen · ${OSM_CREDIT}`,
    fallback: {
      url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      maxNativeZoom: 17,
      credit: `© OpenTopoMap · ${OSM_CREDIT}`,
    },
  },
  {
    id: "cycle",
    label: "Cycling",
    hint: "Bike lanes and paths",
    dark: false,
    url: "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
    maxNativeZoom: 18,
    credit: `© CyclOSM · ${OSM_CREDIT}`,
  },
];

// "auto" follows the app theme: dark themes get the dark map.
export const MAP_STYLE_AUTO = "auto";
const STYLE_KEY = "ridewise-map-style";

export function loadMapStyleChoice() {
  try {
    const saved = localStorage.getItem(STYLE_KEY);
    if (saved === MAP_STYLE_AUTO || MAP_STYLES.some((style) => style.id === saved)) return saved;
  } catch {
    // storage unavailable
  }
  return MAP_STYLE_AUTO;
}

export function saveMapStyleChoice(choice) {
  try { localStorage.setItem(STYLE_KEY, choice); } catch { /* storage unavailable */ }
}

export function resolveMapStyle(choice, darkTheme) {
  const id = choice === MAP_STYLE_AUTO ? (darkTheme ? "dark" : "standard") : choice;
  return MAP_STYLES.find((style) => style.id === id) || MAP_STYLES[0];
}

// ── Route line colours ───────────────────────────────────────
//   route    the road still to ride
//   casing   outline that separates the line from the map underneath
//   passed   the part already ridden
//   rejoin   the way back to the route when off it
export const ROUTE_COLORS = {
  light: {
    route: "#2F6FED",
    casing: "#FFFFFF",
    passed: "#8E96A3",
    rejoin: "#7C3AED",
    puck: "#2F6FED",
  },
  dark: {
    route: "#5B9BFF",
    casing: "#0B1220",
    passed: "#7A8597",
    rejoin: "#A78BFA",
    puck: "#5B9BFF",
  },
};

// Line width for a zoom level: thin when the whole route is on screen,
// road-width when navigating at street level.
export function routeWeight(zoom) {
  if (zoom >= 17) return 9;
  if (zoom >= 15) return 8;
  if (zoom >= 13) return 7;
  if (zoom >= 10) return 6;
  return 5;
}

// One colour per rider in a group ride. Colour here is information
// (which rider is which), so it is the one place the map is not monochrome.
export const RIDER_COLORS = [
  "#8B5CF6", "#14B8A6", "#F59E0B", "#EC4899", "#06B6D4",
  "#10B981", "#F43F5E", "#6366F1", "#84CC16", "#E11D48",
];
