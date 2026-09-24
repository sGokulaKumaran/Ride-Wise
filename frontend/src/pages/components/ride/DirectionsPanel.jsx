// ============================================================
// 📍 DirectionsPanel.jsx — Turn-by-turn directions drawer
//
// A Google Maps-style slide-up panel that shows the full
// list of route steps. The current/nearest step is highlighted
// and automatically scrolled into view as the user moves.
//
// PROPS:
//   steps        — array of step objects from parseRouteSteps()
//   activeStep   — index of the currently nearest step (0-based)
//   onClose      — called when the X button is pressed
//   totalDist    — total route distance (metres)
//   totalTime    — total route duration (seconds)
//   destName     — short destination name string
// ============================================================

import { useEffect, useRef } from "react";
import Icon from "../ui/Icon";
import { formatDistance, formatDuration } from "../../../services/routingApi";

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

export default function DirectionsPanel({
  steps       = [],
  activeStep  = 0,
  onClose,
  totalDist   = 0,
  totalTime   = 0,
  destName    = "Destination",
  tc,
}) {
  const activeRef = useRef(null); // ref to the active step row

  // Auto-scroll the active step into view whenever it changes
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block:    "nearest",
      });
    }
  }, [activeStep]);

  return (
    <div style={{
      position:       "fixed",
      inset:          0,
      zIndex:         9999,
      display:        "flex",
      flexDirection:  "column",
      justifyContent: "flex-end",
      // Backdrop: dark semi-transparent overlay behind the drawer
      background:     "rgba(0,0,0,0.55)",
      backdropFilter: "blur(2px)",
      animation:      "dpFadeIn 0.25s ease-out both",
    }}>

      {/* ── Tap outside to close ── */}
      <div
        style={{ position: "absolute", inset: 0 }}
        onClick={onClose}
        aria-label="Close directions"
      />

      {/* ── Drawer ── */}
      <div
        className={`${tc.card} ${tc.text}`}
        style={{
          position:       "relative",
          zIndex:         1999,
          borderRadius:   "24px 24px 0 0",
          maxHeight:      "72vh",
          display:        "flex",
          flexDirection:  "column",
          border:         "1px solid currentColor",
          borderBottom:   "none",
          boxShadow:      "0 -24px 80px rgba(0,0,0,0.35)",
        animation:      "dpSlideUp 0.32s cubic-bezier(0.32,0,0.67,0) both",
      }}>

        {/* ── Drawer header ── */}
        <div
          className={tc.divider}
          style={{
           padding:        "16px 20px 12px",
          borderBottomWidth: "1px",
          display:        "flex",
          alignItems:     "center",
          gap:            "12px",
          flexShrink:     0,
        }}>
          {/* Drag handle */}
          <div className={`${tc.sub} opacity-50`} style={{
            position:   "absolute",
            top:        "10px",
            left:       "50%",
            transform:  "translateX(-50%)",
            width:      "40px",
            height:     "4px",
            borderRadius:"2px",
          }} />

          {/* Destination icon */}
          <div
            className={tc.accentSoft}
            style={{
             width:          "44px",
             height:         "44px",
             borderRadius:   "14px",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            flexShrink:     0,
          }}>
            <Icon name="route" size={19} />
          </div>

          {/* Title + summary */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontWeight: 800,
              fontSize:  "15px",
              margin:    0,
              overflow:  "hidden",
              textOverflow:"ellipsis",
              whiteSpace: "nowrap",
            }}>
              {destName}
            </p>
            <p className={tc.sub} style={{
              fontSize: "12px",
              margin:   "2px 0 0",
            }}>
              {formatDistance(totalDist)} · {formatDuration(totalTime)} · {steps.length} steps
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className={tc.btnGhost}
            style={{
              width:          "36px",
              height:         "36px",
              borderRadius:   "50%",
              cursor:         "pointer",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              flexShrink:     0,
              fontSize:       "13px",
            }}
          >
            <Icon name="close" size={17} />
          </button>
        </div>

        {/* ── Step list (scrollable) ── */}
        <div style={{
          overflowY:  "auto",
          flex:       1,
          padding:    "8px 0 24px",
        }}>
          {steps.map((step, i) => {
            const isActive  = i === activeStep;
            const isLast    = i === steps.length - 1;
            const isPast    = i < activeStep;

            return (
                <div
                  key={i}
                  ref={isActive ? activeRef : null}
                  className={isActive ? tc.accentSoft : ""}
                  style={{
                   display:        "flex",
                  alignItems:     "flex-start",
                  gap:            "14px",
                  padding:        "12px 20px",
                  background:     isActive
                    ? "linear-gradient(90deg, rgba(249,115,22,0.12), rgba(236,72,153,0.05))"
                    : "transparent",
                  borderLeft:     isActive
                    ? "3px solid #f97316"
                    : "3px solid transparent",
                  transition:     "background 0.3s, border-color 0.3s",
                  opacity:        isPast ? 0.4 : 1,
                }}
              >
                {/* Icon circle */}
                <div
                  className={isActive ? tc.accentSoft : tc.surface2}
                  style={{
                  width:          "36px",
                  height:         "36px",
                  borderRadius:   "50%",
                  flexShrink:     0,
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  border: isActive
                    ? "1.5px solid #f97316"
                    : "1.5px solid transparent",
                  transition: "background 0.3s, border 0.3s",
                }}>
                  <Icon
                    name={getStepIconName(step)}
                    size={17}
                    className={isActive ? tc.accent : tc.sub}
                  />
                </div>

                {/* Text content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Instruction */}
                  <p className={isActive ? "" : tc.sub} style={{
                    fontWeight: isActive ? 700 : 500,
                    fontSize:   "13px",
                    margin:     0,
                    lineHeight: "1.4",
                  }}>
                    {step.instruction}
                  </p>

                  {/* Distance for this step */}
                  {step.distance > 0 && (
                    <p className={isActive ? tc.accent : tc.sub} style={{
                      fontSize:  "11px",
                      margin:    "4px 0 0",
                      fontWeight: isActive ? 700 : 400,
                    }}>
                      {formatDistance(step.distance)}
                    </p>
                  )}
                </div>

                {/* Step number badge (right side) */}
                {!isLast && (
                  <div className={tc.sub} style={{
                    fontSize:   "10px",
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop:  "2px",
                  }}>
                    {i + 1}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes dpFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes dpSlideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0);    }
        }
      `}</style>
    </div>
  );
}
