// ============================================================
// 🗄️ ridersApi.js — Backend-ready data layer for the Riders feature
//
// IMPORTANT:
//   - NO seed/dummy users. Lists are empty until real signups.
//   - Reads from "ridewise-all-accounts" (written by AuthContext)
//   - When backend is ready, replace function bodies with fetch()
// ============================================================

const ACCOUNTS_KEY  = "ridewise-all-accounts";
const CONNECTIONS_KEY = "ridewise-connections";

// ── INTERNAL HELPERS ──

function getAllAccounts() {
  return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]");
}

function getConnections(userId) {
  const all = JSON.parse(localStorage.getItem(CONNECTIONS_KEY) || "{}");
  return all[userId] || [];
}

function setConnections(userId, list) {
  const all = JSON.parse(localStorage.getItem(CONNECTIONS_KEY) || "{}");
  all[userId] = list;
  localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(all));
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── PUBLIC API ──

// BACKEND: GET /api/users/search?q=...&exclude=:currentUserId
export async function searchRiders(query, currentUserId) {
  await new Promise((r) => setTimeout(r, 300));
  const q = (query || "").trim().toLowerCase();
  if (!q) return [];
  return getAllAccounts()
    .filter((u) => u.id !== currentUserId)
    .filter(
      (u) =>
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.email    && u.email.toLowerCase().includes(q))
    );
}

// BACKEND: POST /api/connections
export async function addRider(userId, riderId) {
  await new Promise((r) => setTimeout(r, 250));
  const list = getConnections(userId);
  if (list.includes(riderId)) return { success: false, error: "Already added" };
  setConnections(userId, [...list, riderId]);
  return { success: true };
}

// BACKEND: DELETE /api/connections/:userId/:riderId
export async function removeRider(userId, riderId) {
  await new Promise((r) => setTimeout(r, 250));
  const list = getConnections(userId);
  if (!list.includes(riderId)) return { success: false, error: "Not in connections" };
  setConnections(userId, list.filter((id) => id !== riderId));
  return { success: true };
}

// BACKEND: GET /api/connections/:userId
export async function getConnectionsFull(userId) {
  await new Promise((r) => setTimeout(r, 200));
  const ids = getConnections(userId);
  return getAllAccounts().filter((u) => ids.includes(u.id));
}

// BACKEND: GET /api/riders/nearby?lat=...&lng=...
export async function getNearRiders(userId) {
  await new Promise((r) => setTimeout(r, 300));

  const all = getAllAccounts();
  const me = all.find((u) => u.id === userId);
  if (!me) return [];

  const myLat = me.lat ?? 13.0827;
  const myLng = me.lng ?? 80.2707;
  const RADIUS_KM = 50;

  return all
    .filter((u) => u.id !== userId)
    .map((u) => ({
      ...u,
      distance:
        u.lat != null && u.lng != null
          ? distanceKm(myLat, myLng, u.lat, u.lng)
          : null,
    }))
    .filter((u) => u.distance !== null && u.distance <= RADIUS_KM)
    .sort((a, b) => a.distance - b.distance);
}

// BACKEND: GET /api/connections/:userId/has/:riderId
export function isConnected(userId, riderId) {
  return getConnections(userId).includes(riderId);
}