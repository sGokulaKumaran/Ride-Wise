// ============================================================
// useFleet.js — small hooks the organization / fleet screens share
//
//   useLoad(key, load)          fetch something, keep it, reload it
//   useNow(everyMs)             a clock that ticks (for "seen 2 min ago")
//   useDebounced(action, ms)    run something once after a burst of calls
//   useFleetWatch(target, on)   live events for a vehicle or a fleet
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { watchFleet } from "../../services/fleetSocket";

// ── useLoad ──────────────────────────────────────────────────
// const { data, error, loading, reload, setData } = useLoad(key, load)
//
//   key      identifies WHAT is loaded ("org-12"); a new key loads again
//            and the old data is not shown for the new key. null = idle.
//   load     () => Promise — may change every render, the newest is used
//
//   loading  true until the first answer for this key
//   reload   fetch again, keeping what is shown until the answer arrives
//   setData  change the kept data in place (live updates)
//
// An answer that arrives after the key changed, or after a newer request
// was started, is dropped.
export function useLoad(key, load) {
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });

  const [tick, setTick] = useState(0);
  const [result, setResult] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    if (key == null) return undefined;
    let cancelled = false;
    Promise.resolve()
      .then(() => loadRef.current())
      .then((data) => { if (!cancelled) setResult({ key, data, error: null }); })
      .catch((error) => {
        if (cancelled) return;
        // A failed RELOAD keeps what is on screen; a failed first load has nothing to keep.
        setResult((previous) => ({ key, data: previous.key === key ? previous.data : null, error }));
      });
    return () => { cancelled = true; };
  }, [key, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  const setData = useCallback((next) => {
    setResult((previous) => ({
      ...previous,
      data: typeof next === "function" ? next(previous.data) : next,
    }));
  }, []);

  const current = key != null && result.key === key;
  return {
    data: current ? result.data : null,
    error: current ? result.error : null,
    loading: key != null && !current,
    reload,
    setData,
  };
}

// ── useNow ───────────────────────────────────────────────────
// Rendering must not read the clock by itself, so "how long ago" figures
// read this ticking value instead.
export function useNow(everyMs = 5000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

// ── useDebounced ─────────────────────────────────────────────
// const reloadSoon = useDebounced(reload, 250)
// Several live events often arrive together (a trip ends → "session-ended"
// and "vehicle-changed"); one reload answers them all.
export function useDebounced(action, delayMs = 250) {
  const actionRef = useRef(action);
  useEffect(() => { actionRef.current = action; });

  const [calls, setCalls] = useState(0);
  useEffect(() => {
    if (calls === 0) return undefined;
    const timer = setTimeout(() => actionRef.current(), delayMs);
    return () => clearTimeout(timer);
  }, [calls, delayMs]);

  return useCallback(() => setCalls((value) => value + 1), []);
}

// ── useFleetWatch ────────────────────────────────────────────
// Live events for one vehicle ({ vehicleId }) or one fleet ({ orgId }).
//
//   onEvent(message)   position, session-started, session-ended, sos, …
//   onSync()           the watch is (re)established — reload over REST now,
//                      so nothing that happened while disconnected is missed
//
// Returns { status, denied }:
//   status  "connecting" | "connected" | "disconnected"
//   denied  the server's reason when watching is not allowed
export function useFleetWatch(target, { onEvent, onSync } = {}) {
  const vehicleId = target?.vehicleId ?? null;
  const orgId = target?.orgId ?? null;
  const enabled = vehicleId != null || orgId != null;

  const handlersRef = useRef({ onEvent, onSync });
  useEffect(() => { handlersRef.current = { onEvent, onSync }; });

  const [state, setState] = useState({ key: null, status: "connecting", denied: null });
  const key = enabled ? `${vehicleId ?? ""}|${orgId ?? ""}` : null;

  useEffect(() => {
    if (key == null) return undefined;
    const patch = (changes) => setState((previous) => ({
      ...(previous.key === key ? previous : { status: "connecting", denied: null }),
      key,
      ...changes,
    }));

    return watchFleet(vehicleId != null ? { vehicleId } : { orgId }, {
      onEvent: (message) => handlersRef.current.onEvent?.(message),
      onWatching: () => {
        patch({ status: "connected", denied: null });
        handlersRef.current.onSync?.();
      },
      onDenied: (message) => patch({ denied: message || "You can no longer see this." }),
      onStatus: (status) => { if (status === "disconnected") patch({ status: "disconnected" }); },
    });
  }, [key, vehicleId, orgId]);

  const current = state.key === key;
  return {
    status: current ? state.status : "connecting",
    denied: current ? state.denied : null,
  };
}
