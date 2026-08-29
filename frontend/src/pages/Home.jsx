// ============================================================
// 🏠 Home — Rider Dashboard
// Route: /home (protected — requires login + onboarding)
//
// PHILOSOPHY:
//   This is intentionally minimal and focused.
//   One primary action (Start a Ride), nothing else competing for attention.
//   Everything else (riders, live, community) is a future feature.
//
// LAYOUT:
//   Desktop: [Sidebar 256px] [Centered main content]
//   Mobile:  [TopBar] [Content] [Bottom Nav with FAB]
//
// SECTIONS:
//   1. HERO — animated greeting + the single "Start a Ride" CTA
//   2. STATS — 3 glassy cards: Rides · Distance · Connected
//   3. TIP   — daily riding tip card
//
// INTERACTIONS:
//   - Mouse glow radial gradient follows cursor (orange tint)
//   - Motorcycle icon floats up/down continuously (CSS float animation)
//   - CTA button has a pulsing orange glow ring
//   - Hovering CTA: lifts + glow intensifies
//   - Stats cards: hover lifts them with a shadow
//   - All cards animate in on load (slide-up + fade)
//   - Voice commands: "start", "dark", "light", "warm", "midnight"
// ============================================================

import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import MobileNav from "./components/layout/MobileNav";
import Sidebar from "./components/layout/Sidebar";
import TopBar from "./components/layout/TopBar";
import StartRideModal from "./components/shared/StartRideModal";
import { useVoice } from "./components/shared/useVoice";
import { useTheme } from "./hooks/useTheme";

