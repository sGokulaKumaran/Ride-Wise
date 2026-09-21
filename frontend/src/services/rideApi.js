// ============================================================
// 🛣️ rideApi.js — Ride data service
//
// All ride operations go through this file.
// Talks to the Spring Boot backend at /api/rides.
// Falls back to localStorage if the backend is unreachable
// (so the UI still works during development without the server).
//
// HOW TO USE:
//   import { createRide, getUserRides, endRide, deleteRide } from "../services/rideApi";
// ============================================================

// ---------------------------------------------------------------------------
// BASE URL — change this if your backend runs on a different port
// In Vite dev mode the proxy in vite.config.js rewrites /api → localhost:8080
// ---------------------------------------------------------------------------
const BASE = "/api/rides";

// ---------------------------------------------------------------------------
// LOCALSTORAGE FALLBACK KEY
// Used when the backend is not running (dev convenience)
// ---------------------------------------------------------------------------
const LS_KEY = "ridewise-rides-local";// this is the name of the web Local Storage a key for the value of the web storage

// ---------------------------------------------------------------------------
// Helper: load rides from localStorage (used as fallback cache)
// ---------------------------------------------------------------------------
function lsLoad() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
  catch { return []; }
}

// ---------------------------------------------------------------------------
// Helper: save rides to localStorage fallback cache
// ---------------------------------------------------------------------------
function lsSave(rides) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(rides)); }
  catch { /* storage quota exceeded — ignore */ }
}

// ---------------------------------------------------------------------------
// Helper: call backend; if it fails, run the fallback function instead
// This lets every function degrade gracefully when the backend is offline
// ---------------------------------------------------------------------------
async function withFallback(backendFn, fallbackFn) {
  try {
    return await backendFn();
  } catch (err) {
    console.warn("Backend unreachable, using local fallback:", err.message);
    return fallbackFn();
  }
}

// ============================================================
// CREATE RIDE
// POST /api/rides
// rideData: { userId, fromName, fromLat, fromLng,
//             destinationName, destinationLat, destinationLng,
//             routeCoordinates (JSON string), distanceMeters,
//             durationSeconds, rideType }
// Returns the saved ride object with id + createdAt
// ============================================================
export async function createRide(rideData) {
  return withFallback(
    // ---- Try backend ----
    async () => {
      const res = await fetch(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rideData), // send all fields to backend
      });
      if (!res.ok) throw new Error(`Create ride failed: ${res.status}`);// res.status is the 
      const saved = await res.json();
      // Also add to local cache so getActiveRides works offline
      const cached = lsLoad();// Here the cache variable get the isLoad function 
      cached.push(saved);// here in that isLoad funtion I add new ride detail so that has the updated rides in the array
      lsSave(cached);// Then in this line the cache is update in the in the isSave
      return saved; //Then the saved is return
    },
    // ---- Fallback: save to localStorage ---- if the backend is not feched then the local storage in the web Browser is used
    () => {// this is a arrow funciton for the fallbackFn
      const ride = {
        ...rideData,
        id: "local_" + Date.now(),       // local-only id // its give the date of that ride created
        status: "active",                // new rides start active
        createdAt: new Date().toISOString(),// its convert that data into the standard text format for feature use 
        endedAt: null,// for now at the create of tha ride the endedAt seems null
      };
      const cached = lsLoad();
      cached.push(ride);
      lsSave(cached);
      return ride;
    }
  );
}

// ============================================================
// GET ALL RIDES FOR A USER  (history — newest first)
// GET /api/rides/user/{userId}
// ============================================================
export async function getUserRides(userId) {
  return withFallback(
    async () => {
      const res = await fetch(`${BASE}/user/${userId}`);
      if (!res.ok) throw new Error(`Get rides failed: ${res.status}`);
      return res.json(); // array of RideResponse
    },
    () => {
      // Fallback: filter local cache by userId
      return lsLoad()
        .filter(r => String(r.userId) === String(userId)) 
        .reverse(); // newest first
    }
  );
}

