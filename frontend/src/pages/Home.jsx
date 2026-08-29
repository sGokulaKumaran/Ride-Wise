// ============================================================
// 🏠 Home — Rider Dashboard (the main page after login + onboarding)
//
// LAYOUT:
//   Desktop: [Sidebar] [Main Column 2/3] [Right Rail 1/3]
//   Mobile:  [TopBar] [Dashboard] [Bottom Nav with Start Ride FAB]
//
// SECTIONS:
//   1. Greeting hero + "Start a Ride" CTA (most important button)
//   2. Riders around you (nearby rider cards)
//   3. Your recent rides
//   4. Live now (right rail on desktop)
//   5. Tip of the day
//
// DATA:
//   All data is currently static/mock.
//   To connect to the backend:
//     - Replace nearbyRiders with: const { data } = await axios.get('/api/riders/nearby')
//     - Replace recentRides with:  const { data } = await axios.get('/api/rides/recent')
//     - Replace trendingRides with: const { data } = await axios.get('/api/live/trending')
//
// VOICE COMMANDS:
//   "dark" / "light" / "warm" / "midnight" → switch theme
//   "start" → open Start Ride modal
//   "find"  → navigate to /find-riders (community)
//   "rides" → navigate to /my-rides
// ============================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "./hooks/useTheme";
import { useAuth } from "../context/AuthContext";
import { useVoice } from "./components/shared/useVoice";
import Sidebar from "./components/layout/Sidebar";
import TopBar from "./components/layout/TopBar";
import MobileNav from "./components/layout/MobileNav";
import StartRideModal from "./components/shared/StartRideModal";

