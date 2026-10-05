// ============================================================
// locationService.js — browser geolocation, made dependable
//
// Every position handed to the app comes from the device. There is no
// simulation mode and nothing is ever invented.
//
// LOCATION OBJECT
//   { lat, lng, accuracy (m), speed (m/s | null), heading (° | null), timestamp }
//
// WHAT THIS ADDS ON TOP OF navigator.geolocation
//   • THROTTLE      at most one update every 1.5 s (the raw API can fire
//                   10×/second on a phone).
//   • STATUS        one of GPS.* is reported whenever it changes, so the
//                   UI can say "Searching for GPS…" or "GPS signal lost"
//                   instead of flashing a raw browser error.
//   • NO DEAD ENDS  a high-accuracy TIMEOUT used to surface as a red
//                   "Timeout expired" banner every 15 s on laptops and
//                   indoors. It now falls back to a coarse (Wi-Fi) fix,
//                   which is shown as approximate.
//   • HEARTBEAT     some devices send nothing while standing still. After
//                   12 s of silence the device is asked directly, so
//                   "no updates" and "signal lost" can be told apart.
//   • RECOVERY      if the rider grants the location permission after
//                   having blocked it, tracking restarts by itself.
//
// EXPORTS
//   GPS                              status names
//   watchLocation(onUpdate, onStatus) → stop()
//   getCurrentLocation()             → Promise<Location>
//   requestFreshFix()                → Promise<Location | null>
//   getLastKnownLocation()           → Location | null
// ============================================================

export const GPS = Object.freeze({
  SEARCHING: "searching",     // watching, no position yet
  OK: "ok",                   // recent, accurate position
  WEAK: "weak",               // recent but only approximate (Wi-Fi level)
  LOST: "lost",               // had a position, nothing new arrives
  DENIED: "denied",           // permission blocked
  UNSUPPORTED: "unsupported", // no geolocation on this device / page
});

const STATUS_MESSAGE = {
  [GPS.SEARCHING]: "Searching for GPS…",
  [GPS.OK]: "",
  [GPS.WEAK]: "Approximate location — GPS signal is weak",
  [GPS.LOST]: "GPS signal lost",
  [GPS.DENIED]: "Location access is blocked. Allow it in your browser settings to navigate.",
  [GPS.UNSUPPORTED]: "This device or browser can't share its location.",
};

const THROTTLE_MS = 1500;       // minimum gap between emitted updates
const SILENCE_MS = 12_000;      // no position for this long → ask directly
const WEAK_ACCURACY_M = 60;     // worse than this is shown as approximate

// maximumAge: 0 → always a FRESH fix. A cached, IP-based position can be
// hundreds of kilometres off, which is how the map once "locked" onto
// the ISP's town instead of the rider.
const PRECISE = { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 };
// Fallback when the GPS chip cannot answer in time (laptops, indoors).
const COARSE = { enableHighAccuracy: false, maximumAge: 15_000, timeout: 10_000 };
// Heartbeat for devices that stay silent while standing still.
const HEARTBEAT = { enableHighAccuracy: true, maximumAge: 10_000, timeout: 8_000 };

const PERMISSION_DENIED = 1;
const TIMEOUT = 3;

function supported() {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

function toLocation(pos) {
  const c = pos.coords;
  return {
    lat: c.latitude,
    lng: c.longitude,
    accuracy: Number.isFinite(c.accuracy) ? c.accuracy : null,
    speed: Number.isFinite(c.speed) ? c.speed : null,
    heading: Number.isFinite(c.heading) ? c.heading : null,
    timestamp: pos.timestamp || Date.now(),
  };
}

// The newest real fix — lets the re-center button respond instantly.
let lastKnown = null;
export function getLastKnownLocation() {
  return lastKnown;
}

// Active watchers, so requestFreshFix() can hand them the new position.
const watchers = new Set();

// ============================================================
// getCurrentLocation — one position, as good as the device can give
//
// Tries the GPS chip first; if that times out (very common on desktops)
// it settles for a coarse fix rather than failing.
// Rejects with an Error whose message is safe to show to the rider.
// ============================================================
export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!supported()) {
      reject(new Error(STATUS_MESSAGE[GPS.UNSUPPORTED]));
      return;
    }

    const succeed = (pos) => {
      const location = toLocation(pos);
      lastKnown = location;
      resolve(location);
    };
    const fail = (err) => {
      reject(new Error(
        err?.code === PERMISSION_DENIED
          ? STATUS_MESSAGE[GPS.DENIED]
          : "Couldn't find your location. Check that location is switched on and try again.",
      ));
    };

    navigator.geolocation.getCurrentPosition(
      succeed,
      (err) => {
        if (err?.code === PERMISSION_DENIED) { fail(err); return; }
        navigator.geolocation.getCurrentPosition(succeed, fail, { ...COARSE, maximumAge: 60_000 });
      },
      { ...PRECISE, timeout: 12_000 },
    );
  });
}

