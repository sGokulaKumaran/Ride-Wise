// ============================================================
// orgApi.js — organizations, fleets and vehicle trips
//
// The contract is the backend's dto/OrgDtos.java; every function here is
// one endpoint. All of them throw an ApiError carrying the server's own
// message ("BUS-01 is in use by Arun right now.") — screens show it as is.
//
//   organizations   /api/organizations…          find, open, create, edit
//   people          …/members, …/invitations     invite, roles, leave
//   fleet           …/vehicles, …/routes         vehicles and saved routes
//   insight         …/dashboard, /analytics, /activity, /announcements, /trips
//   trips           /api/vehicle-sessions…       a driver's trip
//   alerts          /api/vehicle-alerts          "tell me when it is near"
//   platform        /api/admin/organizations     RideWise's own admins
// ============================================================

import { apiJson, jsonBody } from "./http";

const ORGS = "/api/organizations";
const TRIPS = "/api/vehicle-sessions";

const query = (params) => {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, value);
  });
  const text = search.toString();
  return text ? `?${text}` : "";
};

// The browser's offset from UTC in minutes (east positive) — the server
// uses it so that "today" and each day of the statistics are MY days.
const tzOffset = () => -new Date().getTimezoneOffset();

// ── Mine ─────────────────────────────────────────────────────
export const getMyOrganizations = () => apiJson(`${ORGS}/me`);
export const getSavedOrganizations = () => apiJson(`${ORGS}/saved`);

// ── Find and open ────────────────────────────────────────────
export const searchOrganizations = (text, options) =>
  apiJson(`${ORGS}/search${query({ q: text })}`, options);
export const openPrivateOrganization = (orgCode, password) =>
  apiJson(`${ORGS}/access`, jsonBody("POST", { orgCode, password }));
export const saveOrganization = (orgId) => apiJson(`${ORGS}/${orgId}/saved`, { method: "PUT" });
export const unsaveOrganization = (orgId) => apiJson(`${ORGS}/${orgId}/saved`, { method: "DELETE" });

// ── One organization ─────────────────────────────────────────
export const createOrganization = (details) => apiJson(ORGS, jsonBody("POST", details));
export const getOrganization = (orgId) => apiJson(`${ORGS}/${orgId}`);
export const updateOrganization = (orgId, changes) => apiJson(`${ORGS}/${orgId}`, jsonBody("PATCH", changes));
export const deleteOrganization = (orgId) => apiJson(`${ORGS}/${orgId}`, { method: "DELETE" });
export const setAccessPassword = (orgId, password, revokeExisting) =>
  apiJson(`${ORGS}/${orgId}/access-password`, jsonBody("PUT", { password, revokeExisting }));
export const getAccessHolders = (orgId, page = 0, size = 30) =>
  apiJson(`${ORGS}/${orgId}/access${query({ page, size })}`);
export const revokeAccess = (orgId, userId) => apiJson(`${ORGS}/${orgId}/access/${userId}`, { method: "DELETE" });

// ── People ───────────────────────────────────────────────────
export const getMembers = (orgId) => apiJson(`${ORGS}/${orgId}/members`);
export const inviteMember = (orgId, identifier, role) =>
  apiJson(`${ORGS}/${orgId}/members`, jsonBody("POST", { identifier, role }));
export const updateMember = (orgId, memberId, changes) =>
  apiJson(`${ORGS}/${orgId}/members/${memberId}`, jsonBody("PATCH", changes));
export const removeMember = (orgId, memberId) =>
  apiJson(`${ORGS}/${orgId}/members/${memberId}`, { method: "DELETE" });
export const leaveOrganization = (orgId) => apiJson(`${ORGS}/${orgId}/leave`, { method: "POST" });
export const transferOwnership = (orgId, memberId) =>
  apiJson(`${ORGS}/${orgId}/transfer`, jsonBody("POST", { memberId }));
export const acceptInvitation = (memberId) =>
  apiJson(`${ORGS}/invitations/${memberId}/accept`, { method: "POST" });
export const rejectInvitation = (memberId) =>
  apiJson(`${ORGS}/invitations/${memberId}/reject`, { method: "POST" });

// ── Vehicles ─────────────────────────────────────────────────
export const getVehicles = (orgId) => apiJson(`${ORGS}/${orgId}/vehicles`);
export const getVehicleDetail = (orgId, vehicleId) => apiJson(`${ORGS}/${orgId}/vehicles/${vehicleId}`);
export const addVehicle = (orgId, vehicle) => apiJson(`${ORGS}/${orgId}/vehicles`, jsonBody("POST", vehicle));
export const updateVehicle = (orgId, vehicleId, changes) =>
  apiJson(`${ORGS}/${orgId}/vehicles/${vehicleId}`, jsonBody("PATCH", changes));
