// ============================================================
// ridersApi.js — rider search and connections
//
// ENDPOINTS (RidersController.java):
//   GET   /api/riders/search?query=      → searchRiders
//   GET   /api/riders/nearby             → getNearRiders
//   GET   /api/riders/connections        → getConnectionsFull
//   POST  /api/riders/add    { riderId } → addRider
//   POST  /api/riders/remove { riderId } → removeRider
//
// The backend always acts for the logged-in session, so no user id is
// sent. Every function throws an ApiError carrying the server's message
// on failure, so callers can show it.
//
// A rider object: { id, username, email, address, distance? }
//   distance (km) is present in "nearby" results only. Other riders'
//   coordinates and phone numbers are never sent to the browser, and the
//   email of a rider you are not connected with arrives only as a hint
//   ("r•••@example.com").
// ============================================================

import { apiJson, jsonBody } from "./http";

const BASE = "/api/riders";

// Riders whose username or email contains the query (top 20).
export async function searchRiders(query) {
  const q = (query || "").trim();
  if (!q) return [];
  return apiJson(`${BASE}/search?${new URLSearchParams({ query: q })}`);
}

// Returns { success } — false when already connected.
export async function addRider(riderId) {
  return apiJson(`${BASE}/add`, jsonBody("POST", { riderId }));
}

// Returns { success } — false when not connected.
export async function removeRider(riderId) {
  return apiJson(`${BASE}/remove`, jsonBody("POST", { riderId }));
}

// Everyone the logged-in rider is connected with, by name.
export async function getConnectionsFull() {
  return apiJson(`${BASE}/connections`);
}

// Riders within 50 km of MY saved location, nearest first.
// Rejects with status 409 when no location has been saved yet — save one
// with AuthContext's updateProfile({ lat, lng }) first.
export async function getNearRiders() {
  return apiJson(`${BASE}/nearby`);
}
