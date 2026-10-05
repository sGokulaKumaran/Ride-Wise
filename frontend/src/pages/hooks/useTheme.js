import { useCallback, useEffect, useSyncExternalStore } from "react";

// ============================================================
// RideWise theme tokens
//
// Every theme exposes EXACTLY the same keys, so one design system
// works in all four. Rules the whole UI follows:
//   · surfaces and text are monochrome (no brand gradients anywhere)
//   · one functional accent (RideWise amber) for primary ride actions,
//     active selection and map recenter
//   · one functional danger tone, one ok tone, one warn tone, and one
//     "rejoin" tone that matches the purple rejoin line on the map
//   · borders are hairlines; shadows are reserved for floating
//     controls that sit on top of the map
//
// Token groups:  page → container → chrome → form → buttons → nav →
//                accent/status → chips → map → decoration
//
// OPACITY NOTE
//   Tailwind only generates `/NN` opacity steps that exist in its scale
//   (multiples of 5). A value such as `/12` or `/88` produces NO CSS at
//   all — which silently left the Warm and Midnight top bars transparent
//   and the "soft" status surfaces without their tint. Every off-scale
//   opacity below therefore uses the explicit `/[0.12]` form.
// ============================================================
export const themes = {
  // ── DARK · neutral black, light ink ─────────────────────────
  dark: {
    label: "Dark", icon: "moon", isDark: true, isLight: false,

    bg: "bg-[#0B0B0C]",                                    // page background
    text: "text-[#F4F4F5]",                                // primary text
    sub: "text-[#A1A1AA]",                                 // secondary text

    card: "bg-[#141416] border-[#26262B]",                 // container surface
    cardHover: "hover:bg-[#1C1C20]",
    surface2: "bg-[#1A1A1E]",                              // raised row inside a card
    divider: "border-[#26262B]",                           // hairline
    bar: "bg-[#0B0B0C]",                                   // sidebar / topbar / bottom nav — opaque, so
                                                           // scrolled content never shows through it
    overlay: "bg-black/70",                                // scrim behind sheets

    input: "bg-[#141416] border-[#26262B] text-[#F4F4F5] placeholder-[#71717A] focus:border-[#3F3F46]",

    btnPrimary:   "bg-[#F4F4F5] text-[#0B0B0C] border-[#F4F4F5] hover:bg-white",
    btnAccent:    "bg-[#FF7A1A] text-[#141416] border-[#FF7A1A] hover:bg-[#FF8A34]",
    btnSecondary: "bg-transparent text-[#F4F4F5] border-[#3F3F46] hover:bg-white/[0.06]",
    btnGhost:     "bg-transparent text-[#A1A1AA] border-transparent hover:bg-white/[0.06] hover:text-[#F4F4F5]",
    btnSoft:      "bg-white/[0.08] text-[#F4F4F5] border-transparent hover:bg-white/[0.14]",
    btnDanger:    "bg-transparent text-[#FF7B7B] border-[#FF7B7B]/40 hover:bg-[#FF7B7B]/10",
    button:       "bg-[#F4F4F5] text-[#0B0B0C] border-[#F4F4F5] hover:bg-white", // legacy alias of btnPrimary

    navActive: "bg-white/[0.08] text-[#F4F4F5]",
    navIdle:   "text-[#A1A1AA] hover:bg-white/[0.05] hover:text-[#F4F4F5]",

    record: "bg-white/[0.05] border-[#26262B]",            // soft translucent panel

    accent:     "text-[#FF8A34]",                          // accent ink
    accentSoft: "bg-[#FF7A1A]/[0.12] border-[#FF7A1A]/35 text-[#FF9A4D]",
    danger:     "text-[#FF7B7B]",
    dangerSoft: "bg-[#FF7B7B]/[0.12] border-[#FF7B7B]/35 text-[#FF9A9A]",
    ok:         "text-[#5DD98A]",
    okSoft:     "bg-[#5DD98A]/[0.12] border-[#5DD98A]/35 text-[#7CE3A1]",
    warn:       "text-[#FFC24D]",
    warnSoft:   "bg-[#FFC24D]/[0.12] border-[#FFC24D]/35 text-[#FFD27A]",
    rejoinSoft: "bg-[#8B5CF6]/[0.16] border-[#8B5CF6]/40 text-[#B7A1FF]", // off-route / rejoin state

    chipIdle:     "bg-transparent text-[#A1A1AA] border-[#26262B] hover:bg-white/[0.06] hover:text-[#F4F4F5]",
    chipSelected: "bg-[#F4F4F5] text-[#0B0B0C] border-[#F4F4F5]",

    mapControl: "bg-[#141416]/95 text-[#F4F4F5] border-[#26262B] shadow-sm",

    // ── Shared chrome: ride cards, stacked rider avatars, small tiles ──
    // These exist so no component has to hardcode a colour that only works
    // in one theme (a dark ring on a light card, a white "+2" on a white
    // background, a black tile on a black page…).
    hairline:   "bg-[#26262B]",                        // 1px divider line (not a border)
    inkTile:    "bg-[#F4F4F5] text-[#0B0B0C]",         // chunky icon tile — ink inverts with theme
    avatarRing: "border-[#141416]",                    // ring colour = the card it sits on
    avatarMore: "bg-white/10 text-[#F4F4F5] border-[#141416]",  // the "+N" overflow circle
    groupBadge: "bg-[#8B5CF6]/15 border-[#8B5CF6]/30 text-[#A78BFA]", // "Group" pill

    glow: "rgba(255,255,255,0.06)",                        // mouse glow (login)
    particle: "bg-white",                                  // floating dots (login)

    // Swatch shown in the theme picker (Settings / Login)
    preview: {
      page: "bg-[#0B0B0C]", surface: "bg-[#141416]",
      ink: "bg-[#F4F4F5]", accent: "bg-[#FF7A1A]",
    },
  },
  // ── LIGHT · soft paper, dark ink ────────────────────────────
  light: {
    label: "Light", icon: "sun", isDark: false, isLight: true,

    bg: "bg-[#FAFAFA]",
    text: "text-[#111113]",
    sub: "text-[#6B6B72]",

    card: "bg-white border-[#E4E4E7]",
    cardHover: "hover:bg-[#F4F4F5]",
    surface2: "bg-[#F4F4F5]",
    divider: "border-[#E4E4E7]",
    bar: "bg-white",
    overlay: "bg-black/40",

    input: "bg-white border-[#D9D9DE] text-[#111113] placeholder-[#9A9AA1] focus:border-[#A1A1AA]",

    btnPrimary:   "bg-[#111113] text-white border-[#111113] hover:bg-[#2A2A2F]",
    btnAccent:    "bg-[#F2690C] text-white border-[#F2690C] hover:bg-[#FF7A1A]",
    btnSecondary: "bg-transparent text-[#111113] border-[#CFCFD4] hover:bg-black/[0.04]",
    btnGhost:     "bg-transparent text-[#6B6B72] border-transparent hover:bg-black/[0.05] hover:text-[#111113]",
    btnSoft:      "bg-black/[0.06] text-[#111113] border-transparent hover:bg-black/[0.1]",
    btnDanger:    "bg-transparent text-[#C23434] border-[#C23434]/35 hover:bg-[#C23434]/10",
    button:       "bg-[#111113] text-white border-[#111113] hover:bg-[#2A2A2F]",

    navActive: "bg-black/[0.06] text-[#111113]",
    navIdle:   "text-[#6B6B72] hover:bg-black/[0.04] hover:text-[#111113]",

    record: "bg-black/[0.04] border-[#E4E4E7]",

    accent:     "text-[#B4500A]",
    accentSoft: "bg-[#F2690C]/10 border-[#F2690C]/30 text-[#9E4408]",
    danger:     "text-[#C23434]",
    dangerSoft: "bg-[#C23434]/[0.08] border-[#C23434]/30 text-[#A82C2C]",
    ok:         "text-[#1F7A4D]",
    okSoft:     "bg-[#1F7A4D]/[0.08] border-[#1F7A4D]/30 text-[#1B6B43]",
    warn:       "text-[#8A5A00]",
    warnSoft:   "bg-[#B97800]/10 border-[#B97800]/30 text-[#7A4F00]",
    rejoinSoft: "bg-[#8B5CF6]/10 border-[#8B5CF6]/30 text-[#5B21B6]",

    chipIdle:     "bg-transparent text-[#6B6B72] border-[#D9D9DE] hover:bg-black/[0.04] hover:text-[#111113]",
    chipSelected: "bg-[#111113] text-white border-[#111113]",

    mapControl: "bg-white/95 text-[#111113] border-[#E4E4E7] shadow-sm",

    // ── Shared chrome (see the Dark theme for what each token is for) ──
    hairline:   "bg-[#E4E4E7]",
    inkTile:    "bg-[#111113] text-white",
    avatarRing: "border-white",
    avatarMore: "bg-black/[0.06] text-[#111113] border-white",
    groupBadge: "bg-[#8B5CF6]/10 border-[#8B5CF6]/25 text-[#6D28D9]",

    glow: "rgba(0,0,0,0.05)",
    particle: "bg-black/40",

    preview: {
      page: "bg-[#FAFAFA]", surface: "bg-white",
      ink: "bg-[#111113]",  accent: "bg-[#F2690C]",
    },
  },
  // ── WARM · warm paper, warm ink (no orange wash) ────────────
  warm: {
    label: "Warm", icon: "sunCloud", isDark: false, isLight: true,

    bg: "bg-[#FBF6F0]",
    text: "text-[#241C15]",
    sub: "text-[#7C6A58]",

    card: "bg-white border-[#EADFD2]",
    cardHover: "hover:bg-[#F7F0E7]",
    surface2: "bg-[#F7F0E7]",
    divider: "border-[#EADFD2]",
    bar: "bg-[#FBF6F0]",
    overlay: "bg-[#3B2E22]/45",

    input: "bg-white border-[#DFD1C0] text-[#241C15] placeholder-[#A79383] focus:border-[#B9A490]",

    btnPrimary:   "bg-[#2A211A] text-[#FDF8F3] border-[#2A211A] hover:bg-[#3B2E24]",
    btnAccent:    "bg-[#C2560A] text-white border-[#C2560A] hover:bg-[#D2640F]",
    btnSecondary: "bg-transparent text-[#241C15] border-[#D5C6B4] hover:bg-[#2A211A]/[0.05]",
    btnGhost:     "bg-transparent text-[#7C6A58] border-transparent hover:bg-[#2A211A]/[0.06] hover:text-[#241C15]",
    btnSoft:      "bg-[#2A211A]/[0.07] text-[#241C15] border-transparent hover:bg-[#2A211A]/[0.12]",
    btnDanger:    "bg-transparent text-[#A8402C] border-[#A8402C]/35 hover:bg-[#A8402C]/10",
    button:       "bg-[#2A211A] text-[#FDF8F3] border-[#2A211A] hover:bg-[#3B2E24]",

    navActive: "bg-[#2A211A]/[0.07] text-[#241C15]",
    navIdle:   "text-[#7C6A58] hover:bg-[#2A211A]/[0.05] hover:text-[#241C15]",

    record: "bg-[#2A211A]/[0.05] border-[#EADFD2]",

    accent:     "text-[#B4500A]",
    accentSoft: "bg-[#C2560A]/10 border-[#C2560A]/30 text-[#9E4408]",
    danger:     "text-[#A8402C]",
    dangerSoft: "bg-[#A8402C]/10 border-[#A8402C]/30 text-[#93361F]",
    ok:         "text-[#3F6B3A]",
    okSoft:     "bg-[#3F6B3A]/10 border-[#3F6B3A]/30 text-[#35592F]",
    warn:       "text-[#8A5A00]",
    warnSoft:   "bg-[#B97800]/10 border-[#B97800]/30 text-[#7A4F00]",
    rejoinSoft: "bg-[#8B5CF6]/10 border-[#8B5CF6]/30 text-[#5B21B6]",

    chipIdle:     "bg-transparent text-[#7C6A58] border-[#DFD1C0] hover:bg-[#2A211A]/[0.05] hover:text-[#241C15]",
    chipSelected: "bg-[#2A211A] text-[#FDF8F3] border-[#2A211A]",

    mapControl: "bg-white/95 text-[#241C15] border-[#EADFD2] shadow-sm",

    // ── Shared chrome (see the Dark theme for what each token is for) ──
    hairline:   "bg-[#EADFD2]",
    inkTile:    "bg-[#2A211A] text-[#FDF8F3]",
    avatarRing: "border-white",
    avatarMore: "bg-[#2A211A]/[0.08] text-[#241C15] border-white",
    groupBadge: "bg-[#8B5CF6]/10 border-[#8B5CF6]/25 text-[#6D28D9]",

    glow: "rgba(180,120,60,0.10)",
    particle: "bg-[#B4500A]/50",

    preview: {
      page: "bg-[#FBF6F0]", surface: "bg-white",
      ink: "bg-[#2A211A]",  accent: "bg-[#C2560A]",
    },
  },
  // ── MIDNIGHT · deep cool slate, cool ink ────────────────────
  midnight: {
    label: "Midnight", icon: "moonStars", isDark: true, isLight: false,

    bg: "bg-[#0A0B14]",
    text: "text-[#E7E9F5]",
    sub: "text-[#9AA0C0]",

    card: "bg-[#131627] border-[#252A45]",
    cardHover: "hover:bg-[#1A1E33]",
    surface2: "bg-[#181C2E]",
    divider: "border-[#252A45]",
    bar: "bg-[#0A0B14]",
    overlay: "bg-[#05060C]/75",

    input: "bg-[#131627] border-[#252A45] text-[#E7E9F5] placeholder-[#707A9E] focus:border-[#3A416B]",

    btnPrimary:   "bg-[#E7E9F5] text-[#0A0B14] border-[#E7E9F5] hover:bg-white",
    btnAccent:    "bg-[#FF7A1A] text-[#0A0B14] border-[#FF7A1A] hover:bg-[#FF8A34]",
    btnSecondary: "bg-transparent text-[#E7E9F5] border-[#3A416B] hover:bg-white/[0.06]",
    btnGhost:     "bg-transparent text-[#9AA0C0] border-transparent hover:bg-white/[0.06] hover:text-[#E7E9F5]",
    btnSoft:      "bg-white/[0.08] text-[#E7E9F5] border-transparent hover:bg-white/[0.14]",
    btnDanger:    "bg-transparent text-[#FF8A8A] border-[#FF8A8A]/40 hover:bg-[#FF8A8A]/10",
    button:       "bg-[#E7E9F5] text-[#0A0B14] border-[#E7E9F5] hover:bg-white",

    navActive: "bg-white/[0.08] text-[#E7E9F5]",
    navIdle:   "text-[#9AA0C0] hover:bg-white/[0.05] hover:text-[#E7E9F5]",

    record: "bg-white/[0.05] border-[#252A45]",

    accent:     "text-[#FF9A4D]",
    accentSoft: "bg-[#FF7A1A]/[0.14] border-[#FF7A1A]/35 text-[#FFAE6E]",
    danger:     "text-[#FF8A8A]",
    dangerSoft: "bg-[#FF8A8A]/[0.12] border-[#FF8A8A]/35 text-[#FFA3A3]",
    ok:         "text-[#6ED9A0]",
    okSoft:     "bg-[#6ED9A0]/[0.12] border-[#6ED9A0]/35 text-[#8FE4B6]",
    warn:       "text-[#FFC96B]",
    warnSoft:   "bg-[#FFC96B]/[0.12] border-[#FFC96B]/35 text-[#FFD68F]",
    rejoinSoft: "bg-[#8B5CF6]/[0.18] border-[#8B5CF6]/40 text-[#C1AEFF]",

    chipIdle:     "bg-transparent text-[#9AA0C0] border-[#252A45] hover:bg-white/[0.06] hover:text-[#E7E9F5]",
    chipSelected: "bg-[#E7E9F5] text-[#0A0B14] border-[#E7E9F5]",

    mapControl: "bg-[#131627]/95 text-[#E7E9F5] border-[#252A45] shadow-sm",

    // ── Shared chrome (see the Dark theme for what each token is for) ──
    hairline:   "bg-[#252A45]",
    inkTile:    "bg-[#E7E9F5] text-[#0A0B14]",
    avatarRing: "border-[#131627]",
    avatarMore: "bg-white/10 text-[#E7E9F5] border-[#131627]",
    groupBadge: "bg-[#8B5CF6]/15 border-[#8B5CF6]/30 text-[#B4A0FF]",

    glow: "rgba(120,140,255,0.10)",
    particle: "bg-[#9AA0C0]",

    preview: {
      page: "bg-[#0A0B14]", surface: "bg-[#131627]",
      ink: "bg-[#E7E9F5]",  accent: "bg-[#FF7A1A]",
    },
  },
};

