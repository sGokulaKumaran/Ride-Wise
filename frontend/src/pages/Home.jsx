// ============================================================
// 🏠 Home Page — Main entry point for the homepage
// Combines all home components + global state (theme, voice, mouse)
// ============================================================

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import Navbar from "./components/home/Navbar";
import Hero from "./components/home/Hero";
import TrendingVideos from "./components/home/TrendingVideos";
import ExploreBikes from "./components/home/ExploreBikes";
import PopularRides from "./components/home/PopularRides";
import FeaturedVideo from "./components/home/FeaturedVideo";
import RiderEssentials from "./components/home/RiderEssentials";
import LiveRides from "./components/home/LiveRides";
import RideStories from "./components/home/RideStories";
import Footer from "./components/home/Footer";

import { useTheme } from "./hooks/useTheme";
import { useVoice } from "./components/shared/useVoice";

export default function Home() {
  const navigate = useNavigate();
  const { theme, setTheme, tc } = useTheme();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const trailRef = useRef([]);

  // Helper: scroll to any section by ID
  const scrollToSection = (id) => {
    if (id === "top") return window.scrollTo({ top: 0, behavior: "smooth" });
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Mouse tracking for glow effect + cursor trail
  useEffect(() => {
    const handler = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      trailRef.current.push({ x: e.clientX, y: e.clientY, id: Date.now() });
      if (trailRef.current.length > 10) trailRef.current.shift();
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  // Clear trail periodically for smooth fade effect
  useEffect(() => {
    const interval = setInterval(() => { trailRef.current = []; }, 100);
    return () => clearInterval(interval);
  }, []);

  // 🎤 Voice commands — each entry maps to multiple keywords
  const voiceCommands = {
    darkTheme:     [() => setTheme("dark"),     ["dark", "night", "black"]],
    lightTheme:    [() => setTheme("light"),    ["light", "day", "bright", "white"]],
    warmTheme:     [() => setTheme("warm"),     ["warm", "orange", "sunset", "sunrise"]],
    midnightTheme: [() => setTheme("midnight"), ["midnight", "purple", "galaxy", "space"]],
    goHome:        [() => navigate("/"),         ["home", "landing"]],
    goLogin:       [() => navigate("/login"),    ["login", "sign in"]],
    goBikes:       [() => scrollToSection("bikes"),    ["bike", "bikes", "explore"]],
    goTrending:    [() => scrollToSection("trending"), ["trending", "videos"]],
    goRides:       [() => scrollToSection("rides"),    ["ride", "rides", "routes"]],
    goLive:        [() => scrollToSection("live"),     ["live", "streaming"]],
    goShop:        [() => scrollToSection("shop"),     ["shop", "essentials", "products", "buy"]],
  };

  // Build commands object for useVoice hook
  const commandsMap = {};
  Object.entries(voiceCommands).forEach(([key, [fn, keywords]]) => {
    keywords.forEach((kw) => {
      commandsMap[kw] = fn;
    });
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
              opacity: i / 10,
              filter: "blur(1px)",
            }}
          />
        ))}
      </div>

      {/* 🌟 Mouse-following Glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `radial-gradient(circle 600px at ${mousePos.x}px ${mousePos.y}px, ${tc.glow}, transparent 40%)`,
        }}
      />

      {/* 🧭 Navigation */}
      <Navbar 
        theme={theme}
        setTheme={setTheme}
        tc={tc}
        voiceMode={voiceMode}
        startVoice={startVoice}
      />

      {/* Spacer for fixed navbar */}
      <div className="h-28 md:h-24"></div>

      {/* 📄 Page Sections */}
      <Hero tc={tc} scrollToSection={scrollToSection} />
      <TrendingVideos tc={tc} />
      <ExploreBikes tc={tc} />
      <PopularRides tc={tc} />
      <FeaturedVideo tc={tc} />
      <RiderEssentials tc={tc} />
      <LiveRides tc={tc} />
      <RideStories tc={tc} />
      <Footer tc={tc} />
    </div>
  );
}