// ============================================================
// GET ACTIVE RIDES FOR A USER
// GET /api/rides/user/{userId}/active   
// ============================================================
export async function getActiveRides(userId) {
  return withFallback(
    async () => {
      const res = await fetch(`${BASE}/user/${userId}/active`);
      if (!res.ok) throw new Error(`Get active rides failed: ${res.status}`);
      return res.json();
    },
    () => {
      // Fallback: filter local cache for active rides
      return lsLoad().filter(
        r => String(r.userId) === String(userId) && r.status === "active"
      );
    }
  );
}

// ============================================================
// END A RIDE (change status to "completed")
// PATCH /api/rides/{rideId}/status
// ============================================================
export async function endRide(rideId) {
  return withFallback(
    async () => {
      const res = await fetch(`${BASE}/${rideId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }), // tell backend to mark complete
      });
      if (!res.ok) throw new Error(`End ride failed: ${res.status}`);
      const updated = await res.json();
      // Sync to local cache
      const cached = lsLoad().map(r => String(r.id) === String(rideId) ? updated : r);
      lsSave(cached);
      return updated;
    },
    () => {
      // Fallback: update local cache
      const cached = lsLoad().map(r =>
        String(r.id) === String(rideId)
          ? { ...r, status: "completed", endedAt: new Date().toISOString() }
          : r
      );
      lsSave(cached);
      return cached.find(r => String(r.id) === String(rideId));
    }
  );
}

// ============================================================
// DELETE A RIDE PERMANENTLY
// DELETE /api/rides/{rideId}
// ============================================================
export async function deleteRide(rideId) {
  return withFallback(
    async () => {
      const res = await fetch(`${BASE}/${rideId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete ride failed: ${res.status}`);
      // Remove from local cache too
      lsSave(lsLoad().filter(r => String(r.id) !== String(rideId)));// in this code this will filter the id object
    },
    () => {
      // Fallback: remove from local cache
      lsSave(lsLoad().filter(r => String(r.id) !== String(rideId)));// Like that it also filter that array with remove of that id 
    }
  );
}

// ============================================================
// GET A SINGLE RIDE BY ID
// GET /api/rides/{rideId}
// ============================================================
export async function getRide(rideId) {
  return withFallback(
    async () => {
      const res = await fetch(`${BASE}/${rideId}`);// here its go the backend database and get the id
      if (!res.ok) throw new Error(`Get ride failed: ${res.status}`);
      return res.json();
    },
    () => lsLoad().find(r => String(r.id) === String(rideId)) || null // if its find the id then retrun, if not its return null
  );
}

// ============================================================
// UPDATE USER LOCATION — store a GPS position update on the backend
//
// Called on every GPS tick while a ride is active.
// The backend records position history so we can:
//   • Show the traveled path in ride history
//   • Support future route deviation detection
//   • Support group ride live location sharing
//
// POST /api/rides/{rideId}/location
// Body: { lat, lng, timestamp }
//
// This is "fire-and-forget" — if backend is unreachable we log and
// silently skip. GPS dot and route trimming still work client-side.
// ============================================================
export async function updateUserLocation(rideId, lat, lng, userId) {

  try {
    // Build the location update payload with an ISO timestamp
    const payload = {
      userId: userId || null,
      lat,                                // decimal degrees (e.g. 13.0827)
      lng,                                // decimal degrees (e.g. 80.2707)

      timestamp: new Date().toISOString(), // when this fix was captured
    };

    const res = await fetch(`${BASE}/${rideId}/location`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });

    // Log non-2xx responses but don't throw — this is non-critical
    if (!res.ok) {
      console.warn(`[rideApi] Location update returned HTTP ${res.status}`);
    }
  } catch (err) {
    // Backend offline or network error — silently continue.
    // All client-side map features still work without this call.
    console.warn("[rideApi] updateUserLocation skipped (backend unreachable):", err.message);
  }
}
//This only post the lat, lan with the time and date

// ============================================================
// GROUP RIDE API FUNCTIONS
// ============================================================

export async function getGroupRideParticipants(rideId) {
  try {
    const res = await fetch(`${BASE}/${rideId}/participants`);
    if (!res.ok) throw new Error(`Get participants failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("[rideApi] getGroupRideParticipants failed:", err.message);
    return [];
  }
}

export async function updateParticipantStatus(rideId, userId, status) {
  const res = await fetch(`${BASE}/${rideId}/participants/${userId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Update participant status failed: ${res.status}`);
  return await res.json();
}