// Browser chrome colour (address bar on phones) for each theme
const PAGE_COLOR = { dark: "#0B0B0C", light: "#FAFAFA", warm: "#FBF6F0", midnight: "#0A0B14" };

// ── Per-user localStorage key ──────────────────────────────────
// "ridewise-theme-<id>" when logged in; the global "ridewise-theme"
// otherwise, so the login page has a theme too.
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
function resolveTheme(userId) {
  // A choice made while storage is unavailable still applies for this visit
  const remembered = unsaved.get(themeKey(userId));
  if (remembered) return remembered;
  try {
    if (userId) {
      const perUser = localStorage.getItem(themeKey(userId));
      if (perUser && themes[perUser]) return perUser;
    }
    const global = localStorage.getItem("ridewise-theme");
    if (global && themes[global]) return global;
  } catch {
    // storage unavailable (private mode) → fall through to auto-detect
  }
  return detectThemeByTime();
}

// Choices that could not be written to localStorage (key → theme)
const unsaved = new Map();

// ── One shared theme store ───────────────────────────────────────
// useTheme() is called by many components at once (the page, the toast
// host, the route guards, the ride overlay…). Each used to keep its OWN
// copy of the theme in useState, so changing the theme in the top bar
// left the others on the old one until a reload — toasts stayed dark
// after switching to Light. All of them now read one store and are
// notified together. The `storage` event keeps other tabs in sync too.
const listeners = new Set();

