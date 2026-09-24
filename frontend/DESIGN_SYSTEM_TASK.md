# RideWise UI migration — shared spec (read fully before editing)

Repo: `E:\My projects\RideWise\frontend` · React 19 + Vite + Tailwind 3 + plain JSX.
Active work: replacing the old UI (Font Awesome + orange/pink gradients + glassmorphism)
with a minimal, premium, monochrome RideWise design system.

## 0. Hard constraints

* Change **only** visual markup: `className`, inline style values, and icon/button elements.
* **Never** change logic, state, hooks, props, handlers, routing, API calls, field names, validation, or behaviour.
* Keep every file's comment structure and the `tc` prop flow (components receiving `tc` keep receiving it).
* Font Awesome is **removed** from `index.html` — any leftover `fa fa-*` renders nothing. Zero `fa-` may remain in your files.
* `npm run build` (vite) must still pass. Do not add dependencies.

## 1. The systems that already exist

### Icons — `src/pages/components/ui/Icon.jsx`
```jsx
import Icon from "../components/ui/Icon";        // adjust the relative path
<Icon name="search" size={18} />
<Icon name="spinner" size={16} className="rw-spin" />
```
One family: 24×24 grid, single 1.6 stroke, round caps/joins, outline only, colour = `currentColor`
(so it always follows the theme). Unknown names render nothing — use the map below.
Sizes: inline meta 14 · default/button 16 · section header or list row 18 · nav item 20 · stat/hero 22–24 · empty state 28–32.

### Buttons — `src/pages/components/ui/Button.jsx`
```jsx
import Button, { IconButton, Chip, buttonClass } from "../components/ui/Button";

<Button variant="primary" size="md" icon="ride" tc={tc}>Start a Ride</Button>
<Button variant="accent" size="lg" icon="ride" tc={tc} onClick={…}>Start a Ride</Button>
<Button variant="ghost" icon="refresh" iconOnly title="Refresh" tc={tc} />
<Button variant="danger" icon="trash" tc={tc}>Delete</Button>
<Button loading={saving} iconRight icon="arrowRight" tc={tc} full>Continue</Button>
<IconButton icon="close" label="Close" tc={tc} />
<Chip selected={isActive} onClick={…} tc={tc}>Completed</Chip>
```
Variants → meaning (do not invent new ones):
`primary` the single main action of a view (monochrome ink) ·
`accent` **only** ride-critical actions (start a ride, map recenter) ·
`secondary` alternative action beside a primary · `ghost` tertiary/toolbar/close ·
`soft` selected state in a group · `danger` destructive/irreversible.
Sizes: `sm` (h-8) `md` (h-10, default) `lg` (h-12). `iconOnly` makes it round. `loading` shows the spinner and disables.
`buttonClass({variant,size,full,tc,className})` exists for non-`<button>` elements (links, rows, labels).

### Radius language (apply consistently)
`rounded-lg` controls (buttons, inputs, small tiles) · `rounded-xl` containers (cards, panels, sheets) · `rounded-full` icon-only buttons, avatars, pills/chips.
So: replace `rounded-2xl`/`rounded-3xl` on cards/panels with `rounded-xl`, and on buttons with `rounded-lg` (or use `<Button>`).

### Theme tokens — `src/pages/hooks/useTheme.js` (already rewritten, 33 identical keys per theme)
`label, icon, isDark, isLight, bg, text, sub, card, cardHover, surface2, divider, bar, overlay, input,`
`btnPrimary, btnAccent, btnSecondary, btnGhost, btnSoft, btnDanger, button, navActive, navIdle, record,`
`accent, accentSoft, danger, dangerSoft, ok, warn, chipIdle, chipSelected, mapControl, glow, particle, preview`
Notes: `accent`/`danger`/`ok`/`warn` are **text colours**; `accentSoft`/`dangerSoft` are **tinted surfaces** (bg+border+text).
`isLight` is true for light+warm, `isDark` true for dark+midnight — use these instead of `theme === "light"`.
(`buttonClass` lives in `src/pages/components/ui/buttonStyles.js` — import it from there, not from Button.jsx.)

## 2. Colour migration rules (no emoji, no gradients)

