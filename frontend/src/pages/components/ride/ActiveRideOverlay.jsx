// ============================================================
// 🗺️ ActiveRideOverlay.jsx — Full-screen map overlay for active rides
//
// This is the "Google Maps-like" full-screen experience shown when
// a ride is in progress. It covers the entire viewport.
//
// ── FEATURES ──────────────────────────────────────────────
//   ✅ Full-screen MapLibre map with OSM tiles
//   ✅ Live GPS tracking — blue pulsing dot moves with the user
//   ✅ Dynamic blue route line — shrinks as user progresses
//   ✅ Minimize button — shrinks to a floating widget
//   ✅ Close button — hides the map, ride stays alive in the background
//   ✅ End Ride button — permanently ends the ride
//   ✅ Bottom bar: LIVE remaining distance + ETA from current GPS position
//      (falls back to total route stats if GPS is unavailable)
//   ✅ GPS error banner when location permission is denied
//
// ── REMAINING DISTANCE / ETA LOGIC ───────────────────────
//   Every GPS tick we recalculate:
//     • remainingDist = haversineDistance(user → destination)
//     • remainingTime = remainingDist / avgSpeed
//       (avgSpeed = totalDistance / totalDuration from the saved ride)
//   These live values are shown in the bottom bar.
//   The same values are also passed to RideMap so the destination
//   popup can display up-to-date remaining info.
//
// ── PROPS ─────────────────────────────────────────────────
//   ride    — active ride object (from backend / localStorage)
//   onClose — called when X is pressed (hides overlay, ride stays active)
//   onEnd   — called when "End Ride" is confirmed
// ============================================================

import { useState, useEffect, useRef } from "react";
import RideMap from "./RideMap";
import { watchLocation } from "../../../services/locationService";
import { formatDistance, formatDuration, haversineDistance } from "../../../services/routingApi";
import { updateUserLocation } from "../../../services/rideApi";

