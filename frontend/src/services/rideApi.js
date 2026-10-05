// ============================================================
// rideApi.js — ride data service
//
// Every ride operation goes through this file and talks to the Spring
// Boot backend at /api/rides (the Vite dev proxy / Cloudflare function
// forwards /api to it).
//
// OFFLINE BEHAVIOUR — and what it is NOT
//   When the backend cannot be REACHED (no network, the free-tier server
//   is asleep), rides are read from and written to localStorage so the
//   app keeps working, and an "end ride" made offline is replayed when
//   the server is back.
//
//   A fallback is used ONLY for "unreachable". When the server answers
//   with a refusal (403 not your ride, 400 invalid, 409 …) that answer
//   is the truth and is thrown to the caller with the server's message.
//   The old helper treated every failure as "offline", so the UI said
//   "Ride ended" / "Ride deleted" while the server had refused — and the
//   ride reappeared on the next refresh.
//
// WHAT IS CACHED
//   ridewise-rides-local   the ride LIST (lightweight rows, no route data)
//   ridewise-ride-<id>     the full copy of an ACTIVE ride, route included,
//                          so the map still opens offline
//   ridewise-pending-ends  rides ended while offline, waiting to be sent
//
//   The list used to store every ride with its complete route geometry
//   (tens to hundreds of KB each) and only ever grew, until it silently
//   hit the browser's storage limit.
// ============================================================

import { ApiError, apiJson, isOffline, jsonBody } from "./http";

const BASE = "/api/rides";

const LIST_KEY = "ridewise-rides-local";
const DETAIL_PREFIX = "ridewise-ride-";
const PENDING_ENDS_KEY = "ridewise-pending-ends";

// A ride created while offline lives only on this device.
const isLocalRide = (rideId) => String(rideId).startsWith("local_");

// ── localStorage helpers (never throw) ───────────────────────
function readJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded / storage unavailable — the cache is optional
  }
}

function remove(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

const loadList = () => {
  const list = readJson(LIST_KEY, []);
  return Array.isArray(list) ? list : [];
};

// A list row never carries the route blobs.
function toSummary(ride) {
  const summary = { ...ride, hasRoute: Boolean(ride.hasRoute ?? ride.routeCoordinates) };
  delete summary.routeCoordinates;
  delete summary.routeSteps;
  return summary;
}

function upsertInList(ride) {
  const list = loadList().filter((r) => String(r.id) !== String(ride.id));
  // Local-only rides keep their route in the row — there is no server copy.
  list.unshift(isLocalRide(ride.id) ? ride : toSummary(ride));
  writeJson(LIST_KEY, list);
}

function cacheDetail(ride) {
  if (!ride || ride.id == null) return;
  if (ride.status === "active" && ride.routeCoordinates) writeJson(DETAIL_PREFIX + ride.id, ride);
  else remove(DETAIL_PREFIX + ride.id);
}

// Drop full-ride copies of rides that are no longer active.
function pruneDetails(activeIds) {
  try {
    const keep = new Set(activeIds.map((id) => DETAIL_PREFIX + id));
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DETAIL_PREFIX) && !keep.has(key)) localStorage.removeItem(key);
    }
  } catch {
    // storage unavailable
  }
}

// Run the backend call; use the fallback ONLY when the backend is unreachable.
async function withFallback(backendFn, fallbackFn) {
  try {
    return await backendFn();
  } catch (err) {
    if (!isOffline(err)) throw err; // a real answer from the server
    console.warn("[rideApi] Backend unreachable — using the local copy.");
    return fallbackFn(err);
  }
}

// ── Rides ended while offline ────────────────────────────────
// A measured distance is sent even when it is 0: "tracked, nothing ridden"
// is different from "never tracked" (which the stats count at the planned
// length). Only a missing / unusable figure is left out.
const isMeasured = (meters) => Number.isFinite(meters) && meters >= 0;

function statusBody(actualDistanceMeters) {
  return {
    status: "completed",
    ...(isMeasured(actualDistanceMeters) ? { actualDistanceMeters } : {}),
  };
}

