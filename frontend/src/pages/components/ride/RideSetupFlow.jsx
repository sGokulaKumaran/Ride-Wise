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

import { useState, useCallback } from "react";
import { geocode, getRoute, formatDistance, formatDuration } from "../../../services/routingApi";
import { getCurrentLocation }                                  from "../../../services/locationService";
import { createRide }                                          from "../../../services/rideApi";
import RideMap                                                 from "./RideMap";

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

export default function RideSetupFlow({ rideType, userId, onRideCreated, onCancel, tc }) {
  // ---- Step tracker ----
  const [step, setStep] = useState(STEP.FROM);

  // ---- FROM location state ----
  const [fromText,        setFromText]        = useState("");   // what the user typed
  const [fromCoords,      setFromCoords]      = useState(null); // { lat, lng, name }
  const [fromSuggestions, setFromSuggestions] = useState([]);  // filtered POPULAR_PLACES
  const [usingGps,        setUsingGps]        = useState(false); // true = GPS used for from

  // ---- DESTINATION state ----
  const [destText,        setDestText]        = useState("");
  const [destCoords,      setDestCoords]      = useState(null);
  const [destSuggestions, setDestSuggestions] = useState([]);

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
      setFromCoords({ lat: loc.lat, lng: loc.lng, name: "📍 My Current Location" });
      setFromText("📍 My Current Location");
      setUsingGps(true);
      setFromSuggestions([]);
      // Automatically advance to destination step
      setStep(STEP.DESTINATION);
    } catch (e) {
      setError("Could not get your location. Please allow location access or type an address.");
    } finally {
      setLoading(false);
    }
  };

  // ====================================================================
  // FROM — text input handler (filters suggestions)
  // ====================================================================
  const handleFromType = (text) => {
    setFromText(text);
    setUsingGps(false);
    setFromCoords(null); // clear previous geocoded result when user retypes
    // Filter popular places that contain the typed text (case-insensitive)
    setFromSuggestions(
      text.trim()
        ? POPULAR_PLACES.filter(p => p.toLowerCase().includes(text.toLowerCase()))
        : []
    );
  };

  // User picks a FROM suggestion chip
  const pickFrom = (place) => {
    setFromText(place);
    setFromCoords(null); // will be geocoded when user advances
    setFromSuggestions([]);
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
  // DESTINATION — text input handler
  // ====================================================================
  const handleDestType = (text) => {
    setDestText(text);
    setDestCoords(null);
    setDestSuggestions(
      text.trim()
        ? POPULAR_PLACES.filter(p => p.toLowerCase().includes(text.toLowerCase()))
        : []
    );
  };

  const pickDest = (place) => {
    setDestText(place);
    setDestCoords(null);
    setDestSuggestions([]);
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
      };

      // Save to backend (or localStorage fallback)
      // Attach routeSteps directly to savedRide so navigation has them
      // immediately (before the backend might strip unknown fields).
      const savedRide = await createRide(ridePayload);
      if (!savedRide.routeSteps && routeData.steps?.length) {
        savedRide.routeSteps = routeData.steps; // client-side attach for instant nav
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
            style={{
              flex: 1, height: "3px", borderRadius: "2px",
              background: step >= n
                ? "linear-gradient(90deg, #f97316, #ec4899)"   // completed/current = orange
                : "rgba(255,255,255,0.1)",                      // upcoming = faint
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

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "rgba(255,255,255,0.3)", fontSize: "12px" }}>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.1)" }} />
            or type a location
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.1)" }} />
          </div>

          {/* Text input for FROM */}
          <div style={{ position: "relative" }}>
            <i className="fa fa-map-marker-alt" style={{
              position: "absolute", left: "14px", top: "50%",
              transform: "translateY(-50%)", color: "#22c55e", fontSize: "14px",
            }} />
            <input
              type="text"
              value={fromText}
              onChange={e => handleFromType(e.target.value)}
              placeholder="e.g. Chennai Central, Koyambedu..."
              className={`w-full ${tc.input}`}
              style={{
                paddingLeft: "40px", paddingRight: "16px",
                paddingTop: "14px", paddingBottom: "14px",
                borderRadius: "14px", border: "1.5px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.05)", outline: "none",
                fontSize: "14px",
              }}
              onFocus={e => e.target.style.borderColor = "rgba(249,115,22,0.5)"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
            />
          </div>

          {/* FROM suggestions dropdown */}
          {fromSuggestions.length > 0 && (
            <div style={{
              background: "rgba(10,10,15,0.97)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "14px",
              overflow: "hidden",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}>
              {fromSuggestions.map((place, i) => (
                <button
                  key={i}
                  onClick={() => pickFrom(place)}
                  style={{
                    width: "100%", padding: "12px 16px",
                    borderBottom: i < fromSuggestions.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                    display: "flex", alignItems: "center", gap: "10px",
                    background: "transparent", color: "inherit",
                    cursor: "pointer", textAlign: "left", fontSize: "13px",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <i className="fa fa-location-dot" style={{ color: "#22c55e", fontSize: "12px", flexShrink: 0 }} />
                  {place}
                </button>
              ))}
            </div>
          )}

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
                  style={{
                    padding: "6px 12px", borderRadius: "50px",
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: fromText === p ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
                    borderColor: fromText === p ? "rgba(249,115,22,0.4)" : "rgba(255,255,255,0.12)",
                    color: "inherit", fontSize: "12px", cursor: "pointer", fontWeight: 600,
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

          <CancelButton onClick={onCancel} />
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

          {/* Destination input */}
          <div style={{ position: "relative" }}>
            <i className="fa fa-flag-checkered" style={{
              position: "absolute", left: "14px", top: "50%",
              transform: "translateY(-50%)", color: "#ef4444", fontSize: "14px",
            }} />
            <input
              type="text"
              value={destText}
              onChange={e => handleDestType(e.target.value)}
              placeholder="e.g. Pondicherry, Ooty, Goa..."
              autoFocus
              className={tc.input}
              style={{
                width: "100%", paddingLeft: "40px", paddingRight: "16px",
                paddingTop: "14px", paddingBottom: "14px",
                borderRadius: "14px", border: "1.5px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.05)", outline: "none",
                fontSize: "14px", boxSizing: "border-box",
              }}
              onFocus={e => e.target.style.borderColor = "rgba(249,115,22,0.5)"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
            />
          </div>

          {/* Destination suggestions dropdown */}
          {destSuggestions.length > 0 && (
            <div style={{
              background: "rgba(10,10,15,0.97)", backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px",
              overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}>
              {destSuggestions.map((place, i) => (
                <button
                  key={i}
                  onClick={() => pickDest(place)}
                  style={{
                    width: "100%", padding: "12px 16px",
                    borderBottom: i < destSuggestions.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                    display: "flex", alignItems: "center", gap: "10px",
                    background: "transparent", color: "inherit",
                    cursor: "pointer", textAlign: "left", fontSize: "13px",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <i className="fa fa-location-dot" style={{ color: "#ef4444", fontSize: "12px", flexShrink: 0 }} />
                  {place}
                </button>
              ))}
            </div>
          )}

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
                  style={{
                    padding: "6px 12px", borderRadius: "50px",
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: destText === p ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
                    borderColor: destText === p ? "rgba(249,115,22,0.4)" : "rgba(255,255,255,0.12)",
                    color: "inherit", fontSize: "12px", cursor: "pointer", fontWeight: 600,
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
              style={{
                padding: "14px 20px", borderRadius: "14px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.05)", color: "inherit",
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
          <div style={{ height: "240px", borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
            <RideMap ride={previewRide} isLive={false} />
          </div>

          {/* Route stats */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: "6px",
          }}>
            {[
              { label: "Distance", value: formatDistance(routeData?.distance), color: "#f97316" },
              { label: "Duration", value: formatDuration(routeData?.duration), color: "#fff" },
              { label: "Turns",    value: String(routeData?.steps?.length || 0), color: "#60a5fa" },
              { label: "Type",     value: rideType,                              color: "#34d399" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                style={{
                  padding: "10px 8px", borderRadius: "12px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  textAlign: "center",
                }}
              >
                <p style={{ color, fontWeight: 900, fontSize: "14px", margin: 0, textTransform: "capitalize" }}>{value}</p>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "9px", margin: 0, textTransform: "uppercase", letterSpacing: "1px", marginTop: "2px" }}>{label}</p>
              </div>
            ))}
          </div>

          {/* From → To summary */}
          <div style={{
            padding: "12px 16px", borderRadius: "12px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            fontSize: "12px",
          }}>
            <p style={{ margin: 0 }}>
              <i className="fa fa-circle" style={{ color: "#22c55e", fontSize: "8px", marginRight: "8px" }} />
              {(fromCoords?.name || fromText).split(",")[0]}
            </p>
            <div style={{ margin: "4px 0 4px 4px", borderLeft: "2px dashed rgba(255,255,255,0.1)", height: "10px" }} />
            <p style={{ margin: 0 }}>
              <i className="fa fa-circle" style={{ color: "#ef4444", fontSize: "8px", marginRight: "8px" }} />
              {(destCoords?.name || destText).split(",")[0]}
            </p>
          </div>

          {/* First-step directions preview (first 4 steps) */}
          {routeData?.steps?.length > 0 && (
            <div style={{
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.07)",
              overflow: "hidden",
            }}>
              {/* Header */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 14px",
                background: "rgba(66,133,244,0.08)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}>
                <i className="fa fa-list" style={{ color: "#4285F4", fontSize: "12px" }} />
                <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "11px", fontWeight: 700 }}>
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
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "9px 14px",
                    borderBottom: i < 3 && i < routeData.steps.length - 1
                      ? "1px solid rgba(255,255,255,0.04)"
                      : "none",
                    background: i === 0 ? "rgba(255,255,255,0.03)" : "transparent",
                  }}
                >
                  <div style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "8px",
                    background: i === 0
                      ? "rgba(66,133,244,0.2)"
                      : "rgba(255,255,255,0.05)",
                    border: `1px solid ${i === 0 ? "rgba(66,133,244,0.35)" : "rgba(255,255,255,0.08)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <i
                      className={`fa ${step.icon}`}
                      style={{
                        color:    i === 0 ? "#4285F4" : "rgba(255,255,255,0.4)",
                        fontSize: "11px",
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      color: i === 0 ? "white" : "rgba(255,255,255,0.55)",
                      fontSize: "11px",
                      fontWeight: i === 0 ? 700 : 400,
                      margin: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {step.instruction}
                    </p>
                  </div>
                  {step.distance > 0 && (
                    <span style={{
                      color: "rgba(255,255,255,0.3)",
                      fontSize: "10px",
                      flexShrink: 0,
                    }}>
                      {formatDistance(step.distance)}
                    </span>
                  )}
                </div>
              ))}

              {/* "... and N more" if steps > 4 */}
              {routeData.steps.length > 4 && (
                <div style={{
                  padding: "8px 14px",
                  color: "rgba(255,255,255,0.3)",
                  fontSize: "10px",
                  textAlign: "center",
                  background: "rgba(255,255,255,0.02)",
                }}>
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
              style={{
                padding: "14px 20px", borderRadius: "14px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.05)", color: "inherit",
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
function CancelButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", padding: "10px",
        background: "transparent", border: "none",
        color: "rgba(255,255,255,0.4)", fontSize: "13px",
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
