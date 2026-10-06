// ============================================================
// fleetUi.js — the words, icons and small calculations every
// organization / fleet screen shares
//
// Kept in one module so "Servicing", "Filling up" or "45 seconds without
// a position means signal lost" are decided exactly once.
// (No components here — see kit.jsx for those.)
// ============================================================

import { shortPlaceName } from "../../../services/routingApi.js";

// ── Organizations ────────────────────────────────────────────
export const ORG_TYPES = [
  { id: "COLLEGE",   label: "College",           icon: "building" },
  { id: "SCHOOL",    label: "School",            icon: "building" },
  { id: "HOSPITAL",  label: "Hospital",          icon: "ambulance" },
  { id: "COMPANY",   label: "Company",           icon: "building" },
  { id: "TRANSPORT", label: "Transport service", icon: "bus" },
  { id: "OTHER",     label: "Other",             icon: "building" },
];

export const orgType = (id) => ORG_TYPES.find((type) => type.id === id) || ORG_TYPES[ORG_TYPES.length - 1];

export const ROLE_LABEL = { OWNER: "Owner", ADMIN: "Admin", DRIVER: "Driver", VIEWER: "Viewer" };

export const ROLE_HINT = {
  ADMIN: "Manages vehicles, routes, drivers and trips. Can also drive.",
  DRIVER: "Starts and ends trips on the organization's vehicles.",
  VIEWER: "Sees the fleet live, but cannot drive or change anything.",
};

// ── Vehicles ─────────────────────────────────────────────────
export const VEHICLE_TYPES = [
  { id: "BUS",       label: "Bus",       icon: "bus" },
  { id: "VAN",       label: "Van",       icon: "van" },
  { id: "AMBULANCE", label: "Ambulance", icon: "ambulance" },
  { id: "CAR",       label: "Car",       icon: "car" },
  { id: "OTHER",     label: "Other",     icon: "ride" },
];

export const vehicleType = (id) => VEHICLE_TYPES.find((type) => type.id === id) || VEHICLE_TYPES[VEHICLE_TYPES.length - 1];

export const VEHICLE_STATUSES = [
  { id: "ACTIVE",     label: "Active",    hint: "Drivers can take it out",       tone: "ok" },
  { id: "IN_SERVICE", label: "Servicing", hint: "Away for its regular service",  tone: "warn" },
  { id: "REPAIR",     label: "Repair",    hint: "Broken down or being repaired", tone: "danger" },
  { id: "RETIRED",    label: "Retired",   hint: "No longer used — history kept", tone: "neutral" },
];

export const vehicleStatus = (id) => VEHICLE_STATUSES.find((status) => status.id === id) || VEHICLE_STATUSES[0];

// How full the vehicle is — set by its driver.
export const CROWD_LEVELS = [
  { id: "LOW",    label: "Seats free", tone: "ok" },
  { id: "MEDIUM", label: "Filling up", tone: "warn" },
  { id: "FULL",   label: "Full",       tone: "danger" },
];

export const crowdLevel = (id) => CROWD_LEVELS.find((level) => level.id === id) || null;

// ── Live state of a vehicle ──────────────────────────────────
// No position for this long while on a trip → shown as "signal lost"
// (the marker turns grey; it is NOT removed — the last place it was seen
// is still the best information there is).
export const STALE_AFTER_MS = 45_000;

/**
 * Stamp freshly fetched vehicles with WHEN their position was seen, on
 * this device's clock. The server sends "ageSeconds"; subtracting it from
 * the time the answer arrived makes the result independent of any
 * difference between the two clocks.
 */
export function stampVehicles(vehicles, fetchedAt = Date.now()) {
  return (vehicles || []).map((vehicle) => stampVehicle(vehicle, fetchedAt));
}

export function stampVehicle(vehicle, fetchedAt = Date.now()) {
  if (!vehicle?.trip) return vehicle;
  const age = Number(vehicle.trip.ageSeconds);
  return {
    ...vehicle,
    trip: { ...vehicle.trip, seenAt: Number.isFinite(age) ? fetchedAt - age * 1000 : null },
  };
}

/** Apply one live "position" event to a vehicle. */
export function applyPosition(vehicle, event, receivedAt = Date.now()) {
  if (!vehicle?.trip || vehicle.trip.sessionId !== event.sessionId) return vehicle;
  return {
    ...vehicle,
    trip: {
      ...vehicle.trip,
      lat: event.lat,
      lng: event.lng,
      speed: event.speed ?? null,
      heading: event.heading ?? vehicle.trip.heading ?? null,
      accuracy: event.accuracy ?? null,
      distanceMeters: event.distanceMeters ?? vehicle.trip.distanceMeters,
      seenAt: receivedAt,
    },
  };
}

/** Has a vehicle on a trip gone quiet? (An emergency can be stale too.) */
export function isStale(trip, now) {
  return Boolean(trip) && trip.seenAt != null && now - trip.seenAt > STALE_AFTER_MS;
}

