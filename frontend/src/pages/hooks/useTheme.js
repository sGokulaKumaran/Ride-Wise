import { useState, useEffect } from "react";

// ============================================================
// RideWise theme tokens
//
// Every theme exposes EXACTLY the same keys, so one design system
// works in all four. Rules the whole UI follows:
//   · surfaces and text are monochrome (no brand gradients anywhere)
//   · one functional accent (RideWise amber) for primary ride actions,
//     active selection and map recenter
//   · one functional danger tone, one ok tone, one warn tone
//   · borders are hairlines; shadows are reserved for floating
//     controls that sit on top of the map
//
// Token groups:  page → container → chrome → form → buttons → nav →
//                accent/status → chips → map → decoration
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
    bar: "bg-[#0B0B0C]/85",                                // sidebar / topbar
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
    accentSoft: "bg-[#FF7A1A]/12 border-[#FF7A1A]/35 text-[#FF9A4D]",
    danger:     "text-[#FF7B7B]",
    dangerSoft: "bg-[#FF7B7B]/12 border-[#FF7B7B]/35 text-[#FF9A9A]",
    ok:         "text-[#5DD98A]",
    warn:       "text-[#FFC24D]",

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
    bar: "bg-white/85",
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
    dangerSoft: "bg-[#C23434]/8 border-[#C23434]/30 text-[#A82C2C]",
    ok:         "text-[#1F7A4D]",
    warn:       "text-[#8A5A00]",

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
    bar: "bg-[#FBF6F0]/88",
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
    warn:       "text-[#8A5A00]",

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
    bar: "bg-[#0A0B14]/88",
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
    accentSoft: "bg-[#FF7A1A]/14 border-[#FF7A1A]/35 text-[#FFAE6E]",
    danger:     "text-[#FF8A8A]",
    dangerSoft: "bg-[#FF8A8A]/12 border-[#FF8A8A]/35 text-[#FFA3A3]",
    ok:         "text-[#6ED9A0]",
    warn:       "text-[#FFC96B]",

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