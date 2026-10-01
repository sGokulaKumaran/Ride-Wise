// ============================================================
// 🚀 RideSetupFlow.jsx — Plan a new ride
//
// FLOW (3 steps inside the modal):
//   Step 1: Choose FROM location
//           → Option A: Use current GPS location (green button)
//           → Option B: Type a place name (with suggestions)
//   Step 2: Choose DESTINATION
//           → Type a place name (with autocomplete suggestions)
//   Step 3: Preview route on mini-map → then "Start Ride"
//
// GEOCODING: converts typed text → lat/lng via Nominatim
// ROUTING:   calculates road path via OSRM
// ON START:  calls createRide() → parent receives the new ride object
//
// PROPS:
//   rideType      — "solo" (always, group is future)
//   userId        — logged-in user's ID
//   onRideCreated — callback(ride) when ride is successfully created
//   onCancel      — callback() to go back
//   tc            — theme classes from useTheme()
// ============================================================

import { useState } from "react";
import { geocode, getRoute, formatDistance, formatDuration } from "../../../services/routingApi";
import { getCurrentLocation }                                  from "../../../services/locationService";
import { createRide }                                          from "../../../services/rideApi";
import RideMap                                                 from "./RideMap";
import LocationSearchInput                                     from "../shared/LocationSearchInput";
import { themes }                                              from "../../hooks/useTheme";

// ---------------------------------------------------------------------------
// Preset popular destinations — shown as quick-pick chips
// Users can also type any custom location
// ---------------------------------------------------------------------------
const POPULAR_PLACES = [
  "Marina Beach, Chennai",
  "Pondicherry",
  "Ooty",
  "Mahabalipuram",
  "Coorg",
  "Goa",
  "Manali",
  "Kodaikanal",
];

// ---------------------------------------------------------------------------
// STEPS enum — which step is currently shown
// ---------------------------------------------------------------------------
const STEP = { FROM: 1, DESTINATION: 2, PREVIEW: 3 };

