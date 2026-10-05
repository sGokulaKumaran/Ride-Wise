// ============================================================
// Place search (services/routingApi.js → searchPlaces / geocode)
//
//   node --test tests/
//
// The two geocoding services are replaced by a scripted fetch(), so these
// tests run offline and check only RideWise's own logic:
//   • which service is asked, and when the second one joins in
//   • "nothing found" versus "could not be reached"
//   • a region never outranks the town of the same name
//
// The tests share one module instance on purpose (Photon's "rest after a
// failure" memory is part of what is tested), so their ORDER matters.
// ============================================================

import assert from "node:assert/strict";
import { test } from "node:test";
import { geocode, searchPlaces, tidyPlaces } from "../src/services/routingApi.js";

// ── a scripted fetch ─────────────────────────────────────────
const calls = [];
let photon = () => ({ features: [] });
let nominatim = () => [];

const json = (body) => ({ ok: true, status: 200, json: async () => body });
globalThis.fetch = async (url) => {
  const target = String(url);
  const service = target.includes("photon") ? "photon" : "nominatim";
  calls.push({ service, url: target });
  const answer = service === "photon" ? photon(target) : nominatim(target);
  if (answer instanceof Error) throw answer;
  return json(answer);
};
const asked = (service) => calls.filter((call) => call.service === service);
const reset = () => { calls.length = 0; };

const feature = (name, lat, lng, extra = {}) => ({
  geometry: { coordinates: [lng, lat] },
  properties: { name, city: "Chennai", state: "Tamil Nadu", country: "India", osm_key: "place", ...extra },
});

// ── tidyPlaces ───────────────────────────────────────────────
test("a region is listed after the town of the same name", () => {
  // What Nominatim really answers for "Pondicherry": the territory first
  // (its centre point is 110 km from the town), then the town — twice.
  const tidy = tidyPlaces([
    { label: "Puducherry, India", name: "Puducherry", detail: "India", lat: 10.916, lng: 79.807, area: true },
    { label: "Puducherry, Puducherry Taluk", name: "Puducherry", detail: "Puducherry Taluk", lat: 11.934, lng: 79.831, area: false },
    { label: "Puducherry, Puducherry Taluk", name: "Puducherry", detail: "Puducherry Taluk", lat: 11.934, lng: 79.831, area: false },
  ]);
  assert.equal(tidy.length, 2, "the repeated town is dropped");
  assert.equal(tidy[0].area, false, "the town comes first");
  assert.equal(tidy[0].lat, 11.934);
  assert.equal(tidy[1].area, true, "the region is still offered");
});

test("a region with no town of the same name keeps its place", () => {
  const tidy = tidyPlaces([
    { label: "Goa, India", name: "Goa", detail: "India", lat: 15.3, lng: 74.086, area: true },
    { label: "Goa Bakery, Chennai", name: "Goa Bakery", detail: "Chennai", lat: 13.05, lng: 80.25, area: false },
  ]);
  assert.deepEqual(tidy.map((place) => place.name), ["Goa", "Goa Bakery"]);
});

// ── searchPlaces ─────────────────────────────────────────────
test("short text is not searched at all", async () => {
  reset();
  assert.deepEqual(await searchPlaces("a"), []);
  assert.equal(calls.length, 0);
});

test("Photon answers → its places are used and Nominatim is never asked", async () => {
  reset();
  photon = () => ({ features: [
    feature("Chennai Central Railway Station", 13.0826, 80.2763, { district: "Park Town" }),
    feature("Central Station Bus Terminus", 13.082, 80.2756),
  ] });
  const places = await searchPlaces("chennai central railway station", { near: { lat: 13.05123, lng: 80.28456 } });

  assert.equal(places.length, 2);
  assert.equal(places[0].name, "Chennai Central Railway Station");
  assert.equal(places[0].detail, "Park Town, Chennai, Tamil Nadu, India");
  assert.equal(places[0].label, "Chennai Central Railway Station, Park Town, Chennai, Tamil Nadu, India");
  assert.equal(places[0].lat, 13.0826);
  assert.equal(places[0].lng, 80.2763);
  assert.equal(asked("nominatim").length, 0);

  // The rider's position is only sent rounded (about a kilometre)
  const url = new URL(asked("photon")[0].url);
  assert.equal(url.searchParams.get("lat"), "13.05");
  assert.equal(url.searchParams.get("lon"), "80.28");
});

