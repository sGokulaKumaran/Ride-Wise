// ============================================================
// 📍 locationService.js — Browser Geolocation wrapper
//
// WHY THIS EXISTS:
//   The native navigator.geolocation API fires very frequently
//   (sometimes every 100ms on mobile). Pushing every update to
//   a backend or re-rendering React would be too expensive.
//   This wrapper throttles updates to once every THROTTLE_MS.
//
// LOCATION OBJECT SHAPE:
//   {
//     lat:       number,   — latitude in decimal degrees
//     lng:       number,   — longitude in decimal degrees
//     accuracy:  number,   — accuracy radius in metres
//     speed:     number|null, — speed in m/s (null if unavailable)
//     heading:   number|null, — direction in degrees 0–360 (null if unavailable)
//     timestamp: number,   — ms since epoch
//   }
//
// EXPORTS:
//   getCurrentLocation()               → Promise<LocationObj>
//   watchLocation(onUpdate, onError)   → stop() function
// ============================================================

// ---------------------------------------------------------------------------
// THROTTLE: minimum milliseconds between emitted location updates.
// 2000ms = update at most once every 2 seconds — responsive enough for
// navigation while still battery-friendly.
// ---------------------------------------------------------------------------
const THROTTLE_MS = 2000;

// ---------------------------------------------------------------------------
// GPS options passed to the browser API
// enableHighAccuracy: true  → use GPS chip (more accurate, uses more battery)
// maximumAge: 3000          → accept cached positions up to 3 seconds old
// timeout: 10000            → give up if no fix in 10 seconds
// ---------------------------------------------------------------------------
const GPS_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge:         3000,
  timeout:            10000,
};

// ── Internal helper to extract a clean location object from a GeolocationPosition ──
function posToLocation(pos) {
  return {
    lat:       pos.coords.latitude,
    lng:       pos.coords.longitude,
    accuracy:  pos.coords.accuracy,
    // speed / heading may be null on desktop browsers; always forward them
    speed:     pos.coords.speed   ?? null,   // m/s (null if not available)
    heading:   pos.coords.heading ?? null,   // degrees 0–360 (null if not available)
    timestamp: pos.timestamp,
  };
}

// ============================================================
// getCurrentLocation — one-shot position fetch
// Returns a Promise so you can await it
// ============================================================
export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(posToLocation(pos)),
      (err)  => reject(err),
      GPS_OPTIONS
    );
  });
}

// ============================================================
// watchLocation — continuous position tracking (with throttle)
//
// onUpdate(location) is called at most once every THROTTLE_MS.
// Returns a stop() function — call it to cancel tracking.
// ============================================================
export function watchLocation(onUpdate, onError) {
  if (!navigator.geolocation) {
    console.warn("[locationService] Geolocation not supported.");
    if (onError) onError(new Error("Geolocation not supported"));
    return () => {};
  }

  let lastEmitTime = 0;

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const now = Date.now();
      if (now - lastEmitTime < THROTTLE_MS) return;
      lastEmitTime = now;
      onUpdate(posToLocation(pos));
    },
    (err) => {
      console.warn("[locationService] GPS error:", err.message);
      if (onError) onError(err);
    },
    GPS_OPTIONS
  );

  return () => {
    navigator.geolocation.clearWatch(watchId);
  };
}
