// ============================================================
// Organization fleets — the pure logic behind the live screens
//
//   node --test tests/
//
// Covered here (no browser, no network — fetch is scripted):
//   • when a vehicle counts as live, stale, starting, idle … and that an
//     emergency outranks all of them
//   • "how old is this position" is measured on THIS device's clock
//   • a live position event only ever touches the trip it belongs to
//   • a route planned THROUGH stops: the request, and directions that say
//     "Stop: <name>" instead of "arrive at your destination" at every stop
//   • exports cannot smuggle a formula into a spreadsheet
// ============================================================

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  STALE_AFTER_MS,
  applyPosition,
  csvCell,
  initials,
  isStale,
  liveState,
  plural,
  stampVehicle,
  timeAgo,
  toMapVehicle,
  tripAsRide,
  tripSeconds,
} from "../src/pages/components/org/fleetUi.js";
import { fetchRoutes, stepIconName } from "../src/services/routingApi.js";

const NOW = 1_800_000_000_000;

const parked = (extra = {}) => ({ id: 7, vehicleCode: "BUS-07", vehicleType: "BUS", status: "ACTIVE", trip: null, ...extra });
const onTrip = (trip = {}) => parked({
  trip: { sessionId: 40, lat: 13.05, lng: 80.25, speed: 9, heading: 90, sos: false, ageSeconds: 3, ...trip },
});

// ── Live state ───────────────────────────────────────────────
test("a vehicle without a trip is idle, or off when it is not in service", () => {
  assert.equal(liveState(parked(), NOW), "idle");
  assert.equal(liveState(parked({ status: "REPAIR" }), NOW), "off");
  assert.equal(liveState(parked({ status: "RETIRED" }), NOW), "off");
});

test("the age the server reports becomes a moment on this device's clock", () => {
  const vehicle = stampVehicle(onTrip({ ageSeconds: 12 }), NOW);
  assert.equal(vehicle.trip.seenAt, NOW - 12_000);
  assert.equal(stampVehicle(parked(), NOW).trip, null, "nothing to stamp without a trip");
});

test("a trip is live while positions arrive and stale once they stop", () => {
  const vehicle = stampVehicle(onTrip({ ageSeconds: 3 }), NOW);
  assert.equal(liveState(vehicle, NOW), "live");
  assert.equal(liveState(vehicle, NOW + STALE_AFTER_MS - 5_000), "live");
  assert.equal(liveState(vehicle, NOW + STALE_AFTER_MS + 5_000), "stale");
  assert.equal(isStale(vehicle.trip, NOW + STALE_AFTER_MS + 5_000), true);
});

test("a trip that has not reported a position yet is starting, not live", () => {
  const vehicle = stampVehicle(onTrip({ lat: null, lng: null, ageSeconds: null }), NOW);
  assert.equal(liveState(vehicle, NOW), "starting");
  assert.equal(toMapVehicle(vehicle, NOW), null, "nothing is drawn where nothing is known");
});

test("an emergency outranks every other state — and can still be stale", () => {
  const vehicle = stampVehicle(onTrip({ sos: true, ageSeconds: 600 }), NOW);
  assert.equal(liveState(vehicle, NOW), "sos");
  assert.equal(isStale(vehicle.trip, NOW), true, "the screen must still say the position is old");
});

// ── Live positions ───────────────────────────────────────────
test("a position event moves the vehicle of that trip only", () => {
  const vehicle = stampVehicle(onTrip(), NOW);
  const event = { type: "position", vehicleId: 7, sessionId: 40, lat: 13.06, lng: 80.26, speed: 12, heading: null, distanceMeters: 900 };

  const moved = applyPosition(vehicle, event, NOW + 2_000);
  assert.equal(moved.trip.lat, 13.06);
  assert.equal(moved.trip.seenAt, NOW + 2_000);
  assert.equal(moved.trip.heading, 90, "a fix without a heading keeps the last known one");
  assert.equal(moved.trip.distanceMeters, 900);
  assert.equal(vehicle.trip.lat, 13.05, "the previous object is not mutated");

  // An event of an older trip (it arrived late) changes nothing.
  assert.equal(applyPosition(vehicle, { ...event, sessionId: 39 }, NOW), vehicle);
  assert.equal(applyPosition(parked(), event, NOW).trip, null);
});

test("the map shows a trip's position, else where the vehicle was last parked", () => {
  const live = toMapVehicle(stampVehicle(onTrip(), NOW), NOW);
  assert.deepEqual([live.lat, live.lng, live.state, live.code], [13.05, 80.25, "live", "BUS-07"]);

  const resting = toMapVehicle(parked({ lastLat: 12.9, lastLng: 80.1 }), NOW);
  assert.deepEqual([resting.lat, resting.lng, resting.state, resting.heading], [12.9, 80.1, "idle", null]);

  assert.equal(toMapVehicle(parked(), NOW), null, "never seen → not on the map");
});

