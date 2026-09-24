import { useState, useEffect } from "react";

export const themes = {
  // Each theme is a bundle of Tailwind classes
  dark: {
    bg: "bg-black",                          // Page background
    text: "text-white",                      // Main text color
    sub: "text-gray-400",                    // Secondary text
    card: "bg-white/5 border-white/10 text-white",  // Card styling
    input: "bg-white/5 border-white/15 text-white placeholder-gray-500",
    button: "bg-white text-black",           // Primary buttons
    record: "bg-white/10 border border-white/20",
    glow: "rgba(255,255,255,0.15)",          // For mouse glow effects
    particle: "bg-white",                    // Floating particles
    accent: "from-white to-gray-400",        // Gradient text
    divider: "border-white/10",
    badge: "bg-gradient-to-r from-orange-500 to-pink-500 text-white",
    cardHover: "hover:bg-white/10",
    bar: "bg-black/60",                          // TopBar / Sidebar / MobileNav surface
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
    bar: "bg-white/80",
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
    bar: "bg-white/60",
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
    bar: "bg-black/50",
  },
};

// ── Build a per-user localStorage key ──────────────────────────
// When userId is available the key is "ridewise-theme-<id>".
// When not logged in (userId is null/undefined) we fall back to
// the legacy global key so the login page still has a theme.
function themeKey(userId) {
  return userId ? `ridewise-theme-${userId}` : "ridewise-theme";
}

// ── Auto-detect theme by time of day ───────────────────────────
function detectThemeByTime() {
  const hour = new Date().getHours();
  if (hour >= 6  && hour < 12) return "warm";
  if (hour >= 12 && hour < 18) return "light";
  if (hour >= 18 && hour < 22) return "dark";
  return "midnight";
}

// ── Resolve the theme that should apply right now ────────────────
// Priority: 1. per-user saved choice  2. login-page (global) choice
//           3. auto-detect by time of day
// Both the first render AND the userId effect use this one helper, so
// every page resolves the SAME theme — admin panel and onboarding too.
function resolveTheme(userId) {
  try {
    // 1. Try the per-user key first
    if (userId) {
      const perUser = localStorage.getItem(themeKey(userId));
      if (perUser && themes[perUser]) return perUser;
    }
    // 2. Fall back to the legacy global key (login-page pick / old data)
    const legacy = localStorage.getItem("ridewise-theme");
    if (legacy && themes[legacy]) return legacy;
  } catch (_) {}
  // 3. Nothing saved yet → auto-detect by time
  return detectThemeByTime();
}

// ── useTheme hook ───────────────────────────────────────────────
// userId  — pass user?.id so the theme is scoped per account.
//           Omit (or pass null) on public pages.
export function useTheme(userId) {
  // First render: resolve immediately so there is no theme flash
  const [theme, setThemeState] = useState(() => resolveTheme(userId));

  // Re-resolve whenever userId changes — switching accounts loads that
  // account's saved theme right away. A saved choice always wins; only
  // a brand-new user with nothing stored falls back to the clock.
  useEffect(() => {
    setThemeState(resolveTheme(userId));
  }, [userId]);

  // Persist theme under the per-user key whenever it changes
  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(themeKey(userId), newTheme);
    } catch (_) {}
  };

  return { theme, setTheme, tc: themes[theme], allThemes: themes };
  // tc = "theme classes" — the bundle for current theme
}