function subscribe(listener) {
  listeners.add(listener);
  const onStorage = (event) => {
    if (!event.key || event.key.startsWith("ridewise-theme")) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function notify() {
  listeners.forEach((listener) => listener());
}

// ── useTheme hook ───────────────────────────────────────────────
// userId  — pass user?.id so the theme is scoped per account.
//           Omit (or pass null) on public pages.
export function useTheme(userId) {
  const theme = useSyncExternalStore(
    subscribe,
    () => resolveTheme(userId),
    () => "dark",
  );

  const setTheme = useCallback((next) => {
    if (!themes[next]) return;
    try {
      localStorage.setItem(themeKey(userId), next);
      // Also remember it as this DEVICE's theme. The login page — and the
      // first moment of every app start, before the account is known —
      // then use what the rider last chose instead of flashing another
      // theme and switching a moment later.
      if (userId) localStorage.setItem("ridewise-theme", next);
      unsaved.delete(themeKey(userId));
    } catch {
      unsaved.set(themeKey(userId), next); // lasts for this visit only
    }
    notify();
  }, [userId]);

  // Tell the browser which scheme is active, so native pieces (scrollbars,
  // form controls, the phone's address bar) match the theme as well.
  useEffect(() => {
    const root = document.documentElement;
    root.style.colorScheme = themes[theme].isDark ? "dark" : "light";
    root.dataset.rwTheme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", PAGE_COLOR[theme]);
  }, [theme]);

  return { theme, setTheme, tc: themes[theme], allThemes: themes };
  // tc = "theme classes" — the bundle for the current theme
}