test("a house without a name is shown by its street address", async () => {
  reset();
  photon = () => ({ features: [
    { geometry: { coordinates: [80.25, 13.06] },
      properties: { street: "Anna Salai", housenumber: "12", city: "Chennai", state: "Tamil Nadu", country: "India" } },
  ] });
  const [place] = await searchPlaces("12 anna salai");
  assert.equal(place.name, "12 Anna Salai");
  assert.equal(place.detail, "Chennai, Tamil Nadu, India");
});

test("Photon finds nothing → Nominatim is asked and its places are used", async () => {
  reset();
  photon = () => ({ features: [] });
  nominatim = () => [
    { display_name: "Marina Beach, Zone 9 Teynampet, Chennai, Tamil Nadu, 600005, India", lat: "13.053", lon: "80.283", category: "natural" },
  ];
  const places = await searchPlaces("marina beach");
  assert.equal(asked("photon").length, 1);
  assert.equal(asked("nominatim").length, 1);
  assert.equal(places[0].name, "Marina Beach");
  assert.equal(places[0].detail, "Zone 9 Teynampet, Chennai, Tamil Nadu", "no postcode in the name");
  assert.equal(places[0].lat, 13.053);
});

test("a Nominatim place is described by street, town and state — not by ward numbers", async () => {
  reset();
  photon = () => ({ features: [] });
  nominatim = () => [{
    name: "Chennai Central Railway Station",
    display_name: "Chennai Central Railway Station, Wall Tax Road, Evening Bazaar, Ward 59, Zone 5 Royapuram, Chennai, Tamil Nadu, 600003, India",
    lat: "13.0826", lon: "80.2763", category: "highway",
    address: { road: "Wall Tax Road", suburb: "Evening Bazaar", city: "Chennai", state: "Tamil Nadu", postcode: "600003", country: "India" },
  }];
  const [place] = await searchPlaces("chennai central railway station");
  assert.equal(place.name, "Chennai Central Railway Station");
  assert.equal(place.detail, "Wall Tax Road, Chennai, Tamil Nadu, India");
});

test("both services answer with nothing → an empty list, not an error", async () => {
  reset();
  photon = () => ({ features: [] });
  nominatim = () => [];
  assert.deepEqual(await searchPlaces("zzzz qqqq"), []);
});

test("geocode picks the town over the region of the same name", async () => {
  reset();
  photon = () => ({ features: [] });
  nominatim = () => [
    { display_name: "Puducherry, India", lat: "10.916", lon: "79.807", category: "boundary" },
    { display_name: "Puducherry, Puducherry Taluk, Puducherry, 605001, India", lat: "11.934", lon: "79.831", category: "place" },
  ];
  const best = await geocode("Pondicherry");
  assert.equal(best.lat, 11.934);
  assert.equal(best.lng, 79.831);
  assert.match(best.name, /^Puducherry, Puducherry Taluk/);
});

test("Photon unreachable → Nominatim covers, and Photon is then left alone for a while", async () => {
  reset();
  photon = () => new TypeError("network down");
  nominatim = () => [{ display_name: "Ooty, Nilgiris, Tamil Nadu, India", lat: "11.413", lon: "76.703", category: "place" }];

  const first = await searchPlaces("ooty");
  assert.equal(first[0].name, "Ooty");
  assert.equal(asked("photon").length, 1);

  reset();
  const second = await searchPlaces("ooty lake");
  assert.equal(second[0].name, "Ooty");
  assert.equal(asked("photon").length, 0, "no second request to a service that just failed");
  assert.equal(asked("nominatim").length, 1);
});

test("no service reachable → rejects with a message that can be shown", async () => {
  reset();
  nominatim = () => new TypeError("network down"); // Photon is still resting
  await assert.rejects(searchPlaces("anywhere"), /isn't responding/);
});

test("a cancelled search rejects with AbortError and is not mistaken for an outage", async () => {
  reset();
  nominatim = () => [{ display_name: "Ooty, Nilgiris", lat: "11.413", lon: "76.703", category: "place" }];
  const controller = new AbortController();
  const pending = searchPlaces("ooty", { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});