export default function ActiveRideOverlay({ ride, onClose, onEnd }) {
  // ── Live GPS state ──
  // myLocation is updated by the GPS watcher every few seconds (throttled)
  const [myLocation,    setMyLocation]   = useState(null);
  const [gpsError,      setGpsError]     = useState(null);

  // ── Live remaining stats (recalculated on every GPS tick) ──
  // These replace the static total distance/duration in the bottom bar.
  const [remainingDist, setRemainingDist] = useState(null); // metres
  const [remainingTime, setRemainingTime] = useState(null); // seconds

  // ── UI state ──
  const [minimized,  setMinimized]  = useState(false); // true = show floating chip
  const [confirmEnd, setConfirmEnd] = useState(false); // true = confirm modal visible
  const [ending,     setEnding]     = useState(false); // true = end request in flight

  // ── GPS watcher stop function — stored in ref to avoid stale closures ──
  const stopGpsRef = useRef(null);

  // ====================================================================
  // START GPS when overlay mounts; STOP when it unmounts
  // ====================================================================
  useEffect(() => {
    // ── Start continuous position tracking ──
    const stop = watchLocation(
      (loc) => {
        setMyLocation(loc);  // update the blue dot on the map
        setGpsError(null);   // clear any previous error

        // ── Recalculate remaining distance + ETA on every GPS tick ──
        if (ride?.destinationLat && ride?.destinationLng) {
          // Straight-line distance from user to destination (metres)
          const distM = haversineDistance(
            loc.lat, loc.lng,
            ride.destinationLat, ride.destinationLng
          );
          setRemainingDist(distM);

          // Estimate remaining time using the original average speed:
          //   avgSpeed (m/s) = totalDistance / totalDuration
          //   remainingTime  = remainingDistance / avgSpeed
          if (ride.distanceMeters && ride.durationSeconds && ride.distanceMeters > 0) {
            const avgSpeed   = ride.distanceMeters / ride.durationSeconds; // m/s
            const remTimeSec = distM / avgSpeed;                           // seconds
            setRemainingTime(remTimeSec);
          }
        }

        // ── Persist user position to backend for tracking/history ──
        // This is fire-and-forget; errors are logged but not surfaced to user
        if (ride?.id) {
          updateUserLocation(ride.id, loc.lat, loc.lng).catch(err => {
            console.warn("[ActiveRideOverlay] location update failed:", err.message);
          });
        }
      },
      (err) => {
        // GPS error (e.g. user denied permission) — show banner
        setGpsError(err.message);
      }
    );

    stopGpsRef.current = stop; // store so cleanup can call it

    // Cleanup: stop GPS when overlay unmounts or ride ends
    return () => {
      stop();
    };
  }, []); // empty deps = run only once on mount

  // ====================================================================
  // END RIDE handler — two-click confirm pattern to prevent accidental ends
  // ====================================================================
  const handleEndRide = async () => {
    if (!confirmEnd) {
      // First click: show the confirmation buttons
      setConfirmEnd(true);
      return;
    }
    // Second click (confirmed): end the ride
    setEnding(true);
    setConfirmEnd(false);
    stopGpsRef.current?.(); // stop GPS tracking before ending
    await onEnd();          // parent (Home.jsx) updates DB + resets state
    setEnding(false);
  };

  const cancelEnd = () => setConfirmEnd(false);

  // ====================================================================
  // MINIMIZED state — show a small floating status chip
  // The chip shows the route summary and a tap target to restore the map
  // ====================================================================
  if (minimized) {
    return (
      // Fixed chip at the bottom-center, above any navigation bar
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
          border:         "1px solid rgba(66,133,244,0.4)", // Google Maps blue border
          borderRadius:   "50px",
          padding:        "10px 20px",
          boxShadow:      "0 8px 40px rgba(0,0,0,0.6), 0 0 20px rgba(66,133,244,0.15)",
          cursor:         "pointer",
          whiteSpace:     "nowrap",
        }}
        onClick={() => setMinimized(false)} // tap chip to restore full-screen map
      >
        {/* Animated live dot */}
        <span style={{
          width: "10px", height: "10px", borderRadius: "50%",
          background:  "#22c55e",
          animation:   "pulse 2s ease-in-out infinite",
          flexShrink:  0,
        }} />

        {/* Route summary */}
        <span style={{ color: "white", fontWeight: 700, fontSize: "13px" }}>
          {(ride.fromName || "From").split(",")[0]}
          {" → "}
          {(ride.destinationName || "Destination").split(",")[0]}
        </span>

        {/* Remaining distance chip (if GPS is available) */}
        {remainingDist != null && (
          <span style={{
            background:  "rgba(66,133,244,0.2)",
            border:      "1px solid rgba(66,133,244,0.4)",
            borderRadius:"50px",
            padding:     "2px 8px",
            color:       "#60a5fa",
            fontSize:    "11px",
            fontWeight:  700,
          }}>
            {formatDistance(remainingDist)}
          </span>
        )}

        {/* Map icon */}
        <i className="fa fa-map" style={{ color: "#4285F4", fontSize: "14px" }} />

        {/* Keyframe for the live dot animation */}
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
      inset:         0,           // shorthand for top:0, right:0, bottom:0, left:0
      zIndex:        9000,        // above all page content
      display:       "flex",
      flexDirection: "column",
      background:    "#000",      // fallback while map tiles load
    }}>

      {/* ============================================================
          TOP BAR — route label + control buttons
          ============================================================ */}
      <div style={{
        position:       "absolute",
        top:            0, left: 0, right: 0,
        zIndex:         10,           // above the map canvas
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        padding:        "16px",
        // Gradient so buttons are readable over any map tile background
        background:     "linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)",
      }}>

        {/* Left: route route label pill */}
        <div style={{
          background:     "rgba(0,0,0,0.6)",
          backdropFilter: "blur(12px)",
          border:         "1px solid rgba(255,255,255,0.1)",
          borderRadius:   "50px",
          padding:        "8px 16px",
          display:        "flex",
          alignItems:     "center",
          gap:            "8px",
        }}>
          {/* Live green dot — animated with the same "pulse" keyframe */}
          <span style={{
            width: "8px", height: "8px", borderRadius: "50%",
            background:  "#22c55e",
            animation:   "pulse 2s ease-in-out infinite",
            flexShrink:  0,
          }} />
          <span style={{ color: "white", fontWeight: 700, fontSize: "13px" }}>
            {(ride.fromName || "From").split(",")[0]}
            {" → "}
            {(ride.destinationName || "Destination").split(",")[0]}
          </span>
        </div>

        {/* Right: Minimize + Close buttons */}
        <div style={{ display: "flex", gap: "8px" }}>

          {/* Minimize — keeps the ride alive, shows the floating chip */}
          <button
            onClick={() => setMinimized(true)}
            title="Minimize map"
            style={{
              width: "40px", height: "40px",
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

          {/* Close — hides overlay; ride keeps running, chip appears next visit */}
          <button
            onClick={onClose}
            title="Close map (ride stays active)"
            style={{
              width: "40px", height: "40px",
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
          MAP CANVAS — fills the remaining space between top and bottom bars
          RideMap handles GPS dot, blue route line, and dynamic trimming.
          ============================================================ */}
      <div style={{ flex: 1, position: "relative" }}>
        <RideMap
          ride={ride}
          myLocation={myLocation}
          isLive={true}            // enables dynamic route trimming
        />

        {/* GPS error banner — shown when location permission is denied */}
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
            zIndex:         20,
          }}>
            <i className="fa fa-triangle-exclamation" style={{ marginRight: "6px" }} />
            GPS: {gpsError}
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
        background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)",
        padding:    "24px 16px 24px",
      }}>

        {/* ── Stats row ── */}
        <div style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          gap:            "24px",
          marginBottom:   "16px",
        }}>

          {/* Remaining Distance
              If GPS is available → show live remaining distance.
              Otherwise → fall back to total distance from saved ride. */}
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "#4285F4", fontWeight: 900, fontSize: "20px", margin: 0 }}>
              {remainingDist != null
                ? formatDistance(remainingDist)      // live: from current GPS to dest
                : formatDistance(ride.distanceMeters) // fallback: total route distance
              }
            </p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>
              {/* Label changes based on whether we have GPS */}
              {remainingDist != null ? "Remaining" : "Distance"}
            </p>
          </div>

          <div style={{ width: "1px", height: "32px", background: "rgba(255,255,255,0.15)" }} />

          {/* Remaining ETA
              If GPS is available → live ETA based on remaining distance.
              Otherwise → fall back to original estimated duration. */}
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "white", fontWeight: 900, fontSize: "20px", margin: 0 }}>
              {remainingTime != null
                ? formatDuration(remainingTime)      // live ETA
                : formatDuration(ride.durationSeconds) // fallback: total duration
              }
            </p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>
              ETA
            </p>
          </div>

          <div style={{ width: "1px", height: "32px", background: "rgba(255,255,255,0.15)" }} />

          {/* Ride type emoji */}
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "white", fontWeight: 900, fontSize: "20px", margin: 0 }}>
              {ride.rideType === "solo" ? "🏍️" : "👥"}
            </p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>
              {ride.rideType}
            </p>
          </div>
        </div>

        {/* ── End Ride button (two-click confirm pattern) ── */}
        {confirmEnd ? (
          // Confirmation state — shows Cancel + Confirm buttons side by side
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
          // Default: single End Ride button (first click → shows confirmation)
          <button
            onClick={handleEndRide}
            style={{
              width:          "100%",
              padding:        "16px",
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
        )}
      </div>

      {/* Keyframe for the top-bar live dot animation */}
      <style>{`@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.4)} }`}</style>
    </div>
  );
}