// Send them now that the server answers. A ride the server refuses to end
// (already ended, deleted, not ours) is simply dropped from the queue.
async function flushPendingEnds() {
  const pending = readJson(PENDING_ENDS_KEY, []);
  if (!Array.isArray(pending) || !pending.length) return;

  const stillWaiting = [];
  for (const item of pending) {
    try {
      await apiJson(`${BASE}/${item.rideId}/status`, jsonBody("PATCH", statusBody(item.actualDistanceMeters)));
    } catch (err) {
      if (isOffline(err)) stillWaiting.push(item);
    }
  }
  if (stillWaiting.length) writeJson(PENDING_ENDS_KEY, stillWaiting);
  else remove(PENDING_ENDS_KEY);
}

// ============================================================
// CREATE RIDE — POST /api/rides
// rideData: { fromName, fromLat, fromLng, destinationName, destinationLat,
//             destinationLng, routeCoordinates (JSON string), routeSteps
//             (JSON string), distanceMeters, durationSeconds, rideType,
//             participantIds? }
// Returns the saved ride (with id, status, createdAt and the route).
// ============================================================
export async function createRide(rideData) {
  return withFallback(
    async () => {
      const saved = await apiJson(BASE, jsonBody("POST", rideData));
      upsertInList(saved);
      cacheDetail(saved);
      return saved;
    },
    () => {
      // A group ride needs the server: the other riders must be invited.
      if (rideData.rideType === "group") {
        throw new ApiError("You're offline. A group ride needs a connection to invite your riders.", {
          offline: true,
        });
      }
      const ride = {
        ...rideData,
        id: `local_${Date.now()}`,
        status: "active",
        createdAt: new Date().toISOString(),
        endedAt: null,
      };
      upsertInList(ride);
      return ride;
    },
  );
}

// ============================================================
// ALL RIDES FOR A USER (newest first) — GET /api/rides/user/{id}?summary=true
//
// Returns lightweight rows: everything except the route geometry and the
// step list (each row has hasRoute instead). Open a ride with getRide()
// to get its full route.
// ============================================================
export async function getUserRides(userId) {
  return withFallback(
    async () => {
      await flushPendingEnds();
      const rides = await apiJson(`${BASE}/user/${userId}?summary=true`);
      const list = Array.isArray(rides) ? rides : [];

      // Cache = the server's list + rides that exist only on this device.
      const localOnly = loadList().filter(
        (r) => isLocalRide(r.id) && String(r.userId) === String(userId),
      );
      writeJson(LIST_KEY, [...localOnly, ...list.map(toSummary)]);
      pruneDetails(list.filter((r) => r.status === "active").map((r) => r.id));
      return [...localOnly, ...list];
    },
    () => loadList().filter((r) => String(r.userId) === String(userId)),
  );
}

// ============================================================
// ONE RIDE, WITH ITS ROUTE — GET /api/rides/{rideId}
// ============================================================
export async function getRide(rideId) {
  const cached = () =>
    readJson(DETAIL_PREFIX + rideId, null) ||
    loadList().find((r) => String(r.id) === String(rideId)) ||
    null;

  if (isLocalRide(rideId)) return cached();

  return withFallback(
    async () => {
      const ride = await apiJson(`${BASE}/${rideId}`);
      cacheDetail(ride);
      return ride;
    },
    cached,
  );
}

// ============================================================
// IS THE RIDE STILL RUNNING? — GET /api/rides/{rideId}?summary=true
// Used by group members to notice that the admin ended the ride.
// Returns the status, "gone" when the ride no longer exists (or this
// rider is no longer part of it), or null when it could not be checked.
// ============================================================
export async function getRideStatus(rideId) {
  if (rideId == null || isLocalRide(rideId)) return null;
  try {
    const ride = await apiJson(`${BASE}/${rideId}?summary=true`);
    return ride?.status ?? null;
  } catch (err) {
    if (err?.status === 404 || err?.status === 403) return "gone";
    return null;
  }
}

