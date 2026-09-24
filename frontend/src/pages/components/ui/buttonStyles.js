// ============================================================
// RideWise button geometry — one shape language for the whole app
//
// Radius philosophy used across the UI:
//   rounded-lg   → controls (buttons, inputs, small tiles)
//   rounded-xl   → containers (cards, panels, sheets)
//   rounded-full → icon-only actions, avatars, pills/chips
//
// Kept in its own module so <Button> can be re-used anywhere
// (links, rows, labels) without duplicating the class recipe.
// ============================================================

export const BASE =
  "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap " +
  "border transition-colors disabled:opacity-45 disabled:pointer-events-none rounded-lg";

export const SIZES = {
  sm: { box: "h-8 px-3 text-xs gap-1.5", icon: 14 },
  md: { box: "h-10 px-4 text-sm",        icon: 16 },
  lg: { box: "h-12 px-5 text-[15px]",    icon: 18 },
};

export const ICON_BOX = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-11 w-11" };

// Variant → theme token. One place to change for the whole app.
export const VARIANT_TOKEN = {
  primary:   "btnPrimary",
  accent:    "btnAccent",
  secondary: "btnSecondary",
  ghost:     "btnGhost",
  soft:      "btnSoft",
  danger:    "btnDanger",
};

// Fallbacks keep the system working even if a page forgets to pass `tc`.
export const FALLBACK = {
  primary:   "bg-black text-white border-black hover:bg-black/85",
  accent:    "bg-[#FF7A1A] text-black border-[#FF7A1A] hover:bg-[#FF8A34]",
  secondary: "bg-transparent text-inherit border-current/25 hover:bg-black/5",
  ghost:     "bg-transparent text-inherit border-transparent hover:bg-black/5",
  soft:      "bg-black/5 text-inherit border-transparent hover:bg-black/10",
  danger:    "bg-transparent text-red-600 border-red-500/40 hover:bg-red-500/10",
};

export function variantClass(variant, tc = {}) {
  return (tc && tc[VARIANT_TOKEN[variant]]) || FALLBACK[variant] || FALLBACK.primary;
}

/**
 * Build the class string for a RideWise button.
 * Exported so links, rows and custom elements share the exact same look.
 */
export function buttonClass({ variant = "primary", size = "md", full = false, tc = {}, className = "" } = {}) {
  const sizing = SIZES[size] || SIZES.md;
  return [BASE, sizing.box, variantClass(variant, tc), full ? "w-full" : "", className]
    .filter(Boolean)
    .join(" ");
}
