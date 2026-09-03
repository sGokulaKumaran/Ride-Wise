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
const LS_KEY = "ridewise-rides-local";

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
      if (!res.ok) throw new Error(`Create ride failed: ${res.status}`);
      const saved = await res.json();
      // Also add to local cache so getActiveRides works offline
      const cached = lsLoad();
      cached.push(saved);
      lsSave(cached);
      return saved;
    },
    // ---- Fallback: save to localStorage ----
    () => {
      const ride = {
        ...rideData,
        id: "local_" + Date.now(),       // local-only id
        status: "active",                // new rides start active
        createdAt: new Date().toISOString(),
        endedAt: null,
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
      lsSave(lsLoad().filter(r => String(r.id) !== String(rideId)));
    },
    () => {
      // Fallback: remove from local cache
      lsSave(lsLoad().filter(r => String(r.id) !== String(rideId)));
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
      const res = await fetch(`${BASE}/${rideId}`);
      if (!res.ok) throw new Error(`Get ride failed: ${res.status}`);
      return res.json();
    },
    () => lsLoad().find(r => String(r.id) === String(rideId)) || null
  );
}
