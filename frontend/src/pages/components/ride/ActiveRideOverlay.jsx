// ============================================================
// 🗺️ ActiveRideOverlay.jsx — Navigation-Mode Map Overlay
//
// This is the full-screen Google Maps-style navigation experience
// shown when a ride is in progress. Covers the entire viewport.
//
// ── FEATURES ──────────────────────────────────────────────
//   ✅ Full-screen MapLibre map with OSM tiles
//   ✅ Live GPS tracking — blue pulsing BEARING ARROW moves + rotates
//   ✅ Dynamic blue route line — shrinks as user progresses
//   ✅ NEXT MANEUVER BAR — Google Maps-style top instruction banner
//      showing the current turn instruction + distance to it
//   ✅ SPEED DISPLAY — current speed in km/h (bottom-left HUD chip)
//   ✅ DIRECTIONS PANEL — tap list icon to see all route steps
//      with the active step highlighted and auto-scrolled into view
//   ✅ Minimize button — shrinks to a floating widget
//   ✅ Close button — hides the map, ride stays alive
//   ✅ End Ride button — permanently ends the ride (two-click confirm)
//   ✅ Bottom bar: LIVE remaining distance + ETA + ride type
//   ✅ GPS error banner when location permission is denied
//   ✅ Camera-follow mode via RideMap's built-in follow logic
//   ✅ VIEW-ONLY MODE — for completed/cancelled rides (no End Ride button)
//
// ── PROPS ─────────────────────────────────────────────────
//   ride    — active ride object (from backend / localStorage)
//   onClose — called when X is pressed (hides overlay, ride stays active)
//   onEnd   — called when "End Ride" is confirmed
// ============================================================

import { useState, useEffect, useRef } from "react";
import RideMap         from "./RideMap";
import DirectionsPanel from "./DirectionsPanel";
import { watchLocation } from "../../../services/locationService";
import {
  formatDistance,
  formatDuration,
  haversineDistance,
  findActiveStep,
} from "../../../services/routingApi";
import { updateUserLocation } from "../../../services/rideApi";

// ── Parse steps — ride.routeSteps is stored as JSON string in DB ──
function parseSteps(ride) {
  if (!ride) return [];
  if (Array.isArray(ride.routeSteps)) return ride.routeSteps;
  if (typeof ride.routeSteps === "string") {
    try { return JSON.parse(ride.routeSteps); } catch { return []; }
  }
  return [];
}

