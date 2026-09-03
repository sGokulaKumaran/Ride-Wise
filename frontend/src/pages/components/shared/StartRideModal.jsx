// ============================================================
// 🏁 StartRideModal — Full ride planning + tracking modal
//
// STATE MACHINE:
//   "type"    → choose Solo or Group
//   "setup"   → RideSetup (geocode + route + map preview)
//   "active"  → RideMap + RideControls (live ride in progress)
//   "history" → list of past rides (RideHistoryCard)
//   "done"    → ride ended success screen
//
// CONNECTIONS:
//   - rideApi      (create, save, end rides)
//   - routingApi   (geocode + route)
//   - locationService (live GPS)
//   - RideMap, RideSetup, RideControls, RideHistoryCard
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../context/AuthContext";
import { getActiveRide, getUserRides, clearActiveRide } from "../../../services/rideApi";
import { useRideLocation } from "../../hooks/useRideLocation";
import RideSetup from "../ride/RideSetup";
import RideMap from "../ride/RideMap";
import RideControls from "../ride/RideControls";
import RideHistoryCard from "../ride/RideHistoryCard";

// ── Which screen is visible inside the modal ──
// "home" = default landing with "New Ride" + "History" buttons
// "type" = pick Solo / Group
// "setup" = RideSetup (enter from/to + calc route)
// "active" = live map with controls
// "history" = ride history list
// "done" = success after ending a ride
const SCREENS = {
  HOME:    "home",
  TYPE:    "type",
  SETUP:   "setup",
  ACTIVE:  "active",
  HISTORY: "history",
  DONE:    "done",
};

