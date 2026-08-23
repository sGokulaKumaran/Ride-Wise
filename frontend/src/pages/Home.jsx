// ============================================================
// 🏠 Home — Main feed page
// Layout: [Sidebar] [TopBar + Feed] [Suggestions]
// Mobile: [TopBar] [Feed] [Bottom Nav]
// ============================================================

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../hooks/useTheme";
import { useVoice } from "../components/shared/useVoice";
import Sidebar from "../components/layout/Sidebar";
import TopBar from "../components/layout/TopBar";
import MobileNav from "../components/layout/MobileNav";
import Feed from "../components/feed/Feed";
import Suggestions from "../components/feed/Suggestions";

export default function Home() {
  const navigate = useNavigate();
  const { theme, setTheme, tc } = useTheme();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const trailRef = useRef([]);

  // Mouse tracking for glow + trail
  useEffect(() => {
    const handler = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      trailRef.current.push({ x: e.clientX, y: e.clientY, id: Date.now() });
      if (trailRef.current.length > 8) trailRef.current.shift();
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => { trailRef.current = []; }, 100);
    return () => clearInterval(interval);
  }, []);

  // Voice commands
  const commandsMap = {
    dark:        () => setTheme("dark"),
    light:       () => setTheme("light"),
    warm:        () => setTheme("warm"),
    midnight:    () => setTheme("midnight"),
    home:        () => window.scrollTo({ top: 0, behavior: "smooth" }),
    marketplace: () => navigate("/marketplace"),
    live:        () => navigate("/live"),
    messages:    () => navigate("/messages"),
  };

  const { voiceMode, startVoice } = useVoice(commandsMap);

  return (
    <div
      className={`relative min-h-screen w-full overflow-x-hidden transition-all duration-1000 ${tc.bg} ${tc.text}`}
    >
      {/* Cursor trail */}
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

      {/* Mouse glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle 500px at ${mousePos.x}px ${mousePos.y}px, ${tc.glow}, transparent 40%)`,
        }}
      />

      <Sidebar tc={tc} />
      <TopBar
        theme={theme}
        setTheme={setTheme}
        tc={tc}
        voiceMode={voiceMode}
        startVoice={startVoice}
      />
      <Suggestions tc={tc} />

      {/* Main feed */}
      <main className="lg:ml-64 xl:mr-80 pt-16 pb-20 lg:pb-0 relative z-10">
        <Feed tc={tc} />
      </main>

      <MobileNav tc={tc} />
    </div>
  );
}
