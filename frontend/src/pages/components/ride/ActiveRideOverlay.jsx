// ============================================================
// 🗺️ ActiveRideOverlay.jsx — Full-screen map overlay
//
// This is the "Google Maps-like" full-screen experience.
// It covers the entire viewport when a ride is active.
//
// FEATURES:
//   ✅ Full-screen MapLibre map (OSM tiles, proper zoom detail)
//   ✅ Live GPS tracking (blue pulsing dot)
//   ✅ Minimize button — shrinks to a floating widget on the screen
//   ✅ Close button  — hides the map, ride stays alive
//   ✅ End Ride button — permanently ends the ride
//   ✅ Route info bar at the bottom (distance + duration + status)
//   ✅ "Re-open map" when minimized
//
// PROPS:
//   ride       — the active ride object from backend/localStorage
//   onClose    — called when X is pressed (hides this overlay, ride stays active)
//   onEnd      — called when "End Ride" is confirmed
// ============================================================

import { useState, useEffect, useRef } from "react";
import RideMap from "./RideMap";
import { watchLocation } from "../../../services/locationService";
import { formatDistance, formatDuration } from "../../../services/routingApi";

export default function ActiveRideOverlay({ ride, onClose, onEnd }) {
  // ---- Live GPS state ----
  // myLocation is updated by the GPS watcher every few seconds
  const [myLocation, setMyLocation]   = useState(null);
  const [gpsError,   setGpsError]     = useState(null);

  // ---- UI state ----
  const [minimized,  setMinimized]    = useState(false); // true = show floating chip
  const [ending,     setEnding]       = useState(false); // true = "End Ride" clicked, waiting confirm
  const [confirmEnd, setConfirmEnd]   = useState(false); // true = show confirmation modal

  // ---- Stop function returned by watchLocation ----
  // We store it in a ref so cleanup can call it without stale closure issues
  const stopGpsRef = useRef(null);

  // ====================================================================
  // START GPS when this overlay mounts; STOP it when it unmounts
  // ====================================================================
  useEffect(() => {
    // Start watching the device's GPS position
    const stop = watchLocation(
      (loc) => {
        setMyLocation(loc);     // update the blue dot on the map
        setGpsError(null);      // clear any previous GPS error
      },
      (err) => {
        setGpsError(err.message); // show error to user (e.g. "permission denied")
      }
    );
    stopGpsRef.current = stop; // save so we can call it in cleanup

    // When this component unmounts (overlay closed/ended), stop GPS
    return () => {
      stop();
    };
  }, []); // empty deps = run only once on mount

  // ====================================================================
  // END RIDE handler — confirms then calls onEnd
  // ====================================================================
  const handleEndRide = async () => {
    if (!confirmEnd) {
      // First click: show the confirmation state
      setConfirmEnd(true);
      return;
    }
    // Second click (confirmed): actually end the ride
    setEnding(true);
    setConfirmEnd(false);
    stopGpsRef.current?.(); // stop GPS before calling onEnd
    await onEnd();          // parent handles DB update + state reset
    setEnding(false);
  };

  // Cancel the end-ride confirmation
  const cancelEnd = () => setConfirmEnd(false);

  // ====================================================================
  // MINIMIZED state — show a small floating status chip
  // ====================================================================
  if (minimized) {
    return (
      // Fixed position chip at the bottom-center of the screen
      <div
        style={{
          position:    "fixed",
          bottom:      "80px",   // above mobile nav bar
          left:        "50%",
          transform:   "translateX(-50%)",
          zIndex:      9999,
          display:     "flex",
          alignItems:  "center",
          gap:         "12px",
          background:  "linear-gradient(135deg, rgba(10,10,10,0.95), rgba(20,20,30,0.95))",
          backdropFilter: "blur(20px)",
          border:      "1px solid rgba(249,115,22,0.4)",
          borderRadius: "50px",
          padding:     "10px 20px",
          boxShadow:   "0 8px 40px rgba(0,0,0,0.6), 0 0 20px rgba(249,115,22,0.15)",
          cursor:      "pointer",
          whiteSpace:  "nowrap",
        }}
        onClick={() => setMinimized(false)} // tap chip to restore map
      >
        {/* Animated green dot = live indicator */}
        <span style={{
          width: "10px", height: "10px", borderRadius: "50%",
          background: "#22c55e",
          animation: "pulse 2s ease-in-out infinite",
          flexShrink: 0,
        }} />
        {/* Ride summary text */}
        <span style={{ color: "white", fontWeight: 700, fontSize: "13px" }}>
          {(ride.fromName || "From").split(",")[0]}
          {" "}→{" "}
          {(ride.destinationName || "Destination").split(",")[0]}
        </span>
        {/* "Open Map" icon */}
        <i className="fa fa-map" style={{ color: "#f97316", fontSize: "14px" }} />

        {/* Keyframe injection for the pulse animation */}
        <style>{`@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.3)} }`}</style>
      </div>
    );
  }

  // ====================================================================
  // FULL-SCREEN overlay
  // ====================================================================
  return (
    <div style={{
      position:   "fixed",
      inset:      0,              // top:0, right:0, bottom:0, left:0
      zIndex:     9000,           // above everything else on the page
      display:    "flex",
      flexDirection: "column",
      background: "#000",         // fallback while map tiles load
    }}>

      {/* ============================================================
          TOP BAR — controls overlay
          ============================================================ */}
      <div style={{
        position:       "absolute",
        top:            0,
        left:           0,
        right:          0,
        zIndex:         10,         // above the map canvas
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        padding:        "16px",
        // Gradient overlay so buttons are readable over any map background
        background:     "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)",
      }}>
        {/* Left: ride route label */}
        <div style={{
          background:    "rgba(0,0,0,0.6)",
          backdropFilter: "blur(12px)",
          border:         "1px solid rgba(255,255,255,0.1)",
          borderRadius:   "50px",
          padding:        "8px 16px",
          display:        "flex",
          alignItems:     "center",
          gap:            "8px",
        }}>
          {/* Live indicator dot */}
          <span style={{
            width: "8px", height: "8px", borderRadius: "50%",
            background: "#22c55e",
            animation: "pulse 2s ease-in-out infinite",
            flexShrink: 0,
          }} />
          <span style={{ color: "white", fontWeight: 700, fontSize: "13px" }}>
            {(ride.fromName || "From").split(",")[0]}
            {" → "}
            {(ride.destinationName || "Destination").split(",")[0]}
          </span>
        </div>

        {/* Right: Minimize + Close buttons */}
        <div style={{ display: "flex", gap: "8px" }}>
          {/* Minimize — keeps ride alive, shows the floating chip */}
          <button
            onClick={() => setMinimized(true)}
            title="Minimize map"
            style={{
              width:   "40px", height: "40px",
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
            }}
          >
            <i className="fa fa-minus" />
          </button>

          {/* Close — hides overlay, ride stays active, chip appears */}
          <button
            onClick={onClose}
            title="Close map (ride stays active)"
            style={{
              width:   "40px", height: "40px",
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
            }}
          >
            <i className="fa fa-times" />
          </button>
        </div>
      </div>

      {/* ============================================================
          MAP CANVAS — fills remaining space
          ============================================================ */}
      <div style={{ flex: 1, position: "relative" }}>
        <RideMap
          ride={ride}
          myLocation={myLocation}
          isLive
        />

        {/* GPS error banner — shown if user denied location permission */}
        {gpsError && (
          <div style={{
            position:       "absolute",
            top:            "70px",
            left:           "50%",
            transform:      "translateX(-50%)",
            background:     "rgba(239,68,68,0.9)",
            color:          "white",
            padding:        "8px 16px",
            borderRadius:   "8px",
            fontSize:       "12px",
            backdropFilter: "blur(8px)",
            whiteSpace:     "nowrap",
          }}>
            <i className="fa fa-triangle-exclamation" style={{ marginRight: "6px" }} />
            GPS: {gpsError}
          </div>
        )}
      </div>

      {/* ============================================================
          BOTTOM BAR — route info + End Ride button
          ============================================================ */}
      <div style={{
        position:       "absolute",
        bottom:         0,
        left:           0,
        right:          0,
        zIndex:         10,
        // Gradient from transparent (top) to solid (bottom)
        background:     "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)",
        padding:        "24px 16px 24px",
      }}>
        {/* Route stats row */}
        <div style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          gap:            "24px",
          marginBottom:   "16px",
        }}>
          {/* Distance */}
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "#f97316", fontWeight: 900, fontSize: "20px", margin: 0 }}>
              {formatDistance(ride.distanceMeters)}
            </p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>
              Distance
            </p>
          </div>

          <div style={{ width: "1px", height: "32px", background: "rgba(255,255,255,0.15)" }} />

          {/* Duration */}
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "white", fontWeight: 900, fontSize: "20px", margin: 0 }}>
              {formatDuration(ride.durationSeconds)}
            </p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>
              ETA
            </p>
          </div>

          <div style={{ width: "1px", height: "32px", background: "rgba(255,255,255,0.15)" }} />

          {/* Ride type */}
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "white", fontWeight: 900, fontSize: "20px", margin: 0 }}>
              {ride.rideType === "solo" ? "🏍️" : "👥"}
            </p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>
              {ride.rideType}
            </p>
          </div>
        </div>

        {/* End Ride button area */}
        {confirmEnd ? (
          // Confirmation step — prevent accidental end
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={cancelEnd}
              style={{
                flex: 1, padding: "14px",
                background:    "rgba(255,255,255,0.1)",
                border:        "1px solid rgba(255,255,255,0.2)",
                borderRadius:  "14px",
                color:         "white",
                fontWeight:    700,
                fontSize:      "14px",
                cursor:        "pointer",
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
                background:    "linear-gradient(135deg, #ef4444, #dc2626)",
                border:        "none",
                borderRadius:  "14px",
                color:         "white",
                fontWeight:    900,
                fontSize:      "14px",
                cursor:        ending ? "not-allowed" : "pointer",
                opacity:       ending ? 0.7 : 1,
                boxShadow:     "0 4px 20px rgba(239,68,68,0.4)",
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
              width:         "100%",
              padding:       "16px",
              background:    "rgba(239,68,68,0.15)",
              border:        "1.5px solid rgba(239,68,68,0.5)",
              borderRadius:  "14px",
              color:         "#ef4444",
              fontWeight:    900,
              fontSize:      "15px",
              cursor:        "pointer",
              backdropFilter:"blur(8px)",
            }}
          >
            <i className="fa fa-flag-checkered" style={{ marginRight: "8px" }} />
            End Ride
          </button>
        )}
      </div>

      {/* Keyframe for the live dot animation */}
      <style>{`@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.4)} }`}</style>
    </div>
  );
}
