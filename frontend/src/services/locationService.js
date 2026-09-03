// ============================================================
// 📍 locationService.js — Browser Geolocation wrapper
//
// WHY THIS EXISTS:
//   The native navigator.geolocation API fires very frequently
//   (sometimes every 100ms on mobile). Pushing every update to
//   a backend or re-rendering React would be too expensive.
//   This wrapper throttles updates to once every THROTTLE_MS.
//
// EXPORTS:
//   getCurrentLocation()          → Promise<{lat,lng,accuracy}>
//   watchLocation(onUpdate, onError) → stop() function
// ============================================================

// ---------------------------------------------------------------------------
// THROTTLE: minimum milliseconds between emitted location updates
// 3000ms = update at most once every 3 seconds
// You can lower this (e.g. 1000) for smoother tracking at the cost of battery
// ---------------------------------------------------------------------------
const THROTTLE_MS = 3000;

// ---------------------------------------------------------------------------
// GPS options passed to the browser API
// enableHighAccuracy: true  → use GPS chip (more accurate, uses more battery)
// maximumAge: 5000          → accept cached positions up to 5 seconds old
// timeout: 10000            → give up if no fix in 10 seconds
// ---------------------------------------------------------------------------
const GPS_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge:         5000,
  timeout:            10000,
};

// ============================================================
// getCurrentLocation — one-shot position fetch
// Returns a Promise so you can await it
// ============================================================
export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    // Check if the browser supports geolocation at all
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }

    // Ask browser for the current position (one time only)
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat:       pos.coords.latitude,   // decimal degrees, e.g. 13.0827
        lng:       pos.coords.longitude,  // decimal degrees, e.g. 80.2707
        accuracy:  pos.coords.accuracy,   // metres radius of uncertainty
        timestamp: pos.timestamp,         // ms since epoch
      }),
      (err) => reject(err),   // e.g. user denied permission
      GPS_OPTIONS
    );
  });
}

// ============================================================
// watchLocation — continuous position tracking (with throttle)
//
// onUpdate(location) is called at most once every THROTTLE_MS
// Returns a stop() function — call it to cancel tracking
// ============================================================
export function watchLocation(onUpdate, onError) {
  // Guard: check for support before subscribing
  if (!navigator.geolocation) {
    console.warn("[locationService] Geolocation not supported.");
    if (onError) onError(new Error("Geolocation not supported"));
    return () => {}; // return no-op stop function
  }

  let lastEmitTime = 0; // timestamp of last callback we actually fired

  // Subscribe to continuous position updates from the browser
  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const now = Date.now();

      // Throttle: skip this update if we just emitted one recently
      if (now - lastEmitTime < THROTTLE_MS) return;
      lastEmitTime = now; // record when we last emitted

      // Call the consumer with a clean location object
      onUpdate({
        lat:       pos.coords.latitude,
        lng:       pos.coords.longitude,
        accuracy:  pos.coords.accuracy,
        timestamp: pos.timestamp,
      });
    },
    (err) => {
      // Pass the error up to the consumer (e.g. show a banner in the UI)
      console.warn("[locationService] GPS error:", err.message);
      if (onError) onError(err);
    },
    GPS_OPTIONS
  );

  // Return a stop function so the caller can unsubscribe
  return () => {
    navigator.geolocation.clearWatch(watchId);
  };
}
