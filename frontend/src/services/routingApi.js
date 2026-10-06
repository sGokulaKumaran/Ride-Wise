// ============================================================
// routingApi.js — geocoding, road routing, geo math, formatting
//
// GEOCODING   Photon + Nominatim (OpenStreetMap) — place name ↔ coordinates
// ROUTING     OSRM — road route + turn-by-turn steps between two points
// GEO MATH    haversineDistance / bearingBetween
// FORMATTING  metres, seconds, clock time, spoken distances
//
// No API key is needed for any of it.
//
// COORDINATE ORDER (the one thing that is easy to get wrong):
//   navigator.geolocation      { latitude, longitude }
//   RideWise objects           { lat, lng }
//   OSRM URL                   {lng},{lat}
//   OSRM / GeoJSON geometry    [lng, lat]
//   Leaflet                    [lat, lng]
// Route geometry is stored exactly as OSRM returns it ([lng, lat]);
// it is flipped only at the moment it is handed to Leaflet.
// ============================================================

const NOMINATIM = "https://nominatim.openstreetmap.org";
const PHOTON = "https://photon.komoot.io/api/";

// Two public OSRM servers with the same API. The second one is tried
// automatically when the first is down, slow or rate-limiting, so one
// overloaded demo server can no longer block "Calculate route".
const OSRM_ENDPOINTS = [
  "https://router.project-osrm.org/route/v1/driving",
  "https://routing.openstreetmap.de/routed-car/route/v1/driving",
];

const EARTH_RADIUS_M = 6_371_000;
const ROUTE_TIMEOUT_MS = 12_000;
const GEOCODE_TIMEOUT_MS = 10_000;
const PLACE_SEARCH_TIMEOUT_MS = 6_000; // suggestions must feel quick; Nominatim is the backup

// Both services ask for at most one request per second per client.
const MIN_REQUEST_GAP_MS = 1100;

// ============================================================
// ERRORS
// ============================================================
export class RoutingError extends Error {
  // code: "no-route"    → the servers answered: no road path exists
  //       "unavailable" → no server could be reached in time
  constructor(message, code) {
    super(message);
    this.name = "RoutingError";
    this.code = code;
  }
}

// ============================================================
// GEO MATH
// ============================================================

