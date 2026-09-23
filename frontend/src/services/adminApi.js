// ============================================================
// 🛡️ adminApi.js — Admin API service
//
// All admin operations go through this file.
// Talks to the Spring Boot backend at /api/admin.
// In Vite dev mode the proxy rewrites /api → localhost:8080.
//
// ENDPOINT MAP (from AdminController.java):
//   GET    /api/admin/dashboard               → getDashboardStats
//   GET    /api/admin/users?search=&page=&size= → getUsers
//   GET    /api/admin/users/{id}              → getUserDetail
//   PATCH  /api/admin/users/{id}/status       → updateUserStatus
//   GET    /api/admin/rides?status=&type=&page=&size= → getRides
//   GET    /api/admin/rides/{id}              → getRideDetail
//
// NOTES:
//   - All endpoints require ADMIN role — returns 403 for normal users
//   - Uses same credentials: "include" pattern as other services
// ============================================================

const BASE = "/api/admin";

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

// ── Dashboard ──

export async function getDashboardStats() {
  const res = await fetch(`${BASE}/dashboard`, { credentials: "include" });
  return handleResponse(res);
}

// ── User Management ──

export async function getUsers(search = "", page = 0, size = 20) {
  const params = new URLSearchParams({ page, size });
  if (search.trim()) params.set("search", search.trim());
  const res = await fetch(`${BASE}/users?${params}`, { credentials: "include" });
  return handleResponse(res);
}

export async function getUserDetail(userId) {
  const res = await fetch(`${BASE}/users/${userId}`, { credentials: "include" });
  return handleResponse(res);
}

export async function updateUserStatus(userId, enabled) {
  const res = await fetch(`${BASE}/users/${userId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ enabled }),
  });
  return handleResponse(res);
}

// ── Ride Monitoring ──

export async function getRides(status = "", type = "", page = 0, size = 20) {
  const params = new URLSearchParams({ page, size });
  if (status.trim()) params.set("status", status.trim());
  if (type.trim()) params.set("type", type.trim());
  const res = await fetch(`${BASE}/rides?${params}`, { credentials: "include" });
  return handleResponse(res);
}

export async function getRideDetail(rideId) {
  const res = await fetch(`${BASE}/rides/${rideId}`, { credentials: "include" });
  return handleResponse(res);
}
