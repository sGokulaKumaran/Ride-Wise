// ============================================================
// 📏 useRideDistance — live "distance travelled" for active rides
//
// Feed it the latest GPS fix (the overlay already has one from
// locationService.watchLocation) and it returns how far the rider has
// actually ridden, in metres.
//
//   const { distanceTraveled, usingRoute } = useRideDistance(myLocation, {
//     routeCoordinates: ride?.routeCoordinates,
//     rideId: ride?.id,
//     paused: minimized,          // stop counting while minimized/backgrounded
//   });
//
// BEHAVIOUR
//   • Accumulates along the stored route polyline when one is available
//     (snap-to-route) and falls back to straight-line haversine otherwise.
//   • Filters GPS noise: accuracy > 50 m and impossible speed spikes are
//     rejected (see services/rideTracking.js).
//   • PAUSED (minimized / tab hidden) → the rider still gets re-anchored on
//     every fix, so the skipped stretch is never added later.
//   • Resets automatically when a different ride starts.
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { buildRouteIndex, nextDistanceUpdate } from "../../services/rideTracking";

export function useRideDistance(location, { routeCoordinates, rideId, paused = false } = {}) {
  const [distanceTraveled, setDistanceTraveled] = useState(0);

  const prevFixRef       = useRef(null);  // last accepted GPS fix
  const traveledRef      = useRef(0);     // mirror of distanceTraveled (no re-render churn)
  const routeProgressRef = useRef(null);  // metres along the route at prevFix
  const hiddenRef        = useRef(false); // true while the tab/app is backgrounded
  const rideIdRef        = useRef(rideId); // ride id the refs above belong to

  // Route polyline index — rebuilt only when the ride's route changes
  const index = useMemo(() => buildRouteIndex(routeCoordinates), [routeCoordinates]);

  // ── RESET on new ride start ──
  // Done during render (React's documented "adjust state when a prop changes"
  // pattern) — an effect would cause a cascading render. The refs are reset in
  // the accumulation effect below, before the first fix of the new ride.
  const [trackedRideId, setTrackedRideId] = useState(rideId);
  if (rideId !== trackedRideId) {
    setTrackedRideId(rideId);
    setDistanceTraveled(0);
  }

  // ── PAUSE while the tab/app is in the background ──
  useEffect(() => {
    const onVisibility = () => { hiddenRef.current = document.hidden; };
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // ── ACCUMULATE on every GPS fix ──
  useEffect(() => {
    // New ride → drop the previous ride's tracking refs before the first fix
    if (rideIdRef.current !== rideId) {
      rideIdRef.current        = rideId;
      prevFixRef.current       = null;
      traveledRef.current      = 0;
      routeProgressRef.current = null;
    }

    if (!location) return;

    const shouldSkip = paused || hiddenRef.current;

    const next = shouldSkip
      // Paused: keep re-anchoring so the skipped stretch is never counted
      ? {
          traveled: traveledRef.current,
          routeProgress: routeProgressRef.current,
          anchor: location,
          reason: "paused",
        }
      : nextDistanceUpdate({
          prev: prevFixRef.current,
          fix: location,
          index,
          traveled: traveledRef.current,
          routeProgress: routeProgressRef.current,
        });

    prevFixRef.current = next.anchor ?? (shouldSkip ? location : prevFixRef.current);
    routeProgressRef.current = next.routeProgress ?? routeProgressRef.current;

    if (next.traveled !== traveledRef.current) {
      traveledRef.current = next.traveled;
      setDistanceTraveled(next.traveled);
    }
  }, [location, paused, index, rideId]);

  return {
    distanceTraveled,
    usingRoute: Boolean(index),
  };
}
