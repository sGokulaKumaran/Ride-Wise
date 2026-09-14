// ============================================================
// 👥 ridersApi — Real API calls to the Spring Boot backend
//
// All functions call /api/riders/* which is proxied by Vite
// to http://localhost:8080 during development.
//
// ENDPOINT MAP (from RidersController.java):
//   GET  /api/riders/search?query=&userId=   → searchRiders
//   GET  /api/riders/nearby?userId=          → getNearRiders
//   GET  /api/riders/connections?userId=     → getConnectionsFull
//   POST /api/riders/add    { userId, riderId } → addRider
//   POST /api/riders/remove { userId, riderId } → removeRider
//
// NOTES:
//   - userId is a Long (number) — matches the backend DB id
//   - Every function throws on non-2xx so callers can catch errors
// ============================================================

// ── Shared helper: parse response or throw a readable error ──
async function handleResponse(res) {
  if (res.ok) return res.json();
  let msg = `Server error (${res.status})`;
  try {
    const body = await res.json();
    if (body?.message) msg = body.message;
    else if (typeof body === "string") msg = body;
  } catch (_) {/* body wasn't JSON */}
  throw new Error(msg);
}

// ── Haversine distance in km (still used client-side for "Near" badge) ──
export function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── searchRiders(query, currentUserId) ──
// Returns UserResponse[] — users whose username or email contains the query.
export async function searchRiders(query, currentUserId) {
  const q = (query || "").trim();
  if (!q) return [];

  const params = new URLSearchParams({ query: q, userId: currentUserId });
  const res = await fetch(`/api/riders/search?${params}`);
  return handleResponse(res); // its return the server status
}

// ── addRider(userId, riderId) ──
// Returns { success: true/false }
export async function addRider(userId, riderId) {
  if (!userId || !riderId) return { success: false, error: "Missing IDs" };// is to avoid to add unknown rider not exist
  if (userId === riderId)  return { success: false, error: "Cannot add yourself" }; //is to avoid to add myself

  // add rider to the backend
  const res = await fetch("/api/riders/add", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ userId, riderId }),
  });
  return handleResponse(res);
  // Backend returns: { success: true } or { success: false }
}

// ── removeRider(userId, riderId) ──
// Returns { success: true/false }
export async function removeRider(userId, riderId) {
  if (!userId || !riderId) return { success: false, error: "Missing IDs" };

  const res = await fetch("/api/riders/remove", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ userId, riderId }),
  });
  return handleResponse(res);
}

// ── getConnectionsFull(userId) ──
// Returns UserResponse[] — full user objects for all connections.
export async function getConnectionsFull(userId) {
  if (!userId) return [];
  const params = new URLSearchParams({ userId });
  const res = await fetch(`/api/riders/connections?${params}`);
  return handleResponse(res);
}

// ── getNearRiders(userId) ──
// Returns UserResponse[] — riders within 50 km, sorted by distance.
// The backend calculates distance using the user's stored lat/lng.
export async function getNearRiders(userId) {
  if (!userId) return [];
  const params = new URLSearchParams({ userId });
  const res = await fetch(`/api/riders/nearby?${params}`);
  return handleResponse(res);
}
// this two getconnetions and the getnerby function are mostly handle in the backend not in this frontend

// ── isConnected(userId, riderId) ──
// Synchronous check using the cached connections list.
// Call getConnectionsFull first and pass the result here for accuracy.
export function isConnected(connectionsIds, riderId) {
  return connectionsIds.includes(riderId);
}

// ── getAllRidersCount() ──
// Not directly supported by backend — kept as a no-op placeholder.
// Remove or replace with a real endpoint when the feature is needed.
export function getAllRidersCount() {
  return 0;
}