// Straight-line distance between two points, in metres (Haversine).
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Compass bearing from A to B: 0 = north, 90 = east, 180 = south, 270 = west.
export function bearingBetween(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// ============================================================
// FORMATTING
// ============================================================

// 850 → "850 m" · 3500 → "3.5 km" · 150000 → "150 km"
export function formatDistance(meters) {
  if (meters == null || !Number.isFinite(Number(meters))) return "—";
  const m = Math.max(0, Number(meters));
  if (m < 1000) return `${Math.round(m)} m`;
  const km = m / 1000;
  return km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}

// Distance to the next turn. Rounded the way navigation apps round it,
// so the number counts down in calm steps instead of flickering by the
// metre: 1.2 km · 450 m · 80 m · 20 m.
export function formatManeuverDistance(meters) {
  if (meters == null || !Number.isFinite(Number(meters))) return "";
  const m = Math.max(0, Number(meters));
  if (m >= 10_000) return `${Math.round(m / 1000)} km`;
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  if (m >= 300) return `${Math.round(m / 50) * 50} m`;
  if (m >= 30) return `${Math.round(m / 10) * 10} m`;
  return `${Math.max(5, Math.round(m / 5) * 5)} m`;
}

// 45 → "1 min" · 600 → "10 min" · 5400 → "1 h 30 min"
export function formatDuration(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return "—";
  const total = Math.max(0, Number(seconds));
  if (total < 60) return "1 min";
  const h = Math.floor(total / 3600);
  const m = Math.round((total % 3600) / 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  if (m === 60) return `${h + 1} h`;
  return `${h} h ${m} min`;
}

// Was the distance of this ride measured while riding? (0 m counts: the
// ride was tracked and nothing was ridden. Rides finished before tracking
// existed — or closed by the server — carry no figure at all.)
export function hasTrackedDistance(ride) {
  return ride?.actualDistanceMeters != null && Number(ride.actualDistanceMeters) >= 0;
}

// Metres a ride really contributed to "distance ridden":
//   tracked            → what was measured, even when that is 0
//   completed, legacy  → its planned length (the best figure there is)
//   active / cancelled → nothing yet
export function rideRiddenMeters(ride) {
  if (hasTrackedDistance(ride)) return Number(ride.actualDistanceMeters);
  return ride?.status === "completed" ? Number(ride.distanceMeters) || 0 : 0;
}

// How long a ride took, in seconds — for lists and summaries.
//   finished ride → start to end, when both are known and believable
//   otherwise     → the planned riding time
// A ride that was left running and closed much later (forgotten, or ended
// automatically after two days) did not take that long to RIDE: past
// 18 hours the planned time is the more honest figure.
export function rideTimeSeconds(ride) {
  const planned = Number(ride?.durationSeconds) > 0 ? Number(ride.durationSeconds) : null;
  if (!ride || ride.status === "active") return planned;
  const elapsed = (Date.parse(ride.endedAt) - Date.parse(ride.createdAt)) / 1000;
  if (Number.isFinite(elapsed) && elapsed > 0 && elapsed <= 18 * 3600) return elapsed;
  return planned;
}

// m/s → whole km/h as a string
export function formatSpeed(mps) {
  if (mps == null || !Number.isFinite(Number(mps)) || mps < 0) return "0";
  return Math.round(mps * 3.6).toString();
}

// Timestamp (ms) → local clock time, e.g. "4:35 PM"
export function formatClock(ms) {
  if (ms == null || !Number.isFinite(Number(ms))) return "—";
  try {
    return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "—";
  }
}

// Distance as it should be SPOKEN: "300 metres", "1.5 kilometres"
export function spokenDistance(meters) {
  const m = Math.max(0, Number(meters) || 0);
  if (m >= 1000) {
    const km = m >= 10_000 ? Math.round(m / 1000) : Math.round(m / 100) / 10;
    return `${km} ${km === 1 ? "kilometre" : "kilometres"}`;
  }
  const rounded = m >= 300 ? Math.round(m / 50) * 50 : Math.max(10, Math.round(m / 10) * 10);
  return `${rounded} metres`;
}

// "Marina Beach, Chennai, Tamil Nadu, India" → "Marina Beach"
export function shortPlaceName(name, fallback = "") {
  const first = String(name || "").split(",")[0].trim();
  return first || fallback;
}

// ============================================================
// TURN-BY-TURN STEPS
//
// parseRouteSteps() turns raw OSRM steps into the objects RideWise
// stores with a ride and shows in the navigation UI:
//   {
//     instruction       "Turn left onto Anna Salai"
//     distance          metres ridden on this step (AFTER its maneuver)
//     duration          seconds for this step
//     maneuverType      OSRM maneuver type ("turn", "roundabout", …)
//     maneuverModifier  OSRM modifier ("left", "slight right", …)
//     name / ref        road name and number, when known
//     exit              roundabout exit number, when known
//     location          [lng, lat] where the maneuver happens
//     icon              name in the RideWise icon family
//   }
// ============================================================
export function parseRouteSteps(rawSteps) {
  if (!Array.isArray(rawSteps)) return [];
  return rawSteps.map((step) => {
    const maneuver = step?.maneuver || {};
    const parsed = {
      distance: Number(step?.distance) || 0,
      duration: Number(step?.duration) || 0,
      maneuverType: maneuver.type || "",
      maneuverModifier: maneuver.modifier || "",
      name: step?.name || "",
      ref: step?.ref || "",
      exit: Number.isFinite(maneuver.exit) ? maneuver.exit : null,
      location: Array.isArray(maneuver.location) ? maneuver.location : null,
      bearingAfter: Number.isFinite(maneuver.bearing_after) ? maneuver.bearing_after : null,
    };
    parsed.instruction = buildInstruction(parsed);
    parsed.icon = stepIconName(parsed);
    return parsed;
  });
}

const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
const ORDINALS = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];

function compassWord(bearing) {
  const normalised = ((bearing % 360) + 360) % 360;
  return COMPASS[Math.round(normalised / 45) % 8];
}

// "left" / "right" / "" from an OSRM modifier such as "slight left"
function sideOf(modifier) {
  const m = String(modifier || "");
  if (m.includes("left")) return "left";
  if (m.includes("right")) return "right";
  return "";
}

// Road label: the name, plus the road number when it adds information.
function roadLabel(name, ref) {
  if (name && ref && !name.includes(ref)) return `${name} (${ref})`;
  return name || ref || "";
}

function turnPhrase(modifier) {
  switch (modifier) {
    case "left":         return "Turn left";
    case "right":        return "Turn right";
    case "slight left":  return "Bear left";
    case "slight right": return "Bear right";
    case "sharp left":   return "Turn sharp left";
    case "sharp right":  return "Turn sharp right";
    case "uturn":        return "Make a U-turn";
    default:             return "Continue straight";
  }
}

// One readable sentence for a step.
function buildInstruction({ maneuverType: type, maneuverModifier: modifier, name, ref, exit, bearingAfter }) {
  const road = roadLabel(name, ref);
  const onto = road ? ` onto ${road}` : "";
  const on = road ? ` on ${road}` : "";
  const side = sideOf(modifier);

  switch (type) {
    case "depart":
      if (bearingAfter != null) return `Head ${compassWord(bearingAfter)}${on}`;
      return road ? `Start on ${road}` : "Start riding";

    case "arrive":
      return side ? `Arrive at your destination, on the ${side}` : "Arrive at your destination";

    case "turn":
      return `${turnPhrase(modifier)}${onto}`;

    case "new name":
      return road ? `Continue onto ${road}` : "Continue straight";

    case "continue":
      if (modifier === "uturn") return road ? `Make a U-turn and continue on ${road}` : "Make a U-turn";
      if (modifier === "left" || modifier === "right" || modifier?.startsWith("sharp")) {
        return road ? `Turn ${side} to stay on ${road}` : `Turn ${side}`;
      }
      if (side) return road ? `Keep ${side} to stay on ${road}` : `Keep ${side}`;
      return `Continue straight${on}`;

    case "merge":
      return `Merge${side ? ` ${side}` : ""}${onto}`;

    case "on ramp":
      return `Take the ramp${side ? ` on the ${side}` : ""}${onto}`;

    case "off ramp":
      return `Take the exit${side ? ` on the ${side}` : ""}${onto}`;

    case "fork":
      return `Keep ${side || "straight"} at the fork${onto}`;

    case "end of road":
      if (modifier === "uturn") return "At the end of the road, make a U-turn";
      return `At the end of the road, turn ${side || "ahead"}${onto}`;

    case "roundabout":
    case "rotary":
      return exit && ORDINALS[exit]
        ? `At the roundabout, take the ${ORDINALS[exit]} exit${onto}`
        : `Enter the roundabout${onto}`;

    case "roundabout turn":
      return side ? `At the roundabout, turn ${side}${onto}` : `At the roundabout, continue straight${onto}`;

    case "exit roundabout":
    case "exit rotary":
      return `Exit the roundabout${onto}`;

    default:
      return road ? `Continue on ${road}` : "Continue";
  }
}

// Which icon of the RideWise family draws this step.
// Works for freshly parsed steps AND for steps stored by older versions
// (which carry a Font Awesome class in `icon` and no reliable modifier).
export function stepIconName(step) {
  if (!step) return "maneuverStraight";
  const type = step.maneuverType || "";
  const modifier = String(step.maneuverModifier || "");
  const legacy = String(step.icon || "");

  if (type === "rejoin") return "maneuverMerge";
  if (type === "waypoint") return "pin";
  if (type === "arrive" || legacy.includes("flag")) return "maneuverArrive";
  if (type === "depart" || legacy.includes("location-dot")) return "maneuverDepart";
  if (type.includes("roundabout") || type.includes("rotary")) return "maneuverRoundabout";
  if (type === "merge" || legacy.includes("merge")) return "maneuverMerge";
  if (type === "fork") return sideOf(modifier) === "left" ? "maneuverKeepLeft" : "maneuverKeepRight";
  if (type === "on ramp" || type === "off ramp") {
    return sideOf(modifier) === "left" ? "maneuverSlightLeft" : "maneuverSlightRight";
  }

  if (modifier === "uturn" || legacy.includes("rotate-left")) return "maneuverUTurn";
  if (modifier === "sharp left") return "maneuverSharpLeft";
  if (modifier === "sharp right") return "maneuverSharpRight";
  if (modifier === "slight left" || legacy.includes("up-left")) return "maneuverSlightLeft";
  if (modifier === "slight right" || legacy.includes("up-right")) return "maneuverSlightRight";
  if (modifier === "left" || legacy.includes("turn-left")) return "maneuverLeft";
  if (modifier === "right" || legacy.includes("turn-right")) return "maneuverRight";
  return "maneuverStraight";
}

// ============================================================
// NETWORK HELPERS
// ============================================================

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function abortError() {
  const err = new Error("Request cancelled");
  err.name = "AbortError";
  return err;
}

// One politeness queue per service: requests START at least
// MIN_REQUEST_GAP_MS apart. A higher `priority` jumps the line, so the
// rider's own reroute never waits behind background lookups (the rejoin
// lines drawn for other riders). A slow request does not hold up the
// next one — only the start times are spaced.
function createQueue() {
  const waiting = [];
  let pumping = false;
  let lastStart = 0;

  async function pump() {
    if (pumping) return;
    pumping = true;
    while (waiting.length) {
      const wait = lastStart + MIN_REQUEST_GAP_MS - Date.now();
      if (wait > 0) await sleep(wait);

      // Highest priority first; first-come-first-served within a priority.
      let best = 0;
      for (let i = 1; i < waiting.length; i++) {
        if (waiting[i].priority > waiting[best].priority) best = i;
      }
      const job = waiting.splice(best, 1)[0];
      if (job.signal?.aborted) { job.reject(abortError()); continue; }

      lastStart = Date.now();
      Promise.resolve().then(job.task).then(job.resolve, job.reject);
    }
    pumping = false;
  }

  return function enqueue(task, signal, priority = 1) {
    return new Promise((resolve, reject) => {
      waiting.push({ task, signal, priority, resolve, reject });
      pump();
    });
  };
}

const routeQueue = createQueue();
const geocodeQueue = createQueue();

// fetch() that gives up after `ms` and also honours the caller's signal.
// Resolves to { res } or { timedOut: true }; throws AbortError only when
// the CALLER cancelled.
async function fetchWithTimeout(url, { signal, ms, headers } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, ms);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    return { res };
  } catch (err) {
    if (signal?.aborted) throw abortError();
    if (timedOut) return { timedOut: true };
    return { failed: true, error: err };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

// Convert one OSRM route into the RideWise shape.
//
// A route through stops comes back as several LEGS, each ending in an
// "arrive" and (after the first) starting with a "depart". Read out as
// they are, a bus driver would be told "arrive at your destination" at
// every stop. So inside the route, each arrival becomes "Stop: <name>"
// and the departures after it are dropped.
function toRoute(route, via = []) {
  const legs = route.legs || [];
  const steps = [];
  legs.forEach((leg, legIndex) => {
    const parsed = parseRouteSteps(leg.steps || []);
    const lastLeg = legIndex === legs.length - 1;
    parsed.forEach((step, stepIndex) => {
      if (legIndex > 0 && stepIndex === 0 && step.maneuverType === "depart") return;
      if (!lastLeg && stepIndex === parsed.length - 1 && step.maneuverType === "arrive") {
        const name = via[legIndex]?.name;
        steps.push({
          ...step,
          maneuverType: "waypoint",
          instruction: name ? `Stop: ${name}` : `Stop ${legIndex + 1}`,
          icon: "pin",
        });
        return;
      }
      steps.push(step);
    });
  });

  return {
    coordinates: route.geometry?.coordinates || [], // [[lng, lat], ...]
    distance: route.distance,                       // metres
    duration: route.duration,                       // seconds
    steps,
    summary: legs.map((leg) => leg.summary).filter(Boolean).join(", ") || "",
  };
}

// Index of the OSRM server that answered last — tried first next time.
let preferredEndpoint = 0;

// ============================================================
// FETCH ROUTES — the low-level routing call
//
// from / to   { lat, lng }
// options:
//   alternatives  also return up to two alternative routes
//   bearing       rider's heading in degrees — the start is matched to a
//                 road going that way, so a reroute does not begin with
//                 an instant U-turn when a way forward exists
//   signal        AbortSignal to cancel the request
//   priority      1 = the rider is waiting for it (default)
//                 0 = background work that may wait its turn
//   via           places the route must pass through, in order
//                 ([{ lat, lng, name }]) — a bus route and its stops.
//                 (No alternatives then: there is one way through them.)
//
// Resolves to an ARRAY of routes (best first).
// Rejects with RoutingError ("no-route" | "unavailable") or AbortError.
// ============================================================
export function fetchRoutes(from, to, { alternatives = false, bearing = null, signal, priority = 1, via = [] } = {}) {
  const valid = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng);
  if (!valid(from) || !valid(to)) {
    return Promise.reject(new RoutingError("A start and a destination are required.", "no-route"));
  }
  const through = (Array.isArray(via) ? via : []).filter(valid);

  const coords = [from, ...through, to].map((p) => `${p.lng},${p.lat}`).join(";");
  const base = `overview=full&geometries=geojson&steps=true${
    alternatives && through.length === 0 ? "&alternatives=true" : ""}`;
  const withBearing = Number.isFinite(bearing) && through.length === 0
    ? `${base}&bearings=${Math.round(((bearing % 360) + 360) % 360)},60;&radiuses=80;unlimited`
    : null;

  return routeQueue(async () => {
    const order = [preferredEndpoint, ...OSRM_ENDPOINTS.keys()].filter(
      (value, index, list) => list.indexOf(value) === index,
    );

    for (const index of order) {
      // With a heading first; without it when that finds no usable road.
      for (const query of withBearing ? [withBearing, base] : [base]) {
        const outcome = await fetchWithTimeout(`${OSRM_ENDPOINTS[index]}/${coords}?${query}`, {
          signal,
          ms: ROUTE_TIMEOUT_MS,
        });
        if (!outcome.res) break;                // network error / timeout → next server
        if (!outcome.res.ok && outcome.res.status !== 400) break; // 429 / 5xx → next server

        let data;
        try { data = await outcome.res.json(); } catch { break; }

        if (data?.code === "Ok" && data.routes?.length) {
          preferredEndpoint = index;
          return data.routes.map((found) => toRoute(found, through));
        }
        // "NoRoute" / "NoSegment" is a real answer, not an outage. With a
        // heading it may only mean "no road going that way" → fall through
        // to the unconstrained query. Without one it is final: another
        // server would say the same.
        if (query === base) {
          throw new RoutingError("No road route was found between these places.", "no-route");
        }
      }
    }

    throw new RoutingError(
      "The routing service isn't responding. Check your connection and try again.",
      "unavailable",
    );
  }, signal, priority);
}

