// ============================================================
// 📍 locationService.js — Browser Geolocation wrapper
//
// WHY THIS EXISTS:
//   The native navigator.geolocation API fires very frequently
//   (sometimes every 100ms on mobile). This wrapper throttles
//   updates to THROTTLE_MS and exposes speed + heading.
//
// LOCATION OBJECT:
//   {
//     lat:       number,        — latitude  (decimal degrees)
//     lng:       number,        — longitude (decimal degrees)
//     accuracy:  number,        — accuracy radius in metres
//                                 < 20m  = GPS hardware fix (excellent)
//                                 < 100m = WiFi-based (good)
//                                 > 500m = IP-based (unreliable — do not use)
//     speed:     number|null,   — speed in m/s (null if unavailable)
//     heading:   number|null,   — direction 0-360° (null if unavailable)
//     timestamp: number,        — ms since epoch
//   }
//
// EXPORTS:
//   getCurrentLocation()               → Promise<LocationObj>
//   watchLocation(onUpdate, onError)   → stop() function
// ============================================================

// ---------------------------------------------------------------------------
// THROTTLE: minimum ms between emitted location updates.
// 1500ms = responsive for navigation while still battery-friendly.
// ---------------------------------------------------------------------------
const THROTTLE_MS = 1500;

// ---------------------------------------------------------------------------
// GPS options:
//   enableHighAccuracy: true  → use GPS chip (not IP/WiFi fallback)
//   maximumAge: 0             → ALWAYS request a fresh GPS fix.
//                               Never serve a stale cached position.
//                               This is the key fix for the "locked location"
//                               bug — cached IP-based positions (like an ISP
//                               server at Virudhunagar) would be served if
//                               maximumAge > 0.
//   timeout: 15000            → wait up to 15s for a real GPS hardware fix
// ---------------------------------------------------------------------------
const GPS_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge:         0,      // ← CRITICAL: 0 = never use cached position
  timeout:            15000,
};

// ── Internal helper ─────────────────────────────────────────

function posToLocation(pos) {
  return {
    lat:       pos.coords.latitude,
    lng:       pos.coords.longitude,
    accuracy:  pos.coords.accuracy,   // metres — lower is better
    speed:     pos.coords.speed   ?? null,  // m/s
    heading:   pos.coords.heading ?? null,  // degrees 0-360
    timestamp: pos.timestamp,
  };
}

// ============================================================
// getCurrentLocation — one-shot fresh GPS fix
// Returns a Promise — never uses cache (maximumAge: 0).
// ============================================================

export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition( // this getCurrentPosotion is the browser function a inbuild function for to track gps
      (pos) => resolve(posToLocation(pos)), // this is a success parameter 
      (err)  => reject(err),// this the error parameter but its all call inside of another function like
      GPS_OPTIONS // this is the variable on that 44 line
    );
  });
}

// ============================================================
// watchLocation — continuous position tracking (throttled)
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

  return () => navigator.geolocation.clearWatch(watchId);
}

