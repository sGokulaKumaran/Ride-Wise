// ============================================================
// RideSetupFlow.jsx — plan a new ride in three steps
//
//   1. FROM     use the device's location, or search for a place
//   2. TO       search for the destination
//   3. REVIEW   see the route on a map (and pick between alternatives
//               when the routing service offers them), then start
//
// Place search and routing use OpenStreetMap services (no API key).
// On "Start ride" the ride is created through rideApi and handed to the
// parent, which opens the full-screen map.
//
// PROPS
//   rideType        "solo" | "group"
//   participantIds  riders invited to a group ride
//   onRideCreated   (ride) → the ride was created
//   onCancel        leave the flow
//   tc              theme classes
// ============================================================

import { useMemo, useState } from "react";
import {
  fetchRoutes,
  formatDistance,
  formatDuration,
  geocode,
  haversineDistance,
  reverseGeocode,
  shortPlaceName,
  stepIconName,
} from "../../../services/routingApi";
import { getCurrentLocation, getLastKnownLocation } from "../../../services/locationService";
import { createRide } from "../../../services/rideApi";
import RideMap from "./RideMap";
import LocationSearchInput from "../shared/LocationSearchInput";
import Button, { Chip } from "../ui/Button";
import Icon from "../ui/Icon";

// Quick picks under the search boxes (any place can be typed instead).
//
// Each one carries its own coordinates — the town itself. Looking the name
// up instead gave the centre point of the REGION for some of them: the
// centre of the Puducherry territory is 110 km from Pondicherry town, and
// "Goa" / "Coorg" landed in the middle of the state / district.
//   label  shown on the chip      name  saved with the ride
const POPULAR_PLACES = [
  { label: "Marina Beach", name: "Marina Beach, Chennai", lat: 13.0530, lng: 80.2830 },
  { label: "Pondicherry", name: "Pondicherry", lat: 11.9340, lng: 79.8306 },
  { label: "Ooty", name: "Ooty, Tamil Nadu", lat: 11.4126, lng: 76.7030 },
  { label: "Mahabalipuram", name: "Mahabalipuram, Tamil Nadu", lat: 12.6200, lng: 80.1940 },
  { label: "Coorg", name: "Madikeri, Coorg", lat: 12.4210, lng: 75.7390 },
  { label: "Goa", name: "Panaji, Goa", lat: 15.4990, lng: 73.8280 },
  { label: "Manali", name: "Manali, Himachal Pradesh", lat: 32.2450, lng: 77.1870 },
  { label: "Kodaikanal", name: "Kodaikanal, Tamil Nadu", lat: 10.2340, lng: 77.4920 },
];

const STEP = { FROM: 1, DESTINATION: 2, PREVIEW: 3 };
const STEP_LABELS = ["From", "To", "Review"];