export default function RideSetupFlow({ rideType, userId, participantIds = [], onRideCreated, onCancel, tc: tcProp }) {
  // ---- Theme tokens (fallback if the parent did not pass tc) ----
  const tc = tcProp || themes[localStorage.getItem("ridewise-theme")] || themes.dark;

  // ---- Step tracker ----
  const [step, setStep] = useState(STEP.FROM);

  // ---- FROM location state ----
  const [fromText,        setFromText]        = useState("");   // what the user typed
  const [fromCoords,      setFromCoords]      = useState(null); // { lat, lng, name }

  // ---- DESTINATION state ----
  const [destText,        setDestText]        = useState("");
  const [destCoords,      setDestCoords]      = useState(null);

  // ---- Route preview state ----
  const [routeData,  setRouteData]  = useState(null);   // { coordinates, distanceMeters, durationSeconds }
  const [previewRide, setPreviewRide] = useState(null); // fake ride object for RideMap preview

  // ---- Loading / error ----
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  // ====================================================================
  // FROM — "Use Current Location" button handler
  // ====================================================================

  //THis is the main thing to access the gps of the devcie from browser
  const handleUseGps = async () => {
    setLoading(true);
    setError("");
    try {
      const loc = await getCurrentLocation(); // prompts browser for GPS permission
      setFromCoords({ lat: loc.lat, lng: loc.lng, name: "Start Location" });
      setFromText("Start Location");
      // Automatically advance to destination step
      setStep(STEP.DESTINATION);
    } catch {
      setError("Could not get your location. Please allow location access or type an address.");
    } finally {
      setLoading(false);
    }
  };

  // ====================================================================
  // (Suggestion filtering now lives inside LocationSearchInput)
  // ====================================================================

  // User picks a FROM suggestion chip
  const pickFrom = (place) => {
    setFromText(place);
    setFromCoords(null); // will be geocoded when user advances
  };

  // ====================================================================
  // Advance from Step 1 → Step 2 (geocode the FROM text if needed)
  // ====================================================================
  const handleFromNext = async () => {
    setError("");
    if (!fromText.trim()) { setError("Please enter a starting location."); return; }
    setLoading(true);
    try {
      if (!fromCoords) {
        // Text was typed manually — geocode it
        const result = await geocode(fromText);
        if (!result) throw new Error(`Could not find "${fromText}". Try a more specific name.`);
        setFromCoords(result);
      }
      setStep(STEP.DESTINATION); // go to next step
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ====================================================================
  // (Destination autocomplete now lives inside LocationSearchInput)
  // ====================================================================

  const pickDest = (place) => {
    setDestText(place);
    setDestCoords(null);
  };

  // ====================================================================
  // Advance Step 2 → Step 3: geocode destination + calculate route
  // ====================================================================
  const handleCalcRoute = async () => {
    setError("");
    if (!destText.trim()) { setError("Please enter a destination."); return; }
    setLoading(true);
    try {
      // 1. Geocode destination (if not already done)
      let dest = destCoords;
      if (!dest) {
        dest = await geocode(destText);
        if (!dest) throw new Error(`Could not find "${destText}". Try a more specific name.`);
        setDestCoords(dest);
      }

      // 2. Calculate the road route (OSRM)
      const route = await getRoute(fromCoords, dest);
      if (!route) throw new Error("No road route found between these locations.");
      setRouteData(route);

      // 3. Build a fake "ride" object so RideMap can render the preview
      // The route.coordinates array needs to be JSON-stringified (matches DB format)
      setPreviewRide({
        fromLat:         fromCoords.lat,
        fromLng:         fromCoords.lng,
        fromName:        fromCoords.name,
        destinationLat:  dest.lat,
        destinationLng:  dest.lng,
        destinationName: dest.name,
        routeCoordinates: JSON.stringify(route.coordinates), // [[lng,lat], ...]
        routeSteps:       route.steps || [],                 // turn-by-turn steps array
        distanceMeters:   route.distance,
        durationSeconds:  route.duration,
      });

      setStep(STEP.PREVIEW); // show map preview
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ====================================================================
  // START RIDE — create the ride in the backend + call onRideCreated
  // ====================================================================
  const handleStartRide = async () => {
    setError("");
    // Defensive guard: the button only renders on step 3, but never build a
    // ride from a half-finished wizard state (routeData would be null).
    if (!fromCoords || !destCoords || !routeData) {
      setError("Please calculate the route first.");
      return;
    }
    setLoading(true);
    try {
      const dest = destCoords;

      // Build the request body matching our RideRequest DTO
      const ridePayload = {
        userId:           userId,
        fromName:         fromCoords.name,
        fromLat:          fromCoords.lat,
        fromLng:          fromCoords.lng,
        destinationName:  dest.name,
        destinationLat:   dest.lat,
        destinationLng:   dest.lng,
        // Store coordinates as JSON string (our DB column type is TEXT)
        routeCoordinates: JSON.stringify(routeData.coordinates),
        // Store turn-by-turn steps as JSON string for navigation
        routeSteps:       JSON.stringify(routeData.steps || []),
        distanceMeters:   routeData.distance,
        durationSeconds:  routeData.duration,
        rideType:         rideType, // "solo"
        participantIds:   participantIds.length > 0 ? participantIds : undefined,
      };

      // Save to backend (or localStorage fallback)
      const savedRide = await createRide(ridePayload);

      // ── CRITICAL: re-attach route data that backend may not return ──
      // The backend DB might not have a routeCoordinates or routeSteps column,
      // so the returned object may be missing them. We always restore from the
      // locally computed OSRM result so the live map always has coordinates to draw.
      if (!savedRide.routeCoordinates) {
        savedRide.routeCoordinates = JSON.stringify(routeData.coordinates);
      }
      if (!savedRide.routeSteps) {
        // Same shape the backend column uses elsewhere: a JSON string.
        savedRide.routeSteps = JSON.stringify(routeData.steps || []);
      }

      // Tell the parent (Home.jsx) to open the full-screen map for this ride
      onRideCreated(savedRide);

    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ====================================================================
  // RENDER
  // ====================================================================
  return (
    <div>
      {/* ---- Step indicator ---- */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "20px" }}>
        {[1, 2, 3].map(n => (
          <div
            key={n}
            // Upcoming segments use the themed hairline colour instead of a
            // white wash, which vanished on the Light / Warm themes.
            className={step >= n ? "" : tc.hairline}
            style={{
              flex: 1, height: "3px", borderRadius: "2px",
              background: step >= n
                ? "linear-gradient(90deg, #f97316, #ec4899)"   // completed/current = accent
                : undefined,                                    // upcoming = themed hairline
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>

      {/* ================================================================
          STEP 1 — FROM LOCATION
      ================================================================ */}
      {step === STEP.FROM && (
        <div className="space-y-3">
          <div>
            <p style={{ fontSize: "11px", fontWeight: 700, opacity: 0.5, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>
              Step 1 of 3 — Where are you starting?
            </p>
          </div>

          {/* Use Current GPS Location button */}
          <button
            onClick={handleUseGps}
            disabled={loading}
            style={{
              width:          "100%",
              padding:        "14px 16px",
              background:     "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(16,185,129,0.1))",
              border:         "1.5px solid rgba(34,197,94,0.4)",
              borderRadius:   "14px",
              display:        "flex",
              alignItems:     "center",
              gap:            "12px",
              cursor:         loading ? "not-allowed" : "pointer",
              color:          "inherit",
              textAlign:      "left",
            }}
          >
            <div style={{
              width: "40px", height: "40px", borderRadius: "12px",
              background: "rgba(34,197,94,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <i className="fa fa-location-crosshairs" style={{ color: "#22c55e", fontSize: "18px" }} />
            </div>
            <div>
              <p style={{ fontWeight: 700, margin: 0 }}>Use My Current Location</p>
              <p style={{ fontSize: "12px", opacity: 0.5, margin: 0 }}>Automatically detect via GPS</p>
            </div>
            {loading && <i className="fa fa-spinner fa-spin" style={{ marginLeft: "auto", color: "#22c55e" }} />}
          </button>

          {/* Divider — themed ink + hairline so it stays visible on light themes */}
          <div className={`flex items-center gap-[10px] text-[12px] ${tc.sub}`}>
            <div className={`flex-1 h-px ${tc.hairline}`} />
            or type a location
            <div className={`flex-1 h-px ${tc.hairline}`} />
          </div>

          {/* Text input for FROM — live OSM geocoder */}
          <LocationSearchInput
            icon="fa-map-marker-alt"
            iconColor="#22c55e"
            placeholder="Search any city, area, landmark..."
            value={fromText}
            onSelect={(result) => {
              setFromText(result.label);
              setFromCoords({ lat: result.lat, lng: result.lng, name: result.label });
            }}
            tc={tc}
          />

          {/* Error */}
          {error && <ErrorBox message={error} />}

          {/* Popular places */}
          <div>
            <p style={{ fontSize: "11px", opacity: 0.4, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>Popular places</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {POPULAR_PLACES.slice(0, 6).map(p => (
                <button
                  key={p}
                  onClick={() => pickFrom(p)}
                  // Idle state comes from the theme's chip tokens; the accent
                  // (orange) is kept only for the selected chip.
                  className={`rounded-full border ${fromText === p ? tc.accent : tc.chipIdle}`}
                  style={{
                    padding: "6px 12px",
                    ...(fromText === p
                      ? { background: "rgba(249,115,22,0.15)", borderColor: "rgba(249,115,22,0.45)" }
                      : {}),
                    fontSize: "12px", cursor: "pointer", fontWeight: 600,
                  }}
                >
                  {p.split(",")[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Next button */}
          <ActionButton
            label={loading ? "Locating..." : "Next →"}
            icon={loading ? "fa-spinner fa-spin" : "fa-arrow-right"}
            onClick={handleFromNext}
            disabled={loading || !fromText.trim()}
          />

          <CancelButton onClick={onCancel} tc={tc} />
        </div>
      )}

      {/* ================================================================
          STEP 2 — DESTINATION
      ================================================================ */}
      {step === STEP.DESTINATION && (
        <div className="space-y-3">
          <div>
            <p style={{ fontSize: "11px", fontWeight: 700, opacity: 0.5, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>
              Step 2 of 3 — Where are you going?
            </p>
            {/* Show selected FROM as a summary chip */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "4px 10px", borderRadius: "50px",
              background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)",
              fontSize: "11px", color: "#22c55e",
            }}>
              <i className="fa fa-location-dot" style={{ fontSize: "10px" }} />
              From: {(fromCoords?.name || fromText).split(",")[0]}
            </div>
          </div>

          {/* Destination input — live OSM geocoder */}
          <LocationSearchInput
            icon="fa-flag-checkered"
            iconColor="#ef4444"
            placeholder="Search destination city, place..."
            value={destText}
            onChange={(text) => { setDestText(text); setDestCoords(null); }}
            onSelect={(result) => {
              setDestText(result.label);
              setDestCoords({ lat: result.lat, lng: result.lng, name: result.label });
            }}
            tc={tc}
          />

          {/* Error */}
          {error && <ErrorBox message={error} />}

          {/* Popular destinations */}
          <div>
            <p style={{ fontSize: "11px", opacity: 0.4, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>Popular destinations</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {POPULAR_PLACES.map(p => (
                <button
                  key={p}
                  onClick={() => pickDest(p)}
                  className={`rounded-full border ${destText === p ? tc.accent : tc.chipIdle}`}
                  style={{
                    padding: "6px 12px",
                    ...(destText === p
                      ? { background: "rgba(249,115,22,0.15)", borderColor: "rgba(249,115,22,0.45)" }
                      : {}),
                    fontSize: "12px", cursor: "pointer", fontWeight: 600,
                  }}
                >
                  {p.split(",")[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Back + Calculate Route buttons */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => { setStep(STEP.FROM); setError(""); }}
              className={`border ${tc.btnSecondary}`}
              style={{
                padding: "14px 20px", borderRadius: "14px",
                cursor: "pointer", fontSize: "14px", fontWeight: 600,
              }}
            >
              <i className="fa fa-arrow-left" style={{ marginRight: "6px" }} />
              Back
            </button>
            <ActionButton
              label={loading ? "Calculating..." : "Calculate Route"}
              icon={loading ? "fa-spinner fa-spin" : "fa-route"}
              onClick={handleCalcRoute}
              disabled={loading || !destText.trim()}
              style={{ flex: 1 }}
            />
          </div>
        </div>
      )}

      {/* ================================================================
          STEP 3 — ROUTE PREVIEW + START
      ================================================================ */}
      {step === STEP.PREVIEW && previewRide && (
        <div className="space-y-3">
          <p style={{ fontSize: "11px", fontWeight: 700, opacity: 0.5, textTransform: "uppercase", letterSpacing: "1px" }}>
            Step 3 of 3 — Your Route
          </p>

          {/* Mini map preview */}
          <div
            className={`border ${tc.divider}`}
            style={{ height: "240px", borderRadius: "16px", overflow: "hidden", position: "relative" }}
          >
            <RideMap ride={previewRide} isLive={false} />
          </div>

          {/* Route stats */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: "6px",
          }}>
            {[
              // Colour comes from the active theme: accent for the headline
              // figure, ink for the neutral ones, ok-tone for the ride type.
              { label: "Distance", value: formatDistance(routeData?.distance),  cls: tc.accent },
              { label: "Duration", value: formatDuration(routeData?.duration),   cls: tc.text },
              { label: "Turns",    value: String(routeData?.steps?.length || 0), cls: tc.text },
              { label: "Type",     value: rideType,                              cls: tc.ok },
            ].map(({ label, value, cls }) => (
              <div
                key={label}
                className={`border rounded-xl ${tc.record}`}
                style={{ padding: "10px 8px", textAlign: "center" }}
              >
                <p className={`${cls} font-black`} style={{ fontSize: "14px", margin: 0, textTransform: "capitalize" }}>{value}</p>
                <p className={tc.sub} style={{ fontSize: "9px", margin: 0, textTransform: "uppercase", letterSpacing: "1px", marginTop: "2px" }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Group Ride Info */}
          {participantIds.length > 0 && (
            <div
              className={`border rounded-xl ${tc.record} flex items-center gap-2 text-[12px]`}
              style={{ padding: "12px 16px" }}
            >
              <p style={{ margin: 0, fontWeight: 700 }}> {participantIds.length + 1} riders</p>
              <p className={tc.sub} style={{ margin: 0 }}>(including you)</p>
            </div>
          )}

          {/* From → To summary */}
          <div
            className={`border rounded-xl ${tc.record} text-[12px]`}
            style={{ padding: "12px 16px" }}
          >
            <p style={{ margin: 0 }}>
              <i className="fa fa-circle" style={{ color: "#22c55e", fontSize: "8px", marginRight: "8px" }} />
              {(fromCoords?.name || fromText).split(",")[0]}
            </p>
            <div
              className={tc.divider}
              style={{ margin: "4px 0 4px 4px", borderLeftWidth: "2px", borderLeftStyle: "dashed", height: "10px" }}
            />
            <p style={{ margin: 0 }}>
              <i className="fa fa-circle" style={{ color: "#ef4444", fontSize: "8px", marginRight: "8px" }} />
              {(destCoords?.name || destText).split(",")[0]}
            </p>
          </div>

          {/* First-step directions preview (first 4 steps) */}
          {routeData?.steps?.length > 0 && (
            <div
              className={`border rounded-xl overflow-hidden ${tc.divider}`}
            >
              {/* Header */}
              <div
                className={`flex items-center gap-2 px-[14px] py-[10px] border-b ${tc.divider}`}
                style={{ background: "rgba(66,133,244,0.08)" }}
              >
                <i className="fa fa-list" style={{ color: "#4285F4", fontSize: "12px" }} />
                <span className={`${tc.text} text-[11px] font-bold`}>
                  Turn-by-turn preview
                </span>
                <span style={{
                  marginLeft: "auto",
                  background: "rgba(66,133,244,0.2)",
                  color: "#60a5fa",
                  fontSize: "10px",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "50px",
                }}>
                  {routeData.steps.length} steps
                </span>
              </div>

              {/* Step rows (first 4 only) */}
              {routeData.steps.slice(0, 4).map((step, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-[10px] px-[14px] py-[9px] ${i === 0 ? tc.record : ""} ${
                    i < 3 && i < routeData.steps.length - 1 ? `border-b ${tc.divider}` : ""
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                      i === 0 ? "" : `${tc.surface2} ${tc.divider}`
                    }`}
                    style={i === 0 ? { background: "rgba(66,133,244,0.2)", borderColor: "rgba(66,133,244,0.35)" } : undefined}
                  >
                    <i
                      className={`fa ${step.icon} ${i === 0 ? "" : tc.sub} text-[11px]`}
                      style={i === 0 ? { color: "#4285F4" } : undefined}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      className={i === 0 ? tc.text : tc.sub}
                      style={{
                        fontSize: "11px",
                        fontWeight: i === 0 ? 700 : 400,
                        margin: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {step.instruction}
                    </p>
                  </div>
                  {step.distance > 0 && (
                    <span className={`${tc.sub} text-[10px] shrink-0`}>
                      {formatDistance(step.distance)}
                    </span>
                  )}
                </div>
              ))}

              {/* "... and N more" if steps > 4 */}
              {routeData.steps.length > 4 && (
                <div className={`text-center text-[10px] ${tc.sub} ${tc.record}`} style={{ padding: "8px 14px" }}>
                  + {routeData.steps.length - 4} more steps (shown during navigation)
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && <ErrorBox message={error} />}

          {/* Back + Start Ride buttons */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => { setStep(STEP.DESTINATION); setError(""); }}
              className={`border ${tc.btnSecondary}`}
              style={{
                padding: "14px 20px", borderRadius: "14px",
                cursor: "pointer", fontSize: "14px", fontWeight: 600,
              }}
            >
              <i className="fa fa-arrow-left" style={{ marginRight: "6px" }} />
              Back
            </button>
            <ActionButton
              label={loading ? "Starting..." : "Start Ride!"}
              icon={loading ? "fa-spinner fa-spin" : "fa-motorcycle"}
              onClick={handleStartRide}
              disabled={loading}
              style={{ flex: 1 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SMALL REUSABLE UI COMPONENTS (local to this file)
// ---------------------------------------------------------------------------

// Primary action button (orange gradient)
function ActionButton({ label, icon, onClick, disabled, style = {} }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding:       "14px 20px",
        borderRadius:  "14px",
        background:    "linear-gradient(135deg, #f97316, #ec4899)",
        border:        "none",
        color:         "white",
        fontWeight:    900,
        fontSize:      "14px",
        cursor:        disabled ? "not-allowed" : "pointer",
        opacity:       disabled ? 0.5 : 1,
        display:       "flex",
        alignItems:    "center",
        justifyContent: "center",
        gap:           "8px",
        boxShadow:     disabled ? "none" : "0 4px 20px rgba(249,115,22,0.3)",
        transition:    "transform 0.15s, box-shadow 0.15s",
        ...style,
      }}
      onMouseEnter={e => !disabled && (e.currentTarget.style.transform = "scale(1.02)")}
      onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
    >
      <i className={`fa ${icon}`} />
      {label}
    </button>
  );
}

// Cancel link
function CancelButton({ onClick, tc }) {
  return (
    <button
      onClick={onClick}
      className={`${tc.sub} w-full text-[13px]`}
      style={{
        padding: "10px",
        background: "transparent", border: "none",
        cursor: "pointer",
      }}
    >
      Cancel
    </button>
  );
}

// Error message box
function ErrorBox({ message }) {
  return (
    <div style={{
      padding:       "12px 16px",
      borderRadius:  "12px",
      background:    "rgba(239,68,68,0.1)",
      border:        "1px solid rgba(239,68,68,0.3)",
      color:         "#ef4444",
      fontSize:      "13px",
      display:       "flex",
      alignItems:    "flex-start",
      gap:           "8px",
    }}>
      <i className="fa fa-exclamation-circle" style={{ flexShrink: 0, marginTop: "1px" }} />
      {message}
    </div>
  );
}
