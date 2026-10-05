// ============================================================
// useNavigation — live navigation state for an active ride
//
// Connects the pure engine (services/navigation.js) to React:
//
//   const { nav, pushFix } = useNavigation(ride);
//   watchLocation((fix) => pushFix(fix), …);
//
//   nav       one plain object with everything the map screen shows:
//             status, next turn + distance, remaining distance/time, ETA,
//             distance ridden, the rejoin line when off-route … (see
//             describeNav() in services/navigation.js)
//   pushFix   feed it every GPS fix
//
// WHAT LIVES HERE (and not in the engine)
//   • fetching the rejoin route from the routing service when the rider
//     leaves the route, re-fetching only when they stray from IT, and
//     dropping answers that arrive after the situation changed
//   • remembering progress + distance ridden per ride in localStorage,
//     so closing the map or reloading the page mid-ride does not reset
//     "ridden" to zero
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildNavRoute,
  createNavState,
  advanceNav,
  describeNav,
  planRejoinTarget,
  buildRejoin,
  trackRejoin,
  offRouteThreshold,
} from "../../services/navigation";
import { fetchRoutes, haversineDistance } from "../../services/routingApi";

const STORE_PREFIX = "ridewise-nav-";
const SAVE_EVERY_MS = 5000;
const REPLAN_MIN_MS = 5000;        // never ask for a rejoin route more often
const RETRY_AFTER_MS = 10_000;     // …and wait this long after a failure
const CONNECTOR_REFRESH_M = 150;   // re-check a straight connector after this much movement

// ── Per-ride progress storage ────────────────────────────────
export function loadNavProgress(rideId) {
  if (rideId == null) return null;
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_PREFIX + rideId) || "null");
    if (saved && typeof saved === "object") return saved;
  } catch {
    // unreadable entry → start fresh
  }
  return null;
}

function saveNavProgress(rideId, state) {
  if (rideId == null || !state) return;
  try {
    localStorage.setItem(STORE_PREFIX + rideId, JSON.stringify({
      progress: state.progress,
      traveled: state.traveled,
      savedAt: state.lastFix?.timestamp ?? Date.now(),
    }));
  } catch {
    // storage full / unavailable — tracking still works for this session
  }
}

export function clearNavProgress(rideId) {
  if (rideId == null) return;
  try { localStorage.removeItem(STORE_PREFIX + rideId); } catch { /* ignore */ }
}

// Forget stored progress for rides that are no longer active.
export function pruneNavProgress(activeRideIds) {
  try {
    const keep = new Set((activeRideIds || []).map((id) => STORE_PREFIX + id));
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORE_PREFIX) && !keep.has(key)) localStorage.removeItem(key);
    }
  } catch {
    // storage unavailable
  }
}

