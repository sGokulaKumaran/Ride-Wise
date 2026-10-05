// ============================================================
// Tests for the navigation engine (src/services/navigation.js)
// and the step/formatting helpers in routingApi.js.
//
// Run:  npm test          (uses Node's built-in test runner — no deps)
//
// Routes are built from metre offsets around a base point so the
// expected numbers are easy to reason about.
// ============================================================

import test from "node:test";
import assert from "node:assert/strict";

import {
  NAV,
  buildNavRoute,
  projectOnRoute,
  pointAtProgress,
  sliceRoute,
  nextStepAt,
  remainingDuration,
  createNavState,
  advanceNav,
  offRouteThreshold,
  planRejoinTarget,
  buildRejoin,
  trackRejoin,
  describeNav,
  nextAnnouncement,
} from "../src/services/navigation.js";
import {
  parseRouteSteps,
  stepIconName,
  formatDistance,
  formatManeuverDistance,
  formatDuration,
  spokenDistance,
  shortPlaceName,
  haversineDistance,
  hasTrackedDistance,
  rideRiddenMeters,
  rideTimeSeconds,
} from "../src/services/routingApi.js";

// ── helpers ──────────────────────────────────────────────────

const BASE = { lat: 13.0, lng: 80.0 };
const PER_LAT = 111_320;
const PER_LNG = 111_320 * Math.cos((BASE.lat * Math.PI) / 180);

// metres east / north of the base → { lat, lng }
const at = (x, y) => ({ lat: BASE.lat + y / PER_LAT, lng: BASE.lng + x / PER_LNG });
// …and as a GeoJSON [lng, lat] pair, the way routes are stored
const pair = (x, y) => { const p = at(x, y); return [p.lng, p.lat]; };