export default function Home() {
  const navigate = useNavigate();
  const { theme, setTheme, tc } = useTheme();
  const { user } = useAuth();

  // Controls whether the Start Ride modal is visible
  const [showStart, setShowStart] = useState(false);

  // ── Voice commands ───────────────────────────────────────────
  const commandsMap = {
    dark:      () => setTheme("dark"),
    light:     () => setTheme("light"),
    warm:      () => setTheme("warm"),
    midnight:  () => setTheme("midnight"),
    start:     () => setShowStart(true),
    find:      () => navigate("/community"),
    rides:     () => navigate("/my-rides"),
    community: () => navigate("/community"),
    messages:  () => navigate("/messages"),
    settings:  () => navigate("/settings"),
  };
  const { voiceMode, startVoice } = useVoice(commandsMap);

  // ── Mock data — replace with API calls when backend is ready ─

  // Nearby riders (from the same area as the logged-in user)
  const nearbyRiders = [
    { id: 1, name: "Anbu Kumar",   bike: "Yamaha R15",     distance: "2.3 km", rides: 142, online: true,  img: "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=200&h=200&fit=crop" },
    { id: 2, name: "Vikram Singh", bike: "KTM Duke 390",   distance: "3.1 km", rides: 89,  online: true,  img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop" },
    { id: 3, name: "Priya Sharma", bike: "RE Classic 350", distance: "4.5 km", rides: 67,  online: false, img: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop" },
    { id: 4, name: "Karthik R",    bike: "Himalayan 450",  distance: "5.8 km", rides: 234, online: true,  img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop" },
  ];

  // Recent rides by the logged-in user
  const recentRides = [
    { id: 1, route: "Chennai → Pondicherry", distance: "151 km", duration: "3h 20m", date: "Last weekend",  img: "https://images.unsplash.com/photo-1518987048-93e29699e79a?w=600&q=80" },
    { id: 2, route: "Ooty Weekend Ride",     distance: "270 km", duration: "6h 10m", date: "2 weeks ago",   img: "https://images.unsplash.com/photo-1609631839270-c53dba908e91?w=600&q=80" },
    { id: 3, route: "Mahabalipuram Loop",    distance: "60 km",  duration: "1h 30m", date: "3 weeks ago",   img: "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=600&q=80" },
  ];

  // Live rides currently being streamed/tracked
  const trendingRides = [
    { name: "Spiti Valley Epic 🏔️",   viewers: 3240, bike: "Himalayan 450"  },
    { name: "Coorg Morning Mist ☁️",  viewers: 780,  bike: "RE Interceptor" },
    { name: "Leh-Ladakh Highway 🛣️",  viewers: 2150, bike: "RE 650 Twin"    },
  ];

  // ── Time-based greeting ──────────────────────────────────────
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" :
    hour < 17 ? "Good afternoon" :
    hour < 21 ? "Good evening" : "Good night";

  return (
    <div className={`relative min-h-screen w-full overflow-x-hidden ${tc.bg} ${tc.text}`}>

      {/* ── Layout components ──────────────────────────────── */}
      <Sidebar tc={tc} />
      <TopBar
        theme={theme}
        setTheme={setTheme}
        tc={tc}
        voiceMode={voiceMode}
        startVoice={startVoice}
      />
      {/* MobileNav gets onStartRide to control the modal from the FAB */}
      <MobileNav tc={tc} onStartRide={() => setShowStart(true)} />

      {/* ── Main content area (offset for Sidebar on desktop) ── */}
      <main className="lg:ml-64 pt-20 px-4 pb-28 lg:pb-8">
        <div className="max-w-6xl mx-auto">

          {/* ══════════════════════════════════════════════════
              SECTION 1: Greeting hero + Start a Ride CTA
          ══════════════════════════════════════════════════ */}
          <section className={`relative rounded-3xl overflow-hidden border p-6 md:p-8 mb-6 ${tc.card}`}>
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/15 via-pink-500/5 to-transparent pointer-events-none" />

            <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              {/* Greeting text */}
              <div>
                <p className={`text-sm font-medium mb-1 flex items-center gap-1.5 ${tc.sub}`}>
                  <i className="fa fa-sun text-yellow-400" />
                  {greeting}, ready to ride?
                </p>
                <h1 className="text-3xl md:text-4xl font-black mb-2">
                  Welcome back,{" "}
                  <span className="text-orange-400">
                    {user?.username || "Rider"}
                  </span>{" "}
                  🏍️
                </h1>
                <p className={`text-sm max-w-md ${tc.sub}`}>
                  Your next adventure starts here. Connect with riders along your
                  journey and explore the open road together.
                </p>
              </div>

              {/* START A RIDE — the single most important CTA on this page */}
              <button
                id="start-ride-hero-btn"
                onClick={() => setShowStart(true)}
                className="group relative shrink-0 px-7 py-4 rounded-2xl font-black text-base bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-2xl shadow-orange-500/30 transition-all hover:scale-105 active:scale-95"
              >
                <span className="flex items-center gap-2.5">
                  <i className="fa fa-motorcycle text-xl group-hover:animate-bounce" />
                  Start a Ride
                </span>
                {/* Pulsing ring effect */}
                <span className="absolute inset-0 rounded-2xl bg-orange-500/30 animate-ping opacity-0 group-hover:opacity-100" />
              </button>
            </div>
          </section>

          {/* ══════════════════════════════════════════════════
              SECTION 2: Two-column grid
              Left (2/3): Riders nearby + Recent rides
              Right (1/3): Live now + Tip
          ══════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* ── LEFT / MAIN COLUMN ──────────────────────── */}
            <div className="lg:col-span-2 space-y-4">

              {/* ── Riders around you ────────────────────── */}
              <section className={`rounded-2xl border p-5 ${tc.card}`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-black">📍 Riders around you</h2>
                    <p className={`text-xs ${tc.sub}`}>Based on your location</p>
                  </div>
                  <button
                    onClick={() => navigate("/community")}
                    className={`text-xs font-bold ${tc.sub} hover:underline transition-opacity`}
                  >
                    See all →
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {nearbyRiders.map((r) => (
                    <div
                      key={r.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:scale-[1.02] cursor-pointer ${tc.card} ${tc.cardHover}`}
                    >
                      {/* Avatar with online indicator */}
                      <div className="relative shrink-0">
                        <img
                          src={r.img}
                          alt={r.name}
                          className="w-12 h-12 rounded-full object-cover"
                          loading="lazy"
                        />
                        {r.online && (
                          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-black" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{r.name}</p>
                        <p className={`text-xs truncate ${tc.sub}`}>
                          {r.distance} · 🏍️ {r.bike}
                        </p>
                      </div>

                      {/* Connect button */}
                      <button
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:scale-105 shrink-0 ${tc.button}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Connect
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* ── Recent rides ──────────────────────────── */}
              <section className={`rounded-2xl border p-5 ${tc.card}`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-black">🛣️ Your recent rides</h2>
                    <p className={`text-xs ${tc.sub}`}>Your last few adventures</p>
                  </div>
                  <button
                    onClick={() => navigate("/my-rides")}
                    className={`text-xs font-bold ${tc.sub} hover:underline`}
                  >
                    View all →
                  </button>
                </div>

                <div className="space-y-3">
                  {recentRides.map((ride) => (
                    <div
                      key={ride.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:scale-[1.01] cursor-pointer ${tc.card} ${tc.cardHover}`}
                    >
                      <img
                        src={ride.img}
                        alt={ride.route}
                        className="w-16 h-16 rounded-xl object-cover shrink-0"
                        loading="lazy"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{ride.route}</p>
                        <p className={`text-xs ${tc.sub}`}>
                          {ride.distance} · {ride.duration}
                        </p>
                        <p className={`text-xs ${tc.sub}`}>{ride.date}</p>
                      </div>
                      <i className={`fa fa-chevron-right ${tc.sub} shrink-0`} />
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* ── RIGHT RAIL ──────────────────────────────── */}
            <div className="space-y-4">

              {/* Live now */}
              <section className={`rounded-2xl border p-5 ${tc.card}`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-black flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    Live now
                  </h2>
                  <button
                    onClick={() => navigate("/live")}
                    className={`text-xs font-bold ${tc.sub} hover:underline`}
                  >
                    All →
                  </button>
                </div>

                <div className="space-y-2.5">
                  {trendingRides.map((t, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-xl border transition-all hover:scale-[1.02] cursor-pointer ${tc.card} ${tc.cardHover}`}
                    >
                      <p className="font-bold text-sm truncate">{t.name}</p>
                      <p className={`text-xs mt-1 ${tc.sub}`}>
                        👁 {t.viewers.toLocaleString()} watching · 🏍️ {t.bike}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Quick stats */}
              <section className={`rounded-2xl border p-5 ${tc.card}`}>
                <h2 className="text-base font-black mb-3">📊 Your stats</h2>
                <div className="space-y-2.5">
                  {[
                    { label: "Total rides",    value: "12",   icon: "fa-motorcycle text-orange-400" },
                    { label: "Total distance",  value: "481 km", icon: "fa-route text-blue-400" },
                    { label: "Riders connected", value: "248",  icon: "fa-users text-green-400" },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center justify-between">
                      <span className={`text-xs flex items-center gap-2 ${tc.sub}`}>
                        <i className={`fa ${s.icon} w-4 text-center`} />
                        {s.label}
                      </span>
                      <span className="font-black text-sm">{s.value}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Tip of the day */}
              <section className={`rounded-2xl border p-5 ${tc.card} bg-gradient-to-br from-orange-500/10 to-pink-500/10`}>
                <div className="text-3xl mb-2">💡</div>
                <h3 className="font-black text-sm mb-1">Tip of the day</h3>
                <p className={`text-xs leading-relaxed ${tc.sub}`}>
                  Always check your tire pressure before a long ride. Properly
                  inflated tires improve fuel efficiency by up to 10% and make
                  your bike much safer to handle.
                </p>
              </section>
            </div>

          </div>
        </div>
      </main>

      {/* ── Start Ride modal ────────────────────────────────── */}
      <StartRideModal
        open={showStart}
        onClose={() => setShowStart(false)}
        tc={tc}
      />
    </div>
  );
}
