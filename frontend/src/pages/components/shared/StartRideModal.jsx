// ============================================================
// 🏁 StartRideModal.jsx — Slide-up modal for starting/managing rides
//
// SCREENS (internal state machine):
//   "home"    → two big cards: "New Ride" + "Ride History"
//   "type"    → Solo card (active) + Group card (disabled/future)
//   "setup"   → RideSetupFlow (3-step wizard)
//
// This modal does NOT handle the active map.
// When a ride is created here, it calls onRideCreated(ride)
// so Home.jsx can mount the full-screen ActiveRideOverlay.
//
// PROPS:
//   open            — boolean, controls visibility
//   onClose         — called when modal is dismissed
//   tc              — theme classes from useTheme()
//   onRideCreated   — callback(ride) when user starts a new ride
//   onOpenHistory   — callback() to open history panel
// ============================================================

import { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import RideSetupFlow from "../ride/RideSetupFlow";

// Internal screen names
const SCREEN = {
  HOME:  "home",
  TYPE:  "type",
  SETUP: "setup",
};

export default function StartRideModal({ open, onClose, tc, onRideCreated, onOpenHistory }) {
  const { user } = useAuth();

  // Which screen is currently shown inside the modal
  const [screen,   setScreen]   = useState(SCREEN.HOME);
  const [rideType, setRideType] = useState("solo");

  // Reset to home screen whenever the modal is opened fresh
  useEffect(() => {
    if (open) setScreen(SCREEN.HOME);
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Handler: ride successfully created in the setup wizard
  const handleRideCreated = (ride) => {
    onClose();                 // close this modal
    onRideCreated(ride);       // tell Home to open the full-screen map
  };

  // Handler: user clicked "Ride History" — open history panel
  const handleHistory = () => {
    onClose();         // close this modal
    onOpenHistory();   // Home.jsx will open the history panel
  };

  if (!open) return null;

  // ---- Header labels per screen ----
  const headerLabel = {
    [SCREEN.HOME]:  { icon: "fa-motorcycle",      title: "RideWise"          },
    [SCREEN.TYPE]:  { icon: "fa-route",            title: "Choose Ride Type"  },
    [SCREEN.SETUP]: { icon: "fa-map-location-dot", title: rideType === "solo" ? "Solo Ride Setup" : "Group Ride Setup" },
  }[screen];

  return (
    <>
      {/* ── BACKDROP ──────────────────────────────────────────── */}
      <div
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        style={{
          position:       "fixed",
          inset:          0,
          background:     "rgba(0,0,0,0.75)",
          backdropFilter: "blur(8px)",
          zIndex:         8000,
          display:        "flex",
          alignItems:     "flex-end",           // slide up from bottom (mobile-native feel)
          justifyContent: "center",
          padding:        "0 0 0 0",
        }}
      >
        {/* ── MODAL PANEL ───────────────────────────────────────── */}
        <div
          style={{
            width:         "100%",
            maxWidth:      "480px",
            maxHeight:     "90vh",
            background:    "linear-gradient(135deg, rgba(10,10,15,0.98), rgba(15,15,25,0.98))",
            backdropFilter:"blur(24px)",
            borderRadius:  "28px 28px 0 0",   // rounded top corners only (slides from bottom)
            border:        "1px solid rgba(255,255,255,0.08)",
            borderBottom:  "none",
            overflow:      "hidden",
            display:       "flex",
            flexDirection: "column",
            boxShadow:     "0 -20px 80px rgba(0,0,0,0.7)",
            animation:     "slideUp 0.3s cubic-bezier(0.32,0.72,0,1)",
          }}
        >
          {/* ── DRAG HANDLE ─────────────────────────────────────── */}
          {/* Visual hint that this is a bottom sheet */}
          <div style={{
            width: "40px", height: "4px", borderRadius: "2px",
            background: "rgba(255,255,255,0.15)",
            margin: "12px auto 0",
            flexShrink: 0,
          }} />

          {/* ── HEADER ──────────────────────────────────────────── */}
          <div style={{
            display:       "flex",
            alignItems:    "center",
            justifyContent:"space-between",
            padding:       "16px 20px",
            borderBottom:  "1px solid rgba(255,255,255,0.06)",
            flexShrink:    0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {/* Back chevron when on type or setup screens */}
              {screen !== SCREEN.HOME && (
                <button
                  onClick={() => setScreen(screen === SCREEN.SETUP ? SCREEN.TYPE : SCREEN.HOME)}
                  style={{
                    width: "32px", height: "32px", borderRadius: "50%",
                    background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.8)", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <i className="fa fa-arrow-left" style={{ fontSize: "12px" }} />
                </button>
              )}
              {/* Icon bubble */}
              <div style={{
                width: "38px", height: "38px", borderRadius: "12px",
                background: "linear-gradient(135deg, #f97316, #ec4899)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 16px rgba(249,115,22,0.35)",
              }}>
                <i className={`fa ${headerLabel.icon}`} style={{ color: "white", fontSize: "15px" }} />
              </div>
              <span style={{ fontWeight: 900, fontSize: "16px" }}>{headerLabel.title}</span>
            </div>
            {/* X close button */}
            <button
              onClick={onClose}
              style={{
                width: "32px", height: "32px", borderRadius: "50%",
                background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.6)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <i className="fa fa-times" style={{ fontSize: "13px" }} />
            </button>
          </div>

          {/* ── SCROLLABLE CONTENT ────────────────────────────────── */}
          <div style={{ overflowY: "auto", flex: 1, padding: "20px" }}>

            {/* ================================================
                HOME screen — New Ride + History cards
            ================================================ */}
            {screen === SCREEN.HOME && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

                {/* NEW RIDE card */}
                <button
                  onClick={() => setScreen(SCREEN.TYPE)}
                  style={{
                    padding:        "20px",
                    background:     "linear-gradient(135deg, rgba(249,115,22,0.12), rgba(236,72,153,0.08))",
                    border:         "1.5px solid rgba(249,115,22,0.25)",
                    borderRadius:   "20px",
                    display:        "flex",
                    alignItems:     "center",
                    gap:            "16px",
                    cursor:         "pointer",
                    color:          "inherit",
                    textAlign:      "left",
                    width:          "100%",
                    transition:     "transform 0.2s, border-color 0.2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.01)"; e.currentTarget.style.borderColor = "rgba(249,115,22,0.5)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)";    e.currentTarget.style.borderColor = "rgba(249,115,22,0.25)"; }}
                >
                  <div style={{
                    width: "52px", height: "52px", borderRadius: "16px", flexShrink: 0,
                    background: "linear-gradient(135deg, #f97316, #ec4899)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 8px 24px rgba(249,115,22,0.35)",
                  }}>
                    <i className="fa fa-motorcycle" style={{ color: "white", fontSize: "22px" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 900, fontSize: "16px", margin: "0 0 4px" }}>Start a New Ride</p>
                    <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0 }}>
                      Plan your route with geocoding + live map
                    </p>
                  </div>
                  <i className="fa fa-arrow-right" style={{ color: "#f97316", fontSize: "16px" }} />
                </button>

                {/* RIDE HISTORY card */}
                <button
                  onClick={handleHistory}
                  style={{
                    padding:        "20px",
                    background:     "rgba(255,255,255,0.03)",
                    border:         "1px solid rgba(255,255,255,0.08)",
                    borderRadius:   "20px",
                    display:        "flex",
                    alignItems:     "center",
                    gap:            "16px",
                    cursor:         "pointer",
                    color:          "inherit",
                    textAlign:      "left",
                    width:          "100%",
                    transition:     "transform 0.2s, background 0.2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.01)"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)";    e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                >
                  <div style={{
                    width: "52px", height: "52px", borderRadius: "16px", flexShrink: 0,
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <i className="fa fa-clock-rotate-left" style={{ color: "rgba(255,255,255,0.6)", fontSize: "20px" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 900, fontSize: "16px", margin: "0 0 4px" }}>Ride History</p>
                    <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0 }}>
                      View, reopen or delete past rides
                    </p>
                  </div>
                  <i className="fa fa-arrow-right" style={{ color: "rgba(255,255,255,0.3)", fontSize: "16px" }} />
                </button>
              </div>
            )}

            {/* ================================================
                TYPE screen — Solo or Group
            ================================================ */}
            {screen === SCREEN.TYPE && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", margin: "0 0 4px" }}>
                  How are you riding today?
                </p>

                {/* SOLO — active */}
                <button
                  onClick={() => { setRideType("solo"); setScreen(SCREEN.SETUP); }}
                  style={{
                    padding:      "20px",
                    background:   "linear-gradient(135deg, rgba(249,115,22,0.1), rgba(234,179,8,0.08))",
                    border:       "1.5px solid rgba(249,115,22,0.3)",
                    borderRadius: "20px",
                    display:      "flex",
                    alignItems:   "center",
                    gap:          "16px",
                    cursor:       "pointer",
                    color:        "inherit",
                    textAlign:    "left",
                    width:        "100%",
                    transition:   "transform 0.2s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = "scale(1.01)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                >
                  <div style={{
                    width: "52px", height: "52px", borderRadius: "16px", flexShrink: 0,
                    background: "linear-gradient(135deg, #f97316, #ca8a04)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "24px",
                  }}>
                    🏍️
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 900, fontSize: "16px", color: "#fb923c", margin: "0 0 4px" }}>Solo Ride</p>
                    <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0 }}>
                      Just you. Plan your route and hit the road.
                    </p>
                  </div>
                  <i className="fa fa-arrow-right" style={{ color: "#f97316" }} />
                </button>

                {/* GROUP — disabled (future feature) */}
                <div style={{
                  padding:      "20px",
                  background:   "rgba(255,255,255,0.02)",
                  border:       "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "20px",
                  display:      "flex",
                  alignItems:   "center",
                  gap:          "16px",
                  opacity:      0.4,           // visually dimmed
                  cursor:       "not-allowed", // shows the "no" cursor on hover
                  pointerEvents: "none",       // disables all mouse interaction
                }}>
                  <div style={{
                    width: "52px", height: "52px", borderRadius: "16px", flexShrink: 0,
                    background: "rgba(255,255,255,0.06)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "24px",
                  }}>
                    👥
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <p style={{ fontWeight: 900, fontSize: "16px", margin: 0 }}>Group Ride</p>
                      {/* "Coming Soon" badge */}
                      <span style={{
                        padding: "2px 8px", borderRadius: "50px",
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        fontSize: "9px", fontWeight: 700, textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}>
                        Coming Soon
                      </span>
                    </div>
                    <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0 }}>
                      Ride with friends. Live map for all members.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ================================================
                SETUP screen — 3-step wizard
            ================================================ */}
            {screen === SCREEN.SETUP && (
              <RideSetupFlow
                rideType={rideType}
                userId={user?.id}
                onRideCreated={handleRideCreated}
                onCancel={() => setScreen(SCREEN.TYPE)}
                tc={tc}
              />
            )}

          </div>
        </div>
      </div>

      {/* Slide-up animation keyframe */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
