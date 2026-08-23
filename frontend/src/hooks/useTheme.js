// ============================================================
// 🎨 useTheme HOOK — Centralized theme management
// Handles: time-based auto-detection, manual switching, persistence
// ============================================================

import { useState, useEffect } from "react";

export const themes = {
  dark: {
    bg: "bg-black",
    text: "text-white",
    sub: "text-gray-400",
    card: "bg-white/5 border-white/10 text-white",
    input: "bg-white/5 border-white/15 text-white placeholder-gray-500",
    button: "bg-white text-black",
    record: "bg-white/10 border border-white/20",
    glow: "rgba(255,255,255,0.15)",
    particle: "bg-white",
    accent: "from-white to-gray-400",
    divider: "border-white/10",
    badge: "bg-gradient-to-r from-orange-500 to-pink-500 text-white",
    cardHover: "hover:bg-white/10",
  },
  light: {
    bg: "bg-gray-50",
    text: "text-black",
    sub: "text-gray-500",
    card: "bg-white border-gray-200 shadow-xl text-black",
    input: "bg-gray-50 border-gray-300 text-black placeholder-gray-400",
    button: "bg-black text-white",
    record: "bg-gray-200 border border-gray-300",
    glow: "rgba(0,0,0,0.08)",
    particle: "bg-black",
    accent: "from-black to-gray-500",
    divider: "border-gray-200",
    badge: "bg-gradient-to-r from-orange-500 to-pink-500 text-white",
    cardHover: "hover:bg-gray-100",
  },
  warm: {
    bg: "bg-gradient-to-br from-orange-50 via-rose-50 to-amber-50",
    text: "text-orange-950",
    sub: "text-orange-700",
    card: "bg-white/60 backdrop-blur-xl border-orange-200 shadow-xl text-orange-950",
    input: "bg-white/70 border-orange-200 text-orange-950 placeholder-orange-300",
    button: "bg-gradient-to-r from-orange-500 to-rose-500 text-white",
    record: "bg-orange-100 border border-orange-300",
    glow: "rgba(251,146,60,0.2)",
    particle: "bg-orange-500",
    accent: "from-orange-500 to-rose-500",
    divider: "border-orange-200",
    badge: "bg-gradient-to-r from-orange-500 to-rose-500 text-white",
    cardHover: "hover:bg-orange-50",
  },
  midnight: {
    bg: "bg-gradient-to-br from-indigo-950 via-purple-950 to-black",
    text: "text-white",
    sub: "text-purple-300",
    card: "bg-white/5 border-purple-500/20 text-white",
    input: "bg-white/5 border-purple-400/20 text-white placeholder-purple-400",
    button: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
    record: "bg-purple-500/20 border border-purple-400/40",
    glow: "rgba(168,85,247,0.25)",
    particle: "bg-purple-400",
    accent: "from-purple-400 to-pink-400",
    divider: "border-purple-500/20",
    badge: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
    cardHover: "hover:bg-purple-500/10",
  },
};

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("ridewise-theme");
    if (saved && themes[saved]) return saved;
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return "warm";
    if (hour >= 12 && hour < 18) return "light";
    if (hour >= 18 && hour < 22) return "dark";
    return "midnight";
  });

  useEffect(() => {
    localStorage.setItem("ridewise-theme", theme);
  }, [theme]);

  return { theme, setTheme, tc: themes[theme], allThemes: themes };
}