export const setVehicleStatus = (orgId, vehicleId, status) =>
  apiJson(`${ORGS}/${orgId}/vehicles/${vehicleId}/status`, jsonBody("PUT", { status }));
export const removeVehicle = (orgId, vehicleId) =>
  apiJson(`${ORGS}/${orgId}/vehicles/${vehicleId}`, { method: "DELETE" });

// ── Saved routes ─────────────────────────────────────────────
export const getRoutes = (orgId) => apiJson(`${ORGS}/${orgId}/routes`);
export const getRouteDetail = (orgId, routeId) => apiJson(`${ORGS}/${orgId}/routes/${routeId}`);
export const addRoute = (orgId, route) => apiJson(`${ORGS}/${orgId}/routes`, jsonBody("POST", route));
export const updateRoute = (orgId, routeId, changes) =>
  apiJson(`${ORGS}/${orgId}/routes/${routeId}`, jsonBody("PATCH", changes));
export const removeRoute = (orgId, routeId) => apiJson(`${ORGS}/${orgId}/routes/${routeId}`, { method: "DELETE" });

// ── What the admins look at ──────────────────────────────────
export const getDashboard = (orgId) => apiJson(`${ORGS}/${orgId}/dashboard${query({ tz: tzOffset() })}`);
export const getAnalytics = (orgId, days) =>
  apiJson(`${ORGS}/${orgId}/analytics${query({ days, tz: tzOffset() })}`);
export const getActivity = (orgId, limit = 50) => apiJson(`${ORGS}/${orgId}/activity${query({ limit })}`);
export const getOrgTrips = (orgId, filters = {}) => apiJson(`${ORGS}/${orgId}/trips${query(filters)}`);

// ── Announcements ────────────────────────────────────────────
export const getAnnouncements = (orgId) => apiJson(`${ORGS}/${orgId}/announcements`);
export const postAnnouncement = (orgId, announcement) =>
  apiJson(`${ORGS}/${orgId}/announcements`, jsonBody("POST", announcement));
export const removeAnnouncement = (orgId, announcementId) =>
  apiJson(`${ORGS}/${orgId}/announcements/${announcementId}`, { method: "DELETE" });

// ── A driver's trip ──────────────────────────────────────────
export const startTrip = (request) => apiJson(TRIPS, jsonBody("POST", request));
export const getActiveTrip = () => apiJson(`${TRIPS}/active`); // null when there is none
export const getMyTrips = (page = 0, size = 20) => apiJson(`${TRIPS}/mine${query({ page, size })}`);
export const stopTrip = (sessionId) => apiJson(`${TRIPS}/${sessionId}/stop`, { method: "POST" });
export const forceEndTrip = (sessionId) => apiJson(`${TRIPS}/${sessionId}/end`, { method: "POST" });
export const getTripTrack = (sessionId) => apiJson(`${TRIPS}/${sessionId}/track`);
export const setTripSos = (sessionId, active, message) =>
  apiJson(`${TRIPS}/${sessionId}/sos`, jsonBody("PUT", { active, message }));
export const setTripCrowd = (sessionId, level) =>
  apiJson(`${TRIPS}/${sessionId}/crowd`, jsonBody("PUT", { level }));

// One GPS fix over plain HTTP — the fallback for when the live socket is
// down. Resolves to { accepted }.
export const postTripPosition = (sessionId, fix) =>
  apiJson(`${TRIPS}/${sessionId}/position`, jsonBody("POST", {
    lat: fix.lat,
    lng: fix.lng,
    accuracy: fix.accuracy ?? null,
    speed: fix.speed ?? null,
    heading: fix.heading ?? null,
    timestamp: fix.timestamp ?? null,
  }));

// ── "Tell me when it is near" ────────────────────────────────
export const saveVehicleAlert = (alert) => apiJson("/api/vehicle-alerts", jsonBody("PUT", alert));
export const removeVehicleAlert = (vehicleId) => apiJson(`/api/vehicle-alerts/${vehicleId}`, { method: "DELETE" });

// ── RideWise's own admins ────────────────────────────────────
export const adminGetOrganizations = (search = "", page = 0, size = 20) =>
  apiJson(`/api/admin/organizations${query({ search: search.trim(), page, size })}`);
export const adminUpdateOrganization = (orgId, changes) =>
  apiJson(`/api/admin/organizations/${orgId}`, jsonBody("PATCH", changes));