// "sos" | "live" | "stale" | "starting" | "idle" | "off"
// An emergency outranks everything: it is what must be seen first, whether
// or not the vehicle is still reporting (ask isStale for that).
export function liveState(vehicle, now) {
  const trip = vehicle?.trip;
  if (!trip) return vehicle?.status === "ACTIVE" ? "idle" : "off";
  if (trip.sos) return "sos";
  if (!Number.isFinite(trip.lat) || !Number.isFinite(trip.lng)) return "starting";
  if (isStale(trip, now)) return "stale";
  return "live";
}

export const LIVE_STATE = {
  sos:      { label: "Emergency",         tone: "danger" },
  live:     { label: "Live",              tone: "ok" },
  stale:    { label: "Signal lost",       tone: "warn" },
  starting: { label: "Starting…",         tone: "neutral" },
  idle:     { label: "Not on a trip",     tone: "neutral" },
  off:      { label: "Not in use",        tone: "neutral" },
};

/** The map position of a vehicle: live when on a trip, else where it was last parked. */
export function vehiclePosition(vehicle) {
  const trip = vehicle?.trip;
  if (trip && Number.isFinite(trip.lat) && Number.isFinite(trip.lng)) {
    return { lat: trip.lat, lng: trip.lng, heading: trip.heading ?? null };
  }
  if (Number.isFinite(vehicle?.lastLat) && Number.isFinite(vehicle?.lastLng)) {
    return { lat: vehicle.lastLat, lng: vehicle.lastLng, heading: null };
  }
  return null;
}

/** A vehicle as FleetMapView draws it. */
export function toMapVehicle(vehicle, now) {
  const position = vehiclePosition(vehicle);
  if (!position) return null;
  return {
    id: vehicle.id,
    code: vehicle.vehicleCode,
    type: vehicle.vehicleType,
    lat: position.lat,
    lng: position.lng,
    heading: position.heading,
    state: liveState(vehicle, now),
  };
}

// ── A trip as the navigation engine / RideMap understand it ──
// (They were written for rides; a vehicle trip has the same shape.)
export function tripAsRide(session, route) {
  if (!session) return null;
  return {
    id: `vs-${session.id}`,
    status: session.status === "ACTIVE" ? "active" : "completed",
    fromName: session.fromName,
    fromLat: session.fromLat,
    fromLng: session.fromLng,
    destinationName: session.destinationName,
    destinationLat: session.destinationLat,
    destinationLng: session.destinationLng,
    routeCoordinates: route?.routeCoordinates || null,
    routeSteps: route?.routeSteps || null,
    distanceMeters: session.plannedDistanceMeters,
    durationSeconds: session.plannedDurationSeconds,
  };
}

export function tripTitle(trip) {
  if (!trip) return "";
  if (trip.routeName) return trip.routeName;
  const destination = shortPlaceName(trip.destinationName, "");
  return destination ? `To ${destination}` : "On a trip";
}

// ── Time ─────────────────────────────────────────────────────
export function timeAgo(ms, now) {
  if (!Number.isFinite(ms)) return "";
  const seconds = Math.max(0, Math.round((now - ms) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds} s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(ms).toLocaleDateString([], { day: "numeric", month: "short" });
}

export const parseTime = (iso) => {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
};

export function formatDateTime(iso) {
  const ms = parseTime(iso);
  if (ms == null) return "—";
  return new Date(ms).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function formatDay(iso) {
  const ms = parseTime(iso);
  if (ms == null) return "—";
  return new Date(ms).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

export function formatClockTime(iso) {
  const ms = parseTime(iso);
  if (ms == null) return "—";
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Start → end of a finished trip, in seconds (null while it runs). */
export function tripSeconds(session) {
  const start = parseTime(session?.startedAt);
  const end = parseTime(session?.endedAt);
  if (start == null || end == null) return null;
  return Math.max(0, Math.round((end - start) / 1000));
}

export const END_REASON = {
  DRIVER: "Ended by the driver",
  ADMIN: "Ended by an admin",
  TIMEOUT: "Ended automatically — the phone went silent",
  REMOVED: "Ended — the driver was no longer active",
  VEHICLE: "Ended — the vehicle was removed",
  ORG: "Ended — the organization was closed or suspended",
};

// ── Text ─────────────────────────────────────────────────────
export function initials(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export const kmh = (metresPerSecond) =>
  Number.isFinite(metresPerSecond) ? Math.round(metresPerSecond * 3.6) : null;

export const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

// ── Files ────────────────────────────────────────────────────
// A spreadsheet treats a cell starting with = + - @ as a formula. Names in
// an export come from people, so such a cell is given a leading apostrophe.
export function csvCell(value) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadCsv(filename, header, rows) {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(","));
  // The BOM makes Excel read the file as UTF-8 (names in any script).
  const blob = new Blob(["﻿", lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
