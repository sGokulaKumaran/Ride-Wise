// ============================================================
// 👥 ridersApi — Mock API for the Riders feature
//
// All these functions read/write localStorage.
// When you add a backend, replace the bodies with fetch() calls.
// ============================================================

const ACCOUNTS_KEY = "ridewise-all-accounts";
const CONNECTIONS_KEY = "ridewise-connections";

// ── INTERNAL: read all accounts ──
function getAllAccounts() {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]");
  } catch (_) {
    return [];
  }
}

// ── INTERNAL: read connections for a user ──
function getConnections(userId) {
  if (!userId) return [];
  try {
    const all = JSON.parse(localStorage.getItem(CONNECTIONS_KEY) || "{}");
    return all[userId] || [];
  } catch (_) {
    return [];
  }
}

// ── INTERNAL: write connections for a user ──
function setConnections(userId, list) {
  if (!userId) return;
  try {
    const all = JSON.parse(localStorage.getItem(CONNECTIONS_KEY) || "{}");
    all[userId] = list;
    localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(all));
  } catch (err) {
    console.error("Failed to save connections:", err);
  }
}

// ── INTERNAL: Haversine distance in km ──
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

// searchRiders(query, currentUserId)
export async function searchRiders(query, currentUserId) {
  await new Promise((r) => setTimeout(r, 300));

  const q = (query || "").trim().toLowerCase();
  if (!q) return [];

  return getAllAccounts().filter((u) => {
    if (u.id === currentUserId) return false;
    const username = (u.username || "").toLowerCase();
    const email = (u.email || "").toLowerCase();
    return username.includes(q) || email.includes(q);
  });
}

// addRider(userId, riderId)
export async function addRider(userId, riderId) {
  await new Promise((r) => setTimeout(r, 250));
  if (!userId || !riderId) return { success: false, error: "Missing IDs" };
  if (userId === riderId) return { success: false, error: "Cannot add yourself" };

  const list = getConnections(userId);
  if (list.includes(riderId)) return { success: false, error: "Already in your connections" };

  list.push(riderId);
  setConnections(userId, list);
  return { success: true };
}

// removeRider(userId, riderId)
export async function removeRider(userId, riderId) {
  await new Promise((r) => setTimeout(r, 250));
  if (!userId || !riderId) return { success: false, error: "Missing IDs" };

  const list = getConnections(userId);
  if (!list.includes(riderId)) return { success: false, error: "Not in connections" };

  setConnections(userId, list.filter((id) => id !== riderId));
  return { success: true };
}

// getConnectionsFull(userId)
export async function getConnectionsFull(userId) {
  await new Promise((r) => setTimeout(r, 200));
  if (!userId) return [];
  const ids = getConnections(userId);
  return getAllAccounts().filter((u) => ids.includes(u.id));
}

// getNearRiders(userId)
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
    .filter((u) => u.lat != null && u.lng != null)
    .map((u) => ({
      ...u,
      distance: distanceKm(myLat, myLng, u.lat, u.lng),
    }))
    .filter((u) => u.distance <= RADIUS_KM)
    .sort((a, b) => a.distance - b.distance);
}

// isConnected(userId, riderId)
export function isConnected(userId, riderId) {
  return getConnections(userId).includes(riderId);
}

// getAllRidersCount()
export function getAllRidersCount() {
  return getAllAccounts().filter((u) => u.email).length;
}