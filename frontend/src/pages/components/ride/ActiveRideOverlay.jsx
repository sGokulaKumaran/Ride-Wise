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
//   ✅ Bottom bar: LIVE distance RIDDEN + remaining distance + ETA + total route
//   ✅ Live distance travelled — route-accurate (snap-to-route) with GPS noise
//      filtering; paused while minimized/backgrounded; saved on ride end
//   ✅ GPS error banner when location permission is denied
//   ✅ Camera-follow mode via RideMap's built-in follow logic
//   ✅ VIEW-ONLY MODE — for completed/cancelled rides (no End Ride button)
//
// ── PROPS ─────────────────────────────────────────────────
//   ride    — active ride object (from backend / localStorage)
//   onClose — called when X is pressed (hides overlay, ride stays active)
//   onEnd   — called when "End Ride" is confirmed
// ============================================================

import { useState, useEffect, useRef, useCallback } from "react";
import RideMap         from "./RideMap";
import DirectionsPanel from "./DirectionsPanel";
import { watchLocation } from "../../../services/locationService";
import {
  formatDistance,
  formatDuration,
  haversineDistance,
  findActiveStep,
} from "../../../services/routingApi";
import { updateUserLocation, getGroupRideParticipants, updateParticipantStatus } from "../../../services/rideApi";
import GroupRidersPanel from "./GroupRidersPanel";
import Icon from "../ui/Icon";
import { useAuth } from "../../../context/AuthContext";
import { useTheme } from "../../hooks/useTheme";
import { useRideDistance } from "../../hooks/useRideDistance";

const RIDER_COLORS = [
  "#8b5cf6", "#14b8a6", "#f59e0b", "#ec4899", "#06b6d4",
  "#10b981", "#f43f5e", "#6366f1", "#84cc16", "#e11d48",
];

// ── Parse steps — ride.routeSteps is stored as JSON string in DB ──
function parseSteps(ride) {
  if (!ride) return [];
  if (Array.isArray(ride.routeSteps)) return ride.routeSteps;
  if (typeof ride.routeSteps === "string") {
    try { return JSON.parse(ride.routeSteps); } catch { return []; }
  }
  return [];
}

function getStepIconName(step) {
  const type = step.maneuverType || "";
  const modifier = String(step.maneuverModifier || "");
  const legacyIcon = String(step.icon || "");
  if (type === "arrive" || legacyIcon.includes("flag")) return "maneuverArrive";
  if (type === "depart" || legacyIcon.includes("location")) return "maneuverDepart";
  if (["merge", "roundabout", "rotary"].includes(type) || legacyIcon.includes("merge") || legacyIcon.includes("rotate")) {
    return "maneuverMerge";
  }
  if (modifier === "uturn" || legacyIcon.includes("rotate-left")) return "maneuverUTurn";
  if (modifier === "slight left" || legacyIcon.includes("up-left")) return "maneuverSlightLeft";
  if (modifier === "slight right" || legacyIcon.includes("up-right")) return "maneuverSlightRight";
  if (modifier.includes("left") || legacyIcon.includes("left")) return "maneuverLeft";
  if (modifier.includes("right") || legacyIcon.includes("right")) return "maneuverRight";
  return "maneuverStraight";
}