// Best route between two points (or throws RoutingError).
export async function getRoute(from, to, options = {}) {
  const routes = await fetchRoutes(from, to, options);
  return routes[0];
}

// ============================================================
// SEARCH PLACES — typed text → places to choose from
//
//   searchPlaces("chennai central railway station", { near })
//     → [{ label, name, detail, lat, lng, area }, …]   (best first, max `limit`)
//
//   name    the place itself          "Chennai Central Railway Station"
//   detail  where it is               "Park Town, Chennai, Tamil Nadu"
//   label   both, for saving/showing  "Chennai Central Railway Station, Park Town, …"
//   area    true for a region (state, district) rather than a spot
//
// TWO SERVICES THAT COVER FOR EACH OTHER
//   Photon     made for search-as-you-type: forgives typos and extra words
//              ("marina bech", "… railway station") and, given `near`,
//              lists nearby places first. Its public server is fast when
//              healthy but has slow spells.
//   Nominatim  dependable and strict: an exact name works, a typo finds
//              nothing — which used to read as "this place does not exist".
//
//   Photon is asked first and gets a short head start. If it has not found
//   anything by then (slow, down, or no match) Nominatim is asked as well
//   and whichever finds something first is shown. After a failure Photon
//   is left alone for a minute, so a slow spell costs one wait, not one
//   per keystroke.
//
// `near` ({ lat, lng }) is optional and is rounded to about a kilometre
// before it is sent: enough to rank nearby places first, without handing
// the rider's exact position to a search service.
//
// Resolves to [] when nothing matches. Rejects (with a message that is
// safe to show) only when NEITHER service could be reached — so the UI
// can tell "no such place" apart from "no connection".
// ============================================================
const PHOTON_HEAD_START_MS = 1200;
const PHOTON_REST_MS = 60_000;
let photonRestUntil = 0;

