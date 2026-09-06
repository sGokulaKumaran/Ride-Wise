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
import { formatDistance, formatDuration } from "../../../services/routingApi";

export default function DirectionsPanel({
  steps       = [],
  activeStep  = 0,
  onClose,
  totalDist   = 0,
  totalTime   = 0,
  destName    = "Destination",
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
      zIndex:         9500,
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
      <div style={{
        position:       "relative",
        zIndex:         1,
        background:     "linear-gradient(180deg, #0f0f1a 0%, #0a0a14 100%)",
        borderRadius:   "24px 24px 0 0",
        maxHeight:      "72vh",
        display:        "flex",
        flexDirection:  "column",
        border:         "1px solid rgba(255,255,255,0.08)",
        borderBottom:   "none",
        boxShadow:      "0 -24px 80px rgba(0,0,0,0.7)",
        animation:      "dpSlideUp 0.32s cubic-bezier(0.32,0,0.67,0) both",
      }}>

        {/* ── Drawer header ── */}
        <div style={{
          padding:        "16px 20px 12px",
          borderBottom:   "1px solid rgba(255,255,255,0.07)",
          display:        "flex",
          alignItems:     "center",
          gap:            "12px",
          flexShrink:     0,
        }}>
          {/* Drag handle */}
          <div style={{
            position:   "absolute",
            top:        "10px",
            left:       "50%",
            transform:  "translateX(-50%)",
            width:      "40px",
            height:     "4px",
            borderRadius:"2px",
            background: "rgba(255,255,255,0.18)",
          }} />

          {/* Destination icon */}
          <div style={{
            width:          "44px",
            height:         "44px",
            borderRadius:   "14px",
            background:     "linear-gradient(135deg, rgba(249,115,22,0.25), rgba(236,72,153,0.15))",
            border:         "1px solid rgba(249,115,22,0.3)",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            flexShrink:     0,
          }}>
            <i className="fa fa-route" style={{ color: "#f97316", fontSize: "18px" }} />
          </div>

          {/* Title + summary */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              color:     "white",
              fontWeight: 800,
              fontSize:  "15px",
              margin:    0,
              overflow:  "hidden",
              textOverflow:"ellipsis",
              whiteSpace: "nowrap",
            }}>
              {destName}
            </p>
            <p style={{
              color:    "rgba(255,255,255,0.45)",
              fontSize: "12px",
              margin:   "2px 0 0",
            }}>
              {formatDistance(totalDist)} · {formatDuration(totalTime)} · {steps.length} steps
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              width:          "36px",
              height:         "36px",
              borderRadius:   "50%",
              background:     "rgba(255,255,255,0.08)",
              border:         "1px solid rgba(255,255,255,0.12)",
              color:          "rgba(255,255,255,0.7)",
              cursor:         "pointer",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              flexShrink:     0,
              fontSize:       "13px",
            }}
          >
            <i className="fa fa-times" />
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
                <div style={{
                  width:          "36px",
                  height:         "36px",
                  borderRadius:   "50%",
                  flexShrink:     0,
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  background: isActive
                    ? "linear-gradient(135deg, rgba(249,115,22,0.3), rgba(236,72,153,0.2))"
                    : isPast
                    ? "rgba(255,255,255,0.04)"
                    : "rgba(255,255,255,0.07)",
                  border: isActive
                    ? "1.5px solid rgba(249,115,22,0.5)"
                    : "1.5px solid rgba(255,255,255,0.08)",
                  transition: "background 0.3s, border 0.3s",
                }}>
                  <i
                    className={`fa ${step.icon}`}
                    style={{
                      color:    isActive ? "#f97316" : "rgba(255,255,255,0.5)",
                      fontSize: "14px",
                    }}
                  />
                </div>

                {/* Text content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Instruction */}
                  <p style={{
                    color:      isActive ? "white" : "rgba(255,255,255,0.7)",
                    fontWeight: isActive ? 700 : 500,
                    fontSize:   "13px",
                    margin:     0,
                    lineHeight: "1.4",
                  }}>
                    {step.instruction}
                  </p>

                  {/* Distance for this step */}
                  {step.distance > 0 && (
                    <p style={{
                      color:     isActive ? "#f97316" : "rgba(255,255,255,0.3)",
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
                  <div style={{
                    fontSize:   "10px",
                    color:      "rgba(255,255,255,0.2)",
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