// ============================================================
// END A RIDE — PATCH /api/rides/{rideId}/status
//   actualDistanceMeters  how far the rider REALLY rode (tracked live)
// The backend allows this only for the ride's owner / the group admin.
// ============================================================
export async function endRide(rideId, actualDistanceMeters) {
  const hasDistance = isMeasured(actualDistanceMeters);

  const endLocally = () => {
    const list = loadList().map((r) =>
      String(r.id) === String(rideId)
        ? {
            ...r,
            status: "completed",
            endedAt: new Date().toISOString(),
            ...(hasDistance ? { actualDistanceMeters } : {}),
          }
        : r,
    );
    writeJson(LIST_KEY, list);
    remove(DETAIL_PREFIX + rideId);
    return list.find((r) => String(r.id) === String(rideId)) || null;
  };

  if (isLocalRide(rideId)) return endLocally();

  return withFallback(
    async () => {
      const updated = await apiJson(
        `${BASE}/${rideId}/status`,
        jsonBody("PATCH", statusBody(actualDistanceMeters)),
      );
      upsertInList(updated);
      remove(DETAIL_PREFIX + rideId);
      return updated;
    },
    () => {
      // Offline: finish it on this device now, tell the server later.
      const pending = readJson(PENDING_ENDS_KEY, []).filter(
        (item) => String(item.rideId) !== String(rideId),
      );
      pending.push({ rideId, actualDistanceMeters: hasDistance ? actualDistanceMeters : null });
      writeJson(PENDING_ENDS_KEY, pending);
      return endLocally();
    },
  );
}

// ============================================================
// DELETE A RIDE PERMANENTLY — DELETE /api/rides/{rideId}
// Deleting needs the server (it is the only real copy), so there is no
// offline fallback: an offline delete fails with a clear message.
// ============================================================
export async function deleteRide(rideId) {
  if (!isLocalRide(rideId)) {
    await apiJson(`${BASE}/${rideId}`, { method: "DELETE" });
  }
  writeJson(LIST_KEY, loadList().filter((r) => String(r.id) !== String(rideId)));
  remove(DETAIL_PREFIX + rideId);
}

// ============================================================
// PUBLISH MY POSITION (REST) — POST /api/rides/{rideId}/location
//
// The fallback for the live socket in a group ride. Fire-and-forget:
// a lost update only means the marker is a tick older.
// ============================================================
export async function updateUserLocation(rideId, lat, lng, accuracy) {
  if (rideId == null || isLocalRide(rideId)) return;
  try {
    await apiJson(`${BASE}/${rideId}/location`, jsonBody("POST", {
      lat,
      lng,
      ...(Number.isFinite(accuracy) ? { accuracy } : {}),
      timestamp: new Date().toISOString(),
    }));
  } catch (err) {
    console.warn("[rideApi] Position update skipped:", err.message);
  }
}

// ============================================================
// GROUP RIDES
// ============================================================

// Current position of every member who is sharing one.
//   [...]  → the server's list (may legitimately be empty)
//   null   → the request FAILED: keep what is already on the map
export async function getLiveRideLocations(rideId) {
  if (rideId == null || isLocalRide(rideId)) return null;
  try {
    const list = await apiJson(`${BASE}/${rideId}/live-locations`);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn("[rideApi] Live positions unavailable:", err.message);
    return null;
  }
}

// Stop sharing my live position (the REST twin of the socket's "stop").
// Never throws — losing it only means the marker ages out by itself.
export async function clearLiveLocation(rideId) {
  if (rideId == null || isLocalRide(rideId)) return;
  try {
    await apiJson(`${BASE}/${rideId}/live-location`, { method: "DELETE" });
  } catch (err) {
    console.warn("[rideApi] Could not clear the live position:", err.message);
  }
}

// Active riders of a group ride.
//   [...]  → the list     null → the request failed (keep the current list)
export async function getGroupRideParticipants(rideId) {
  if (rideId == null || isLocalRide(rideId)) return null;
  try {
    const list = await apiJson(`${BASE}/${rideId}/participants`);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn("[rideApi] Riders list unavailable:", err.message);
    return null;
  }
}

// A member leaves a group ride. Throws with the server's message.
export async function updateParticipantStatus(rideId, userId, status) {
  return apiJson(`${BASE}/${rideId}/participants/${userId}/status`, jsonBody("PATCH", { status }));
}

// The admin adds a connected rider to a live group ride.
// Throws with the server's message ("already in this ride", …).
export async function addGroupRideParticipant(rideId, adminId, userId) {
  return apiJson(`${BASE}/${rideId}/participants`, jsonBody("POST", { adminId, userId }));
}