// ── A trip in the shape the navigation engine understands ────
test("a vehicle trip is handed to the navigation engine as a ride", () => {
  const ride = tripAsRide(
    { id: 40, status: "ACTIVE", destinationName: "Central", destinationLat: 13.08, destinationLng: 80.27,
      plannedDistanceMeters: 4300, plannedDurationSeconds: 780 },
    { routeCoordinates: "[[80.25,13.05],[80.27,13.08]]", routeSteps: null },
  );
  assert.equal(ride.id, "vs-40", "its stored progress can never collide with a personal ride's");
  assert.equal(ride.status, "active");
  assert.equal(ride.distanceMeters, 4300);
  assert.equal(ride.routeCoordinates, "[[80.25,13.05],[80.27,13.08]]");
  assert.equal(tripAsRide(null, null), null);
});

// ── Small things people read ─────────────────────────────────
test("times are told the way a person would", () => {
  assert.equal(timeAgo(NOW - 4_000, NOW), "just now");
  assert.equal(timeAgo(NOW - 40_000, NOW), "40 s ago");
  assert.equal(timeAgo(NOW - 5 * 60_000, NOW), "5 min ago");
  assert.equal(timeAgo(NOW - 3 * 3_600_000, NOW), "3 h ago");
  assert.equal(timeAgo(NaN, NOW), "");
  assert.equal(tripSeconds({ startedAt: "2026-01-01T10:00:00Z", endedAt: "2026-01-01T10:12:30Z" }), 750);
  assert.equal(tripSeconds({ startedAt: "2026-01-01T10:00:00Z", endedAt: null }), null, "still running");
});

test("initials and plurals", () => {
  assert.equal(initials("Riverside Engineering College"), "RE");
  assert.equal(initials("Metro"), "ME");
  assert.equal(initials(""), "?");
  assert.equal(plural(1, "vehicle"), "1 vehicle");
  assert.equal(plural(4, "vehicle"), "4 vehicles");
  assert.equal(plural(1, "person", "people"), "1 person");
});

test("an export cannot smuggle a formula into a spreadsheet", () => {
  assert.equal(csvCell("BUS-01"), "BUS-01");
  assert.equal(csvCell('He said "hi", twice'), '"He said ""hi"", twice"');
  assert.equal(csvCell("=HYPERLINK(\"http://x\")"), "\"'=HYPERLINK(\"\"http://x\"\")\"");
  assert.equal(csvCell("+91 90000"), "'+91 90000");
  assert.equal(csvCell("@driver"), "'@driver");
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(12.5), "12.5");
});

// ── A route through stops ────────────────────────────────────
test("a route with stops is planned THROUGH them, and announced stop by stop", async () => {
  const step = (type, modifier, name) => ({
    distance: 500, duration: 60, name, maneuver: { type, modifier, location: [80.2, 13.0] },
  });
  let asked = "";
  globalThis.fetch = async (url) => {
    asked = String(url);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        code: "Ok",
        routes: [{
          distance: 3000,
          duration: 420,
          geometry: { coordinates: [[80.20, 13.00], [80.21, 13.01], [80.22, 13.02], [80.23, 13.03]] },
          legs: [
            { summary: "A", steps: [step("depart", "", "First Street"), step("turn", "left", "Main Road"), step("arrive", "right", "")] },
            { summary: "B", steps: [step("depart", "", "Main Road"), step("turn", "right", "Lake Road"), step("arrive", "left", "")] },
            { summary: "C", steps: [step("depart", "", "Lake Road"), step("arrive", "", "")] },
          ],
        }],
      }),
    };
  };

  const [route] = await fetchRoutes(
    { lat: 13.00, lng: 80.20 },
    { lat: 13.03, lng: 80.23 },
    { alternatives: true, via: [{ lat: 13.01, lng: 80.21, name: "Market" }, { lat: 13.02, lng: 80.22 }] },
  );

  // The request names every place in order — and asks for no alternatives:
  // there is one way through the stops.
  assert.match(asked, /80\.2,13;80\.21,13\.01;80\.22,13\.02;80\.23,13\.03\?/);
  assert.doesNotMatch(asked, /alternatives=true/);

  const said = route.steps.map((item) => `${item.maneuverType}:${item.instruction}`);
  assert.deepEqual(said, [
    "depart:Start on First Street",
    "turn:Turn left onto Main Road",
    "waypoint:Stop: Market",
    "turn:Turn right onto Lake Road",
    "waypoint:Stop 2",                       // an unnamed stop still gets announced
    "arrive:Arrive at your destination",     // only the real end "arrives"
  ]);
  assert.equal(route.steps.filter((item) => item.maneuverType === "arrive").length, 1);
  assert.equal(route.steps.filter((item) => item.maneuverType === "depart").length, 1);
  assert.equal(stepIconName(route.steps[2]), "pin");
  assert.equal(route.distance, 3000);
});