export default function RideSetupFlow({ rideType, participantIds = [], onRideCreated, onCancel, tc }) {
  const [step, setStep] = useState(STEP.FROM);

  // FROM
  const [fromText, setFromText] = useState("");
  const [fromCoords, setFromCoords] = useState(null); // { lat, lng, name }
  const [locating, setLocating] = useState(false);

  // DESTINATION
  const [destText, setDestText] = useState("");
  const [destCoords, setDestCoords] = useState(null);

  // ROUTE
  const [routes, setRoutes] = useState([]);   // best first; may hold alternatives
  const [routeIndex, setRouteIndex] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const route = routes[routeIndex] || null;

  // The object RideMap needs to draw the preview — same shape as a saved ride.
  const previewRide = useMemo(() => {
    if (!route || !fromCoords || !destCoords) return null;
    return {
      fromLat: fromCoords.lat,
      fromLng: fromCoords.lng,
      fromName: fromCoords.name,
      destinationLat: destCoords.lat,
      destinationLng: destCoords.lng,
      destinationName: destCoords.name,
      routeCoordinates: JSON.stringify(route.coordinates),
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      rideType,
    };
  }, [route, fromCoords, destCoords, rideType]);

  // ====================================================================
  // STEP 1 — start from the device's location
  // ====================================================================
  const handleUseGps = async () => {
    setLocating(true);
    setError("");
    try {
      const here = await getCurrentLocation();
      // A readable name ("Anna Salai, Chennai") instead of "Start Location",
      // so the ride reads well in the history. Falls back gracefully.
      const name = (await reverseGeocode(here.lat, here.lng)) || "My location";
      setFromCoords({ lat: here.lat, lng: here.lng, name });
      setFromText(name);
      setStep(STEP.DESTINATION);
    } catch (err) {
      setError(err.message || "Couldn't get your location. Search for a starting place instead.");
    } finally {
      setLocating(false);
    }
  };

  // STEP 1 → 2 (look the typed text up when no suggestion was picked)
  const handleFromNext = async () => {
    setError("");
    if (!fromText.trim()) { setError("Enter where you're starting from."); return; }
    setLoading(true);
    try {
      if (!fromCoords) {
        // Nearby matches first: "Gandhi Road" should be the one in this town
        const found = await geocode(fromText, { near: getLastKnownLocation() });
        if (!found) throw new Error(`Couldn't find "${fromText}". Try a more specific name.`);
        setFromCoords(found);
      }
      setStep(STEP.DESTINATION);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ====================================================================
  // STEP 2 → 3 — find the destination and calculate the route
  // ====================================================================
  const handleCalcRoute = async () => {
    setError("");
    if (!destText.trim()) { setError("Enter where you're going."); return; }
    setLoading(true);
    try {
      let destination = destCoords;
      if (!destination) {
        destination = await geocode(destText, { near: fromCoords });
        if (!destination) throw new Error(`Couldn't find "${destText}". Try a more specific name.`);
        setDestCoords(destination);
      }

      if (haversineDistance(fromCoords.lat, fromCoords.lng, destination.lat, destination.lng) < 30) {
        throw new Error("The start and the destination are the same place.");
      }

      // Up to three routes, best first.
      const found = await fetchRoutes(fromCoords, destination, { alternatives: true });
      setRoutes(found.slice(0, 3));
      setRouteIndex(0);
      setStep(STEP.PREVIEW);
    } catch (err) {
      setError(err.message || "Couldn't calculate a route. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ====================================================================
  // STEP 3 — create the ride
  // ====================================================================
  const handleStartRide = async () => {
    setError("");
    if (!fromCoords || !destCoords || !route) {
      setError("Calculate the route first.");
      return;
    }
    setLoading(true);
    try {
      const routeCoordinates = JSON.stringify(route.coordinates);
      const routeSteps = JSON.stringify(route.steps || []);

      const saved = await createRide({
        fromName: fromCoords.name,
        fromLat: fromCoords.lat,
        fromLng: fromCoords.lng,
        destinationName: destCoords.name,
        destinationLat: destCoords.lat,
        destinationLng: destCoords.lng,
        routeCoordinates,   // stored as JSON text
        routeSteps,
        distanceMeters: route.distance,
        durationSeconds: route.duration,
        rideType,
        participantIds: participantIds.length > 0 ? participantIds : undefined,
      });

      // The live map needs the route whatever the response carried.
      onRideCreated({
        ...saved,
        routeCoordinates: saved.routeCoordinates || routeCoordinates,
        routeSteps: saved.routeSteps || routeSteps,
      });
    } catch (err) {
      setError(err.message || "Couldn't start the ride. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fromLabel = shortPlaceName(fromCoords?.name || fromText, "Start");
  const destLabel = shortPlaceName(destCoords?.name || destText, "Destination");

  return (
    <div>
      {/* ── Where am I in the flow? ── */}
      <ol className="mb-5 flex gap-2" aria-label="Steps">
        {STEP_LABELS.map((label, index) => {
          const number = index + 1;
          const done = step > number;
          const current = step === number;
          return (
            <li key={label} className="flex-1" aria-current={current ? "step" : undefined}>
              <div className={`h-1 rounded-full ${done || current ? "bg-current" : tc.hairline}`} />
              <p className={`mt-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider ${current ? "" : tc.sub}`}>
                {done ? <Icon name="check" size={12} /> : <span>{number}</span>}
                {label}
              </p>
            </li>
          );
        })}
      </ol>

      {/* ================================================================
          STEP 1 — FROM
      ================================================================ */}
      {step === STEP.FROM && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold">Where are you starting?</h3>

          <Button
            variant="secondary"
            size="lg"
            full
            tc={tc}
            icon="recenter"
            loading={locating}
            onClick={handleUseGps}
            disabled={loading}
            className="!h-auto justify-start py-3.5 text-left"
          >
            <span className="flex flex-col">
              <span className="font-semibold">{locating ? "Finding your location…" : "Use my current location"}</span>
              <span className={`text-xs font-normal ${tc.sub}`}>Your browser will ask for permission</span>
            </span>
          </Button>

          <div className={`flex items-center gap-3 text-xs ${tc.sub}`}>
            <span className={`h-px flex-1 ${tc.hairline}`} />
            or search for a place
            <span className={`h-px flex-1 ${tc.hairline}`} />
          </div>

          <LocationSearchInput
            icon="dot"
            label="Starting place"
            placeholder="City, area or landmark"
            value={fromText}
            // Editing the text invalidates coordinates picked earlier
            onChange={(text) => { setFromText(text); setFromCoords(null); }}
            onSelect={(result) => {
              setFromText(result.label);
              setFromCoords({ lat: result.lat, lng: result.lng, name: result.label });
            }}
            onSubmit={handleFromNext}
            tc={tc}
          />

          <PlaceChips
            places={POPULAR_PLACES.slice(0, 6)}
            selected={fromCoords?.name}
            onPick={(place) => {
              setFromText(place.name);
              setFromCoords({ lat: place.lat, lng: place.lng, name: place.name });
              setError("");
            }}
            tc={tc}
          />

          {error && <ErrorBox message={error} tc={tc} />}

          <div className="flex gap-2 pt-1">
            <Button variant="ghost" size="lg" tc={tc} onClick={onCancel}>Back</Button>
            <Button
              variant="primary"
              size="lg"
              full
              tc={tc}
              icon="arrowRight"
              iconRight
              loading={loading}
              disabled={locating || !fromText.trim()}
              onClick={handleFromNext}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* ================================================================
          STEP 2 — DESTINATION
      ================================================================ */}
      {step === STEP.DESTINATION && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold">Where are you going?</h3>

          <p className={`flex items-center gap-2 text-xs ${tc.sub}`}>
            <Icon name="dot" size={13} />
            <span className="truncate">From {fromLabel}</span>
          </p>

          <LocationSearchInput
            icon="pin"
            label="Destination"
            placeholder="City, area or landmark"
            value={destText}
            autoFocus
            onChange={(text) => { setDestText(text); setDestCoords(null); }}
            onSelect={(result) => {
              setDestText(result.label);
              setDestCoords({ lat: result.lat, lng: result.lng, name: result.label });
            }}
            onSubmit={handleCalcRoute}
            // Suggestions close to the start come first
            near={fromCoords}
            tc={tc}
          />

          <PlaceChips
            places={POPULAR_PLACES}
            selected={destCoords?.name}
            onPick={(place) => {
              setDestText(place.name);
              setDestCoords({ lat: place.lat, lng: place.lng, name: place.name });
              setError("");
            }}
            tc={tc}
          />

          {error && <ErrorBox message={error} tc={tc} />}

          <div className="flex gap-2 pt-1">
            <Button variant="ghost" size="lg" tc={tc} onClick={() => { setStep(STEP.FROM); setError(""); }} disabled={loading}>
              Back
            </Button>
            <Button
              variant="primary"
              size="lg"
              full
              tc={tc}
              icon="route"
              loading={loading}
              disabled={!destText.trim()}
              onClick={handleCalcRoute}
            >
              {loading ? "Finding the route…" : "Show route"}
            </Button>
          </div>
        </div>
      )}

      {/* ================================================================
          STEP 3 — REVIEW + START
      ================================================================ */}
      {step === STEP.PREVIEW && previewRide && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold">Your route</h3>

          {/* Map preview — fits the whole route */}
          <div className={`relative h-[240px] overflow-hidden rounded-xl border ${tc.divider}`}>
            <RideMap ride={previewRide} compact tc={tc} />
          </div>

          {/* Alternatives, when the routing service offered any */}
          {routes.length > 1 && (
            <div className="scrollbar-hide flex gap-2 overflow-x-auto" role="radiogroup" aria-label="Route options">
              {routes.map((option, index) => (
                <Chip
                  key={index}
                  selected={index === routeIndex}
                  onClick={() => setRouteIndex(index)}
                  tc={tc}
                  className="!h-auto shrink-0 py-1.5"
                >
                  <span className="flex flex-col items-start leading-tight">
                    <span>{index === 0 ? "Fastest" : `Option ${index + 1}`}</span>
                    <span className="font-normal opacity-80">
                      {formatDuration(option.duration)} · {formatDistance(option.distance)}
                    </span>
                  </span>
                </Chip>
              ))}
            </div>
          )}

          {/* Numbers */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: "road",   label: "Distance",  value: formatDistance(route.distance) },
              { icon: "clock",  label: "Ride time", value: formatDuration(route.duration) },
              { icon: rideType === "group" ? "riders" : "ride",
                label: rideType === "group" ? "Riders" : "Ride",
                value: rideType === "group" ? String(participantIds.length + 1) : "Solo" },
            ].map((stat) => (
              <div key={stat.label} className={`rounded-lg border px-2 py-2.5 text-center ${tc.record}`}>
                <Icon name={stat.icon} size={15} className={`mx-auto ${tc.sub}`} />
                <p className="mt-1 text-sm font-bold tabular-nums">{stat.value}</p>
                <p className={`text-[10px] uppercase tracking-wider ${tc.sub}`}>{stat.label}</p>
              </div>
            ))}
          </div>

          {/* From → To */}
          <div className={`flex gap-3 rounded-lg border p-3 text-sm ${tc.record}`}>
            <div className="flex flex-col items-center pt-1" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-current" />
              <span className={`my-0.5 w-px flex-1 ${tc.hairline}`} />
              <span className="h-2.5 w-2.5 rounded-full bg-current" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="truncate font-medium">{fromLabel}</p>
              <p className="truncate font-medium">{destLabel}</p>
            </div>
          </div>

          {/* First directions */}
          {route.steps?.length > 0 && (
            <div className={`overflow-hidden rounded-lg border ${tc.divider}`}>
              <p className={`flex items-center gap-2 border-b px-3 py-2 text-xs font-semibold ${tc.divider} ${tc.sub}`}>
                <Icon name="list" size={14} />
                Directions
                <span className="ml-auto font-normal">{route.steps.length} steps</span>
              </p>
              {route.steps.slice(0, 4).map((item, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-3 px-3 py-2 ${index > 0 ? `border-t ${tc.divider}` : ""}`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tc.surface2}`}>
                    <Icon name={stepIconName(item)} size={15} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">{item.instruction}</span>
                  {item.distance > 0 && (
                    <span className={`shrink-0 text-[11px] tabular-nums ${tc.sub}`}>{formatDistance(item.distance)}</span>
                  )}
                </div>
              ))}
              {route.steps.length > 4 && (
                <p className={`border-t px-3 py-2 text-center text-[11px] ${tc.divider} ${tc.sub}`}>
                  + {route.steps.length - 4} more, read out as you ride
                </p>
              )}
            </div>
          )}

          {error && <ErrorBox message={error} tc={tc} />}

          <div className="flex gap-2 pt-1">
            <Button variant="ghost" size="lg" tc={tc} onClick={() => { setStep(STEP.DESTINATION); setError(""); }} disabled={loading}>
              Back
            </Button>
            <Button variant="accent" size="lg" full tc={tc} icon="ride" loading={loading} onClick={handleStartRide}>
              {loading ? "Starting…" : "Start ride"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Quick-pick chips ─────────────────────────────────────────
function PlaceChips({ places, selected, onPick, tc }) {
  return (
    <div>
      <p className={`mb-2 text-[11px] font-semibold uppercase tracking-wider ${tc.sub}`}>Popular places</p>
      <div className="flex flex-wrap gap-1.5">
        {places.map((place) => (
          <Chip key={place.label} selected={selected === place.name} onClick={() => onPick(place)} tc={tc}>
            {place.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

// ── Error message ────────────────────────────────────────────
function ErrorBox({ message, tc }) {
  return (
    <div role="alert" className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${tc.dangerSoft}`}>
      <Icon name="alertCircle" size={16} className="mt-0.5" />
      <span>{message}</span>
    </div>
  );
}