export default function ActiveRideOverlay({ ride, onClose, onEnd, onLeave }) {
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
  const [confirmLeave,    setConfirmLeave]     = useState(false);
  const [leaving,         setLeaving]          = useState(false);
  const [showDirections,  setShowDirections]   = useState(false);
  const [miniPosition,    setMiniPosition]     = useState(null);

  const [participants, setParticipants] = useState([]);
  const [participantLocations, setParticipantLocations] = useState({});

  const { user } = useAuth();
  const { tc } = useTheme(user?.id);

  const stopGpsRef = useRef(null);
  const miniDragRef = useRef({ pointerId: null, offsetX: 0, offsetY: 0, moved: false });

  // ── Determine if ride is active (live navigation) or view-only ──
  // Completed/cancelled rides open in view-only mode — no End Ride button,
  // no GPS tracking started (to avoid unnecessary battery drain).
  const isActiveRide = ride?.status === "active";

  // ====================================================================
  // ROLE DETECTION (group rides)
  // Admin = ride creator (ride.userId) OR a participant with role "admin".
  //   • Admin               → sees "End Ride" only
  //   • Non-admin member    → sees "Leave Ride" only
  //   • Solo rides          → unchanged (creator always sees "End Ride")
  // ====================================================================
  const isGroupRide = ride?.rideType === "group";
  const isAdmin = !isGroupRide
    ? true // solo rides preserve existing End Ride behavior
    : String(ride?.userId) === String(user?.id) ||
      participants.some(
        p => String(p.userId) === String(user?.id) && p.role === "admin"
      );
  const showEndRide   = isActiveRide && (!isGroupRide || isAdmin);
  const showLeaveRide = isActiveRide && !isAdmin && isGroupRide;

  // ====================================================================
  // LIVE DISTANCE TRAVELLED
  // Accurately accumulates how far the rider has ACTUALLY ridden:
  //   • route-accurate mode when the ride has a stored OSRM polyline
  //     (snap-to-route), straight-line haversine otherwise
  //   • GPS noise/jump filtering lives in services/rideTracking.js
  //   • paused while the overlay is minimized or the tab is backgrounded,
  //     re-anchoring on resume so skipped stretches are never counted
  //   • resets automatically when a different ride starts
  // ====================================================================
  const { distanceTraveled, usingRoute } = useRideDistance(myLocation, {
    routeCoordinates: ride?.routeCoordinates,
    rideId: ride?.id,
    paused: minimized || !isActiveRide,
  });

  // ====================================================================
  // PARTICIPANTS — initial fetch + live refresh
  // GET /api/rides/{id}/participants returns ACTIVE riders only, so
  // re-fetching automatically drops riders who left (their markers
  // disappear) and picks up riders the admin adds mid-ride.
  // Demo-dragged marker positions live in `participantLocations` (keyed
  // by userId) and are merged in at render time, so they survive polls.
  // ====================================================================
  const refreshParticipants = useCallback(() => {
    if (ride?.rideType === "group" && ride?.id) {
      getGroupRideParticipants(ride.id)
        .then(list => setParticipants(list || []))
        .catch(() => {});
    } else {
      setParticipants([]);
    }
  }, [ride?.id, ride?.rideType]);

  useEffect(() => {
    refreshParticipants();
  }, [refreshParticipants]);

  // Poll every 10s while the overlay shows a LIVE group ride so
  // added/left riders update without a manual refresh
  useEffect(() => {
    if (!isActiveRide || ride?.rideType !== "group" || !ride?.id) return;
    const interval = setInterval(refreshParticipants, 10000);
    return () => clearInterval(interval);
  }, [isActiveRide, ride?.id, ride?.rideType, refreshParticipants]);

  useEffect(() => {
    const handler = (e) => {
      const { userId, lat, lng } = e.detail;
      setParticipantLocations(prev => ({
        ...prev,
        [userId]: { lat, lng },
      }));
    };
    window.addEventListener("simulate-group-gps", handler);
    return () => window.removeEventListener("simulate-group-gps", handler);
  }, []);

  // Parse steps whenever ride changes
  useEffect(() => {
    setSteps(parseSteps(ride));
  }, [ride]);

  // ── Current step derived values ──
  const currentStep    = steps[activeStep];

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
          updateUserLocation(ride.id, loc.lat, loc.lng, user?.id).catch(err => {
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
    // Hand the real travelled distance to Home → PATCH /api/rides/{id}/status
    await onEnd({ distanceTraveled });
    setEnding(false);
  };

  const cancelEnd = () => setConfirmEnd(false);

  // ====================================================================
  // LEAVE RIDE handler (two-click confirm) — non-admin group members only
  // Stops GPS, marks this user as "left" on the backend, closes the
  // overlay and asks Home to refresh (ride itself stays active for
  // everyone else).
  // ====================================================================
  const handleLeaveRide = async () => {
    if (!confirmLeave) { setConfirmLeave(true); return; }
    setLeaving(true);
    setConfirmLeave(false);
    // Stop GPS tracking — leaving riders no longer share their location
    stopGpsRef.current?.();
    stopGpsRef.current = null;
    try {
      // PATCH /api/rides/{id}/participants/{userId}/status { status: "left", actorUserId }
      await updateParticipantStatus(ride.id, user?.id, "left", user?.id);
    } catch (err) {
      console.warn("[ActiveRideOverlay] leave ride failed:", err.message);
    }
    setLeaving(false);
    // Close overlay + refresh Home (falls back to onClose if no onLeave given)
    if (onLeave) onLeave();
    else onClose?.();
  };

  const cancelLeave = () => setConfirmLeave(false);

  // ── Derive current step distance (to next maneuver) ──
  const stepDist = currentStep?.distance || 0;

  // ── Minimized-map bubble: tap to restore, drag to reposition ──
  const handleMiniPointerDown = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    miniDragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleMiniPointerMove = (event) => {
    const drag = miniDragRef.current;
    if (drag.pointerId !== event.pointerId) return;

    // Bubble is 104 × 46 px (see the style below) — keep it inside the viewport
    const bubbleWidth  = 104;
    const bubbleHeight = 46;
    const left = Math.min(Math.max(10, event.clientX - drag.offsetX), window.innerWidth  - bubbleWidth  - 10);
    const top  = Math.min(Math.max(10, event.clientY - drag.offsetY), window.innerHeight - bubbleHeight - 10);
    drag.moved = true;
    setMiniPosition({ left, top });
  };

  const handleMiniPointerUp = (event) => {
    const drag = miniDragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    miniDragRef.current.pointerId = null;
    if (!drag.moved) setMinimized(false);
  };

  // ====================================================================
  // MINIMIZED state — compact draggable map bubble
  // ====================================================================
  if (minimized) {
    return (
      <>
        <style>{`
          @keyframes miniMapPulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50%       { opacity: 0.55; transform: scale(1.4); }
          }
          @keyframes miniMapGlow {
            0%, 100% { box-shadow: 0 0 0 0px rgba(59,130,246,0.55), 0 8px 28px rgba(0,0,0,0.55); }
            50%       { box-shadow: 0 0 0 7px rgba(59,130,246,0.0),  0 8px 28px rgba(0,0,0,0.55); }
          }
          .mini-map-btn:hover {
            transform: scale(1.06) !important;
            filter: brightness(1.12);
          }
          .mini-map-btn:active {
            transform: scale(0.97) !important;
          }
        `}</style>

        <div
          className="mini-map-btn"
          style={{
            position:        "fixed",
            ...(miniPosition
              ? { left: `${miniPosition.left}px`, top: `${miniPosition.top}px` }
              : { right: "20px", bottom: "22px" }),
            zIndex:          9999,
            display:         "flex",
            alignItems:      "center",
            justifyContent:  "center",
            gap:             "7px",
            width:           "104px",
            height:          "46px",
            background:      "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 60%, #1e3a8a 100%)",
            border:          "1.5px solid rgba(255,255,255,0.22)",
            borderRadius:    "999px",
            boxShadow:       "0 0 0 0px rgba(59,130,246,0.55), 0 8px 28px rgba(0,0,0,0.55)",
            animation:       "miniMapGlow 2.6s ease-in-out infinite",
            cursor:          "grab",
            touchAction:     "none",
            userSelect:      "none",
            transition:      "transform 0.18s ease, filter 0.18s ease",
            /* glass sheen */
            backdropFilter:  "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            overflow:        "hidden",
          }}
          title="Drag to move · tap to reopen the map"
          onPointerDown={handleMiniPointerDown}
          onPointerMove={handleMiniPointerMove}
          onPointerUp={handleMiniPointerUp}
          onPointerCancel={handleMiniPointerUp}
        >
          {/* Top-left sheen highlight */}
          <div style={{
            position:     "absolute",
            top: 0, left: 0,
            width:        "60%",
            height:       "50%",
            background:   "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 100%)",
            borderRadius: "999px 999px 60% 0",
            pointerEvents:"none",
          }} />

          {/* Live status dot */}
          <span style={{
            position:     "absolute",
            top:          "8px",
            right:        "9px",
            width:        "8px",
            height:       "8px",
            borderRadius: "50%",
            background:   isActiveRide ? "#4ade80" : "#6b7280",
            boxShadow:    isActiveRide ? "0 0 6px #4ade80" : "none",
            animation:    isActiveRide ? "miniMapPulse 2s ease-in-out infinite" : "none",
            border:       "1.5px solid rgba(255,255,255,0.6)",
          }} />

          {/* Map icon */}
          <i
            className="fa fa-map"
            style={{
              color:        "rgba(255,255,255,0.95)",
              fontSize:     "16px",
              pointerEvents:"none",
              filter:       "drop-shadow(0 1px 3px rgba(0,0,0,0.4))",
            }}
          />

          {/* Label + live ridden distance */}
          <span style={{
            display:       "flex",
            flexDirection: "column",
            alignItems:    "flex-start",
            lineHeight:    1.15,
            pointerEvents: "none",
            textShadow:    "0 1px 4px rgba(0,0,0,0.35)",
          }}>
            {distanceTraveled > 0 ? (
              <>
                <span style={{ color: "#bbf7d0", fontWeight: 900, fontSize: "13px", letterSpacing: "0.2px" }}>
                  {formatDistance(distanceTraveled)}
                </span>
                <span style={{ color: "rgba(255,255,255,0.75)", fontWeight: 600, fontSize: "8.5px", letterSpacing: "0.6px" }}>
                  RIDDEN
                </span>
              </>
            ) : (
              <span style={{ color: "rgba(255,255,255,0.95)", fontWeight: 700, fontSize: "13.5px", letterSpacing: "0.5px" }}>
                Map
              </span>
            )}
          </span>
        </div>
      </>
    );
  }

  // ====================================================================
  // FULL-SCREEN overlay
  // ====================================================================
  return (
    <div style={{
      position:      "fixed",
      inset:         0,
      zIndex:        999,
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
        zIndex:         9999,
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
            background:     "rgba(15,15,26,0.42)",
            backdropFilter: "blur(26px)",
            border:         "1px solid rgba(255,255,255,0.08)",
            borderRadius:   "16px",
            padding:        "12px 16px",
            marginBottom:   "px",
            boxShadow:      "0 4px 24px rgba(0,0,0,0.5)",
            pointerEvents:  "auto",
          }}>

            {/* Maneuver icon circle */}
            <div style={{
              width:          "38px",
              height:         "38px",
              borderRadius:   "120px",
              background:     "linear-gradient(135deg, rgba(66,133,244,0.3), rgba(66,133,244,0.15))",
              border:         "1.5px solid rgba(66,133,244,0.4)",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              flexShrink:     0,
            }}>
              <Icon name={getStepIconName(currentStep)} size={21} />
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
            <div style={{ display: "flex", flexDirection: "row", gap: "6px", pointerEvents: "auto" }}>
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
                <Icon name="list" size={18} />
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
                <Icon name="minimize" size={18} />
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
                <Icon name="close" size={18} />
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
                <button onClick={() => setShowDirections(v => !v)} style={topBtnStyle} title="Show all directions">
                  <Icon name="list" size={18} />
                </button>
              )}
              <button onClick={() => setMinimized(true)} style={topBtnStyle} title="Minimize">
                <Icon name="minimize" size={18} />
              </button>
              <button onClick={onClose} style={topBtnStyle} title="Close map">
                <Icon name="close" size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================
          MAP CANVAS
          ============================================================ */}
      <div style={{ flex: 1, position: "relative", height: 0, overflow: "hidden" }}>
        {(() => {
          const participantsWithLocations = participants.map((p, i) => ({
            ...p,
            lat: participantLocations[p.userId]?.lat || (ride?.fromLat ? ride.fromLat + (i + 1) * 0.003 : null),
            lng: participantLocations[p.userId]?.lng || (ride?.fromLng ? ride.fromLng + (i + 1) * 0.003 : null),
            color: RIDER_COLORS[i % RIDER_COLORS.length],
          }));

          return (
            <>
              <RideMap
                ride={ride}
                myLocation={myLocation}
                isLive={isActiveRide}
                participants={ride?.rideType === "group" ? participantsWithLocations : []}
                currentUserId={user?.id}
              />

              {ride?.rideType === "group" && participantsWithLocations.length > 0 && (
                <GroupRidersPanel
                  participants={participantsWithLocations}
                  currentUserId={user?.id}
                  isAdmin={isAdmin}
                  rideId={isActiveRide ? ride?.id : null}
                  onParticipantsChanged={refreshParticipants}
                  tc={tc}
                  onRiderClick={(p) => {
                    if (p.lat && p.lng) {
                      window.dispatchEvent(new CustomEvent("rw-recenter", {
                        detail: { lat: p.lat, lng: p.lng }
                      }));
                    }
                  }}
                />
              )}
            </>
          );
        })()}

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
        {isActiveRide && myLocation?.speed != null && myLocation.speed >= 0 && (
          <div style={{
            position:       "absolute",
            bottom:         "200px",
            right:           "16px",
            zIndex:         9999,
            background:     "rgba(15,15,26,0.9)",
            backdropFilter: "blur(12px)",
            border:         "1px solid rgba(255,255,255,0.1)",
            borderRadius:   "14px",
            padding:        "8px 10px",
            textAlign:      "center",
            minWidth:       "30px",
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
          <div
            className={tc.mapControl}
            style={{
              position:       "absolute",
              bottom:         "120px",
              right:          "16px",
              zIndex:         9999,
              borderRadius:   "140px",
            padding:        "10px 14px",
            textAlign:      "center",
            minWidth:       "60px",
          }}>
            <p
              className={tc.accent}
              style={{ fontWeight: 900, fontSize: "16px", margin: 0, lineHeight: 1 }}
            >
              {activeStep + 1}/{steps.length}
            </p>
            <p
              className={tc.sub}
              style={{ fontSize: "9px", margin: "3px 0 0", textTransform: "uppercase", letterSpacing: "1px" }}
            >
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
        zIndex:     999,
        background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.8) 60%, transparent 100%)",
        padding:    "10px 6px 4px",
      }}>

        {/* ── Stats row ── */}
        <div style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          gap:            "14px",
          marginBottom:   "10px",
        }}>
          {/* Ridden so far — live, route-accurate when a route is stored */}
          <div style={{ flex: 1, textAlign: "center" }}>
            <p style={{ color: "#34d399", fontWeight: 900, fontSize: "19px", margin: 0 }}>
              {formatDistance(distanceTraveled)}
            </p>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "10px", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>
              Ridden
            </p>
          </div>

          <div style={{ width: "1px", height: "32px", background: "rgba(255,255,255,0.12)" }} />

          {/* Remaining Distance */}
          <div style={{ flex: 1, textAlign: "center" }}>
            <p style={{ color: "#4285F4", fontWeight: 900, fontSize: "19px", margin: 0 }}>
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
          <div style={{ flex: 1, textAlign: "center" }}>
            <p style={{ color: "white", fontWeight: 900, fontSize: "19px", margin: 0 }}>
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
          <div style={{ flex: 1, textAlign: "center" }}>
            <p style={{ color: "white", fontWeight: 900, fontSize: "22px", margin: 0 }}>
              {ride.rideType === "solo" ? "🏍️" : `👥 ${participants.length}`}
            </p>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "10px", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>
              {ride.rideType === "solo" ? "solo" : "riders"}
            </p>
          </div>
        </div>

        {/* ── Total route meta line ── */}
        <p style={{
          textAlign:     "center",
          margin:        "0 0 8px",
          fontSize:      "10.5px",
          color:         "rgba(255,255,255,0.5)",
          letterSpacing: "0.3px",
        }}>
          Total route {formatDistance(ride.distanceMeters)} · {formatDuration(ride.durationSeconds)}
          {usingRoute && <span style={{ color: "#34d399" }}> · route-accurate</span>}
        </p>

        {/* ── Action button — only for ACTIVE rides ── */}
        {/* Admin/solo: End Ride · Non-admin group member: Leave Ride */}
        {/* BUG FIX: completed/cancelled rides show a "Close" button instead */}
        {isActiveRide ? (
          showLeaveRide ? (
            // ── LEAVE RIDE (non-admin group member, two-click confirm) ──
            confirmLeave ? (
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={cancelLeave}
                  style={{
                    flex: 1, padding: "14px",
                    background:   "rgba(255,255,255,0.1)",
                    border:       "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "14px",
                    color:        "white",
                    fontWeight:   700,
                    fontSize:     "14px",
                    cursor:       "pointer",
                  }}
                >
                  <i className="fa fa-arrow-left" style={{ marginRight: "8px" }} />
                  Stay
                </button>
                <button
                  onClick={handleLeaveRide}
                  disabled={leaving}
                  style={{
                    flex: 1, padding: "14px",
                    background:   "linear-gradient(135deg, #f97316, #ea580c)",
                    border:       "none",
                    borderRadius: "14px",
                    color:        "white",
                    fontWeight:   900,
                    fontSize:     "14px",
                    cursor:       leaving ? "not-allowed" : "pointer",
                    opacity:      leaving ? 0.7 : 1,
                    boxShadow:    "0 4px 20px rgba(249,115,22,0.4)",
                  }}
                >
                  {leaving
                    ? <><i className="fa fa-spinner fa-spin" style={{ marginRight: "8px" }} />Leaving...</>
                    : <><i className="fa fa-person-walking-arrow-right" style={{ marginRight: "8px" }} />Confirm Leave</>
                  }
                </button>
              </div>
            ) : (
              <button
                onClick={handleLeaveRide}
                style={{
                  width:          "100%",
                  padding:        "15px",
                  background:     "rgba(249,115,22,0.15)",
                  border:         "1.5px solid rgba(249,115,22,0.5)",
                  borderRadius:   "14px",
                  color:          "#fb923c",
                  fontWeight:     900,
                  fontSize:       "15px",
                  cursor:         "pointer",
                  backdropFilter: "blur(8px)",
                }}
              >
                <i className="fa fa-person-walking-arrow-right" style={{ marginRight: "8px" }} />
                Leave Ride
              </button>
            )
          ) : showEndRide ? (
          // ── END RIDE (admin / solo, two-click confirm) ──
          confirmEnd ? (
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={cancelEnd}
                style={{
                  flex: 1, padding: "14px",
                  background:   "rgba(255,255,255,0.1)",
                  border:       "1px solid rgba(255,255,255,0.1)",
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
          ) : null
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
          tc={tc}
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
  color:          "red",
  cursor:         "pointer",
  display:        "flex",
  alignItems:     "center",
  justifyContent: "center",
  fontSize:       "14px",
};