| Old | New |
| --- | --- |
| `bg-gradient-to-r from-orange-500 to-pink-500` on a button | `<Button variant="primary">`; use `variant="accent"` only for the ride-start action |
| avatar / logo tiles with the orange→pink gradient | `${tc.button}` (solid ink) on the tile |
| `text-orange-400/500` accent ink | `${tc.accent}` |
| orange tinted panels/badges (`bg-orange-500/10 border-orange-500/30`) | `${tc.accentSoft}` |
| `bg-red-500/10 border-red-500/30 text-red-400` alerts | `${tc.dangerSoft}` |
| `text-red-400` destructive text | `${tc.danger}` / `<Button variant="danger">` |
| `text-green-400/500`, `bg-green-500` | `${tc.ok}` (keep green **only** for the live/active ride pulse dot) |
| `text-gray-300/400/500`, `text-white/40`, `text-black/40` for secondary text | `${tc.sub}` |
| `hover:bg-white/10`, `hover:bg-black/10` on themed surfaces | `${tc.cardHover}` (or use `Button variant="ghost"`) |
| gradients, `backdrop-blur-*`, `shadow-xl/2xl` on cards, `hover:scale-*`, `animate-pulse` on buttons | delete — flat surfaces, hairline borders, `transition-colors` only |
| coloured inline `style={{ background: "linear-gradient(…)" }}`, hex colours like `#f97316`, `#a78bfa`, `#60a5fa`, `rgba(139,92,246,…)` | theme tokens (monochrome) |
| `<i className="fa fa-x" />` | `<Icon name="…" />` per the map below |
| emoji used as icons (🏍️ 🎙️ 👥 ⚙️ 🌙 ☀️ 🌅 🌌 ⌄ ✓ 💡 👋 🏁 🛡️) | remove, or use text/`<Icon>` |
| stray `outline-none` on focusable elements | delete it (the app has one global accent focus ring) |

Only `shadow-sm` is allowed, and only on floating controls over the map (`tc.mapControl`).
The accent may only appear for: ride start, map recenter, active selection, and danger/warn/ok status.

## 3. Font Awesome → RideWise icon name

`fa-motorcycle`→`ride` · `fa-route`→`route` · `fa-map`,`fa-map-location-dot`→`map` ·
`fa-map-marker-alt`,`fa-location-dot`→`pin` · `fa-location-crosshairs`→`recenter` · `fa-location-arrow`→`navigate` ·
`fa-home`→`home` · `fa-users`,`fa-user-group`→`riders` · `fa-user`→`user` · `fa-user-plus`→`userPlus` ·
`fa-user-minus`→`userMinus` · `fa-user-slash`→`userOff` · `fa-person-walking-arrow-right`→`leave` ·
`fa-right-from-bracket`→`logout` · `fa-shield`,`fa-shield-alt`,`fa-shield-halved`→`shield` ·
`fa-tachometer-alt`→`gauge` · `fa-road`→`road` · `fa-cog`,`fa-palette`→`settings` · `fa-clock`→`clock` ·
`fa-clock-rotate-left`→`history` · `fa-calendar-check`→`calendar` · `fa-chart-bar`→`chart` · `fa-list`→`list` ·
`fa-play-circle`→`play` · `fa-flag-checkered`→`finish` · `fa-plus`→`plus` · `fa-minus`→`minus` ·
`fa-check`→`check` · `fa-check-square`→`checkbox` · `fa-check-circle`→`checkCircle` · `fa-square`→`square` ·
`fa-circle`→`dot` (filled: `dotFilled`) · `fa-times`,`fa-xmark`→`close` · `fa-times-circle`→`closeCircle` ·
`fa-chevron-up/down/left/right`→same names · `fa-arrow-right`→`arrowRight` · `fa-arrow-left`→`arrowLeft` ·
`fa-exclamation-circle`→`alertCircle` · `fa-exclamation-triangle`,`fa-triangle-exclamation`→`alertTriangle` ·
`fa-trash`→`trash` · `fa-pen`→`edit` · `fa-eye`→`eye` · `fa-eye-slash`→`eyeOff` · `fa-lock`→`lock` ·
`fa-envelope`→`mail` · `fa-phone`→`phone` · `fa-mobile-alt`→`mobile` · `fa-at`→`at` · `fa-ban`→`ban` ·
`fa-refresh`,`fa-rotate-right`→`refresh` · `fa-bell`→`bell` · `fa-bell-slash`→`bellOff` ·
`fa-sun`→`sun` · `fa-moon`→`moon` · `fa-cloud-sun`→`sunCloud` · `fa-city`→`city` · `fa-lightbulb`→`idea` ·
`fa-server`→`server` · `fa-universal-access`→`access` · `fa-search`→`search` · `fa-microphone`→`mic` ·
`fa-microphone-slash`→`micOff` · `fa-spinner fa-spin`→`<Icon name="spinner" className="rw-spin" />` (or `<Button loading>`)

## 4. Done when

1. `grep`ping your files for `fa-` returns nothing.
2. No `gradient`, no emoji-as-icon, no hardcoded colour families (orange/pink/purple/green/red/blue/gray) left in your files — except the functional tokens/status listed above.
3. `npx eslint <your files>` reports no **new** errors (pre-existing `react-hooks/set-state-in-effect` and `catch (_) {}` errors are fine).
4. Report to the lead: files changed, icons used, anything unmapped, anything you deliberately kept.
