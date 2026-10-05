// ============================================================
// useRiderRejoinLines — where the OTHER riders of a group are
// relative to the shared route
//
//   const { status, lines } = useRiderRejoinLines(route, riders, enabled);
//
//   status[userId]  { offRoute, distance }  — computed locally on every
//                   render (no network): how far that rider is from the
//                   route. Drives the "off route" label in the riders panel.
//   lines[userId]   [[lat, lng], …] — a road path from an off-route rider
//                   back to the route, drawn dashed in their colour.
//
// The old version asked the routing server for every off-route rider on
// every 150 m of movement, from every viewer's device at once, and
// redrew lines from stale replies. This one:
//   • detects "off route" against road SEGMENTS, not vertices
//   • sends background-priority requests, so the viewer's own reroute
//     always goes first
//   • re-plans a rider only after 200 m of movement or 90 s
//   • draws at most MAX_LINES lines
//   • shows a straight dashed line when no road path is available
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import {
  projectOnRoute,
  planRejoinTarget,
  buildRejoin,
  routeLatLngs,
  sliceRoute,
  offRouteThreshold,
} from "../../services/navigation";
import { fetchRoutes, haversineDistance } from "../../services/routingApi";

const MAX_LINES = 4;
const REPLAN_MOVE_M = 200;
const REPLAN_AFTER_MS = 90_000;
// Other riders' positions arrive less often and less precisely than our
// own, so the bar for calling them "off route" is a little higher.
const OFF_ROUTE_FLOOR_M = 80;

export function useRiderRejoinLines(route, riders, enabled) {
  const [paths, setPaths] = useState({});   // userId → { points, from }
  const cacheRef = useRef({});              // userId → { at, time, controller }

  // ── Who is off the route? (pure, no network) ──
  const status = useMemo(() => {
    const result = {};
    if (!route) return result;
    for (const rider of riders || []) {
      if (!Number.isFinite(rider.lat) || !Number.isFinite(rider.lng)) continue;
      const near = projectOnRoute(route, rider.lat, rider.lng);
      if (!near) continue;
      const limit = Math.max(OFF_ROUTE_FLOOR_M, offRouteThreshold(rider.accuracy));
      result[String(rider.userId)] = {
        offRoute: near.lateralMeters > limit,
        distance: near.lateralMeters,
        near,
      };
    }
    return result;
  }, [route, riders]);

  // ── Fetch a road path for riders who need one ──
  useEffect(() => {
    const cache = cacheRef.current;
    const wanted = enabled && route
      ? (riders || []).filter((rider) => status[String(rider.userId)]?.offRoute).slice(0, MAX_LINES)
      : [];
    const wantedIds = new Set(wanted.map((rider) => String(rider.userId)));

    // Riders who are back on the route (or gone): stop their requests.
    for (const id of Object.keys(cache)) {
      if (!wantedIds.has(id)) {
        cache[id].controller?.abort();
        delete cache[id];
      }
    }

    const now = Date.now();
    for (const rider of wanted) {
      const id = String(rider.userId);
      const entry = cache[id] || (cache[id] = { at: null, time: 0, controller: null });
      if (entry.controller) continue;

      const moved = entry.at
        ? haversineDistance(entry.at.lat, entry.at.lng, rider.lat, rider.lng)
        : Infinity;
      if (moved < REPLAN_MOVE_M && now - entry.time < REPLAN_AFTER_MS) continue;

      const near = status[id].near;
      const from = { lat: rider.lat, lng: rider.lng };
      const target = planRejoinTarget(route, {
        progress: near.progress,
        lastFix: { lat: rider.lat, lng: rider.lng, accuracy: rider.accuracy },
        nearest: near,
      });

      const controller = new AbortController();
      entry.controller = controller;
      entry.at = from;
      entry.time = now;

      fetchRoutes(from, { lat: target.lat, lng: target.lng }, { signal: controller.signal, priority: 0 })
        .then((routes) => {
          if (controller.signal.aborted) return;
          const built = buildRejoin(route, routes[0], near.progress);
          const end = built?.mergePoint ?? target;
          setPaths((previous) => ({
            ...previous,
            [id]: { leg: built?.route ?? null, end: [end.lat, end.lng] },
          }));
        })
        .catch((err) => {
          if (err?.name === "AbortError" || controller.signal.aborted) return;
          // No road path: a straight line to the nearest point of the route.
          setPaths((previous) => ({ ...previous, [id]: { leg: null, end: [near.lat, near.lng] } }));
        })
        .finally(() => {
          if (entry.controller === controller) entry.controller = null;
        });
    }
  }, [enabled, route, riders, status]);

  // Stop everything when the map closes.
  useEffect(() => {
    const cache = cacheRef.current;
    return () => {
      Object.values(cache).forEach((entry) => entry.controller?.abort());
    };
  }, []);

  // ── Lines to draw: only for riders who are STILL off the route. Each
  // starts at the rider's current position and covers only the part of
  // the path that is still ahead of them. ──
  const lines = useMemo(() => {
    const result = {};
    if (!enabled) return result;
    for (const rider of riders || []) {
      const id = String(rider.userId);
      const path = paths[id];
      if (!path || !status[id]?.offRoute) continue;

      let ahead = [path.end];
      if (path.leg) {
        const at = projectOnRoute(path.leg, rider.lat, rider.lng);
        ahead = at ? sliceRoute(path.leg, at.progress, path.leg.total) : routeLatLngs(path.leg);
        if (!ahead.length) ahead = [path.end];
      }
      result[id] = [[rider.lat, rider.lng], ...ahead];
    }
    return result;
  }, [enabled, riders, paths, status]);

  return { status, lines };
}
