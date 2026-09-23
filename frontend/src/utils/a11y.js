// ============================================================
// ♿ a11y.js — Applies Settings → Accessibility choices app-wide
//
// Settings.jsx persists { textSize, reduceMotion, highContrast }
// per user in localStorage. This module applies them to the
// <html> element so they take effect on EVERY page:
//
//   textSize      → root font-size (Tailwind is rem-based, so the
//                   whole UI scales: small=14px, medium=16px, large=18px)
//   reduceMotion  → html.rw-reduce-motion  (kills animations in index.css)
//   highContrast  → html.rw-high-contrast  (stronger text/borders/cards)
//
// Used by:
//   App.jsx      — re-applies saved settings on app load / user switch
//   Settings.jsx — applies immediately when a toggle changes
// ============================================================

const TEXT_SIZES = { small: "14px", medium: "16px", large: "18px" };

export function applyA11ySettings(settings) {
  if (typeof document === "undefined" || !settings) return;
  const root = document.documentElement;
  root.style.fontSize = TEXT_SIZES[settings.textSize] || TEXT_SIZES.medium;
  root.classList.toggle("rw-reduce-motion", Boolean(settings.reduceMotion));
  root.classList.toggle("rw-high-contrast", Boolean(settings.highContrast));
}

// Load the saved settings object for a user (null if none saved yet)
export function loadA11ySettings(userId) {
  try {
    const key = userId ? `ridewise-settings-${userId}` : "ridewise-settings";
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch { /* storage unavailable or bad JSON */ }
  return null;
}