// ============================================================
// watchLocation — continuous tracking
//
//   onUpdate(location)             throttled position updates
//   onStatus({ state, message })   whenever the GPS status changes
//
// Returns stop(). Tracking ends completely when it is called — nothing
// keeps running in the background.
// ============================================================
export function watchLocation(onUpdate, onStatus) {
  let state = null;
  const report = (next) => {
    if (next === state) return;
    state = next;
    try { onStatus?.({ state: next, message: STATUS_MESSAGE[next] }); } catch { /* UI callback failed */ }
  };

  if (!supported()) {
    report(GPS.UNSUPPORTED);
    return () => {};
  }

  let stopped = false;
  let watchId = null;
  let hadFix = false;
  let lastFixAt = Date.now();   // also the "started waiting" time
  let lastEmitAt = 0;
  let asking = false;           // a one-shot request is in flight
  let permission = null;

  const deliver = (location, force = false) => {
    if (stopped) return;
    hadFix = true;
    lastFixAt = Date.now();
    lastKnown = location;
    report(location.accuracy != null && location.accuracy > WEAK_ACCURACY_M ? GPS.WEAK : GPS.OK);

    if (!force && lastFixAt - lastEmitAt < THROTTLE_MS) return;
    lastEmitAt = lastFixAt;
    try { onUpdate(location); } catch (err) { console.error("[locationService] update handler failed:", err); }
  };

  // Ask the device once, outside the watch.
  const askOnce = (options) => {
    if (asking || stopped || state === GPS.DENIED) return;
    asking = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => { asking = false; deliver(toLocation(pos)); },
      (err) => {
        asking = false;
        if (stopped) return;
        if (err?.code === PERMISSION_DENIED) report(GPS.DENIED);
        else report(hadFix ? GPS.LOST : GPS.SEARCHING);
      },
      options,
    );
  };

  const start = () => {
    if (stopped) return;
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    watchId = navigator.geolocation.watchPosition(
      (pos) => deliver(toLocation(pos)),
      (err) => {
        if (stopped) return;
        if (err?.code === PERMISSION_DENIED) { report(GPS.DENIED); return; }
        // The watch itself keeps running after these; get a position some
        // other way in the meantime.
        if (err?.code === TIMEOUT) askOnce(COARSE);
        else report(hadFix ? GPS.LOST : GPS.SEARCHING);
      },
      PRECISE,
    );
  };

  report(GPS.SEARCHING);
  start();

  // Heartbeat: silence is not the same as a lost signal.
  const heartbeat = setInterval(() => {
    if (stopped || state === GPS.DENIED) return;
    if (Date.now() - lastFixAt > SILENCE_MS) askOnce(HEARTBEAT);
  }, 4000);

  // Permission granted after being blocked → start tracking again.
  const onPermissionChange = () => {
    if (stopped || !permission) return;
    if (permission.state === "granted" && state === GPS.DENIED) {
      state = null;
      report(GPS.SEARCHING);
      lastFixAt = Date.now();
      start();
    } else if (permission.state === "denied") {
      report(GPS.DENIED);
    }
  };
  if (navigator.permissions?.query) {
    navigator.permissions.query({ name: "geolocation" })
      .then((status) => {
        if (stopped) return;
        permission = status;
        status.addEventListener?.("change", onPermissionChange);
      })
      .catch(() => { /* Permissions API not available for geolocation */ });
  }

  const watcher = { deliver };
  watchers.add(watcher);

  return () => {
    stopped = true;
    watchers.delete(watcher);
    clearInterval(heartbeat);
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    permission?.removeEventListener?.("change", onPermissionChange);
  };
}

// ============================================================
// requestFreshFix — used by the re-center button
//
// Asks the hardware for a brand-new position and gives it to every
// active watcher immediately (bypassing the throttle). Resolves to the
// position, or null when none could be obtained. Never rejects.
// ============================================================
export function requestFreshFix() {
  return new Promise((resolve) => {
    if (!supported()) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const location = toLocation(pos);
        lastKnown = location;
        watchers.forEach((watcher) => watcher.deliver(location, true));
        resolve(location);
      },
      () => resolve(null),
      PRECISE,
    );
  });
}
