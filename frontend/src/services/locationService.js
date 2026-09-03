// ============================================================
// 📍 locationService.js — Browser geolocation wrapper
//
// Wraps navigator.geolocation with throttling (so we don't
// spam Firebase 100x per second)
//
// Provides:
//   - watchLocation(callback) → returns a stop function
//   - getCurrentLocation()    → one-shot current position
// ============================================================

// How often to actually emit a location update (milliseconds)
const THROTTLE_MS = 3000; // 3 seconds between updates

// Get current position once
// BACKEND: not needed (browser API only)
export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat:       pos.coords.latitude,
        lng:       pos.coords.longitude,
        accuracy:  pos.coords.accuracy,
        timestamp: pos.timestamp,
      }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

// Continuously watch location, with throttling
// callback receives { lat, lng } objects
// Returns a stop() function
export function watchLocation(callback) {
  if (!navigator.geolocation) {
    console.warn("Geolocation not supported");
    return () => {};
  }

  let lastEmit = 0;
  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const now = Date.now();
      // Throttle: only emit every THROTTLE_MS
      if (now - lastEmit < THROTTLE_MS) return;
      lastEmit = now;

      callback({
        lat:       pos.coords.latitude,
        lng:       pos.coords.longitude,
        accuracy:  pos.coords.accuracy,
        timestamp: pos.timestamp,
      });
    },
    (err) => console.warn("Location error:", err),
    { enableHighAccuracy: true, maximumAge: 5000 }
  );

  // Return a stop function
  return () => navigator.geolocation.clearWatch(watchId);
}