const near = (actual, expected, tolerance, label) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label ?? "value"}: expected ≈${expected}, got ${actual}`);

// An L-shaped route: 1000 m east, then 1000 m north. Only THREE vertices,
// so each leg is one long straight segment (the case the old
// nearest-vertex logic got wrong).
const L_COORDS = [pair(0, 0), pair(1000, 0), pair(1000, 1000)];
const L_STEPS = [
  { instruction: "Head east on First Road", maneuverType: "depart", maneuverModifier: "", name: "First Road", distance: 1000, duration: 100, location: pair(0, 0) },
  { instruction: "Turn left onto Second Road", maneuverType: "turn", maneuverModifier: "left", name: "Second Road", distance: 1000, duration: 100, location: pair(1000, 0) },
  { instruction: "Arrive at your destination", maneuverType: "arrive", maneuverModifier: "", name: "", distance: 0, duration: 0, location: pair(1000, 1000) },
];
const lRoute = () => buildNavRoute(JSON.stringify(L_COORDS), JSON.stringify(L_STEPS), { duration: 200 });

let clock = 1_000_000;
const fixAt = (x, y, extra = {}) => {
  clock += extra.dt ?? 2000;
  const p = at(x, y);
  return { lat: p.lat, lng: p.lng, accuracy: 10, speed: null, heading: null, timestamp: clock, ...extra };
};

// Drive a sequence of [x, y] positions through the tracker.
function ride(route, positions, state = createNavState(), extra = {}) {
  let s = state;
  for (const [x, y] of positions) s = advanceNav(route, s, fixAt(x, y, extra));
  return s;
}

// ── route building ───────────────────────────────────────────

test("buildNavRoute indexes the polyline and places every step", () => {
  const route = lRoute();
  near(route.total, 2000, 5, "total");
  assert.equal(route.steps.length, 3);
  near(route.steps[0].progress, 0, 1, "depart");
  near(route.steps[1].progress, 1000, 3, "turn");
  near(route.steps[2].progress, route.total, 0.001, "arrive");
});

test("buildNavRoute returns null without usable geometry", () => {
  assert.equal(buildNavRoute(null, []), null);
  assert.equal(buildNavRoute("not json", []), null);
  assert.equal(buildNavRoute(JSON.stringify([pair(0, 0)]), []), null);
  assert.equal(buildNavRoute(JSON.stringify([pair(5, 5), pair(5, 5)]), []), null);
});

test("steps without coordinates are placed from their distances", () => {
  const steps = L_STEPS.map((step) => {
    const rest = { ...step };
    delete rest.location;
    return rest;
  });
  const route = buildNavRoute(L_COORDS, steps);
  near(route.steps[1].progress, 1000, 5, "turn from distances");
});

// ── projection ───────────────────────────────────────────────

test("projection snaps to the SEGMENT, not the nearest vertex", () => {
  const route = lRoute();
  const p = at(500, 8);
  const hit = projectOnRoute(route, p.lat, p.lng);
  near(hit.progress, 500, 2, "progress");
  near(hit.lateralMeters, 8, 1, "lateral");
  // The nearest VERTEX is 500 m away — the bug this replaces.
  assert.ok(haversineDistance(p.lat, p.lng, at(0, 0).lat, at(0, 0).lng) > 490);
});

test("pointAtProgress and sliceRoute start and end exactly on the route", () => {
  const route = lRoute();
  const mid = pointAtProgress(route, 250);
  near(haversineDistance(mid.lat, mid.lng, at(250, 0).lat, at(250, 0).lng), 0, 1, "point");

  const line = sliceRoute(route, 250, 1400);
  near(haversineDistance(line[0][0], line[0][1], at(250, 0).lat, at(250, 0).lng), 0, 1, "slice start");
  const tail = line[line.length - 1];
  // (3 m: the test's flat metre grid and the engine's great-circle
  // distances differ by ~0.1 % over 1.4 km)
  near(haversineDistance(tail[0], tail[1], at(1000, 400).lat, at(1000, 400).lng), 0, 3, "slice end");
  assert.equal(line.length, 3, "start point, the corner vertex, end point");
  assert.deepEqual(sliceRoute(route, 800, 800), []);
});

// ── guidance ─────────────────────────────────────────────────

test("the next turn counts down and never shows 'arrive' early", () => {
  const route = lRoute();

  const early = nextStepAt(route, 300);
  assert.equal(early.step.maneuverType, "turn");
  near(early.distance, 700, 3, "distance to turn");
  assert.equal(early.currentRoad, "First Road");

  // 600 m up the second leg: the destination is the NEAREST maneuver
  // (400 m vs 600 m back to the turn) but the rider has NOT arrived.
  const late = nextStepAt(route, 1600);
  assert.equal(late.step.maneuverType, "arrive");
  near(late.distance, 400, 3, "distance to destination");
});

test("a turn stays 'next' until the rider is past it", () => {
  const route = lRoute();
  assert.equal(nextStepAt(route, 1000 + NAV.PASSED_STEP_M - 2).step.maneuverType, "turn");
  assert.equal(nextStepAt(route, 1000 + NAV.PASSED_STEP_M + 5).step.maneuverType, "arrive");
});

test("remaining duration follows the per-step times", () => {
  const route = lRoute();
  near(remainingDuration(route, 0), 200, 1, "start");
  near(remainingDuration(route, 500), 150, 2, "half of first leg");
  near(remainingDuration(route, 1500), 50, 2, "half of second leg");
  near(remainingDuration(route, route.total), 0, 0.5, "end");
});

// ── tracker ──────────────────────────────────────────────────

test("riding the route stays on-route and reports live figures", () => {
  const route = lRoute();
  let s = ride(route, [[0, 2], [30, 3], [60, -2], [300, 4]]);
  assert.equal(s.offRoute, false);
  near(s.progress, 300, 3, "progress");

  const nav = describeNav(route, s, null, null, clock);
  assert.equal(nav.status, "on-route");
  assert.equal(nav.step.maneuverType, "turn");
  near(nav.stepDistance, 700, 4, "step distance");
  near(nav.remainingDistance, 1700, 4, "remaining");
  near(nav.eta, clock + nav.remainingTime * 1000, 1, "eta");

  s = ride(route, [[600, 0], [900, 0], [1000, 200], [1000, 600]], s);
  const later = describeNav(route, s);
  assert.equal(later.status, "on-route");
  assert.equal(later.step.maneuverType, "arrive");
  near(later.stepDistance, 400, 4, "to destination");
});

test("arrival is detected at the end of the route only", () => {
  const route = lRoute();
  let s = ride(route, [[0, 0], [500, 0], [1000, 500], [1000, 940]]);
  assert.equal(s.arrived, false);
  s = ride(route, [[1000, 985]], s);
  assert.equal(s.arrived, true);
  assert.equal(describeNav(route, s).status, "arrived");
});

test("one stray fix does not flip to off-route; two in a row do", () => {
  const route = lRoute();
  let s = ride(route, [[100, 0], [130, 0]]);
  s = ride(route, [[160, 90]], s);
  assert.equal(s.offRoute, false, "single outlier ignored");
  s = ride(route, [[190, 2]], s);
  assert.equal(s.offRoute, false);
  assert.equal(s.offCount, 0);

  s = ride(route, [[220, 90], [250, 95]], s);
  assert.equal(s.offRoute, true, "two consecutive fixes outside");
});

test("coming back needs to be well inside the limit (hysteresis)", () => {
  const route = lRoute();
  let s = ride(route, [[100, 0], [130, 90], [160, 95]]);
  assert.equal(s.offRoute, true);

  // accuracy 10 → off limit 50 m, back-on limit 30 m
  assert.equal(offRouteThreshold(10), 50);
  s = ride(route, [[190, 40]], s);
  assert.equal(s.offRoute, true, "40 m is inside the off limit but not the on limit");
  s = ride(route, [[220, 15]], s);
  assert.equal(s.offRoute, false);
  near(s.progress, 220, 4, "progress after rejoining");
});

test("GPS wobble backwards is ignored, but a detour that rejoins further back is believed", () => {
  const route = lRoute();

  // On the route the whole time: a fix 40 m behind is wobble → hold 400.
  let s = ride(route, [[340, 0], [370, 0], [400, 0], [360, 3]]);
  assert.equal(s.offRoute, false);
  near(s.progress, 400, 4, "wobble does not move the rider backwards");

  // Leave the route, then come back onto it 60 m BEHIND the point of
  // leaving (a one-way system, a U-turn). The rider really is at 340 m:
  // a turn between 340 and 400 must not be skipped.
  s = ride(route, [[400, 90], [400, 120]], s);
  assert.equal(s.offRoute, true);
  s = ride(route, [[370, 60], [340, 5]], s);
  assert.equal(s.offRoute, false);
  near(s.progress, 340, 4, "progress follows the rider back");
});

test("a vague fix cannot prove the rider left the route", () => {
  const route = lRoute();
  let s = ride(route, [[100, 0], [130, 0]]);
  // 200 m from the road, but the fix is only good to ±300 m
  s = ride(route, [[160, 200], [190, 200], [220, 200]], s, { accuracy: 300 });
  assert.equal(s.offRoute, false);
});

test("starting far from the route is reported as off-route", () => {
  const route = lRoute();
  const s = ride(route, [[-400, -400], [-398, -400]]);
  assert.equal(s.offRoute, true);
  assert.equal(s.progress, null);
  const nav = describeNav(route, s);
  assert.equal(nav.status, "off-route");
  assert.equal(nav.step.maneuverType, "rejoin");
});

test("a loop ride starts at its start, not at its finish", () => {
  const coords = [pair(0, 0), pair(500, 0), pair(500, 500), pair(0, 500), pair(0, 0)];
  const route = buildNavRoute(coords, []);
  const s = ride(route, [[2, 3]]);
  near(s.progress, 2, 6, "progress at start of loop");
  assert.equal(s.arrived, false);

  // …and finishing the loop IS an arrival.
  const done = ride(route, [[250, 0], [500, 250], [250, 500], [0, 250], [0, 20]], s);
  assert.equal(done.arrived, true);
});

test("an out-and-back route keeps the rider on the right pass", () => {
  const coords = [pair(0, 0), pair(1000, 0), pair(0, 0)];
  const route = buildNavRoute(coords, []);
  // Out to the far end, then 300 m back.
  const s = ride(route, [[0, 0], [400, 0], [800, 0], [1000, 0], [950, 0], [700, 0]]);
  near(s.progress, 1300, 6, "progress on the return leg");
});

// ── distance ridden ──────────────────────────────────────────

test("distance ridden follows the route and ignores jitter and jumps", () => {
  const route = lRoute();
  // 100 m every 5 s = 72 km/h
  let s = ride(route, [[0, 0], [100, 4], [200, -5], [300, 3], [400, 0]], createNavState(), { dt: 5000 });
  near(s.traveled, 400, 6, "along the route");

  // A 180 km/h "hop" along the route (100 m in 2 s) is a GPS jump…
  const tooFast = ride(route, [[500, 0]], s);
  near(tooFast.traveled, s.traveled, 0.001, "impossible speed ignored");

  // …and so is a 5 km teleport
  const jumped = ride(route, [[5400, 0]], s);
  near(jumped.traveled, s.traveled, 0.001, "teleport ignored");

  // Standing still off the route with ±4 m of GPS noise
  let idle = ride(route, [[400, 300], [402, 303]], createNavState());
  const before = idle.traveled;
  idle = ride(route, [[398, 298], [403, 301], [399, 303], [401, 297], [400, 300]], idle);
  assert.ok(idle.traveled - before < 8, `jitter added ${idle.traveled - before} m`);
});

test("a vague fix is never used to measure distance", () => {
  const route = lRoute();
  let s = ride(route, [[0, 0], [100, 0]], createNavState(), { dt: 5000 });
  const before = s.traveled;
  near(before, 100, 3, "measured with good fixes");
  s = ride(route, [[200, 60]], s, { accuracy: 120, dt: 5000 });
  assert.equal(s.traveled, before);
});

test("reopening a ride continues from the stored progress", () => {
  const route = lRoute();
  const state = createNavState({ progress: 500, traveled: 500, savedAt: clock });
  const s = ride(route, [[900, 0]], state, { dt: 60_000 });
  near(s.progress, 900, 4, "progress");
  near(s.traveled, 900, 6, "gap counted along the route");
});

// ── rejoin route ─────────────────────────────────────────────

test("the rejoin target is AHEAD on the route, never behind", () => {
  const route = lRoute();
  const s = ride(route, [[300, 0], [400, 0], [450, -200], [470, -220]]);
  assert.equal(s.offRoute, true);
  const target = planRejoinTarget(route, s);
  assert.ok(target.progress > s.progress, "target is past where the rider left");
  near(target.progress, 470 + 440, 30, "nearest point + lookahead");
});

test("near the finish the rejoin target is the destination itself", () => {
  const route = lRoute();
  const s = ride(route, [[1000, 700], [1000, 760], [1080, 800], [1090, 820]]);
  assert.equal(s.offRoute, true);
  assert.equal(planRejoinTarget(route, s).progress, route.total);
});

test("the rejoin leg is cut where it meets the main route", () => {
  const route = lRoute();
  // Rider is 300 m south of the first leg. The road route goes east,
  // north to the main road at x=800, then follows it to the target.
  const found = {
    coordinates: [pair(500, -300), pair(800, -300), pair(800, 0), pair(1000, 0), pair(1000, 300)],
    steps: [
      { instruction: "Head east on Side Road", maneuverType: "depart", distance: 300, duration: 30, location: pair(500, -300) },
      { instruction: "Turn left onto Link Road", maneuverType: "turn", maneuverModifier: "left", distance: 300, duration: 30, location: pair(800, -300) },
      { instruction: "Turn right onto First Road", maneuverType: "turn", maneuverModifier: "right", distance: 200, duration: 20, location: pair(800, 0) },
      { instruction: "Turn left onto Second Road", maneuverType: "turn", maneuverModifier: "left", distance: 300, duration: 30, location: pair(1000, 0) },
      { instruction: "Arrive at your destination", maneuverType: "arrive", distance: 0, duration: 0, location: pair(1000, 300) },
    ],
    distance: 1100,
    duration: 110,
  };

  const rejoin = buildRejoin(route, found, 450);
  near(rejoin.length, 600, 5, "leg length");
  near(rejoin.mergeProgress, 800, 5, "merge progress");
  near(rejoin.route.total, 600, 5, "leg route total");

  const types = rejoin.route.steps.map((step) => step.maneuverType);
  assert.deepEqual(types, ["depart", "turn", "rejoin"]);
  assert.equal(rejoin.route.steps.at(-1).instruction, "Rejoin your route");
  near(rejoin.route.steps.at(-1).progress, 600, 5, "rejoin step sits at the junction");
});

test("merely crossing the main route is not a merge", () => {
  const route = lRoute();
  const found = {
    // crosses the first leg at x=300, wanders north, comes back at x=600
    coordinates: [pair(300, -200), pair(300, 0), pair(300, 200), pair(600, 200), pair(600, 0), pair(900, 0)],
    steps: [],
    distance: 1200,
    duration: 120,
  };
  const rejoin = buildRejoin(route, found, 0);
  near(rejoin.mergeProgress, 600, 5, "merge at the second meeting");
  near(rejoin.length, 900, 6, "length up to the real merge");
});

test("a rider beside the route gets a straight connector", () => {
  const route = lRoute();
  const found = { coordinates: [pair(500, 0), pair(900, 0)], steps: [], distance: 400, duration: 40 };
  const rejoin = buildRejoin(route, found, 400);
  assert.equal(rejoin.route, null);
  near(rejoin.mergeProgress, 500, 5, "merge progress");
});

test("following the rejoin leg trims it; leaving it is noticed", () => {
  const route = lRoute();
  const found = {
    coordinates: [pair(500, -300), pair(800, -300), pair(800, 0), pair(1000, 0)],
    steps: [],
    distance: 800,
    duration: 80,
  };
  let rejoin = { ...buildRejoin(route, found, 450), id: 1 };

  rejoin = trackRejoin(rejoin, fixAt(650, -298), 50);
  near(rejoin.progress, 150, 4, "progress on leg");
  near(rejoin.remaining, 450, 5, "remaining on leg");
  assert.equal(rejoin.stray, 0);

  rejoin = trackRejoin(rejoin, fixAt(650, -500), 50);
  rejoin = trackRejoin(rejoin, fixAt(650, -520), 50);
  assert.equal(rejoin.stray, 2, "two fixes away from the purple line");
});

test("off-route output combines the rejoin leg with the rest of the route", () => {
  const route = lRoute();
  const s = ride(route, [[300, 0], [400, 0], [480, -280], [500, -300]]);
  assert.equal(s.offRoute, true);

  const found = {
    coordinates: [pair(500, -300), pair(800, -300), pair(800, 0), pair(1000, 0)],
    steps: [{ instruction: "Head east on Side Road", maneuverType: "depart", distance: 300, duration: 30, location: pair(500, -300) }],
    distance: 800,
    duration: 80,
  };
  const rejoin = trackRejoin({ ...buildRejoin(route, found, s.progress), id: 7 }, s.lastFix, 50);
  const nav = describeNav(route, s, rejoin);

  assert.equal(nav.status, "off-route");
  near(nav.mergeProgress, 800, 5, "merge");
  near(nav.rejoin.distance, 600, 6, "distance to rejoin");
  near(nav.remainingDistance, 600 + 1200, 10, "leg + rest of route");
  assert.equal(nav.step.maneuverType, "depart");
  assert.ok(nav.stepKey.startsWith("rejoin:7:"));
  // the purple line starts at the rider
  near(haversineDistance(nav.rejoin.line[0][0], nav.rejoin.line[0][1], s.lastFix.lat, s.lastFix.lng), 0, 0.5, "line start");
});

test("a ride without stored geometry still gets straight-line figures", () => {
  const dest = at(3000, 0);
  const rideInfo = { destinationLat: dest.lat, destinationLng: dest.lng, distanceMeters: 3000, durationSeconds: 300 };
  const s = ride(null, [[0, 0], [100, 0], [200, 0]], createNavState(), { dt: 5000 });
  assert.equal(s.offRoute, false);
  near(s.traveled, 200, 6, "straight-line distance");
  const nav = describeNav(null, s, null, rideInfo);
  near(nav.remainingDistance, 2800, 10, "remaining");
  near(nav.remainingTime, 280, 3, "time");
});

// ── voice ────────────────────────────────────────────────────

test("each turn is announced as preview, approach and now — once each", () => {
  const route = lRoute();
  const said = [];
  let memo = null;
  let s = createNavState();
  // 14 m/s along the first leg, a fix every 2 s
  for (let x = 0; x <= 1000; x += 28) {
    s = advanceNav(route, s, fixAt(x, 0, { speed: 14 }));
    const out = nextAnnouncement(memo, describeNav(route, s));
    memo = out.memo;
    if (out.say) said.push(out.say);
  }
  assert.equal(said[0], "Head east on First Road.");
  assert.match(said[1], /^In .* metres, turn left onto Second Road\.$/, "preview");
  assert.match(said[2], /^In \d+ metres, turn left onto Second Road\.$/, "approach");
  assert.equal(said[3], "Turn left onto Second Road.");
  assert.equal(said.length, 4, `spoken: ${JSON.stringify(said)}`);
});

test("road-name changes are shown but not spoken; road numbers are not read out", () => {
  const minor = { instruction: "Continue onto Pallavan Salai", maneuverType: "new name", maneuverModifier: "straight" };
  let out = nextAnnouncement({ status: "on-route" }, { status: "on-route", step: minor, stepKey: "main:5", stepDistance: 600, speed: 10 });
  assert.equal(out.say, null);
  out = nextAnnouncement(out.memo, { status: "on-route", step: minor, stepKey: "main:5", stepDistance: 20, speed: 10 });
  assert.equal(out.say, null);

  const turn = { instruction: "Turn right onto Anna Salai (SHU88)", maneuverType: "turn", maneuverModifier: "right" };
  out = nextAnnouncement(out.memo, { status: "on-route", step: turn, stepKey: "main:6", stepDistance: 20, speed: 10 });
  assert.equal(out.say, "Turn right onto Anna Salai.");
});

test("leaving, rejoining and arriving are announced", () => {
  const base = { stepDistance: null, step: null, speed: 10 };
  let out = nextAnnouncement(null, { ...base, status: "on-route" });
  out = nextAnnouncement(out.memo, { ...base, status: "off-route" });
  assert.match(out.say, /left the route/);
  out = nextAnnouncement(out.memo, { ...base, status: "off-route" });
  assert.equal(out.say, null, "not repeated");
  out = nextAnnouncement(out.memo, { ...base, status: "on-route" });
  assert.match(out.say, /back on your route/);
  out = nextAnnouncement(out.memo, { ...base, status: "arrived" });
  assert.match(out.say, /arrived/);
});

test("a ride that starts away from the road is 'joining', not 'off route'", () => {
  const route = lRoute();

  // Parked 120 m beside the start: never on the route so far.
  let s = ride(route, [[20, 120], [20, 120]]);
  assert.equal(s.offRoute, true);
  let nav = describeNav(route, s, null, null, 0);
  assert.equal(nav.joining, true);
  assert.equal(nav.step.instruction, "Finding the way to your route…");

  // With a straight connector: "Head to …", and the last step of a real
  // leg reads "Join your route".
  const connector = { route: null, mergeProgress: 20, mergePoint: at(20, 0), length: 120, id: 1 };
  nav = describeNav(route, s, connector, null, 0);
  assert.equal(nav.step.instruction, "Head to your route");

  let out = nextAnnouncement(null, nav);
  assert.equal(out.say, "Follow the purple line to reach your route.");

  // Reaching the route ends it — and leaving it later is a real "off route".
  s = ride(route, [[20, 60], [25, 5], [60, 0]], s);
  assert.equal(s.offRoute, false);
  nav = describeNav(route, s, null, null, 0);
  assert.equal(nav.joining, false);
  out = nextAnnouncement(out.memo, nav);
  assert.equal(out.say, "You are on your route.");

  s = ride(route, [[90, 90], [120, 95]], s);
  nav = describeNav(route, s, null, null, 0);
  assert.equal(nav.status, "off-route");
  assert.equal(nav.joining, false);
  assert.equal(nav.step.instruction, "Finding the way back to your route…");
  out = nextAnnouncement(out.memo, nav);
  assert.match(out.say, /left the route/);
});

// ── steps and formatting ─────────────────────────────────────

test("OSRM steps become readable instructions with matching icons", () => {
  const steps = parseRouteSteps([
    { name: "Raja Road", distance: 69, duration: 9, maneuver: { type: "depart", bearing_after: 353, location: [80.27, 13.08] } },
    { name: "Anna Salai", ref: "SH 88", distance: 3500, duration: 300, maneuver: { type: "end of road", modifier: "right", location: [80.27, 13.07] } },
    { name: "Ring Road", distance: 400, duration: 40, maneuver: { type: "roundabout", exit: 2, location: [80.25, 13.05] } },
    { name: "", distance: 185, duration: 20, maneuver: { type: "turn", modifier: "slight left", location: [80.25, 13.05] } },
    { name: "Flyover", distance: 90, duration: 9, maneuver: { type: "fork", modifier: "slight right", location: [80.24, 13.05] } },
    { name: "Main Road", distance: 50, duration: 6, maneuver: { type: "continue", modifier: "uturn", location: [80.24, 13.05] } },
    { name: "", distance: 0, duration: 0, maneuver: { type: "arrive", modifier: "left", location: [80.23, 13.04] } },
  ]);

  assert.deepEqual(steps.map((step) => step.instruction), [
    "Head north on Raja Road",
    "At the end of the road, turn right onto Anna Salai (SH 88)",
    "At the roundabout, take the 2nd exit onto Ring Road",
    "Bear left",
    "Keep right at the fork onto Flyover",
    "Make a U-turn and continue on Main Road",
    "Arrive at your destination, on the left",
  ]);
  assert.deepEqual(steps.map((step) => step.icon), [
    "maneuverDepart",
    "maneuverRight",
    "maneuverRoundabout",
    "maneuverSlightLeft",
    "maneuverKeepRight",
    "maneuverUTurn",
    "maneuverArrive",
  ]);
  assert.equal(parseRouteSteps(null).length, 0);
});

test("steps saved by older versions still get an icon", () => {
  assert.equal(stepIconName({ icon: "fa-turn-left" }), "maneuverLeft");
  assert.equal(stepIconName({ icon: "fa-flag-checkered" }), "maneuverArrive");
  assert.equal(stepIconName({ icon: "fa-arrow-up" }), "maneuverStraight");
  assert.equal(stepIconName(null), "maneuverStraight");
});

test("formatters", () => {
  assert.equal(formatDistance(850), "850 m");
  assert.equal(formatDistance(3500), "3.5 km");
  assert.equal(formatDistance(150_000), "150 km");
  assert.equal(formatDistance(null), "—");

  assert.equal(formatManeuverDistance(1240), "1.2 km");
  assert.equal(formatManeuverDistance(468), "450 m");
  assert.equal(formatManeuverDistance(84), "80 m");
  assert.equal(formatManeuverDistance(12), "10 m");

  assert.equal(formatDuration(40), "1 min");
  assert.equal(formatDuration(600), "10 min");
  assert.equal(formatDuration(5400), "1 h 30 min");
  assert.equal(formatDuration(7190), "2 h");

  assert.equal(spokenDistance(320), "300 metres");
  assert.equal(spokenDistance(1500), "1.5 kilometres");
  assert.equal(spokenDistance(1000), "1 kilometre");

  assert.equal(shortPlaceName("Marina Beach, Chennai, Tamil Nadu"), "Marina Beach");
  assert.equal(shortPlaceName("", "Start"), "Start");
});

test("ride figures: what was ridden and how long it took", () => {
  const start = "2026-10-05T15:14:08.013Z";
  const at = (minutes) => new Date(Date.parse(start) + minutes * 60_000).toISOString();
  const ride = (extra) => ({ status: "completed", distanceMeters: 5800, durationSeconds: 420, createdAt: start, ...extra });

  // Distance: a measured figure always wins — also when it is 0 …
  assert.equal(rideRiddenMeters(ride({ actualDistanceMeters: 6437 })), 6437);
  assert.equal(rideRiddenMeters(ride({ actualDistanceMeters: 0 })), 0, "ended at once: nothing was ridden");
  assert.equal(hasTrackedDistance(ride({ actualDistanceMeters: 0 })), true);
  // … a ride finished before tracking existed counts at its planned length …
  assert.equal(rideRiddenMeters(ride({ actualDistanceMeters: null })), 5800);
  assert.equal(hasTrackedDistance(ride({})), false);
  // … and a ride still under way, or cancelled, counts nothing yet.
  assert.equal(rideRiddenMeters(ride({ status: "active" })), 0);
  assert.equal(rideRiddenMeters(ride({ status: "cancelled" })), 0);

  // Time: start → end for a finished ride, the plan while it is running …
  assert.equal(rideTimeSeconds(ride({ endedAt: at(14) })), 14 * 60);
  assert.equal(rideTimeSeconds(ride({ status: "active" })), 420);
  // … and the plan again when "start → end" cannot be a riding time
  // (left open for two days and closed by the server).
  assert.equal(rideTimeSeconds(ride({ endedAt: at(48 * 60) })), 420);
  assert.equal(rideTimeSeconds(ride({ endedAt: null })), 420);
});