export function useNavigation(ride) {
  const rideId = ride?.id ?? null;

  // The indexed route — rebuilt only when the ride's geometry changes
  // (for example when the full route arrives after a lightweight list row).
  const route = useMemo(
    () => buildNavRoute(ride?.routeCoordinates, ride?.routeSteps, { duration: ride?.durationSeconds }),
    [ride?.routeCoordinates, ride?.routeSteps, ride?.durationSeconds],
  );

  // What the screen shows before the first GPS fix.
  const idle = useMemo(
    () => describeNav(route, createNavState(loadNavProgress(rideId)), null, ride),
    [route, rideId, ride],
  );

  // Latest props for the GPS callback, which must keep a stable identity.
  const routeRef = useRef(route);
  const rideRef = useRef(ride);
  useEffect(() => {
    routeRef.current = route;
    rideRef.current = ride;
  });

  const stateRef = useRef(null);      // tracker state
  const trackedRef = useRef(null);    // { route, rideId } the tracker state belongs to
  const rejoinRef = useRef(null);     // current rejoin leg
  const planRef = useRef({ controller: null, startedAt: 0, seq: 0, retryAt: 0, from: null });
  const savedAtRef = useRef(0);

  // { route, nav } — tagged with its route so a stale result is never shown
  const [live, setLive] = useState(null);

  const publish = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    const current = routeRef.current;
    setLive({
      route: current,
      nav: describeNav(current, state, rejoinRef.current, rideRef.current, Date.now()),
    });
  }, []);

  const cancelPlan = useCallback(() => {
    const plan = planRef.current;
    plan.controller?.abort();
    plan.controller = null;
    plan.seq += 1; // anything still in flight is now out of date
  }, []);

  // ── Ask the routing service for the way back ──
  const planRejoin = useCallback((state) => {
    const current = routeRef.current;
    const plan = planRef.current;
    const fix = state.lastFix;
    if (!current || !fix || plan.controller) return;

    const target = planRejoinTarget(current, state);
    const controller = new AbortController();
    const seq = plan.seq + 1;
    plan.seq = seq;
    plan.controller = controller;
    plan.startedAt = Date.now();
    plan.from = { lat: fix.lat, lng: fix.lng };

    // A heading only helps when the rider is actually moving.
    const bearing = (state.speed ?? 0) > 2 && Number.isFinite(state.heading) ? state.heading : null;
    const stillWanted = () =>
      !controller.signal.aborted &&
      plan.seq === seq &&
      routeRef.current === current &&
      Boolean(stateRef.current?.offRoute);

    fetchRoutes(
      { lat: fix.lat, lng: fix.lng },
      { lat: target.lat, lng: target.lng },
      { bearing, signal: controller.signal },
    )
      .then((routes) => {
        if (!stillWanted()) return;
        const now = stateRef.current;
        const built = buildRejoin(current, routes[0], now.progress ?? 0);
        if (!built) throw new Error("Unusable rejoin route");
        rejoinRef.current = trackRejoin(
          { ...built, id: seq },
          now.lastFix,
          offRouteThreshold(now.lastFix.accuracy),
        );
        plan.retryAt = 0;
      })
      .catch((err) => {
        if (err?.name === "AbortError" || !stillWanted()) return;
        // No road route available right now: still show WHICH WAY the
        // route is, with a straight line, and try again shortly.
        rejoinRef.current = trackRejoin(
          {
            route: null,
            mergeProgress: target.progress,
            mergePoint: { lat: target.lat, lng: target.lng },
            length: 0,
            failed: true,
            id: seq,
          },
          stateRef.current.lastFix,
          0,
        );
        plan.retryAt = Date.now() + RETRY_AFTER_MS;
      })
      .finally(() => {
        if (plan.controller === controller) plan.controller = null;
        if (stillWanted()) publish();
      });
  }, [publish]);

  // ── Feed one GPS fix through the tracker ──
  const pushFix = useCallback((fix) => {
    if (!fix || !Number.isFinite(fix.lat) || !Number.isFinite(fix.lng)) return;

    const current = routeRef.current;
    const currentRideId = rideRef.current?.id ?? null;
    const tracked = trackedRef.current;

    // Start the tracker — or restart it when the ride or its route changed.
    if (!stateRef.current || !tracked || tracked.route !== current || tracked.rideId !== currentRideId) {
      const sameRide = tracked && tracked.rideId === currentRideId;
      const previous = sameRide ? stateRef.current : null;
      const fresh = createNavState(loadNavProgress(currentRideId));
      if (previous) {
        // Same ride, new geometry: keep what was measured so far.
        fresh.traveled = Math.max(fresh.traveled, previous.traveled);
        fresh.lastFix = previous.lastFix;
        fresh.speed = previous.speed;
        fresh.heading = previous.heading;
      }
      stateRef.current = fresh;
      trackedRef.current = { route: current, rideId: currentRideId };
      rejoinRef.current = null;
      cancelPlan();
    }

    const hints = rejoinRef.current ? { mergeProgress: rejoinRef.current.mergeProgress } : {};
    const state = advanceNav(current, stateRef.current, fix, hints);
    stateRef.current = state;

    const now = Date.now();
    if (current) {
      if (!state.offRoute) {
        // Back on the route (or never left): no rejoin leg needed.
        if (rejoinRef.current || planRef.current.controller) {
          rejoinRef.current = null;
          cancelPlan();
        }
      } else {
        if (rejoinRef.current) {
          rejoinRef.current = trackRejoin(rejoinRef.current, fix, offRouteThreshold(fix.accuracy));
        }
        const rejoin = rejoinRef.current;
        const plan = planRef.current;

        let needed;
        if (!rejoin) needed = true;                                        // just left the route
        else if (rejoin.failed) needed = now >= plan.retryAt;              // last attempt failed
        else if (rejoin.route) needed = (rejoin.stray ?? 0) >= 2;          // strayed from the purple line
        else {                                                             // straight connector
          needed = Boolean(plan.from) &&
            haversineDistance(plan.from.lat, plan.from.lng, fix.lat, fix.lng) > CONNECTOR_REFRESH_M;
        }

        if (needed && !plan.controller && now - plan.startedAt >= REPLAN_MIN_MS) planRejoin(state);
      }
    }

    if (now - savedAtRef.current >= SAVE_EVERY_MS) {
      savedAtRef.current = now;
      saveNavProgress(currentRideId, state);
    }
    publish();
  }, [cancelPlan, planRejoin, publish]);

  // The route changed under a ride that is already being tracked — typically
  // the full route arriving a moment after the map opened. Place the rider
  // on it at once with the position we already have. Without this the map
  // said "Finding your location…" until the device sent its next fix, which
  // takes many seconds when the rider is standing still.
  useEffect(() => {
    if (!route) return undefined;
    const timer = setTimeout(() => {
      const last = stateRef.current?.lastFix;
      if (last && trackedRef.current?.route !== routeRef.current) pushFix(last);
    }, 0);
    return () => clearTimeout(timer);
  }, [route, pushFix]);

  // Leaving the map: stop any request in flight and remember where we were.
  const persist = useCallback(() => {
    const tracked = trackedRef.current;
    if (tracked && stateRef.current) saveNavProgress(tracked.rideId, stateRef.current);
  }, []);

  useEffect(() => {
    const plan = planRef.current; // one object for the hook's lifetime
    window.addEventListener("pagehide", persist);
    return () => {
      window.removeEventListener("pagehide", persist);
      persist();
      plan.controller?.abort();
      plan.controller = null;
    };
  }, [persist]);

  // The live result — or, for the instant in which a new route is being
  // adopted, the idle figures WITH the rider's last position, so the dot
  // does not vanish from the map (and the camera does not let go of it).
  const nav = useMemo(() => {
    if (live && live.route === route) return live.nav;
    const last = live?.nav?.position;
    return last ? { ...idle, position: last, heading: live.nav.heading } : idle;
  }, [live, route, idle]);

  return { nav, pushFix, route };
}