export default function ActiveRideOverlay({ ride, onClose, onEnd }) {
  // ── Live GPS state ──
  const [myLocation,    setMyLocation]   = useState(null);
  const [gpsError,      setGpsError]     = useState(null);

  // ── Live remaining stats ──
  const [remainingDist, setRemainingDist] = useState(null); // metres
  const [remainingTime, setRemainingTime] = useState(null); // seconds

  // ── Navigation step state ──
  const [steps,       setSteps]       = useState(() => parseSteps(ride));
  const [activeStep,  setActiveStep]  = useState(0);

  // ── UI state ──
  const [minimized,       setMinimized]       = useState(false);
  const [confirmEnd,      setConfirmEnd]       = useState(false);
  const [ending,          setEnding]           = useState(false);
  const [showDirections,  setShowDirections]   = useState(false);

  const stopGpsRef = useRef(null);

  // ── Determine if ride is active (live navigation) or view-only ──
  // Completed/cancelled rides open in view-only mode — no End Ride button,
  // no GPS tracking started (to avoid unnecessary battery drain).
  const isActiveRide = ride?.status === "active";

  // Parse steps whenever ride changes
  useEffect(() => {
    setSteps(parseSteps(ride));
  }, [ride]);

  // ── Current step derived values ──
  const currentStep    = steps[activeStep];
  const nextStep       = steps[activeStep + 1];
  const isLastStep     = activeStep >= steps.length - 1;

  // ====================================================================
  // START GPS when overlay mounts (only for active rides); STOP on unmount
  // ====================================================================
  useEffect(() => {
    // Only track GPS for active rides — not for history view
    if (!isActiveRide) return;

    const stop = watchLocation(
      (loc) => {
        setMyLocation(loc);
        setGpsError(null);

        // ── Remaining distance + ETA ──
        if (ride?.destinationLat && ride?.destinationLng) {
          const distM = haversineDistance(
            loc.lat, loc.lng,
            ride.destinationLat, ride.destinationLng
          );
          setRemainingDist(distM);
          if (ride.distanceMeters > 0 && ride.durationSeconds > 0) {
            const avgSpeed   = ride.distanceMeters / ride.durationSeconds;
            setRemainingTime(distM / avgSpeed);
          }
        }

        // ── Find which navigation step is currently active ──
        setActiveStep(prev => {
          const steps = parseSteps(ride);
          if (!steps.length) return prev;
          const next = findActiveStep(steps, loc.lat, loc.lng);
          // Only advance forward — never go backward
          return next >= prev ? next : prev;
        });

        // ── Persist user position to backend ──
        if (ride?.id) {
          updateUserLocation(ride.id, loc.lat, loc.lng).catch(err => {
            console.warn("[ActiveRideOverlay] location update failed:", err.message);
          });
        }
      },
      (err) => setGpsError(err.message)
    );

    stopGpsRef.current = stop;
    return () => stop();
  }, [isActiveRide]); // eslint-disable-line react-hooks/exhaustive-deps

  // ====================================================================
  // END RIDE handler (two-click confirm)
  // ====================================================================
  const handleEndRide = async () => {
    if (!confirmEnd) { setConfirmEnd(true); return; }
    setEnding(true);
    setConfirmEnd(false);
    // Stop GPS tracking before calling onEnd
    stopGpsRef.current?.();
    stopGpsRef.current = null;
    await onEnd();
    setEnding(false);
  };

  const cancelEnd = () => setConfirmEnd(false);

  // ── Derive current step distance (to next maneuver) ──
  const stepDist = currentStep?.distance || 0;

  // ====================================================================
  // MINIMIZED state — floating chip
  // ====================================================================
  if (minimized) {
    return (
      <div
        style={{
          position:       "fixed",
          bottom:         "80px",
          left:           "50%",
          transform:      "translateX(-50%)",
          zIndex:         9999,
          display:        "flex",
          alignItems:     "center",
          gap:            "12px",
          background:     "linear-gradient(135deg, rgba(10,10,10,0.95), rgba(20,20,30,0.95))",
          backdropFilter: "blur(20px)",
          border:         "1px solid rgba(66,133,244,0.4)",
          borderRadius:   "50px",
          padding:        "10px 20px",
          boxShadow:      "0 8px 40px rgba(0,0,0,0.6), 0 0 20px rgba(66,133,244,0.15)",
          cursor:         "pointer",
          whiteSpace:     "nowrap",
        }}
        onClick={() => setMinimized(false)}
      >
        <span style={{
          width: "10px", height: "10px", borderRadius: "50%",
          background: isActiveRide ? "#22c55e" : "#9ca3af",
          animation: isActiveRide ? "pulse 2s ease-in-out infinite" : "none",
          flexShrink: 0,
        }} />
        <span style={{ color: "white", fontWeight: 700, fontSize: "13px" }}>
          {(ride.fromName || "From").split(",")[0]} → {(ride.destinationName || "Destination").split(",")[0]}
        </span>
        {remainingDist != null && (
          <span style={{
            background:   "rgba(66,133,244,0.2)",
            border:       "1px solid rgba(66,133,244,0.4)",
            borderRadius: "50px",
            padding:      "2px 8px",
            color:        "#60a5fa",
            fontSize:     "11px",
            fontWeight:   700,
          }}>
            {formatDistance(remainingDist)}
          </span>
        )}
        <i className="fa fa-map" style={{ color: "#4285F4", fontSize: "14px" }} />
        <style>{`@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.3)} }`}</style>
      </div>
    );
  }

  // ====================================================================
  // FULL-SCREEN overlay
  // ====================================================================
  return (
    <div style={{
      position:      "fixed",
      inset:         0,
      zIndex:        9000,
      display:       "flex",
      flexDirection: "column",
      background:    "#000",
    }}>

      {/* ============================================================
          NEXT MANEUVER BAR — Google Maps-style navigation instruction
          ============================================================ */}
      <div style={{
        position:       "absolute",
        top:            0, left: 0, right: 0,
        zIndex:         20,
        padding:        "12px 16px 8px",
        background:     "linear-gradient(to bottom, rgba(0,0,0,0.88) 0%, transparent 100%)",
        pointerEvents:  "none",
      }}>
        {/* ── Row 1: Next turn instruction (only for active rides with steps) ── */}
        {currentStep && isActiveRide && (
          <div style={{
            display:        "flex",
            alignItems:     "center",
            gap:            "12px",
            background:     "rgba(15,15,26,0.92)",
            backdropFilter: "blur(16px)",
            border:         "1px solid rgba(255,255,255,0.08)",
            borderRadius:   "16px",
            padding:        "12px 16px",
            marginBottom:   "8px",
            boxShadow:      "0 4px 24px rgba(0,0,0,0.5)",
            pointerEvents:  "auto",
          }}>

            {/* Maneuver icon circle */}
            <div style={{
              width:          "48px",
              height:         "48px",
              borderRadius:   "14px",
              background:     "linear-gradient(135deg, rgba(66,133,244,0.3), rgba(66,133,244,0.15))",
              border:         "1.5px solid rgba(66,133,244,0.4)",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              flexShrink:     0,
            }}>
              <i
                className={`fa ${currentStep.icon}`}
                style={{ color: "#4285F4", fontSize: "20px" }}
              />
            </div>

            {/* Instruction text + distance */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Distance to next maneuver */}
              {stepDist > 0 && (
                <p style={{
                  color:      "#4285F4",
                  fontWeight: 900,
                  fontSize:   "13px",
                  margin:     "0 0 2px",
                  letterSpacing: "0.5px",
                }}>
                  in {formatDistance(stepDist)}
                </p>
              )}
              {/* Instruction */}
              <p style={{
                color:      "white",
                fontWeight: 700,
                fontSize:   "15px",
                margin:     0,
                lineHeight: "1.3",
                overflow:   "hidden",
                textOverflow:"ellipsis",
                display:    "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}>
                {currentStep.instruction}
              </p>
            </div>

            {/* Right: control buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", pointerEvents: "auto" }}>
              {/* Directions list toggle */}
              <button
                onClick={() => setShowDirections(v => !v)}
                title="Show all directions"
                style={{
                  width:          "36px",
                  height:         "36px",
                  borderRadius:   "10px",
                  background:     showDirections
                    ? "linear-gradient(135deg, rgba(249,115,22,0.3), rgba(236,72,153,0.2))"
                    : "rgba(255,255,255,0.08)",
                  border:         showDirections
                    ? "1px solid rgba(249,115,22,0.5)"
                    : "1px solid rgba(255,255,255,0.12)",
                  color:          showDirections ? "#f97316" : "white",
                  cursor:         "pointer",
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  fontSize:       "13px",
                  transition:     "background 0.2s, border 0.2s",
                }}
              >
                <i className="fa fa-list" />
              </button>
              {/* Minimize */}
              <button
                onClick={() => setMinimized(true)}
                title="Minimize"
                style={{
                  width:          "36px",
                  height:         "36px",
                  borderRadius:   "10px",
                  background:     "rgba(255,255,255,0.08)",
                  border:         "1px solid rgba(255,255,255,0.12)",
                  color:          "white",
                  cursor:         "pointer",
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  fontSize:       "12px",
                }}
              >
                <i className="fa fa-minus" />
              </button>
              {/* Close */}
              <button
                onClick={onClose}
                title="Close map"
                style={{
                  width:          "36px",
                  height:         "36px",
                  borderRadius:   "10px",
                  background:     "rgba(255,255,255,0.08)",
                  border:         "1px solid rgba(255,255,255,0.12)",
                  color:          "white",
                  cursor:         "pointer",
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  fontSize:       "13px",
                }}
              >
                <i className="fa fa-times" />
              </button>
            </div>
          </div>
        )}

        {/* ── If no steps yet or view-only mode — show compact top bar ── */}
        {(!currentStep || !isActiveRide) && (
          <div style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: "space-between",
            background:     "rgba(0,0,0,0.65)",
            backdropFilter: "blur(12px)",
            border:         "1px solid rgba(255,255,255,0.1)",
            borderRadius:   "50px",
            padding:        "8px 16px",
            pointerEvents:  "auto",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{
                width: "8px", height: "8px", borderRadius: "50%",
                background: isActiveRide ? "#22c55e" : "#9ca3af",
                animation: isActiveRide ? "pulse 2s ease-in-out infinite" : "none",
              }} />
              <span style={{ color: "white", fontWeight: 700, fontSize: "13px" }}>
                {(ride.fromName || "From").split(",")[0]} → {(ride.destinationName || "Destination").split(",")[0]}
              </span>
              {/* View-only badge for completed rides */}
              {!isActiveRide && (
                <span style={{
                  background: "rgba(156,163,175,0.2)",
                  border: "1px solid rgba(156,163,175,0.3)",
                  borderRadius: "50px",
                  padding: "2px 8px",
                  color: "#9ca3af",
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}>
                  {ride.status || "Completed"}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              {steps.length > 0 && (
                <button onClick={() => setShowDirections(v => !v)} style={topBtnStyle}>
                  <i className="fa fa-list" />
                </button>
              )}
              <button onClick={() => setMinimized(true)} style={topBtnStyle}>
                <i className="fa fa-minus" />
              </button>
              <button onClick={onClose} style={topBtnStyle}>
                <i className="fa fa-times" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================
          MAP CANVAS
          ============================================================ */}
      <div style={{ flex: 1, position: "relative" }}>
        <RideMap
          ride={ride}
          myLocation={myLocation}
          isLive={isActiveRide}
        />

        {/* GPS error banner */}
        {gpsError && isActiveRide && (
          <div style={{
            position:       "absolute",
            top:            "160px",
            left:           "50%",
            transform:      "translateX(-50%)",
            background:     "rgba(239,68,68,0.92)",
            color:          "white",
            padding:        "8px 16px",
            borderRadius:   "10px",
            fontSize:       "12px",
            backdropFilter: "blur(8px)",
            whiteSpace:     "nowrap",
            zIndex:         20,
            boxShadow:      "0 4px 16px rgba(239,68,68,0.4)",
          }}>
            <i className="fa fa-triangle-exclamation" style={{ marginRight: "6px" }} />
            GPS: {gpsError}
          </div>
        )}

        {/* ── Speed HUD chip (bottom-left) — only during active rides ── */}
        {myLocation?.speed != null && myLocation.speed >= 0 && isActiveRide && (
          <div style={{
            position:       "absolute",
            bottom:         "170px",
            left:           "16px",
            zIndex:         20,
            background:     "rgba(15,15,26,0.9)",
            backdropFilter: "blur(12px)",
            border:         "1px solid rgba(255,255,255,0.1)",
            borderRadius:   "14px",
            padding:        "10px 14px",
            textAlign:      "center",
            minWidth:       "60px",
          }}>
            <p style={{ color: "white", fontWeight: 900, fontSize: "20px", margin: 0, lineHeight: 1 }}>
              {Math.round(myLocation.speed * 3.6)}
            </p>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "9px", margin: "3px 0 0", textTransform: "uppercase", letterSpacing: "1px" }}>
              km/h
            </p>
          </div>
        )}

        {/* ── Step progress indicator (bottom-right) ── */}
        {steps.length > 0 && isActiveRide && (
          <div style={{
            position:       "absolute",
            bottom:         "170px",
            right:          "16px",
            zIndex:         20,
            background:     "rgba(15,15,26,0.9)",
            backdropFilter: "blur(12px)",
            border:         "1px solid rgba(255,255,255,0.1)",
            borderRadius:   "14px",
            padding:        "10px 14px",
            textAlign:      "center",
            minWidth:       "60px",
          }}>
            <p style={{ color: "#4285F4", fontWeight: 900, fontSize: "16px", margin: 0, lineHeight: 1 }}>
              {activeStep + 1}/{steps.length}
            </p>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "9px", margin: "3px 0 0", textTransform: "uppercase", letterSpacing: "1px" }}>
              Steps
            </p>
          </div>
        )}
      </div>

      {/* ============================================================
          BOTTOM BAR — live stats + End Ride button
          ============================================================ */}
      <div style={{
        position:   "absolute",
        bottom:     0, left: 0, right: 0,
        zIndex:     10,
        background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.8) 60%, transparent 100%)",
        padding:    "20px 16px 24px",
      }}>

        {/* ── Stats row ── */}
        <div style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          gap:            "24px",
          marginBottom:   "14px",
        }}>
          {/* Remaining Distance */}
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "#4285F4", fontWeight: 900, fontSize: "22px", margin: 0 }}>
              {remainingDist != null
                ? formatDistance(remainingDist)
                : formatDistance(ride.distanceMeters)}
            </p>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "10px", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>
              {remainingDist != null ? "Remaining" : "Distance"}
            </p>
          </div>

          <div style={{ width: "1px", height: "32px", background: "rgba(255,255,255,0.12)" }} />

          {/* ETA */}
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "white", fontWeight: 900, fontSize: "22px", margin: 0 }}>
              {remainingTime != null
                ? formatDuration(remainingTime)
                : formatDuration(ride.durationSeconds)}
            </p>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "10px", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>
              ETA
            </p>
          </div>

          <div style={{ width: "1px", height: "32px", background: "rgba(255,255,255,0.12)" }} />

          {/* Ride type */}
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "white", fontWeight: 900, fontSize: "22px", margin: 0 }}>
              {ride.rideType === "solo" ? "🏍️" : "👥"}
            </p>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "10px", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>
              {ride.rideType}
            </p>
          </div>
        </div>

        {/* ── End Ride button — only for ACTIVE rides ── */}
        {/* BUG FIX: completed/cancelled rides show a "Close" button instead */}
        {isActiveRide ? (
          confirmEnd ? (
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={cancelEnd}
                style={{
                  flex: 1, padding: "14px",
                  background:   "rgba(255,255,255,0.1)",
                  border:       "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "14px",
                  color:        "white",
                  fontWeight:   700,
                  fontSize:     "14px",
                  cursor:       "pointer",
                }}
              >
                <i className="fa fa-arrow-left" style={{ marginRight: "8px" }} />
                Cancel
              </button>
              <button
                onClick={handleEndRide}
                disabled={ending}
                style={{
                  flex: 1, padding: "14px",
                  background:   "linear-gradient(135deg, #ef4444, #dc2626)",
                  border:       "none",
                  borderRadius: "14px",
                  color:        "white",
                  fontWeight:   900,
                  fontSize:     "14px",
                  cursor:       ending ? "not-allowed" : "pointer",
                  opacity:      ending ? 0.7 : 1,
                  boxShadow:    "0 4px 20px rgba(239,68,68,0.4)",
                }}
              >
                {ending
                  ? <><i className="fa fa-spinner fa-spin" style={{ marginRight: "8px" }} />Ending...</>
                  : <><i className="fa fa-flag-checkered" style={{ marginRight: "8px" }} />Confirm End</>
                }
              </button>
            </div>
          ) : (
            <button
              onClick={handleEndRide}
              style={{
                width:          "100%",
                padding:        "15px",
                background:     "rgba(239,68,68,0.15)",
                border:         "1.5px solid rgba(239,68,68,0.5)",
                borderRadius:   "14px",
                color:          "#ef4444",
                fontWeight:     900,
                fontSize:       "15px",
                cursor:         "pointer",
                backdropFilter: "blur(8px)",
              }}
            >
              <i className="fa fa-flag-checkered" style={{ marginRight: "8px" }} />
              End Ride
            </button>
          )
        ) : (
          // View-only mode for completed/cancelled rides
          <button
            onClick={onClose}
            style={{
              width:          "100%",
              padding:        "15px",
              background:     "rgba(255,255,255,0.08)",
              border:         "1.5px solid rgba(255,255,255,0.15)",
              borderRadius:   "14px",
              color:          "rgba(255,255,255,0.8)",
              fontWeight:     900,
              fontSize:       "15px",
              cursor:         "pointer",
              backdropFilter: "blur(8px)",
            }}
          >
            <i className="fa fa-times" style={{ marginRight: "8px" }} />
            Close
          </button>
        )}
      </div>

      {/* ============================================================
          DIRECTIONS PANEL — slide-up drawer with all steps
          ============================================================ */}
      {showDirections && (
        <DirectionsPanel
          steps={steps}
          activeStep={activeStep}
          onClose={() => setShowDirections(false)}
          totalDist={ride.distanceMeters}
          totalTime={ride.durationSeconds}
          destName={(ride.destinationName || "Destination").split(",")[0]}
        />
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.4)} }
      `}</style>
    </div>
  );
}

// ── Shared small top-bar button style ──
const topBtnStyle = {
  width:          "36px",
  height:         "36px",
  borderRadius:   "50%",
  background:     "rgba(0,0,0,0.6)",
  backdropFilter: "blur(12px)",
  border:         "1px solid rgba(255,255,255,0.15)",
  color:          "white",
  cursor:         "pointer",
  display:        "flex",
  alignItems:     "center",
  justifyContent: "center",
  fontSize:       "14px",
};
