// ============================================================
// navigation.js — the RideWise navigation engine
//
// Pure functions only: no React, no DOM, no network. Everything the
// live map shows is derived here from two inputs — the ride's stored
// route and the stream of GPS fixes — which is what makes it testable
// (see tests/navigation.test.mjs).
//
// THE MODEL
//   A route is a polyline. Every point on it has a PROGRESS: metres
//   ridden from the start. A GPS fix is snapped to the nearest SEGMENT
//   (not the nearest vertex), giving:
//       progress        how far along the route the rider is
//       lateralMeters   how far from the road they are
//
//   From those two numbers come:
//     • on-route / off-route  (with hysteresis, scaled by GPS accuracy)
//     • the NEXT turn and the live distance to it
//     • remaining distance and time ALONG THE ROAD
//     • arrival
//     • distance actually ridden
//
// WHAT IT REPLACES
//   The old logic picked the turn whose map position was NEAREST to the
//   rider and could only ever move forward. It announced "you have
//   arrived" kilometres early, showed a distance that never counted
//   down, and measured "off route" to route vertices, so a rider on a
//   long straight road was reported off-route.
//
// EXPORTS (grouped)
//   route      buildNavRoute · parseRouteCoordinates · parseSteps
//   geometry   projectOnRoute · pointAtProgress · sliceRoute · routeLatLngs
//   guidance   nextStepAt · remainingDuration
//   tracker    createNavState · advanceNav · offRouteThreshold
//   rejoin     planRejoinTarget · buildRejoin · trackRejoin
//   output     describeNav
//   voice      nextAnnouncement
// ============================================================

import { haversineDistance, bearingBetween, spokenDistance } from "./routingApi.js";

