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

const activeListeners = new Set();
let isSimulating = false;

// 1. Listen for dragging the marker
window.addEventListener("simulate-gps", (e) => {
  isSimulating = true;
  const fakeLocation = {
    lat: e.detail.lat,
    lng: e.detail.lng,
    accuracy: 5,
    speed: 10,
    heading: null,
    timestamp: Date.now()
  };
  activeListeners.forEach(onUpdate => onUpdate(fakeLocation));
});

// 2. Listen for the Re-Center button
window.addEventListener("resume-real-gps", () => {
  isSimulating = false; 
  
  // A. Instantly snap to the last known real location (if we have one)
  if (window.lastRealLocation) {
    activeListeners.forEach(onUpdate => onUpdate(window.lastRealLocation));
    window.dispatchEvent(new CustomEvent("rw-recenter", {
      detail: { lat: window.lastRealLocation.lat, lng: window.lastRealLocation.lng }
    }));
  }

  // B. GUARANTEE a fresh coordinate by forcing the hardware sensors to ping
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const freshLoc = posToLocation(pos);
      window.lastRealLocation = freshLoc; // Save it
      
      // Update the map and camera one more time with the fresh coordinate
      if (!isSimulating) {
        activeListeners.forEach(onUpdate => onUpdate(freshLoc));
        window.dispatchEvent(new CustomEvent("rw-recenter", {
          detail: { lat: freshLoc.lat, lng: freshLoc.lng }
        }));
      }
    },
    (err) => console.warn("Forced GPS failed:", err),
    GPS_OPTIONS
  );
});

export function watchLocation(onUpdate, onError) {
  if (!navigator.geolocation) {
    console.warn("[locationService] Geolocation not supported.");
    if (onError) onError(new Error("Geolocation not supported"));
    return () => {};
  }

  activeListeners.add(onUpdate);

  let lastEmitTime = 0;

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      // ALWAYS silently save the real hardware GPS in the background
      window.lastRealLocation = posToLocation(pos);

      if (isSimulating) return;

      const now = Date.now();
      if (now - lastEmitTime < THROTTLE_MS) return;
      lastEmitTime = now;
      onUpdate(window.lastRealLocation);
    },
    (err) => {
      if (!isSimulating) {
        console.warn("[locationService] GPS error:", err.message);
        if (onError) onError(err);
      }
    },
    GPS_OPTIONS
  );

  return () => {
    navigator.geolocation.clearWatch(watchId);
    activeListeners.delete(onUpdate);
    // Only exit simulation mode when NO listeners remain. Previously any
    // single component unmounting killed GPS simulation for every other
    // active listener.
    if (activeListeners.size === 0) isSimulating = false;
  };
}
