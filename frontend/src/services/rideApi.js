// ============================================================
// 🛣️ rideApi.js — Backend-ready data layer for Ride system
//
// Manages: rides, ride members, ride permissions (roles)
// CURRENT: stores in localStorage
// BACKEND: replace function bodies with fetch() calls
// ============================================================

// Storage keys (use a single key for all rides)
const RIDES_KEY   = "ridewise-rides";       // All rides the user has
const ACTIVE_RIDE = "ridewise-active-ride"; // Currently active ride

// Roles allowed on a ride
export const ROLES = {
  CREATOR: "creator", // Full control (edit, delete, promote)
  EDITOR:  "editor",  // Can edit ride + manage members
  VIEWER:  "viewer",  // Read-only
};

// ============================================================
// INTERNAL HELPERS
// ============================================================

// Get all rides from localStorage
function getAllRides() {
  return JSON.parse(localStorage.getItem(RIDES_KEY) || "[]");
}

function saveAllRides(rides) {
  localStorage.setItem(RIDES_KEY, JSON.stringify(rides));
}

// Find a ride by its ID
function findRide(rideId) {
  return getAllRides().find((r) => r.id === rideId);
}

// ============================================================
// PUBLIC API
// ============================================================

// Create a new ride — returns the full ride object
// BACKEND: POST /api/rides with body { type, from, destination, members }
export async function createRide({ type, from, destination, creatorId, members = [] }) {
  await new Promise((r) => setTimeout(r, 200));

  // Build the ride object
  const ride = {
    id:          "ride_" + Date.now(),
    type:        type,        // "solo" | "group"
    from:        from,        // { name, lat, lng }
    destination: destination, // { name, lat, lng }
    route:       null,        // Filled later by routing API
    creatorId:   creatorId,   // User who created it

    // Members array — first entry is always the creator
    members: [
      { userId: creatorId, role: ROLES.CREATOR, joinedAt: Date.now() },
      // Add other members as VIEWER by default
      ...members.map((m) => ({
        userId:   m.userId,
        role:     ROLES.VIEWER,
        joinedAt: Date.now(),
      })),
    ],

    status:    "planned", // "planned" | "active" | "completed" | "cancelled"
    startedAt: null,
    endedAt:   null,
    createdAt: Date.now(),
  };

  // Save to storage
  const all = getAllRides();
  all.push(ride);
  saveAllRides(all);

  // Mark as active ride
  localStorage.setItem(ACTIVE_RIDE, ride.id);

  return ride;
}

// Get a single ride by ID
// BACKEND: GET /api/rides/:id
export async function getRide(rideId) {
  await new Promise((r) => setTimeout(r, 100));
  return findRide(rideId);
}

// Get the currently active ride (if any)
// BACKEND: GET /api/rides/active
export async function getActiveRide() {
  await new Promise((r) => setTimeout(r, 100));
  const id = localStorage.getItem(ACTIVE_RIDE);
  return id ? findRide(id) : null;
}

// Update ride status — used when starting/ending/completing
// BACKEND: PATCH /api/rides/:id with { status }
export async function updateRideStatus(rideId, status) {
  await new Promise((r) => setTimeout(r, 150));
  const all = getAllRides();
  const idx = all.findIndex((r) => r.id === rideId);
  if (idx === -1) return null;

  all[idx].status = status;
  if (status === "active")                              all[idx].startedAt = Date.now();
  if (status === "completed" || status === "cancelled") all[idx].endedAt   = Date.now();
  saveAllRides(all);
  return all[idx];
}

// Save the calculated route on the ride
// BACKEND: PATCH /api/rides/:id with { route }
export async function saveRoute(rideId, route) {
  await new Promise((r) => setTimeout(r, 150));
  const all = getAllRides();
  const idx = all.findIndex((r) => r.id === rideId);
  if (idx === -1) return null;
  all[idx].route = route;
  saveAllRides(all);
  return all[idx];
}

// Update ride details (from / destination / name etc.)
// Only Creator or Editor can do this (caller checks role)
// BACKEND: PATCH /api/rides/:id with { from, destination }
export async function updateRideDetails(rideId, patch) {
  await new Promise((r) => setTimeout(r, 150));
  const all = getAllRides();
  const idx = all.findIndex((r) => r.id === rideId);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch };
  saveAllRides(all);
  return all[idx];
}

// Add a member to the ride
// Only Creator or Editor can do this
// BACKEND: POST /api/rides/:id/members with { userId }
export async function addMember(rideId, userId) {
  await new Promise((r) => setTimeout(r, 150));
  const all = getAllRides();
  const idx = all.findIndex((r) => r.id === rideId);
  if (idx === -1) return null;

  // Don't add if already a member
  if (all[idx].members.some((m) => m.userId === userId)) return all[idx];

  all[idx].members.push({
    userId, role: ROLES.VIEWER, joinedAt: Date.now(),
  });
  saveAllRides(all);
  return all[idx];
}

// Remove a member from the ride
// Only Creator can remove others; Editor can remove themselves only
// BACKEND: DELETE /api/rides/:id/members/:userId
export async function removeMember(rideId, userId) {
  await new Promise((r) => setTimeout(r, 150));
  const all = getAllRides();
  const idx = all.findIndex((r) => r.id === rideId);
  if (idx === -1) return null;
  all[idx].members = all[idx].members.filter((m) => m.userId !== userId);
  saveAllRides(all);
  return all[idx];
}

// Change a member's role (promote/demote) — only Creator
// BACKEND: PATCH /api/rides/:id/members/:userId with { role }
export async function changeMemberRole(rideId, userId, newRole) {
  await new Promise((r) => setTimeout(r, 150));
  const all = getAllRides();
  const idx = all.findIndex((r) => r.id === rideId);
  if (idx === -1) return null;

  // Cannot change the creator's role
  const ride = all[idx];
  if (ride.creatorId === userId) return ride;

  ride.members = ride.members.map((m) =>
    m.userId === userId ? { ...m, role: newRole } : m
  );
  saveAllRides(all);
  return ride;
}

// Get all rides the user has (history)
// BACKEND: GET /api/users/:userId/rides
export async function getUserRides(userId) {
  await new Promise((r) => setTimeout(r, 150));
  return getAllRides().filter(
    (r) => r.creatorId === userId || r.members.some((m) => m.userId === userId)
  );
}

// ============================================================
// PERMISSION HELPERS (used everywhere in the UI)
// ============================================================

// Get the user's role on a specific ride
export function getRole(ride, userId) {
  if (!ride || !userId) return null;
  const member = ride.members.find((m) => m.userId === userId);
  return member?.role || null;
}

// Can this user edit the ride?
export function canEdit(ride, userId) {
  const role = getRole(ride, userId);
  return role === ROLES.CREATOR || role === ROLES.EDITOR;
}

// Can this user delete/end the ride?
export function canDelete(ride, userId) {
  return getRole(ride, userId) === ROLES.CREATOR;
}

// Can this user promote/demote members?
export function canManageRoles(ride, userId) {
  return getRole(ride, userId) === ROLES.CREATOR;
}

// Clear active ride (used when closing map without ending)
export function clearActiveRide() {
  localStorage.removeItem(ACTIVE_RIDE);
}
