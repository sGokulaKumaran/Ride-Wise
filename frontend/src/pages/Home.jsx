// ============================================================
// 🏠 Home Page — Modern Feed-based Layout
// Layout: [Sidebar] [Top Bar + Feed] [Suggestions]
// Mobile:  [Top Bar] [Feed] [Bottom Nav]
// ============================================================

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { useTheme } from "./hooks/useTheme";
import { useVoice } from "./components/shared/useVoice";

import Sidebar from "./components/layout/Sidebar";
import TopBar from "./components/layout/TopBar";
import MobileNav from "./components/layout/MobileNav";
import Feed from "./components/feed/Feed";
import Suggestions from "./components/feed/Suggestions";

export default function Home() {
  const navigate = useNavigate();
  const { theme, setTheme, tc } = useTheme();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const trailRef = useRef([]);

  // Mouse tracking for glow effect + cursor trail
  useEffect(() => {
    const handler = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      trailRef.current.push({ x: e.clientX, y: e.clientY, id: Date.now() });
      if (trailRef.current.length > 8) trailRef.current.shift();
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  // Clear trail periodically
  useEffect(() => {
    const interval = setInterval(() => { trailRef.current = []; }, 100);
    return () => clearInterval(interval);
  }, []);

  // 🎤 Voice commands — keywords mapped to actions
  const voiceCommands = {
    darkTheme:     [() => setTheme("dark"),     ["dark", "night", "black"]],
    lightTheme:    [() => setTheme("light"),    ["light", "day", "bright", "white"]],
    warmTheme:     [() => setTheme("warm"),     ["warm", "orange", "sunset", "sunrise"]],
    midnightTheme: [() => setTheme("midnight"), ["midnight", "purple", "galaxy", "space"]],
    goHome:        [() => navigate("/"),        ["home", "landing"]],
    goTop:         [() => window.scrollTo({ top: 0, behavior: "smooth" }), ["top", "scroll up"]],
    goExplore:     [() => document.getElementById("explore")?.scrollIntoView({ behavior: "smooth" }), ["explore", "feed"]],
    goShop:        [() => document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" }), ["shop", "marketplace", "buy"]],
  };

  // Build flat commands map for useVoice
  const commandsMap = {};
  Object.entries(voiceCommands).forEach(([, [fn, keywords]]) => {
    keywords.forEach((kw) => { commandsMap[kw] = fn; });
  });

  const { voiceMode, startVoice } = useVoice(commandsMap);

  return (
    <div className={`relative min-h-screen w-full overflow-x-hidden transition-all duration-1000 ${tc.bg} ${tc.text}`}>

      {/* 🎨 Cursor Trail Effect */}
      <div className="fixed inset-0 pointer-events-none z-[60]">
        {trailRef.current.map((p, i) => (
          <div
            key={p.id}
            className={`absolute rounded-full ${tc.particle}`}
            style={{
              left: p.x - 3,
              top: p.y - 3,
              width: 6,
              height: 6,
              opacity: i / 8,
              filter: "blur(1px)",
            }}
          />
        ))}
      </div>

      {/* 🌟 Mouse-following Glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle 500px at ${mousePos.x}px ${mousePos.y}px, ${tc.glow}, transparent 40%)`,
        }}
      />

      {/* Left Sidebar (Desktop only) */}
      <Sidebar tc={tc} />

      {/* Top Bar (YouTube-style) */}
      <TopBar
        theme={theme}
        setTheme={setTheme}
        tc={tc}
        voiceMode={voiceMode}
        startVoice={startVoice}
      />

      {/* Right Sidebar Suggestions (Desktop only) */}
      <Suggestions tc={tc} />

      {/* Main Content Area - Feed
          lg:ml-64  → push right of left sidebar
          xl:mr-80  → push left of right sidebar
          pt-16     → clear the fixed top bar
          pb-20 lg:pb-0 → clear bottom nav on mobile
      */}
      <main className="lg:ml-64 xl:mr-80 pt-16 pb-20 lg:pb-0 relative z-10">
        <Feed tc={tc} />
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileNav tc={tc} />
    </div>
  );
}