export default function StartRideModal({ open, onClose, tc }) {
  const { user } = useAuth();

  // ── Screen / flow state ──────────────────────────────────────
  const [screen,    setScreen]    = useState(SCREENS.HOME);
  const [rideType,  setRideType]  = useState("solo"); // "solo" | "group"
  const [activeRide, setActiveRide] = useState(null); // currently active ride object
  const [showMap,   setShowMap]   = useState(true);   // map visibility toggle
  const [history,   setHistory]   = useState([]);     // past rides

  // Live location (only runs when a ride is active)
  const { location: myLocation } = useRideLocation(!!activeRide);

  // ── Check for existing active ride on open ─────────────────
  useEffect(() => {
    if (!open || !user) return;
    getActiveRide().then((ride) => {
      if (ride) {
        setActiveRide(ride);
        setShowMap(true);
        setScreen(SCREENS.ACTIVE);
      } else {
        setScreen(SCREENS.HOME);
      }
    });
  }, [open, user]);

  // ── Reset when modal closes ──────────────────────────────────
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        if (!activeRide) setScreen(SCREENS.HOME);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open, activeRide]);

  // ── Close on Escape ──────────────────────────────────────────
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") handleClose(); };
    if (open) document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open]);

  // ── Close handler — safe close (doesn't end the active ride) ──
  const handleClose = useCallback(() => {
    // Don't reset activeRide so the banner can still show
    onClose();
  }, [onClose]);

  // ── Ride created by RideSetup ────────────────────────────────
  const handleRideCreated = (ride) => {
    setActiveRide(ride);
    setShowMap(true);
    setScreen(SCREENS.ACTIVE);
  };

  // ── Ride ended by RideControls ───────────────────────────────
  const handleRideEnded = (updatedRide) => {
    setActiveRide(null);
    clearActiveRide();
    setScreen(SCREENS.DONE);
    // refresh history
    if (user?.id) getUserRides(user.id).then(setHistory);
  };

  // ── Load history ─────────────────────────────────────────────
  const loadHistory = async () => {
    if (!user?.id) return;
    const rides = await getUserRides(user.id);
    setHistory(rides.reverse()); // newest first
    setScreen(SCREENS.HISTORY);
  };

  if (!open) return null;

  // ── Modal title per screen ───────────────────────────────────
  const titleMap = {
    [SCREENS.HOME]:    { icon: "fa-motorcycle",    title: "RideWise"          },
    [SCREENS.TYPE]:    { icon: "fa-route",          title: "Choose Ride Type"  },
    [SCREENS.SETUP]:   { icon: "fa-map-location-dot", title: `${rideType === "solo" ? "🏍️ Solo" : "👥 Group"} Ride Setup` },
    [SCREENS.ACTIVE]:  { icon: "fa-location-crosshairs", title: "Ride in Progress" },
    [SCREENS.HISTORY]: { icon: "fa-clock-rotate-left", title: "Ride History"   },
    [SCREENS.DONE]:    { icon: "fa-flag-checkered",  title: "Ride Complete!"   },
  };
  const { icon: headerIcon, title: headerTitle } = titleMap[screen] || titleMap[SCREENS.HOME];

  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────── */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      >
        {/* ── Modal panel ─────────────────────────────────────── */}
        <div
          className={`w-full max-w-md rounded-3xl border shadow-2xl shadow-black/70 overflow-hidden flex flex-col ${tc.card}`}
          style={{ maxHeight: "90vh" }}
        >

          {/* ── Header ──────────────────────────────────────── */}
          <div className={`flex items-center justify-between px-6 pt-5 pb-4 border-b ${tc.divider} shrink-0`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
                <i className={`fa ${headerIcon} text-white text-sm`} />
              </div>
              <h2 className="font-black text-base">{headerTitle}</h2>
            </div>
            <button
              onClick={handleClose}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 ${tc.record} ${tc.sub}`}
            >
              <i className="fa fa-times text-xs" />
            </button>
          </div>

          {/* ── Scrollable content area ─────────────────────── */}
          <div className="overflow-y-auto flex-1">

            {/* ═══════════════════════════════════════════════
                HOME SCREEN — choose action
            ═══════════════════════════════════════════════ */}
            {screen === SCREENS.HOME && (
              <div className="p-6 space-y-3">
                {/* Active ride resume banner */}
                {activeRide && (
                  <button
                    onClick={() => { setShowMap(true); setScreen(SCREENS.ACTIVE); }}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl bg-green-500/10 border border-green-500/30 text-left hover:bg-green-500/15 transition-all"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-green-400 text-sm">Ride Active</p>
                      <p className="text-xs opacity-60 truncate">
                        {activeRide.from?.name?.split(",")[0]} → {activeRide.destination?.name?.split(",")[0]}
                      </p>
                    </div>
                    <i className="fa fa-arrow-right text-green-400 text-sm" />
                  </button>
                )}

                {/* New Ride button */}
                <button
                  onClick={() => setScreen(SCREENS.TYPE)}
                  className="w-full flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-orange-500/10 to-pink-500/10 border border-orange-500/20 text-left hover:border-orange-500/40 hover:scale-[1.01] transition-all"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center shadow-lg shadow-orange-500/30 shrink-0">
                    <i className="fa fa-motorcycle text-white text-lg" />
                  </div>
                  <div>
                    <p className="font-black">Start a New Ride</p>
                    <p className="text-xs opacity-50 mt-0.5">Plan your route with geocoding + map</p>
                  </div>
                  <i className="fa fa-arrow-right text-orange-400 ml-auto" />
                </button>

                {/* Ride History button */}
                <button
                  onClick={loadHistory}
                  className={`w-full flex items-center gap-4 p-5 rounded-2xl border text-left hover:scale-[1.01] transition-all ${tc.card}`}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${tc.record}`}>
                    <i className="fa fa-clock-rotate-left text-lg opacity-70" />
                  </div>
                  <div>
                    <p className="font-black">Ride History</p>
                    <p className="text-xs opacity-50 mt-0.5">View all your past rides + routes</p>
                  </div>
                  <i className="fa fa-arrow-right opacity-40 ml-auto" />
                </button>
              </div>
            )}

            {/* ═══════════════════════════════════════════════
                TYPE SCREEN — solo or group
            ═══════════════════════════════════════════════ */}
            {screen === SCREENS.TYPE && (
              <div className="p-6 space-y-3">
                <p className={`text-sm mb-2 ${tc.sub}`}>How are you riding today?</p>

                {/* Solo */}
                <button
                  onClick={() => { setRideType("solo"); setScreen(SCREENS.SETUP); }}
                  className="w-full flex items-start gap-4 p-4 rounded-2xl border-2 border-orange-500/30 bg-orange-500/5 text-left hover:border-orange-500/60 hover:scale-[1.01] transition-all"
                >
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-2xl shrink-0">
                    🏍️
                  </div>
                  <div>
                    <p className="font-black text-orange-400">Solo Ride</p>
                    <p className="text-xs opacity-50 mt-1">Just you and the road. Plan your own route and go.</p>
                  </div>
                </button>

                {/* Group */}
                <button
                  onClick={() => { setRideType("group"); setScreen(SCREENS.SETUP); }}
                  className="w-full flex items-start gap-4 p-4 rounded-2xl border-2 border-blue-500/30 bg-blue-500/5 text-left hover:border-blue-500/60 hover:scale-[1.01] transition-all"
                >
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-2xl shrink-0">
                    👥
                  </div>
                  <div>
                    <p className="font-black text-blue-400">Group Ride</p>
                    <p className="text-xs opacity-50 mt-1">Ride with friends. Members see each other on the map live.</p>
                  </div>
                </button>

                {/* Back */}
                <button
                  onClick={() => setScreen(SCREENS.HOME)}
                  className={`w-full py-3 text-sm opacity-50 hover:opacity-80 transition-opacity`}
                >
                  <i className="fa fa-arrow-left mr-2" />Back
                </button>
              </div>
            )}

            {/* ═══════════════════════════════════════════════
                SETUP SCREEN — from / destination / route
            ═══════════════════════════════════════════════ */}
            {screen === SCREENS.SETUP && (
              <div className="p-6">
                <RideSetup
                  rideType={rideType}
                  userId={user?.id}
                  onRideCreated={handleRideCreated}
                  onCancel={() => setScreen(SCREENS.TYPE)}
                />
              </div>
            )}

            {/* ═══════════════════════════════════════════════
                ACTIVE SCREEN — live map + controls
            ═══════════════════════════════════════════════ */}
            {screen === SCREENS.ACTIVE && activeRide && (
              <div className="p-6 space-y-3">
                {/* Live indicator */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="font-bold text-green-400">Ride Active</span>
                  <span className={`text-xs ml-auto ${tc.sub}`}>
                    {activeRide.from?.name?.split(",")[0]} → {activeRide.destination?.name?.split(",")[0]}
                  </span>
                </div>

                {/* Map toggle */}
                {showMap ? (
                  <RideMap
                    ride={activeRide}
                    myLocation={myLocation}
                    height="300px"
                  />
                ) : (
                  <button
                    onClick={() => setShowMap(true)}
                    className="w-full py-8 rounded-2xl border border-white/10 bg-white/5 text-center hover:bg-white/8 transition-all"
                  >
                    <i className="fa fa-map text-3xl opacity-30 block mb-2" />
                    <span className="text-sm opacity-50">Tap to show map</span>
                  </button>
                )}

                <RideControls
                  ride={activeRide}
                  onCloseMap={() => setShowMap(false)}
                  onRideEnded={handleRideEnded}
                />

                {/* GPS status */}
                {myLocation && (
                  <p className="text-[10px] text-center opacity-30">
                    📍 GPS active · {myLocation.lat.toFixed(4)}, {myLocation.lng.toFixed(4)}
                  </p>
                )}
              </div>
            )}

            {/* ═══════════════════════════════════════════════
                HISTORY SCREEN
            ═══════════════════════════════════════════════ */}
            {screen === SCREENS.HISTORY && (
              <div className="p-6 space-y-3">
                <button
                  onClick={() => setScreen(SCREENS.HOME)}
                  className={`flex items-center gap-1.5 text-xs opacity-50 hover:opacity-80 mb-1 transition-opacity`}
                >
                  <i className="fa fa-arrow-left" />Back
                </button>

                {history.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-5xl mb-4">🛣️</div>
                    <p className="font-bold opacity-60">No rides yet</p>
                    <p className="text-xs opacity-40 mt-1">Your completed rides will appear here.</p>
                  </div>
                ) : (
                  history.map((ride) => (
                    <RideHistoryCard key={ride.id} ride={ride} />
                  ))
                )}
              </div>
            )}

            {/* ═══════════════════════════════════════════════
                DONE SCREEN — success
            ═══════════════════════════════════════════════ */}
            {screen === SCREENS.DONE && (
              <div className="p-6 text-center py-10">
                <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
                  <i className="fa fa-flag-checkered text-3xl text-green-400" />
                </div>
                <h3 className="text-2xl font-black mb-2">Ride Complete! 🏁</h3>
                <p className={`text-sm mb-6 ${tc.sub}`}>
                  Your ride has been saved to history.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={loadHistory}
                    className="flex-1 py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 font-bold text-sm transition-all"
                  >
                    <i className="fa fa-clock-rotate-left mr-2" />View History
                  </button>
                  <button
                    onClick={() => setScreen(SCREENS.TYPE)}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold text-sm hover:scale-[1.02] transition-all"
                  >
                    <i className="fa fa-motorcycle mr-2" />New Ride
                  </button>
                </div>
              </div>
            )}

          </div>{/* end scrollable */}
        </div>
      </div>
    </>
  );
}
