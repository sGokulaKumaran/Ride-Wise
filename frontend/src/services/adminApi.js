// ============================================================
// adminApi.js — admin panel API
//
// ENDPOINTS (AdminController.java) — all require the ADMIN role:
//   GET   /api/admin/dashboard                         → getDashboardStats
//   GET   /api/admin/users?search=&page=&size=         → getUsers
//   GET   /api/admin/users/{id}                        → getUserDetail
//   PATCH /api/admin/users/{id}/status                 → updateUserStatus
//   GET   /api/admin/rides?status=&type=&page=&size=   → getRides
//   GET   /api/admin/rides/{id}                        → getRideDetail
//
// Every function throws an ApiError with the server's message on failure.
// ============================================================

import { apiJson, jsonBody } from "./http";

const BASE = "/api/admin";

// ── Dashboard ──
export async function getDashboardStats() {
  return apiJson(`${BASE}/dashboard`);
}

// ── User management ──
export async function getUsers(search = "", page = 0, size = 20) {
  const params = new URLSearchParams({ page, size });
  if (search.trim()) params.set("search", search.trim());
  return apiJson(`${BASE}/users?${params}`);
}

export async function getUserDetail(userId) {
  return apiJson(`${BASE}/users/${userId}`);
}

export async function updateUserStatus(userId, enabled) {
  return apiJson(`${BASE}/users/${userId}/status`, jsonBody("PATCH", { enabled }));
}

// ── Ride monitoring ──
export async function getRides(status = "", type = "", page = 0, size = 20) {
  const params = new URLSearchParams({ page, size });
  if (status.trim()) params.set("status", status.trim());
  if (type.trim()) params.set("type", type.trim());
  return apiJson(`${BASE}/rides?${params}`);
}

export async function getRideDetail(rideId) {
  return apiJson(`${BASE}/rides/${rideId}`);
}
