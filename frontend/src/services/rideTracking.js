// ============================================================
// 📏 rideTracking.js — Distance-travelled math for active rides
//
// Pure, dependency-free helpers used by the useRideDistance() hook.
// Keeping the math here (instead of inside the overlay) makes it
// testable and reusable by any future screen.
//
// EXPORTS:
//   parseRouteCoordinates(raw)      → [{ lat, lng }] (OSRM [lng,lat] → objects)
//   buildRouteIndex(raw)            → { points, cumulative, total }
//   projectOnRoute(index, lat, lng) → { progress, lateralMeters }
//   nextDistanceUpdate({...})       → next accumulation state
//
// GPS GATES (edge cases from the feature spec):
//   • accuracy  > MAX_ACCURACY_M  → fix rejected (Wi-Fi/IP level noise)
//   • implied speed > MAX_SPEED_MPS → GPS jump: re-anchor, add nothing
//   • movement  < MIN_MOVE_M      → ignore (stationary jitter)
//   • projection behind previous progress → clamp (never subtract)
// ============================================================

import { haversineDistance } from "./routingApi";

export const MAX_ACCURACY_M = 50;   // reject fixes with accuracy worse than this
export const MAX_SPEED_MPS  = 42;   // ≈151 km/h — anything faster is a GPS jump
export const MIN_MOVE_M     = 2;    // sub-2 m movement is treated as jitter
export const MAX_SNAP_M     = 120;  // further than this from the route → don't snap

// ---------------------------------------------------------------------------
// PARSE ROUTE COORDINATES
// The backend stores OSRM geometry as a JSON string of [lng, lat] pairs
// (GeoJSON order). We normalise it to [{ lat, lng }] and drop junk.
// ---------------------------------------------------------------------------
export function parseRouteCoordinates(raw) {
  if (!raw) return [];

  let arr = raw;
  if (typeof raw === "string") {
    try { arr = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(arr)) return [];

  const points = [];
  for (const pt of arr) {
    if (!Array.isArray(pt) || pt.length < 2) continue;
    const lng = Number(pt[0]); // GeoJSON order: [lng, lat]
    const lat = Number(pt[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) points.push({ lat, lng });
  }
  return points;
}

// ---------------------------------------------------------------------------
// BUILD ROUTE INDEX
// Pre-computes the cumulative distance (metres) to every vertex so that
// "distance along the route" between two projections is a subtraction.
// Returns null when there aren't enough points to form a route.
// ---------------------------------------------------------------------------
export function buildRouteIndex(raw) {
  const points = parseRouteCoordinates(raw);
  if (points.length < 2) return null;

  const cumulative = new Array(points.length).fill(0);
  for (let i = 1; i < points.length; i++) {
    cumulative[i] =
      cumulative[i - 1] +
      haversineDistance(
        points[i - 1].lat, points[i - 1].lng,
        points[i].lat,     points[i].lng
      );
  }

  return { points, cumulative, total: cumulative[cumulative.length - 1] };
}


// ---------------------------------------------------------------------------
// PROJECT ON ROUTE — snap a GPS fix onto the polyline
//
// For every segment we work in a local flat-earth plane centred on the fix
// (metres), project the fix onto the segment, clamp to the segment ends and
// keep the closest hit. Returns the distance travelled ALONG the route up to
// that projection, plus how far off-route the fix is.
// ---------------------------------------------------------------------------
export function projectOnRoute(index, lat, lng) {
  if (!index || index.points.length < 2) return null;

  const { points, cumulative } = index;
  const mPerDegLat = 111_320;                                   // metres per degree latitude
  const mPerDegLng = 111_320 * Math.cos((lat * Math.PI) / 180); // shrinks towards the poles

  let best = null;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const segLen = cumulative[i + 1] - cumulative[i];
    if (segLen <= 0) continue;

    // Segment endpoints relative to the fix, in metres
    const ax = (a.lng - lng) * mPerDegLng, ay = (a.lat - lat) * mPerDegLat;
    const bx = (b.lng - lng) * mPerDegLng, by = (b.lat - lat) * mPerDegLat;

    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;

    // Fraction along the segment (0 = a, 1 = b), clamped to the segment
    let t = len2 > 0 ? -(ax * dx + ay * dy) / len2 : 0;
    t = Math.min(1, Math.max(0, t));

    const px = ax + t * dx;
    const py = ay + t * dy;
    const lateralMeters = Math.hypot(px, py);

    if (!best || lateralMeters < best.lateralMeters) {
      best = {
        progress: cumulative[i] + t * segLen, // metres along the route
        lateralMeters,
      };
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// NEXT DISTANCE UPDATE — the accumulation state machine
//
// INPUT:
//   prev          — previously accepted fix (null on the very first fix)
//   fix           — the new GPS fix from locationService
//   index         — buildRouteIndex() result (or null for straight-line mode)
//   traveled      — metres accumulated so far
//   routeProgress — metres along the route at the previous accepted fix
//
// OUTPUT: { traveled, routeProgress, anchor, reason }
//   reason ∈ anchored | accuracy | jump | route | route-init | route-back
//            | stationary | straight
// ---------------------------------------------------------------------------
export function nextDistanceUpdate({ prev, fix, index, traveled, routeProgress }) {
  if (!fix) {
    return { traveled, routeProgress, anchor: prev, reason: "stationary" };
  }

  // ── GATE 1: poor accuracy → ignore the fix entirely and keep the old
  // anchor, so a noisy point can never inject distance.
  if (fix.accuracy != null && fix.accuracy > MAX_ACCURACY_M) {
    return { traveled, routeProgress, anchor: prev, reason: "accuracy" };
  }

  // ── First usable fix → just anchor; there's nothing to measure yet
  if (!prev) {
    return { traveled, routeProgress, anchor: fix, reason: "anchored" };
  }

  const dtSec = Math.max((fix.timestamp - prev.timestamp) / 1000, 0.001);
  const straightDist = haversineDistance(prev.lat, prev.lng, fix.lat, fix.lng);
  const impliedSpeed = straightDist / dtSec; // m/s

  // ── GATE 2: teleport → don't count it, but re-anchor so the ride can
  // continue from the new position.
  if (straightDist > MIN_MOVE_M && impliedSpeed > MAX_SPEED_MPS) {
    return { traveled, routeProgress, anchor: fix, reason: "jump" };
  }

  // ── Preferred: accumulate ALONG THE ROUTE (route-accurate mode)
  if (index) {
    const projection = projectOnRoute(index, fix.lat, fix.lng);

    // Only trust the projection when the rider is actually near the route
    if (projection && projection.lateralMeters <= MAX_SNAP_M) {
      // First route fix → initialise progress here, add nothing
      if (routeProgress == null) {
        return {
          traveled,
          routeProgress: projection.progress,
          anchor: fix,
          reason: "route-init",
        };
      }

      const delta = projection.progress - routeProgress;

      if (delta >= MIN_MOVE_M) {
        return {
          traveled: traveled + delta,
          routeProgress: projection.progress,
          anchor: fix,
          reason: "route",
        };
      }

      // GPS wobble behind the last progress → keep the high-water mark so
      // distance is never subtracted.
      return { traveled, routeProgress, anchor: fix, reason: "route-back" };
    }
  }

  // ── Fallback: straight line between consecutive accepted fixes
  if (straightDist < MIN_MOVE_M) {
    return { traveled, routeProgress, anchor: fix, reason: "stationary" };
  }

  return {
    traveled: traveled + straightDist,
    routeProgress,
    anchor: fix,
    reason: "straight",
  };
}