export default function Home() {
  const { theme, setTheme, tc } = useTheme();
  const { user } = useAuth();

  // Controls the Start Ride modal
  const [showStart, setShowStart] = useState(false);

  // Mouse position for the glow effect (orange tint on home, not white)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const mainRef = useRef(null);

  // Track mouse for the glow
  useEffect(() => {
    const handler = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  // ── Voice commands ───────────────────────────────────────────
  // Say any of these keywords to trigger the action
  const commandsMap = {
    start:    () => setShowStart(true),  // "start" or "start a ride"
    dark:     () => setTheme("dark"),
    light:    () => setTheme("light"),
    warm:     () => setTheme("warm"),
    midnight: () => setTheme("midnight"),
  };
  const { voiceMode, startVoice } = useVoice(commandsMap);

  // ── Time-based greeting ──────────────────────────────────────
  const hour = new Date().getHours();
  const greeting =
    hour < 5  ? "Up late, "   :
    hour < 12 ? "Good morning, " :
    hour < 17 ? "Good afternoon, " :
    hour < 21 ? "Good evening, " :
               "Good night, ";

  const greetingEmoji =
    hour < 5  ? "🌙" :
    hour < 12 ? "☀️" :
    hour < 17 ? "⛅" :
    hour < 21 ? "🌆" : "🌙";

  // ── Static stats (replace with API later) ────────────────────
  const stats = [
    { value: "12",     label: "Total Rides",    icon: "fa-motorcycle", color: "#f97316" },
    { value: "481 km", label: "Distance Ridden", icon: "fa-route",      color: "#60a5fa" },
    { value: "248",    label: "Riders Met",      icon: "fa-users",      color: "#34d399" },
  ];

  return (
    <div
      ref={mainRef}
      className={`relative min-h-screen w-full overflow-x-hidden ${tc.bg} ${tc.text}`}
    >

      {/* ── Orange-tinted mouse glow (home brand colour) ────── */}
      <div
        className="pointer-events-none fixed inset-0 z-0 transition-all duration-300"
        style={{
          background: `radial-gradient(circle 500px at ${mousePos.x}px ${mousePos.y}px, rgba(249,115,22,0.10), transparent 55%)`,
        }}
      />

      {/* ── Layout ──────────────────────────────────────────── */}
      <Sidebar tc={tc} />
      <TopBar
        theme={theme}
        setTheme={setTheme}
        tc={tc}
        voiceMode={voiceMode}
        startVoice={startVoice}
      />
      {/* Pass the modal opener to MobileNav's FAB */}
      <MobileNav tc={tc} onStartRide={() => setShowStart(true)} />

      {/* ════════════════════════════════════════════════════════
          MAIN CONTENT — centered column, max 520px wide
          Sits in the middle of the page (not left-aligned)
      ════════════════════════════════════════════════════════ */}
      <main className="relative z-10 lg:ml-64 min-h-screen flex flex-col items-center justify-center px-5 pt-20 pb-28 lg:pb-8">

        {/* ══════════════════════════════════════════════════════
            SECTION 1 — HERO
            The single most important thing on this page:
            who the user is + the call to start a ride.
        ══════════════════════════════════════════════════════ */}
        <div
          className="w-full max-w-[520px] text-center mb-12"
          style={{ animation: "slideUp 0.6s ease-out both" }}
        >
          {/* Online riders badge */}
          <div
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-bold mb-7 ${tc.card}`}
            style={{ animation: "slideUp 0.5s ease-out both" }}
          >
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>3 riders online near you</span>
          </div>

          {/* Personalised greeting */}
          <h1
            className="text-4xl md:text-5xl font-black mb-2 leading-tight"
            style={{ animation: "slideUp 0.55s ease-out both" }}
          >
            {greeting}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #f97316, #ec4899)" }}
            >
              {user?.username || "Rider"}
            </span>{" "}
            {greetingEmoji}
          </h1>

          <p
            className={`text-base md:text-lg mb-10 ${tc.sub}`}
            style={{ animation: "slideUp 0.6s ease-out both" }}
          >
            Your next adventure is one tap away.
          </p>

          {/* Floating motorcycle emoji */}
          <div
            className="text-7xl md:text-8xl mb-10 select-none"
            style={{ animation: "float 3.5s ease-in-out infinite" }}
          >
            🏍️
          </div>

          {/* ── START A RIDE — the hero CTA ─────────────────────
              This is the single most important interactive element.
              - Orange→pink gradient background
              - Glowing orange shadow (pulses)
              - Outer ring ping animation
              - Hover: lifts + glow intensifies
              - Active (click): compresses
          ──────────────────────────────────────────────────── */}
          <div className="relative inline-block">
            {/* Outer pulsing ring (decorative, behind the button) */}
            <span
              className="absolute inset-0 rounded-2xl opacity-50 pointer-events-none"
              style={{ animation: "ring-pulse 2s ease-in-out infinite" }}
            />

            <button
              id="home-start-ride-btn"
              onClick={() => setShowStart(true)}
              className="relative group px-10 py-5 rounded-2xl font-black text-lg text-white transition-all duration-300 hover:scale-105 hover:-translate-y-1 active:scale-95 active:translate-y-0"
              style={{
                background: "linear-gradient(135deg, #f97316 0%, #ec4899 100%)",
                boxShadow: "0 8px 40px rgba(249, 115, 22, 0.45)",
                animation: "glow 3s ease-in-out infinite",
              }}
            >
              <span className="flex items-center justify-center gap-3">
                {/* Motorcycle bounces on button hover */}
                <i
                  className="fa fa-motorcycle text-2xl transition-transform duration-300 group-hover:translate-x-1"
                />
                Start a Ride
                <i
                  className="fa fa-arrow-right text-base transition-all duration-300 group-hover:translate-x-2 opacity-70"
                />
              </span>
            </button>
          </div>

          {/* Hint text */}
          <p
            className={`mt-5 text-xs ${tc.sub}`}
            style={{ animation: "slideUp 0.9s ease-out both" }}
          >
            🎙️ Or say <span className="font-semibold">"start"</span> to your mic
          </p>
        </div>

        {/* ══════════════════════════════════════════════════════
            SECTION 2 — STATS
            Three glassmorphism cards. Hover lifts each card.
        ══════════════════════════════════════════════════════ */}
        <div
          className="w-full max-w-[520px] grid grid-cols-3 gap-3 mb-8"
          style={{ animation: "slideUp 0.75s ease-out both" }}
        >
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`rounded-2xl border p-4 text-center transition-all duration-300 cursor-default ${tc.card}`}
              style={{
                animation: `slideUp ${0.8 + i * 0.08}s ease-out both`,
                // Hover handled by CSS class above but we add JS hover for extra control
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-6px) scale(1.03)";
                e.currentTarget.style.boxShadow = `0 16px 40px rgba(0,0,0,0.25)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.boxShadow = "";
              }}
            >
              {/* Coloured icon */}
              <i
                className={`fa ${s.icon} text-2xl mb-2 block`}
                style={{ color: s.color }}
              />
              {/* Stat value */}
              <p className="text-xl md:text-2xl font-black">{s.value}</p>
              {/* Label */}
              <p className={`text-[10px] md:text-xs mt-0.5 ${tc.sub}`}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════
            SECTION 3 — TIP OF THE DAY
            Subtle card at the bottom. Soft gradient border.
        ══════════════════════════════════════════════════════ */}
        <div
          className="w-full max-w-[520px]"
          style={{ animation: "slideUp 1s ease-out both" }}
        >
          <div
            className={`rounded-2xl border p-5 flex items-start gap-4 ${tc.card}`}
            style={{
              background: "linear-gradient(135deg, rgba(249,115,22,0.06) 0%, rgba(236,72,153,0.04) 100%)",
            }}
          >
            {/* Tip emoji */}
            <span className="text-3xl select-none shrink-0">💡</span>
            <div>
              <p className="font-black text-sm mb-1">Tip of the day</p>
              <p className={`text-xs leading-relaxed ${tc.sub}`}>
                Always check tire pressure before a long ride. Properly inflated tires
                improve fuel efficiency by up to 10% and make your bike safer to handle.
              </p>
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

      {/* ── CSS Animations ──────────────────────────────────── */}
      <style>{`
        /* Motorcycle floats up and down */
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(-3deg); }
          50%       { transform: translateY(-18px) rotate(-3deg); }
        }

        /* CTA button glow pulses gently */
        @keyframes glow {
          0%, 100% { box-shadow: 0 8px 40px rgba(249,115,22,0.45); }
          50%       { box-shadow: 0 12px 60px rgba(249,115,22,0.70); }
        }

        /* Outer ring around the CTA button expands and fades */
        @keyframes ring-pulse {
          0%   { box-shadow: 0 0 0 0px  rgba(249,115,22,0.50); }
          70%  { box-shadow: 0 0 0 18px rgba(249,115,22,0.00); }
          100% { box-shadow: 0 0 0 0px  rgba(249,115,22,0.00); }
        }

        /* Cards + content slide up + fade in on page load */
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>
    </div>
  );
}