function uniqueParts(parts) {
  const seen = new Set();
  const kept = [];
  for (const part of parts) {
    const text = typeof part === "string" ? part.trim() : "";
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    kept.push(text);
  }
  return kept;
}

function toPlace(nameParts, detailParts, lat, lng, area) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const all = uniqueParts([...nameParts, ...detailParts]);
  if (!all.length) return null;
  const [name, ...rest] = all;
  return { label: all.join(", "), name, detail: rest.join(", "), lat, lng, area: Boolean(area) };
}

function fromPhoton(feature) {
  const p = feature?.properties || {};
  const [lng, lat] = feature?.geometry?.coordinates || [];
  const street = p.street ? [p.housenumber, p.street].filter(Boolean).join(" ") : "";
  return toPlace(
    [p.name || street],
    [p.name ? street : "", p.district || p.locality, p.city || p.county, p.state, p.country],
    lat, lng,
    p.osm_key === "boundary",
  );
}

function fromNominatim(item) {
  // A full Nominatim name runs to eight or more parts ("…, Ward 59, Zone 5
  // Royapuram, Chennai, Tamil Nadu, 600003, India"). Keep what a rider
  // would say: the place, its street or area, the town, the state.
  const parts = String(item?.display_name || "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && !/^\d[\d\s-]*$/.test(part)); // no postcodes
  const a = item?.address;
  const detail = a
    ? [
        a.road || a.neighbourhood || a.suburb || a.city_district,
        a.city || a.town || a.village || a.municipality || a.county,
        a.state,
        a.country,
      ]
    : parts.slice(1, 4);
  return toPlace(
    [item?.name || parts[0]], detail,
    parseFloat(item?.lat), parseFloat(item?.lon),
    item?.category === "boundary" || item?.class === "boundary",
  );
}

const sameName = (a, b) => a.name.toLowerCase() === b.name.toLowerCase();

// Tidy a raw result list:
//   • the same label, or the same spot twice (within ~20 m) → keep the first
//   • a region is listed AFTER the town of the same name. A region's centre
//     point can be far from anywhere — the centre of the Puducherry
//     territory lies 110 km from Pondicherry town — so the town is the
//     better first suggestion and the better "best match".
export function tidyPlaces(places, limit = places.length) {
  const kept = [];
  for (const place of places) {
    const twin = kept.some((other) =>
      other.label.toLowerCase() === place.label.toLowerCase() ||
      (sameName(other, place) && haversineDistance(other.lat, other.lng, place.lat, place.lng) < 20));
    if (!twin) kept.push(place);
  }
  for (let i = 0; i < kept.length; i++) {
    if (!kept[i].area) continue;
    const town = kept.findIndex((other, index) => index > i && !other.area && sameName(other, kept[i]));
    if (town > i) kept.splice(i, 0, kept.splice(town, 1)[0]);
  }
  return kept.slice(0, limit);
}

// Each resolves to { answered, places } and never rejects.
//   answered  false when the service could not be reached / read
async function askPhoton(text, near, limit, signal) {
  const params = new URLSearchParams({ q: text, limit: String(limit + 2), lang: "en" });
  if (near && Number.isFinite(near.lat) && Number.isFinite(near.lng)) {
    params.set("lat", near.lat.toFixed(2));
    params.set("lon", near.lng.toFixed(2));
  }
  try {
    const outcome = await fetchWithTimeout(`${PHOTON}?${params}`, { signal, ms: PLACE_SEARCH_TIMEOUT_MS });
    if (!outcome.res?.ok) throw new Error("photon unavailable");
    const data = await outcome.res.json();
    return { answered: true, places: tidyPlaces((data?.features || []).map(fromPhoton).filter(Boolean), limit) };
  } catch (err) {
    if (err?.name !== "AbortError") photonRestUntil = Date.now() + PHOTON_REST_MS;
    return { answered: false, places: [] };
  }
}

async function askNominatim(text, limit, signal) {
  const url = `${NOMINATIM}/search?q=${encodeURIComponent(text)}&format=jsonv2&addressdetails=1&limit=${limit + 2}`;
  try {
    const outcome = await geocodeQueue(
      () => fetchWithTimeout(url, { signal, ms: GEOCODE_TIMEOUT_MS, headers: { "Accept-Language": "en" } }),
      signal,
    );
    if (!outcome.res?.ok) throw new Error("nominatim unavailable");
    const data = await outcome.res.json();
    if (!Array.isArray(data)) throw new Error("nominatim unreadable");
    return { answered: true, places: tidyPlaces(data.map(fromNominatim).filter(Boolean), limit) };
  } catch {
    return { answered: false, places: [] };
  }
}

// The first ask that finds something wins; when none does, report whether
// anybody answered at all.
function firstWithPlaces(asks) {
  return new Promise((resolve) => {
    let pending = asks.length;
    let answered = false;
    for (const ask of asks) {
      ask.then((outcome) => {
        answered = answered || outcome.answered;
        pending -= 1;
        if (outcome.places.length) resolve({ answered: true, places: outcome.places });
        else if (pending === 0) resolve({ answered, places: [] });
      });
    }
  });
}

export async function searchPlaces(query, { near = null, limit = 6, signal } = {}) {
  const text = String(query || "").trim();
  if (text.length < 2) return [];

  const asks = [];
  if (Date.now() >= photonRestUntil) {
    const photon = askPhoton(text, near, limit, signal);
    asks.push(photon);
    // Photon alone first: when it is healthy it answers within a moment.
    const quick = await Promise.race([photon, sleep(PHOTON_HEAD_START_MS).then(() => null)]);
    if (signal?.aborted) throw abortError();
    if (quick?.places.length) return quick.places;
  }

  // Slow, resting, or nothing found → Nominatim joins in.
  asks.push(askNominatim(text, limit, signal));
  const outcome = await firstWithPlaces(asks);
  if (signal?.aborted) throw abortError();

  if (!outcome.answered) {
    throw new Error("The place search isn't responding. Check your connection and try again.");
  }
  return outcome.places;
}

// ============================================================
// GEOCODE — place name → { name, lat, lng } (null when not found)
//
// The best match of searchPlaces(). Used when the rider typed a place
// and pressed "Next" without picking one of the suggestions.
// ============================================================
export async function geocode(query, { near = null, signal } = {}) {
  const [best] = await searchPlaces(query, { near, limit: 5, signal });
  return best ? { name: best.label, lat: best.lat, lng: best.lng } : null;
}

// ============================================================
// REVERSE GEOCODE — coordinates → a short readable place name
//
// Used when a ride starts from "my current location", so the ride is
// saved as "Anna Salai, Chennai → …" instead of "Start Location → …".
// Never throws: resolves to null when the lookup fails.
// ============================================================
export async function reverseGeocode(lat, lng, { signal } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const url = `${NOMINATIM}/reverse?lat=${lat}&lon=${lng}&format=jsonv2&zoom=17&addressdetails=1`;
  try {
    const outcome = await geocodeQueue(
      () => fetchWithTimeout(url, { signal, ms: GEOCODE_TIMEOUT_MS, headers: { "Accept-Language": "en" } }),
      signal,
    );
    if (!outcome.res?.ok) return null;
    const data = await outcome.res.json();
    const a = data?.address || {};
    const near = a.road || a.pedestrian || a.neighbourhood || a.suburb || a.hamlet || "";
    const town = a.city || a.town || a.village || a.municipality || a.county || a.state_district || "";
    const label = [near, town].filter(Boolean).join(", ");
    return label || shortPlaceName(data?.display_name) || null;
  } catch {
    return null;
  }
}
