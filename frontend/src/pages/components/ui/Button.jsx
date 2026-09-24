// ============================================================
// RideWise button system  ·  one shape language for the whole app
//
// PHILOSOPHY
//   · every button is: same radius, same height scale, same icon slot,
//     same gap, same focus ring, same disabled treatment
//   · colour is functional, never decorative:
//       primary   → the single main action of a view (monochrome ink)
//       accent    → ride-critical actions only (start a ride, recenter)
//       secondary → alternative action next to a primary
//       ghost     → tertiary action / toolbar
//       soft      → selected state in a group of choices
//       danger    → destructive or irreversible action
//   · colour comes from the active theme tokens (tc.*) so all four themes
//     share one system instead of four different designs
//
// RADIUS PHILOSOPHY (used across the whole UI)
//   rounded-lg   → controls (buttons, inputs, small tiles)
//   rounded-xl   → containers (cards, panels, sheets)
//   rounded-full → icon-only actions, avatars, pills/chips
//
// Usage:
//   <Button variant="accent" size="lg" icon="ride" onClick={…}>Start a Ride</Button>
//   <Button variant="ghost" icon="refresh" iconOnly title="Refresh" />
// ============================================================

import Icon from "./Icon";
import { BASE, SIZES, ICON_BOX, variantClass } from "./buttonStyles";

/**
 * Button — the single button component used across RideWise.
 *
 * variant  primary | accent | secondary | ghost | soft | danger
 * size     sm | md | lg
 * icon     name from the RideWise icon family (optional)
 * iconRight place the icon after the label
 * iconOnly square/circular icon-only button (title required for a11y)
 * loading  shows the spinner and disables the button
 * full     stretches to the container width
 * as       "button" (default) | "a" | "label" — anything that takes className
 * tc       theme classes from useTheme(); pass it so colours match the theme
 */
export default function Button({
  variant = "primary",
  size = "md",
  icon,
  iconRight = false,
  iconOnly = false,
  loading = false,
  full = false,
  as: Tag = "button",
  tc = {},
  className = "",
  children,
  disabled,
  title,
  ...rest
}) {
  const sizing = SIZES[size] || SIZES.md;
  const classes = [
    BASE,
    sizing.box,
    variantClass(variant, tc),
    iconOnly ? "px-0 rounded-full" : "",
    full ? "w-full" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <Tag
      className={classes}
      title={title}
      disabled={Tag === "button" ? disabled || loading : undefined}
      aria-label={iconOnly ? title : undefined}
      {...rest}
    >
      {loading ? <Icon name="spinner" size={sizing.icon} className="rw-spin" /> : null}
      {!loading && icon && !iconRight ? <Icon name={icon} size={sizing.icon} /> : null}
      {!iconOnly ? children : null}
      {!loading && icon && iconRight ? <Icon name={icon} size={sizing.icon} /> : null}
    </Tag>
  );
}

/**
 * IconButton — the icon-only member of the same family.
 * Round (see the radius philosophy) with a single 16px glyph.
 * `label` is required: it becomes both title and aria-label.
 */
export function IconButton({
  variant = "ghost",
  size = "md",
  icon,
  label,
  tc = {},
  className = "",
  loading = false,
  disabled,
  ...rest
}) {
  const sizing = SIZES[size] || SIZES.md;
  return (
    <button
      className={[
        "inline-flex items-center justify-center rounded-full border transition-colors",
        "disabled:opacity-45 disabled:pointer-events-none",
        ICON_BOX[size] || ICON_BOX.md,
        variantClass(variant, tc),
        className,
      ].filter(Boolean).join(" ")}
      title={label}
      aria-label={label}
      disabled={disabled || loading}
      {...rest}
    >
      <Icon name={loading ? "spinner" : icon} size={sizing.icon} className={loading ? "rw-spin" : ""} />
    </button>
  );
}

/**
 * Chip — small pill for filters and segmented choices.
 * Selected state is monochrome ink so a row of chips stays calm;
 * the accent is reserved for ride-critical colour only.
 */
export function Chip({ selected = false, icon, tc = {}, className = "", children, ...rest }) {
  return (
    <button
      className={[
        "inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-semibold transition-colors",
        selected
          ? (tc.chipSelected || "bg-black text-white border-black")
          : (tc.chipIdle || "bg-transparent border-current/20 hover:bg-black/5"),
        className,
      ].filter(Boolean).join(" ")}
      aria-pressed={selected}
      {...rest}
    >
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </button>
  );
}