export const NAV = Object.freeze({
  // ── Off-route detection ──
  OFF_ROUTE_MIN_M: 50,        // never call it "off route" closer than this
  OFF_ROUTE_ACCURACY_K: 1.5,  // …and widen that with poor GPS accuracy
  BACK_ON_ROUTE_RATIO: 0.6,   // must come back well inside the limit (hysteresis)
  OFF_ROUTE_CONFIRM: 2,       // consecutive fixes outside before it counts

  // ── Progress tracking ──
  WINDOW_BACK_M: 60,          // how far behind the last progress to search
  WINDOW_AHEAD_MIN_M: 400,    // …and at least this far ahead
  BACKTRACK_ACCEPT_M: 80,     // smaller steps backwards are GPS wobble
  INITIAL_TIE_M: 30,          // first fix: prefer the EARLIEST near-equal match

  // ── Guidance ──
  PASSED_STEP_M: 12,          // a turn stays "next" until this far past it
  THEN_HINT_M: 300,           // show "then …" when the following turn is this close
  ARRIVE_RADIUS_M: 35,
  ARRIVE_RELEASE_M: 150,

  // ── Distance ridden ──
  MAX_ACCURACY_M: 50,         // vaguer fixes are not used to measure distance
  MAX_SPEED_MPS: 42,          // ≈150 km/h — faster means a GPS jump
  MIN_MOVE_M: 3,              // below this it is jitter, not movement

  // ── Rejoin route ──
  REJOIN_LOOKAHEAD_MIN_M: 300,
  REJOIN_LOOKAHEAD_MAX_M: 2500,
  MERGE_TOLERANCE_M: 25,      // rejoin path counts as "on the route" within this
  MERGE_SUSTAIN_M: 120,       // …once it has stayed there this long
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lowerFirst = (text) => (text ? text.charAt(0).toLowerCase() + text.slice(1) : "");

// ============================================================
// ROUTE
// ============================================================

// Stored geometry ([lng, lat] pairs, usually a JSON string) → [{ lat, lng }]
// Junk entries and consecutive duplicate points are dropped.
export function parseRouteCoordinates(raw) {
  if (!raw) return [];
  let list = raw;
  if (typeof raw === "string") {
    try { list = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(list)) return [];

  const points = [];
  for (const pair of list) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const lng = Number(pair[0]);
    const lat = Number(pair[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const previous = points[points.length - 1];
    if (previous && previous.lat === lat && previous.lng === lng) continue;
    points.push({ lat, lng });
  }
  return points;
}

// Stored steps (array or JSON string) → array
export function parseSteps(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// Build the indexed route the rest of this module works on.
// Returns null when there is no usable geometry (older rides whose
// route was cleaned up) — callers fall back to straight-line figures.
export function buildNavRoute(rawCoordinates, rawSteps, { duration } = {}) {
  const points = parseRouteCoordinates(rawCoordinates);
  if (points.length < 2) return null;

  const cumulative = new Array(points.length).fill(0);
  for (let i = 1; i < points.length; i++) {
    cumulative[i] =
      cumulative[i - 1] +
      haversineDistance(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  }
  const total = cumulative[cumulative.length - 1];
  if (!(total > 0)) return null;

  const route = { points, cumulative, total, steps: [], duration: null };
  route.steps = locateSteps(route, parseSteps(rawSteps));

  const stepSeconds = route.steps.reduce((sum, step) => sum + (Number(step.duration) || 0), 0);
  route.duration = Number(duration) > 0 ? Number(duration) : stepSeconds > 0 ? stepSeconds : null;
  return route;
}

// Give every step the PROGRESS at which its maneuver happens.
//   1. estimate from the running sum of step distances (scaled to the
//      polyline's own length), then
//   2. refine by snapping the maneuver's coordinate onto the polyline
//      near that estimate — maneuver points are vertices of the geometry,
//      so this is exact when the coordinate is available.
function locateSteps(route, steps) {
  const usable = steps.filter((step) => step && typeof step === "object");
  if (!usable.length) return [];

  const listed = usable.reduce((sum, step) => sum + (Number(step.distance) || 0), 0);
  const scale = listed > 0 ? route.total / listed : 1;
  const window = Math.max(150, route.total * 0.01);

  let ridden = 0;
  let previous = 0;
  return usable.map((step, index) => {
    const estimate = Math.min(route.total, ridden * scale);
    ridden += Number(step.distance) || 0;

    let progress = estimate;
    const location = step.location;
    if (Array.isArray(location) && location.length >= 2) {
      const lng = Number(location[0]);
      const lat = Number(location[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const hit = projectOnRoute(route, lat, lng, { from: estimate - window, to: estimate + window });
        if (hit && hit.lateralMeters <= 30) progress = hit.progress;
      }
    }
    if (index === usable.length - 1 && step.maneuverType === "arrive") progress = route.total;

    progress = clamp(Math.max(previous, progress), 0, route.total); // never out of order
    previous = progress;
    return { ...step, index, progress };
  });
}

// ============================================================
// GEOMETRY
// ============================================================

// Index of the last vertex whose cumulative distance is <= progress.
function vertexBefore(cumulative, progress) {
  let lo = 0;
  let hi = cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cumulative[mid] <= progress) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// Snap a position onto the route.
//
//   from / to             only consider this stretch of the route (metres).
//                         Keeps tracking on the right pass of a route that
//                         crosses or doubles back over itself.
//   preferEarliestWithin  among matches almost as close as the best one,
//                         take the earliest — used for the very first fix,
//                         so a loop ride does not start at its finish.
//
// Returns { progress, lateralMeters, segment, t, lat, lng } or null.
export function projectOnRoute(route, lat, lng, { from = -Infinity, to = Infinity, preferEarliestWithin = 0 } = {}) {
  if (!route || route.points.length < 2) return null;
  const { points, cumulative } = route;
  const lastSegment = points.length - 2;

  // Local flat-earth plane centred on the position (metres per degree).
  const perLat = 111_320;
  const perLng = 111_320 * Math.cos((lat * Math.PI) / 180);

  const evaluate = (i) => {
    const length = cumulative[i + 1] - cumulative[i];
    if (!(length > 0)) return null;

    // Portion of this segment that lies inside the search window
    const tMin = from > cumulative[i] ? Math.min(1, (from - cumulative[i]) / length) : 0;
    const tMax = to < cumulative[i + 1] ? Math.max(0, (to - cumulative[i]) / length) : 1;
    if (tMin > tMax) return null;

    const a = points[i];
    const b = points[i + 1];
    const ax = (a.lng - lng) * perLng;
    const ay = (a.lat - lat) * perLat;
    const dx = (b.lng - a.lng) * perLng;
    const dy = (b.lat - a.lat) * perLat;
    const squared = dx * dx + dy * dy;

    // Closest point of the segment to the position, as a 0..1 fraction
    let t = squared > 0 ? -(ax * dx + ay * dy) / squared : 0;
    t = clamp(t, tMin, tMax);

    return {
      segment: i,
      t,
      progress: cumulative[i] + t * length,
      lateralMeters: Math.hypot(ax + t * dx, ay + t * dy),
    };
  };

  const first = from > 0 ? Math.min(vertexBefore(cumulative, from), lastSegment) : 0;

  let best = null;
  for (let i = first; i <= lastSegment; i++) {
    if (cumulative[i] > to) break;
    const candidate = evaluate(i);
    if (candidate && (!best || candidate.lateralMeters < best.lateralMeters)) best = candidate;
  }
  if (!best) return null;

  if (preferEarliestWithin > 0) {
    const limit = best.lateralMeters + preferEarliestWithin;
    let earliest = null;
    for (let i = first; i <= best.segment; i++) {
      const candidate = evaluate(i);
      if (candidate && candidate.lateralMeters <= limit) {
        if (!earliest || candidate.lateralMeters < earliest.lateralMeters) earliest = candidate;
      } else if (earliest) {
        break; // left the first run of near matches
      }
    }
    if (earliest) best = earliest;
  }

  const a = points[best.segment];
  const b = points[best.segment + 1];
  best.lat = a.lat + (b.lat - a.lat) * best.t;
  best.lng = a.lng + (b.lng - a.lng) * best.t;
  return best;
}

// The point on the route at a given progress.
export function pointAtProgress(route, progress) {
  const { points, cumulative, total } = route;
  const p = clamp(Number(progress) || 0, 0, total);
  const segment = Math.min(vertexBefore(cumulative, p), points.length - 2);
  const length = cumulative[segment + 1] - cumulative[segment];
  const t = length > 0 ? clamp((p - cumulative[segment]) / length, 0, 1) : 0;
  const a = points[segment];
  const b = points[segment + 1];
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
    segment,
    t,
  };
}

// The stretch of route between two progress values, as Leaflet [lat, lng]
// pairs — starting and ending EXACTLY at those points, not at vertices.
export function sliceRoute(route, from, to) {
  if (!route) return [];
  const start = clamp(Number(from) || 0, 0, route.total);
  const end = clamp(Number(to) || 0, 0, route.total);
  if (!(end > start)) return [];

  const a = pointAtProgress(route, start);
  const b = pointAtProgress(route, end);
  const line = [[a.lat, a.lng]];
  for (let i = a.segment + 1; i <= b.segment; i++) {
    line.push([route.points[i].lat, route.points[i].lng]);
  }
  line.push([b.lat, b.lng]);
  return line;
}

// The whole route as Leaflet [lat, lng] pairs.
export function routeLatLngs(route) {
  return route ? route.points.map((point) => [point.lat, point.lng]) : [];
}

// ============================================================
// GUIDANCE
// ============================================================

// The upcoming maneuver for a rider at `progress`.
//   step         the next step object
//   distance     metres until its maneuver (0 when at / just past it)
//   then         the step after it, when it follows closely
//   currentRoad  name of the road being ridden right now
export function nextStepAt(route, progress) {
  const steps = route?.steps || [];
  if (!steps.length) return null;

  const p = Number(progress) || 0;
  let index = steps.findIndex((step) => step.progress > p - NAV.PASSED_STEP_M);
  if (index < 0) index = steps.length - 1;

  const step = steps[index];
  const following = steps[index + 1];
  const then =
    following &&
    step.maneuverType !== "arrive" &&
    following.progress - step.progress <= NAV.THEN_HINT_M
      ? following
      : null;

  return {
    index,
    step,
    distance: Math.max(0, step.progress - p),
    then,
    currentRoad: (index > 0 ? steps[index - 1].name : "") || "",
  };
}

// Seconds of riding left from `progress` to the end of the route, using
// the routing engine's own per-step durations.
export function remainingDuration(route, progress) {
  if (!route) return null;
  const p = clamp(Number(progress) || 0, 0, route.total);
  const steps = route.steps || [];
  const timed = steps.some((step) => Number(step.duration) > 0);

  if (!timed) {
    return route.duration ? route.duration * (1 - p / route.total) : null;
  }

  let seconds = 0;
  for (let i = 0; i < steps.length; i++) {
    const start = steps[i].progress;
    const end = i + 1 < steps.length ? steps[i + 1].progress : route.total;
    if (end <= p) continue;
    const duration = Number(steps[i].duration) || 0;
    if (start >= p) seconds += duration;
    else if (end > start) seconds += duration * ((end - p) / (end - start));
  }
  return seconds;
}

// ============================================================
// TRACKER
// ============================================================

// How far from the road a fix may be before it counts as off-route.
// It grows with poor accuracy: a fix that is only good to ±200 m cannot
// prove the rider left a road 80 m away.
export function offRouteThreshold(accuracy) {
  const acc = Number.isFinite(accuracy) ? accuracy : 25;
  return Math.max(NAV.OFF_ROUTE_MIN_M, acc * NAV.OFF_ROUTE_ACCURACY_K);
}

// A fresh tracker. `restored` = { progress, traveled, savedAt } read from
// storage, so reopening the map (or reloading the page) mid-ride carries
// on from where the rider was instead of starting again at zero.
export function createNavState(restored = null) {
  const progress = Number.isFinite(restored?.progress) ? Math.max(0, restored.progress) : null;
  return {
    progress,                 // metres along the route; null until first matched
    resumed: progress != null,
    savedAt: Number.isFinite(restored?.savedAt) ? restored.savedAt : null,
    offRoute: false,
    offCount: 0,              // consecutive fixes outside the route
    arrived: false,
    leftEndZone: false,       // has been away from the finish at least once
    lateral: null,            // metres from the route at the last fix
    nearest: null,            // nearest point anywhere on the route
    traveled: Number.isFinite(restored?.traveled) ? Math.max(0, restored.traveled) : 0,
    anchor: null,             // last position used to measure distance
    lastFix: null,
    speed: null,              // m/s, smoothed
    heading: null,            // degrees
  };
}

// Add this fix's contribution to the distance ridden.
//   • along the route while on it (exact, immune to GPS zig-zag)
//   • straight hops while off it, gated by the fix's own accuracy so
//     standing still never "rides" anywhere
function accumulate(prev, next, fix, accuracy, onRoute) {
  if (accuracy > NAV.MAX_ACCURACY_M) return; // too vague to measure with

  const here = {
    lat: fix.lat,
    lng: fix.lng,
    timestamp: fix.timestamp,
    progress: onRoute ? next.progress : null,
  };
  const anchor = prev.anchor;
  if (!anchor) { next.anchor = here; return; }

  const seconds = Math.max((fix.timestamp - anchor.timestamp) / 1000, 0.001);
  const hop = haversineDistance(anchor.lat, anchor.lng, fix.lat, fix.lng);

  // Teleport → count nothing, carry on from the new position.
  if (hop > NAV.MIN_MOVE_M && hop / seconds > NAV.MAX_SPEED_MPS) { next.anchor = here; return; }

  if (onRoute && anchor.progress != null) {
    const delta = next.progress - anchor.progress;
    if (delta >= NAV.MIN_MOVE_M) {
      if (delta / seconds <= NAV.MAX_SPEED_MPS) next.traveled = prev.traveled + delta;
      next.anchor = here;
      return;
    }
    if (delta > -NAV.BACKTRACK_ACCEPT_M) return; // standing still / wobble
    // Rode back along the route → measured as a straight hop below.
  }

  const gate = Math.max(NAV.MIN_MOVE_M, accuracy * 0.5);
  if (hop >= gate) {
    next.traveled = prev.traveled + hop;
    next.anchor = here;
  }
}

// Feed one GPS fix through the tracker. Returns a NEW state.
//
//   route   buildNavRoute() result, or null when the ride has no geometry
//   fix     { lat, lng, accuracy, speed, heading, timestamp }
//   hints   { mergeProgress } — where the current rejoin route meets the
//           main route, so coming back on-route is found there first
export function advanceNav(route, previous, fix, hints = {}) {
  let prev = previous;

  // Resuming a stored ride: measure the gap from where it was left.
  if (prev.resumed && !prev.anchor && route && prev.progress != null && prev.savedAt != null) {
    const at = pointAtProgress(route, prev.progress);
    prev = {
      ...prev,
      anchor: { lat: at.lat, lng: at.lng, timestamp: prev.savedAt, progress: prev.progress },
    };
  }

  const next = { ...prev };
  const accuracy = Number.isFinite(fix.accuracy) ? fix.accuracy : 25;

  // ── Speed and heading ─────────────────────────────────────
  // Phones report both; desktops usually report neither, so they are
  // derived from consecutive fixes when missing.
  const last = prev.lastFix;
  const seconds = last ? (fix.timestamp - last.timestamp) / 1000 : null;
  const moved = last ? haversineDistance(last.lat, last.lng, fix.lat, fix.lng) : 0;

  let speed = Number.isFinite(fix.speed) && fix.speed >= 0 ? fix.speed : null;
  if (speed == null && last && seconds > 0.4 && seconds < 20 && accuracy <= NAV.MAX_ACCURACY_M) {
    speed = moved < Math.max(2, accuracy * 0.3) ? 0 : Math.min(moved / seconds, NAV.MAX_SPEED_MPS);
  }
  if (speed != null) {
    next.speed = prev.speed == null || speed === 0 ? speed : prev.speed * 0.4 + speed * 0.6;
  }

  if (Number.isFinite(fix.heading) && (speed ?? 0) > 1) {
    next.heading = fix.heading;
  } else if (last && moved > Math.max(6, accuracy * 0.5)) {
    next.heading = bearingBetween(last.lat, last.lng, fix.lat, fix.lng);
  }

  next.lastFix = { lat: fix.lat, lng: fix.lng, accuracy, timestamp: fix.timestamp };
  next.resumed = false;

  // ── No stored geometry → free tracking only ───────────────
  if (!route) {
    next.progress = null;
    next.offRoute = false;
    next.offCount = 0;
    next.lateral = null;
    next.nearest = null;
    accumulate(prev, next, fix, accuracy, false);
    return next;
  }

  const offLimit = offRouteThreshold(accuracy);
  const onLimit = offLimit * NAV.BACK_ON_ROUTE_RATIO;

  // ── Where on the route is this fix? ───────────────────────
  const nearest = projectOnRoute(
    route, fix.lat, fix.lng,
    prev.progress == null ? { preferEarliestWithin: NAV.INITIAL_TIE_M } : {},
  );
  next.nearest = nearest;

  let pick = null;
  if (prev.progress == null) {
    if (nearest && nearest.lateralMeters <= offLimit) pick = nearest;
  } else {
    // 1. Continue from the last known progress (a moving window).
    const gap = seconds == null ? Infinity : Math.max(seconds, 1.5);
    const reach = Number.isFinite(gap)
      ? Math.max(NAV.WINDOW_AHEAD_MIN_M, Math.max(next.speed ?? 0, 15) * gap * 3 + 100)
      : Infinity;
    const local = projectOnRoute(route, fix.lat, fix.lng, {
      from: prev.progress - NAV.WINDOW_BACK_M,
      to: prev.progress + reach,
    });
    if (local && local.lateralMeters <= offLimit) pick = local;

    // 2. Coming back from a detour: look where the rejoin route lands.
    if (!pick && Number.isFinite(hints.mergeProgress)) {
      const merge = projectOnRoute(route, fix.lat, fix.lng, {
        from: hints.mergeProgress - 300,
        to: hints.mergeProgress + 800,
      });
      if (merge && merge.lateralMeters <= onLimit) pick = merge;
    }

    // 3. Anywhere else on the route (a shortcut, or riding back).
    if (!pick && nearest && nearest.lateralMeters <= onLimit) pick = nearest;
  }

  // ── On-route / off-route, with hysteresis ─────────────────
  const limit = prev.offRoute ? onLimit : offLimit;
  const within = pick != null && pick.lateralMeters <= limit;

  if (within) {
    next.offRoute = false;
    next.offCount = 0;
    let progress = pick.progress;
    // A small step backwards is GPS wobble — hold the furthest point.
    // Not when coming back from a detour, though: then the rider really
    // is back there, and a turn between that spot and the point where
    // they left the route still has to be shown and announced.
    if (!prev.offRoute && prev.progress != null && progress < prev.progress &&
        prev.progress - progress <= NAV.BACKTRACK_ACCEPT_M) {
      progress = prev.progress;
    }
    next.progress = progress;
    next.lateral = pick.lateralMeters;
  } else {
    if (!prev.offRoute) {
      next.offCount = prev.offCount + 1;
      if (next.offCount >= NAV.OFF_ROUTE_CONFIRM) next.offRoute = true;
    }
    next.lateral = nearest ? nearest.lateralMeters : null;
  }

  const onRoute = within && !next.offRoute;

  // ── Arrival ───────────────────────────────────────────────
  const end = route.points[route.points.length - 1];
  const toEnd = haversineDistance(fix.lat, fix.lng, end.lat, end.lng);
  if (toEnd > NAV.ARRIVE_RELEASE_M) next.leftEndZone = true;

  const remaining = next.progress != null ? route.total - next.progress : Infinity;
  const trustworthy = accuracy <= 60;
  const reached =
    trustworthy &&
    ((onRoute && remaining <= NAV.ARRIVE_RADIUS_M) ||
      (next.leftEndZone && toEnd <= NAV.ARRIVE_RADIUS_M));

  if (reached) next.arrived = true;
  else if (prev.arrived && toEnd > NAV.ARRIVE_RELEASE_M && remaining > NAV.ARRIVE_RELEASE_M) {
    next.arrived = false; // rode on past the finish
  }

  accumulate(prev, next, fix, accuracy, onRoute);
  return next;
}

// ============================================================
// REJOIN ROUTE (the purple line)
// ============================================================

// Where should an off-route rider be sent?
//
// NOT the nearest point of the route — that is usually behind them. The
// target is a point AHEAD on the route, further ahead the further they
// have strayed. The road route to it normally touches the main route
// earlier, and buildRejoin() cuts the purple line at that first touch.
export function planRejoinTarget(route, state) {
  const base = state.progress ?? 0;
  const fix = state.lastFix;
  const ahead = fix
    ? projectOnRoute(route, fix.lat, fix.lng, { from: Math.max(0, base - 100) })
    : null;
  const near = ahead || state.nearest;

  const lateral = near ? near.lateralMeters : 0;
  const lookahead = clamp(lateral * 2, NAV.REJOIN_LOOKAHEAD_MIN_M, NAV.REJOIN_LOOKAHEAD_MAX_M);

  let progress = Math.min(route.total, Math.max(base, near ? near.progress : base) + lookahead);
  if (route.total - progress < 80) progress = route.total; // close enough: aim for the finish

  const point = pointAtProgress(route, progress);
  return { lat: point.lat, lng: point.lng, progress };
}

// Turn a road route (rider → target) into the rejoin leg: the part of it
// that is NOT yet on the main route, plus where the two meet.
//
// Returns {
//   route          indexed rejoin leg with its own turn-by-turn steps,
//                  or null when the rider is effectively beside the route
//   mergeProgress  progress on the MAIN route where the leg joins it
//   mergePoint     { lat, lng } of that junction
//   length         metres of the rejoin leg
// } — or null when the road route is unusable.
export function buildRejoin(mainRoute, found, fromProgress = 0) {
  const full = buildNavRoute(found?.coordinates, found?.steps, { duration: found?.duration });
  if (!full || !mainRoute) return null;

  const { points, cumulative } = full;
  const floor = Math.max(0, fromProgress - 150);
  const lastIndex = points.length - 1;

  // First place the path settles onto the main route and STAYS there.
  // (A single near point is just the two roads crossing.)
  let runStart = -1;
  let runHit = null;
  let merge = null;
  for (let k = 0; k <= lastIndex; k++) {
    const hit = projectOnRoute(mainRoute, points[k].lat, points[k].lng, { from: floor });
    if (hit && hit.lateralMeters <= NAV.MERGE_TOLERANCE_M) {
      if (runStart < 0) { runStart = k; runHit = hit; }
      if (cumulative[k] - cumulative[runStart] >= NAV.MERGE_SUSTAIN_M || k === lastIndex) {
        merge = { index: runStart, hit: runHit };
        break;
      }
    } else {
      runStart = -1;
      runHit = null;
    }
  }

  if (!merge) {
    const tail = points[lastIndex];
    const hit =
      projectOnRoute(mainRoute, tail.lat, tail.lng, { from: floor }) ||
      projectOnRoute(mainRoute, tail.lat, tail.lng);
    if (!hit) return null;
    merge = { index: lastIndex, hit };
  }

  const junction = points[merge.index];
  const mergePoint = { lat: junction.lat, lng: junction.lng };
  const length = cumulative[merge.index];

  // The road route starts on the main route already → no leg to draw.
  if (merge.index < 1 || !(length > 0)) {
    return { route: null, mergeProgress: merge.hit.progress, mergePoint, length: 0 };
  }

  const steps = full.steps
    .filter((step) => step.maneuverType !== "arrive" && step.progress < length - 5)
    .map((step, index) => ({ ...step, index }));
  steps.push({
    instruction: "Rejoin your route",
    maneuverType: "rejoin",
    maneuverModifier: "",
    icon: "maneuverMerge",
    name: "",
    distance: 0,
    duration: 0,
    location: [junction.lng, junction.lat],
    progress: length,
    index: steps.length,
  });

  return {
    route: {
      points: points.slice(0, merge.index + 1),
      cumulative: cumulative.slice(0, merge.index + 1),
      total: length,
      steps,
      duration: full.duration ? full.duration * (length / full.total) : null,
    },
    mergeProgress: merge.hit.progress,
    mergePoint,
    length,
  };
}

// Follow the rider along the rejoin leg: how much of it is left, and
// whether they have strayed from IT (which means a new one is needed).
export function trackRejoin(rejoin, fix, limit) {
  if (!rejoin) return rejoin;

  if (!rejoin.route) {
    return {
      ...rejoin,
      progress: 0,
      lateral: 0,
      stray: 0,
      remaining: haversineDistance(fix.lat, fix.lng, rejoin.mergePoint.lat, rejoin.mergePoint.lng),
    };
  }

  const done = rejoin.progress ?? 0;
  const hit =
    projectOnRoute(rejoin.route, fix.lat, fix.lng, { from: done - NAV.WINDOW_BACK_M }) ||
    projectOnRoute(rejoin.route, fix.lat, fix.lng);
  if (!hit) return rejoin;

  const off = hit.lateralMeters > limit;
  const progress = off ? done : Math.max(done, hit.progress);
  return {
    ...rejoin,
    progress,
    lateral: hit.lateralMeters,
    stray: off ? (rejoin.stray ?? 0) + 1 : 0,
    remaining: Math.max(0, rejoin.route.total - progress),
  };
}

// ============================================================
// OUTPUT — everything the UI needs, in one plain object
// ============================================================

// Two wordings for the same situation. A rider who starts a ride in a car
// park or on a beach has not "left" anything yet — telling them they are
// "off route" before they have moved reads like a mistake. `joining` is
// true until the rider has been on the route once.
const rejoinStep = (instruction) => Object.freeze({
  instruction,
  maneuverType: "rejoin",
  maneuverModifier: "",
  icon: "maneuverMerge",
});
const SEARCHING_STEP = rejoinStep("Finding the way back to your route…");
const SEARCHING_STEP_JOINING = rejoinStep("Finding the way to your route…");
const RETURN_STEP = rejoinStep("Head back to your route");
const RETURN_STEP_JOINING = rejoinStep("Head to your route");

// "Rejoin your route" (end of the purple leg) → "Join your route"
const asJoining = (step) =>
  step && step.maneuverType === "rejoin" && step.instruction === "Rejoin your route"
    ? { ...step, instruction: "Join your route" }
    : step;

// status: "locating" (no GPS fix yet) | "on-route" | "off-route" | "arrived"
export function describeNav(route, state, rejoin = null, ride = null, now = null) {
  const fix = state.lastFix;
  const nav = {
    route,
    hasRoute: Boolean(route),
    status: !fix ? "locating" : state.arrived ? "arrived" : state.offRoute ? "off-route" : "on-route",
    position: fix ? { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy } : null,
    progress: state.progress,          // metres along the main route
    total: route ? route.total : Number(ride?.distanceMeters) || null,
    fraction: 0,                       // 0..1 of the route completed
    lateral: state.lateral,
    traveled: state.traveled,          // metres actually ridden
    speed: state.speed,
    heading: state.heading,

    step: null,                        // the next instruction to show
    stepKey: null,                     // changes whenever `step` is a different maneuver
    stepDistance: null,                // metres to it (null = unknown)
    then: null,                        // the instruction right after it
    stepIndex: 0,                      // position in the main route's step list
    currentRoad: "",

    remainingDistance: null,           // metres along the road
    remainingTime: null,               // seconds
    eta: null,                         // arrival time (ms since epoch)

    mergeProgress: null,               // where the rejoin leg meets the main route
    rejoin: null,                      // { distance, ready, failed, line }
    // Off the route without ever having been on it (the ride starts away
    // from the road): the UI says "head to your route", not "off route".
    joining: Boolean(route && fix && state.offRoute && !state.arrived && state.progress == null),
  };

  if (!route) {
    // No geometry stored: only straight-line figures are possible.
    if (fix && Number.isFinite(ride?.destinationLat) && Number.isFinite(ride?.destinationLng)) {
      const left = haversineDistance(fix.lat, fix.lng, ride.destinationLat, ride.destinationLng);
      nav.remainingDistance = left;
      const planned = Number(ride.distanceMeters);
      const seconds = Number(ride.durationSeconds);
      if (planned > 0 && seconds > 0) nav.remainingTime = left / (planned / seconds);
    }
  } else if (state.arrived) {
    const last = route.steps[route.steps.length - 1] || null;
    nav.step = last;
    nav.stepKey = "arrived";
    nav.stepIndex = Math.max(0, route.steps.length - 1);
    nav.stepDistance = 0;
    nav.remainingDistance = 0;
    nav.remainingTime = 0;
    nav.fraction = 1;
  } else if (!state.offRoute) {
    const progress = state.progress ?? 0;
    const upcoming = nextStepAt(route, progress);
    if (upcoming) {
      nav.step = upcoming.step;
      nav.stepKey = `main:${upcoming.index}`;
      nav.stepIndex = upcoming.index;
      nav.stepDistance = upcoming.distance;
      nav.then = upcoming.then;
      nav.currentRoad = upcoming.currentRoad;
    }
    nav.remainingDistance = route.total - progress;
    nav.remainingTime = remainingDuration(route, progress);
    nav.fraction = progress / route.total;
  } else {
    const left = state.progress ?? 0;
    nav.fraction = left / route.total;

    if (rejoin) {
      const distance = rejoin.remaining ?? rejoin.length ?? 0;
      const mergeAt = clamp(rejoin.mergeProgress, 0, route.total);
      nav.mergeProgress = mergeAt;

      const tail = rejoin.route
        ? sliceRoute(rejoin.route, rejoin.progress ?? 0, rejoin.route.total)
        : [[rejoin.mergePoint.lat, rejoin.mergePoint.lng]];
      nav.rejoin = {
        distance,
        ready: Boolean(rejoin.route),
        failed: Boolean(rejoin.failed),
        // From the rider's real position, then along the rest of the leg.
        line: fix ? [[fix.lat, fix.lng], ...tail] : tail,
        mergePoint: rejoin.mergePoint,
      };

      if (rejoin.route) {
        const upcoming = nextStepAt(rejoin.route, rejoin.progress ?? 0);
        if (upcoming) {
          nav.step = nav.joining ? asJoining(upcoming.step) : upcoming.step;
          nav.stepKey = `rejoin:${rejoin.id}:${upcoming.index}`;
          nav.stepDistance = upcoming.distance;
          nav.then = nav.joining ? asJoining(upcoming.then) : upcoming.then;
          nav.currentRoad = upcoming.currentRoad;
        }
      } else {
        nav.step = nav.joining ? RETURN_STEP_JOINING : RETURN_STEP;
        nav.stepKey = `rejoin:${rejoin.id}:return`;
        nav.stepDistance = distance;
      }

      const legSeconds = rejoin.route
        ? remainingDuration(rejoin.route, rejoin.progress ?? 0)
        : distance / 8; // ≈ 30 km/h when only a straight estimate exists
      nav.remainingDistance = distance + (route.total - mergeAt);
      nav.remainingTime = (legSeconds ?? 0) + (remainingDuration(route, mergeAt) ?? 0);
      nav.stepIndex = nextStepAt(route, mergeAt)?.index ?? 0;
    } else {
      // The way back is still being calculated.
      const near = state.nearest;
      const from = Math.max(left, near ? near.progress : left);
      nav.step = nav.joining ? SEARCHING_STEP_JOINING : SEARCHING_STEP;
      nav.stepKey = "rejoin:searching";
      nav.remainingDistance = (near ? near.lateralMeters : 0) + (route.total - from);
      nav.remainingTime = remainingDuration(route, from);
      nav.stepIndex = nextStepAt(route, from)?.index ?? 0;
    }
  }

  if (now != null && Number.isFinite(nav.remainingTime)) {
    nav.eta = now + nav.remainingTime * 1000;
  }
  return nav;
}

// ============================================================
// VOICE — what should be spoken right now, if anything
//
// Pure decision function: give it the memo it returned last time and the
// current nav output; it returns { memo, say } where `say` is a sentence
// or null. Each maneuver is announced at most three times:
//   preview   when it becomes the next turn and is still far away
//   approach  ~12 seconds before it
//   now       at the turn
// ============================================================
export function nextAnnouncement(previousMemo, nav) {
  const memo = { status: null, stepKey: null, stage: 0, ...(previousMemo || {}) };
  if (!nav || nav.status === "locating") return { memo, say: null };

  // ── Status changes ──
  if (nav.status !== memo.status) {
    const before = memo.status;
    memo.status = nav.status;
    memo.stepKey = null;
    memo.stage = 0;
    if (nav.status === "arrived") return { memo, say: "You have arrived at your destination." };
    if (nav.status === "off-route") {
      memo.joined = !nav.joining;
      return {
        memo,
        say: nav.joining
          ? "Follow the purple line to reach your route."
          : "You have left the route. Follow the purple line to get back on it.",
      };
    }
    if (nav.status === "on-route" && before === "off-route") {
      const say = memo.joined === false ? "You are on your route." : "You are back on your route.";
      memo.joined = true;
      return { memo, say };
    }
  }

  const step = nav.step;
  const distance = nav.stepDistance;
  if (nav.status === "arrived" || !step || distance == null || !step.instruction) {
    return { memo, say: null };
  }

  const type = step.maneuverType;
  const speed = Number.isFinite(nav.speed) ? nav.speed : 8;
  const approachAt = clamp(speed * 12, 120, 400);
  const nowAt = clamp(speed * 3, 25, 60);
  const phrase = (text) => (text.endsWith("…") ? text : `${text}.`);
  const words = spokenInstruction(step);

  // ── A different maneuver became "next" ──
  if (nav.stepKey !== memo.stepKey) {
    memo.stepKey = nav.stepKey;
    memo.stage = 0;
    // The road merely changes its name: shown on screen, not worth saying.
    if (isMinorStep(step)) { memo.stage = 3; return { memo, say: null }; }
    if (type === "depart") {
      memo.stage = 3;
      return { memo, say: phrase(words) };
    }
    if (distance > approachAt + 150) {
      memo.stage = 1;
      return { memo, say: `In ${spokenDistance(distance)}, ${phrase(lowerFirst(words))}` };
    }
  }

  // ── At the turn ──
  if (memo.stage < 3 && distance <= nowAt) {
    memo.stage = 3;
    if (type === "arrive") return { memo, say: null }; // "arrived" speaks for itself
    const tail = nav.then && !isMinorStep(nav.then)
      ? `, then ${lowerFirst(spokenInstruction(nav.then))}`
      : "";
    return { memo, say: phrase(`${words}${tail}`) };
  }

  // ── Approaching it ──
  if (memo.stage < 2 && distance <= approachAt) {
    memo.stage = 2;
    return { memo, say: `In ${spokenDistance(distance)}, ${phrase(lowerFirst(words))}` };
  }

  return { memo, say: null };
}

// A step that needs no action from the rider (the road only changes name,
// or simply carries on) — it is displayed but never spoken.
function isMinorStep(step) {
  const type = step?.maneuverType;
  if (type === "new name" || type === "use lane" || type === "notification") return true;
  if (type === "continue") {
    const modifier = step.maneuverModifier || "straight";
    return modifier === "straight";
  }
  return false;
}

// The instruction as it should be SPOKEN: road numbers in brackets
// ("Anna Salai (SH 88)") are dropped — they read badly aloud.
function spokenInstruction(step) {
  return String(step?.instruction || "").replace(/\s*\([^)]*\)/g, "").trim();
}
