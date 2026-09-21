// ============================================================
// 🏠 Home.jsx — Rider Dashboard
//
// WHAT THIS FILE MANAGES:
//   1. The hero section with greeting + "Start a Ride" button
//   2. The ride history section (below the hero) — live + ended rides
//   3. The StartRideModal (bottom sheet for creating rides)
//   4. The ActiveRideOverlay (full-screen map during a live ride)
//   5. The RideHistoryPanel (side panel for full ride history)
//
// STATE:
//   showStart       → StartRideModal open/closed
//   showHistory     → RideHistoryPanel open/closed
//   activeRide      → the currently live ride (shown in ActiveRideOverlay)
//   rides           → all rides for this user (shown in history section)
//   mapRide         → ride being viewed on the full-screen map (can be
//                     any past ride, not just the live one)
//
// DATA FLOW:
//   1. On mount: fetch all rides from backend (or localStorage fallback)
//   2. Active rides are shown in the home page "Live" section
//   3. When user creates a ride in the modal: activeRide is set + map opens
//   4. When user clicks "Open Map" in history: mapRide is set + map opens
//   5. When user ends a ride: ride is updated in DB, list is refreshed
//   6. When user deletes a ride: ride is removed from DB, list is refreshed
//
// LAYOUT:
//   Desktop: [Sidebar 256px] [Centered main content]
//   Mobile:  [TopBar] [Content] [Bottom Nav with FAB]
// ============================================================

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth }          from "../context/AuthContext";
import MobileNav            from "./components/layout/MobileNav";
import Sidebar              from "./components/layout/Sidebar";
import TopBar               from "./components/layout/TopBar";
import StartRideModal       from "./components/shared/StartRideModal";
import { useVoice }         from "./components/shared/useVoice";
import { useTheme }         from "./hooks/useTheme";

import ActiveRideOverlay    from "./components/ride/ActiveRideOverlay";
import RideHistoryPanel     from "./components/ride/RideHistoryPanel";

import { getUserRides, endRide, deleteRide, getRide } from "../services/rideApi";
import { formatDistance, formatDuration }    from "../services/routingApi";

export default function Home() {
  const { user }                = useAuth();
  // Pass user?.id so each account gets its own theme stored separately
  const { theme, setTheme, tc } = useTheme(user?.id);

  // ── MODAL VISIBILITY ────────────────────────────────────────
  const [showStart,   setShowStart]   = useState(false); // StartRideModal
  const [showHistory, setShowHistory] = useState(false); // RideHistoryPanel side panel

  // ── RIDE STATE ───────────────────────────────────────────────
  // mapRide: which ride is currently shown on the full-screen map
  // (can be the live ride OR any historical ride opened for review)
  const [mapRide,   setMapRide]   = useState(null);
  const [rides,     setRides]     = useState([]);   // all rides for history
  const [loading,   setLoading]   = useState(true); // loading history on mount

  useEffect(() => {
    const handler = async (e) => {
      const { rideId } = e.detail;
      try {
        const ride = await getRide(rideId);
        if (ride) setMapRide(ride);
      } catch (err) {
        console.warn("[Home] Failed to open ride from notification:", err.message);
      }
    };
    window.addEventListener("rw-open-ride", handler);
    return () => window.removeEventListener("rw-open-ride", handler);
  }, []);

  // ── DEEP LINKS (handled ONCE, then the param is cleared) ─────────
  //   /home?openRide=<id>  → notification clicked from any page → open that ride's map
  //   /home?startRide=1    → mobile FAB pressed on Account/Riders/Settings → open Start Ride modal
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const openRideId = searchParams.get("openRide");
    const startRide  = searchParams.get("startRide");
    if (!openRideId && startRide !== "1") return;

    // Clear params FIRST so the action can't fire twice on re-render
    setSearchParams({}, { replace: true });

    if (startRide === "1") setShowStart(true);

    if (openRideId) {
      getRide(openRideId)
        .then(ride => { if (ride) setMapRide(ride); })
        .catch(err => console.warn("[Home] Failed to open ride from link:", err.message));
    }
  }, [searchParams, setSearchParams]);

  // ── RESET STATE ON USER SWITCH ───────────────────────────────
  // If the logged-in account changes (e.g. logout → login as someone else),
  // wipe all in-memory ride state so the previous user's data is never shown.
  useEffect(() => {
    setMapRide(null);
    setRides([]);
    setShowStart(false);
    setShowHistory(false);
    setLoading(true);
  }, [user?.id]);

  // ── MOUSE GLOW ───────────────────────────────────────────────
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const handler = e => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  // ── VOICE COMMANDS ───────────────────────────────────────────
  const commandsMap = {
    start:    () => setShowStart(true),
    history:  () => setShowHistory(true),
    dark:     () => setTheme("dark"),
    light:    () => setTheme("light"),
    warm:     () => setTheme("warm"),
    midnight: () => setTheme("midnight"),
  };
  const { voiceMode, startVoice } = useVoice(commandsMap);

  // ── TIME GREETING ────────────────────────────────────────────
  const hour         = new Date().getHours();
  const greeting     = hour < 5  ? "Up late, "     : hour < 12 ? "Good morning, "
                     : hour < 17 ? "Good afternoon, " : hour < 21 ? "Good evening, "
                     : "Good night, ";
  const greetingIcon = hour < 5  ? "fa-moon"       : hour < 12 ? "fa-sun"
                     : hour < 17 ? "fa-cloud-sun"   : hour < 21 ? "fa-city"
                     : "fa-moon";

  // ── LOAD ALL RIDES ON MOUNT ──────────────────────────────────
  const refreshRides = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const all = await getUserRides(user.id);
      setRides(all); // newest first (backend orders by createdAt desc)
      return all;
    } catch (e) {
      console.error("Failed to load rides:", e);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshRides();
  }, [refreshRides]);

  // ── DERIVED: separate active vs. past rides for the home page ──
  const liveRides = rides.filter(r => r.status === "active");
  const pastRides = rides.filter(r => r.status !== "active");

  // ── STATS ────────────────────────────────────────────────────
  // Computed from actual ride history instead of hardcoded values
  const totalKm        = rides.reduce((sum, r) => sum + (r.distanceMeters || 0) / 1000, 0);
  const completedCount = rides.filter(r => r.status === "completed").length;

  const stats = [
    { value: String(rides.length),                   label: "Total Rides",    icon: "fa-motorcycle", color: "#f97316" },
    { value: totalKm > 0 ? `${totalKm.toFixed(0)} km` : "0 km", label: "Distance Ridden", icon: "fa-route",      color: "#60a5fa" },
    { value: String(completedCount),                  label: "Completed",      icon: "fa-flag-checkered", color: "#34d399" },
  ];

  // ── EVENT HANDLERS ───────────────────────────────────────────

  // Called when a new ride is created in the modal
  const handleRideCreated = (ride) => {
    setMapRide(ride);            // open the full-screen map with this ride
    refreshRides();              // refresh the history list
  };

  // Called by ActiveRideOverlay's X button (close map, ride stays alive)
  const handleCloseMap = () => {
    setMapRide(null); // hides the overlay; ride is still "active" in the DB
  };

  // Called by ActiveRideOverlay when user confirms "End Ride"
  // BUG FIX: we must setMapRide(null) BEFORE refreshing so the overlay
  // doesn't still show "active" state with a stale ride object.
  const handleEndRide = async () => {
    if (!mapRide?.id) return;
    const rideId = mapRide.id;
    // Close map immediately — prevents re-opening a stale active ride object
    setMapRide(null);
    try {
      await endRide(rideId, user?.id);  // PATCH status → "completed" in backend (admin identity included)
    } catch(e) {
      console.error("End ride failed:", e);
    } finally {
      refreshRides();             // refresh history list to show completed status
    }
  };

  // ── LEAVE RIDE (group member, non-admin) ──────────────────────────
  // The overlay already marked this user as "left" on the backend.
  // Here we just close the map and refresh so the live card disappears.
  const handleLeaveRide = () => {
    setMapRide(null);
    refreshRides();
  };

  // Called from RideHistoryPanel or home page history section
  // Opens the full-screen map to view/resume a ride
  const handleOpenRide = (ride) => {
    setMapRide(ride);
    setShowHistory(false); // close the history panel if it was open
  };

  // Called from RideHistoryPanel to permanently delete a ride
  const handleDeleteRide = async (rideId) => {
    await deleteRide(rideId);
    refreshRides();
  };

  // ── STATIC TIPS ──────────────────────────────────────────────
  const tips = [
    "Always check tire pressure before a long ride — properly inflated tires improve fuel efficiency by up to 10%.",
    "Ride in groups for long-distance trips — group rides are statistically safer and more fun.",
    "Keep a first-aid kit, a torch, and a puncture repair kit in your saddlebag for emergencies.",
    "Stay hydrated on long rides — dehydration impairs reaction time just like fatigue.",
  ];
  const dailyTip = tips[new Date().getDate() % tips.length]; // rotates daily

  // ────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────
  return (
    <div
      className={`relative min-h-screen w-full overflow-x-hidden ${tc.bg} ${tc.text}`}
    >
      {/* ── Orange radial mouse glow ─────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0 z-0 transition-all duration-500"
        style={{
          background: `radial-gradient(circle 600px at ${mousePos.x}px ${mousePos.y}px, rgba(249,115,22,0.08), transparent 60%)`,
        }}
      />

      {/* ── Layout shell ─────────────────────────────────────── */}
      <Sidebar tc={tc} />
      <TopBar
        theme={theme} setTheme={setTheme} tc={tc}
        voiceMode={voiceMode} startVoice={startVoice}
        userId={user?.id}
      />
      <MobileNav tc={tc} onStartRide={() => setShowStart(true)} />

      {/* ══════════════════════════════════════════════════════
          MAIN CONTENT — centered column, scrollable
      ══════════════════════════════════════════════════════ */}
      <main className="relative z-10 lg:ml-64 min-h-screen flex flex-col items-center px-5 pt-20 pb-28 lg:pb-12">

        {/* ─── MAX-WIDTH WRAPPER (keeps content readable on wide screens) */}
        <div className="w-full max-w-[560px]">

          {/* ═══════════════════════════════════════════════
              HERO SECTION — greeting + Start Ride CTA
          ═══════════════════════════════════════════════ */}
          <div
            className="text-center mb-10"
            style={{ animation: "slideUp 0.6s ease-out both" }}
          >
            {/* Live riders badge */}
            <div
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-bold mb-6 ${tc.card}`}
              style={{ animation: "slideUp 0.45s ease-out both" }}
            >
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>3 riders online near you</span>
            </div>

            {/* Personalised greeting */}
            <h1
              className="text-4xl md:text-5xl font-black mb-2 leading-tight"
              style={{ animation: "slideUp 0.5s ease-out both" }}
            >
              <i className={`fa ${greetingIcon} mr-3 text-orange-400`} />
              {greeting}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg, #f97316, #ec4899)" }}
              >
                {user?.username || "Rider"}
              </span>
            </h1>

            <p
              className={`text-base md:text-lg mb-8 ${tc.sub}`}
              style={{ animation: "slideUp 0.55s ease-out both" }}
            >
              Your next adventure is one tap away.
            </p>

            {/* ── START A RIDE button ── */}
            <div className="relative inline-block" style={{ animation: "slideUp 0.6s ease-out both" }}>
              {/* Pulsing outer ring */}
              <span
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{ animation: "ring-pulse 2.5s ease-in-out infinite" }}
              />
              <button
                id="home-start-ride-btn"
                onClick={() => setShowStart(true)}
                className="relative group px-10 py-5 rounded-2xl font-black text-lg text-white transition-all duration-300 hover:scale-105 hover:-translate-y-1 active:scale-95 active:translate-y-0"
                style={{
                  background:  "linear-gradient(135deg, #f97316 0%, #ec4899 100%)",
                  boxShadow:   "0 8px 40px rgba(249,115,22,0.45)",
                  animation:   "glow 3s ease-in-out infinite",
                }}
              >
                <span className="flex items-center justify-center gap-3">
                  <i className="fa fa-motorcycle text-2xl transition-transform duration-300 group-hover:translate-x-1" />
                  Start a Ride
                  <i className="fa fa-arrow-right text-base opacity-70 transition-all duration-300 group-hover:translate-x-2" />
                </span>
              </button>
            </div>

            <p
              className={`mt-4 text-xs ${tc.sub}`}
              style={{ animation: "slideUp 0.75s ease-out both" }}
            >
              🎙️ Or say <span className="font-semibold">"start"</span> to your mic
            </p>
          </div>

          {/* ═══════════════════════════════════════════════
              LIVE RIDES SECTION — shown only when there are active rides
          ═══════════════════════════════════════════════ */}
          {liveRides.length > 0 && (
            <div className="mb-8" style={{ animation: "slideUp 0.7s ease-out both" }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <h2 className="font-black text-sm tracking-wide uppercase opacity-70">Live Rides</h2>
              </div>
              <div className="space-y-2">
                {liveRides.map(ride => (
                  <RideCard
                    key={ride.id}
                    ride={ride}
                    onOpen={() => handleOpenRide(ride)}
                    tc={tc}
                    isLive
                  />
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════
              STATS CARDS
          ═══════════════════════════════════════════════ */}
          <div
            className="grid grid-cols-3 gap-3 mb-8"
            style={{ animation: "slideUp 0.8s ease-out both" }}
          >
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={`rounded-2xl border p-4 text-center transition-all duration-300 cursor-default ${tc.card}`}
                style={{ animation: `slideUp ${0.8 + i * 0.07}s ease-out both` }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-6px) scale(1.03)"; e.currentTarget.style.boxShadow = "0 16px 40px rgba(0,0,0,0.25)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
              >
                <i className={`fa ${s.icon} text-2xl mb-2 block`} style={{ color: s.color }} />
                <p className="text-xl md:text-2xl font-black">{s.value}</p>
                <p className={`text-[10px] md:text-xs mt-0.5 ${tc.sub}`}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* ═══════════════════════════════════════════════
              RECENT RIDES SECTION — last 3 rides with quick actions
          ═══════════════════════════════════════════════ */}
          {(rides.length > 0 || loading) && (
            <div className="mb-8" style={{ animation: "slideUp 0.85s ease-out both" }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-black text-sm tracking-wide uppercase opacity-70">Recent Rides</h2>
                {/* "View All" opens the full history side panel */}
                {rides.length > 3 && (
                  <button
                    onClick={() => setShowHistory(true)}
                    className={`text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors`}
                  >
                    View All <i className="fa fa-arrow-right ml-1 text-[10px]" />
                  </button>
                )}
              </div>

              {loading ? (
                // Skeleton loaders while fetching
                <div className="space-y-2">
                  {[1, 2].map(n => (
                    <div key={n} className={`rounded-2xl border h-20 animate-pulse ${tc.card}`} />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Show only the most recent 3 rides */}
                  {rides.slice(0, 3).map(ride => (
                    <RideCard
                      key={ride.id}
                      ride={ride}
                      onOpen={() => handleOpenRide(ride)}
                      tc={tc}
                      isLive={ride.status === "active"}
                    />
                  ))}
                </div>
              )}

              {/* "See all history" button */}
              <button
                onClick={() => setShowHistory(true)}
                className={`mt-3 w-full py-3 rounded-2xl text-sm font-bold border transition-all hover:scale-[1.01] ${tc.card}`}
              >
                <i className="fa fa-clock-rotate-left mr-2 text-orange-400" />
                {rides.length === 0 ? "Ride History" : `See all ${rides.length} ride${rides.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════════════
              FIRST TIME — no rides yet
          ═══════════════════════════════════════════════ */}
          {!loading && rides.length === 0 && (
            <div
              className={`mb-8 rounded-2xl border p-8 text-center ${tc.card}`}
              style={{ animation: "slideUp 0.85s ease-out both" }}
            >
              <i className="fa fa-route text-4xl mb-3 block" style={{ color: "rgba(255,255,255,0.2)" }} />
              <p className="font-bold opacity-50 mb-1">No rides yet</p>
              <p className={`text-xs ${tc.sub}`}>Press "Start a Ride" above to begin your first adventure.</p>
            </div>
          )}

          {/* ═══════════════════════════════════════════════
              TIP OF THE DAY
          ═══════════════════════════════════════════════ */}
          <div style={{ animation: "slideUp 0.95s ease-out both" }}>
            <div
              className={`rounded-2xl border p-5 flex items-start gap-4 ${tc.card}`}
              style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.05) 0%, rgba(236,72,153,0.03) 100%)" }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.2)" }}
              >
                {/* Icon instead of emoji — replaceable by changing the fa- class */}
                <i className="fa fa-lightbulb" style={{ color: "#f97316", fontSize: "16px" }} />
              </div>
              <div>
                <p className="font-black text-sm mb-1">Tip of the Day</p>
                <p className={`text-xs leading-relaxed ${tc.sub}`}>{dailyTip}</p>
              </div>
            </div>
          </div>

        </div>{/* end max-width wrapper */}
      </main>

      {/* ══════════════════════════════════════════════════════
          OVERLAYS & MODALS
      ══════════════════════════════════════════════════════ */}

      {/* ── Start Ride bottom-sheet modal ─────────────────── */}
      <StartRideModal
        open={showStart}
        onClose={() => setShowStart(false)}
        tc={tc}
        onRideCreated={handleRideCreated}
        onOpenHistory={() => { setShowStart(false); setShowHistory(true); }}
      />

      {/* ── Full-screen map (active or history view) ────────── */}
      {mapRide && (
        <ActiveRideOverlay
          ride={mapRide}
          onClose={handleCloseMap}
          onEnd={handleEndRide}
          onLeave={handleLeaveRide}
        />
      )}

      {/* ── Ride History side panel ──────────────────────────── */}
      {showHistory && (
        <RideHistoryPanel
          rides={rides}
          onOpenRide={handleOpenRide}
          onDeleteRide={handleDeleteRide}
          onClose={() => setShowHistory(false)}
          tc={tc}
        />
      )}

      {/* ── CSS Animations ──────────────────────────────────── */}
      <style>{`
        @keyframes glow {
          0%, 100% { box-shadow: 0 8px 40px rgba(249,115,22,0.45); }
          50%       { box-shadow: 0 12px 60px rgba(249,115,22,0.70); }
        }
        @keyframes ring-pulse {
          0%   { box-shadow: 0 0 0 0px  rgba(249,115,22,0.50); }
          70%  { box-shadow: 0 0 0 18px rgba(249,115,22,0.00); }
          100% { box-shadow: 0 0 0 0px  rgba(249,115,22,0.00); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>
    </div>
  );
}

// ============================================================
// RideCard — compact row card used in "Live Rides" + "Recent Rides"
//
// PROPS:
//   ride   — ride object
//   onOpen — open this ride's full-screen map
//   tc     — theme classes
//   isLive — true = show green live indicator
// ============================================================
function RideCard({ ride, onOpen, tc, isLive }) {
  // Short names: "Marina Beach, Chennai, Tamil Nadu..." → "Marina Beach"
  const fromShort = (ride.fromName || "From").split(",")[0];
  const toShort   = (ride.destinationName || "Destination").split(",")[0];

  // Date string: "3 Sep 2026"
  const dateStr = ride.createdAt
    ? new Date(ride.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : "";

  return (
    <div
      className={`rounded-2xl border p-3.5 flex items-center gap-3 transition-all hover:scale-[1.01] cursor-pointer ${tc.card}`}
      onClick={onOpen}
    >
      {/* Left: icon bubble */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{
          background: isLive
            ? "linear-gradient(135deg, rgba(34,197,94,0.2), rgba(16,185,129,0.15))"
            : "rgba(255,255,255,0.06)",
          border: isLive ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.1)",
        }}
      >
        {isLive
          ? <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          : <i className="fa fa-route" style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px" }} />
        }
      </div>

      {/* Center: route + meta */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate">{fromShort} → {toShort}</p>
        <div className={`flex items-center gap-2 text-[11px] mt-0.5 ${tc.sub} flex-wrap`}>
          {ride.distanceMeters > 0 && <span>{formatDistance(ride.distanceMeters)}</span>}
          {ride.durationSeconds > 0 && <><span className="opacity-30">·</span><span>{formatDuration(ride.durationSeconds)}</span></>}
          {dateStr && <><span className="opacity-30">·</span><span>{dateStr}</span></>}
        </div>
      </div>

      {/* Right: status + open icon */}
      <div className="flex items-center gap-2 shrink-0">
        {ride.rideType === "group" && (
          <span style={{
            background: "rgba(139,92,246,0.15)",
            border: "1px solid rgba(139,92,246,0.3)",
            borderRadius: "50px",
            padding: "2px 8px",
            fontSize: "10px",
            fontWeight: 700,
            color: "#a78bfa",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}>
            👥 Group
          </span>
        )}
        {ride.participants && ride.participants.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", marginLeft: "4px" }}>
            {ride.participants.slice(0, 3).map((p, i) => (
              <div
                key={i}
                style={{
                  width: "20px", height: "20px", borderRadius: "50%",
                  background: "linear-gradient(135deg, #f97316, #ec4899)",
                  border: "2px solid rgba(15,15,26,1)",
                  marginLeft: i > 0 ? "-8px" : "0",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "9px", fontWeight: "bold", color: "white",
                  zIndex: 3 - i
                }}
              >
                {(p.username || p.name || p.id || "?")[0].toUpperCase()}
              </div>
            ))}
            {ride.participants.length > 3 && (
              <div style={{
                width: "20px", height: "20px", borderRadius: "50%",
                background: "rgba(255,255,255,0.1)",
                border: "2px solid rgba(15,15,26,1)",
                marginLeft: "-8px",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "8px", color: "white", zIndex: 0
              }}>
                +{ride.participants.length - 3}
              </div>
            )}
          </div>
        )}
        {isLive ? (
          <span className="text-xs font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
            Live
          </span>
        ) : (
          <span className="text-[10px] font-bold opacity-30 uppercase tracking-wide">{ride.status}</span>
        )}
        <i className="fa fa-chevron-right text-xs opacity-30" />
      </div>
    </div>
  );
}
