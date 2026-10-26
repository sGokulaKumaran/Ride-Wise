// ============================================================
// RideWise icon family  ·  one wire/outline language
//
// DESIGN RULES (every icon in this file follows them):
//   · 24×24 grid, artwork sits inside a 3–21 live area
//   · outline only — no fills except single 1px "signal dots"
//   · one stroke weight (1.6), round caps, round joins
//   · flat geometry: no gradients, no shadows, no two-tone
//   · colour always comes from the active theme via currentColor,
//     so an icon can never introduce a colour of its own
//
// Usage:  <Icon name="search" size={18} />
//         <Icon name="ride" size={22} className="text-[--rw-accent]" />
// ============================================================

const SW = 1.6; // stroke weight — the family's single weight

// Icons are grouped exactly the way the app uses them.
const ICONS = {
  // ── Search / input ────────────────────────────────────────
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.4" />
      <path d="M15.5 15.5 20.4 20.4" />
    </>
  ),
  at: (
    <>
      <circle cx="12" cy="12" r="3.4" />
      <path d="M15.4 8.6v4.9a2.6 2.6 0 0 0 5.2 0V12a8.6 8.6 0 1 0-3.5 6.9" />
    </>
  ),

  // ── Voice ─────────────────────────────────────────────────
  mic: (
    <>
      <rect x="9.2" y="3.4" width="5.6" height="9.4" rx="2.8" />
      <path d="M5.8 11.2a6.2 6.2 0 0 0 12.4 0" />
      <path d="M12 17.4v3.2" />
    </>
  ),
  micOff: (
    <>
      <path d="M14.8 9.6V6.2a2.8 2.8 0 0 0-5.5-.7" />
      <path d="M9.2 9.9v2.9a2.8 2.8 0 0 0 4.3 2.4" />
      <path d="M5.8 11.2a6.2 6.2 0 0 0 9.2 5.4" />
      <path d="M18.2 11.2a6.2 6.2 0 0 1-.6 2.6" />
      <path d="M12 17.4v3.2" />
      <path d="M4.4 4.4 19.6 19.6" />
    </>
  ),

  // ── Ride / vehicle ────────────────────────────────────────
  // Motorbike in profile: two wheels, chassis beam, fork + bar, seat.
  // The filled headlight dot is the family's signature detail.
  ride: (
    <>
      <circle cx="6.2" cy="16.6" r="3.2" />
      <circle cx="17.8" cy="16.6" r="3.2" />
      <path d="M9.4 16.6h5.2" />
      <path d="M8.2 14.6 10.4 9.2" />
      <path d="M8.5 9.2h3.6" />
      <path d="M11.8 13.4h4.4l1.6 3.2" />
      <circle cx="11.6" cy="11.5" r=".95" fill="currentColor" stroke="none" />
    </>
  ),
  road: (
    <>
      <path d="M7.2 3.8 4.4 20.2" />
      <path d="M16.8 3.8l2.8 16.4" />
      <path d="M12 5.2v2.6M12 10.9v2.6M12 16.6v2.6" />
    </>
  ),
  route: (
    <>
      <circle cx="6.4" cy="6.4" r="2.6" />
      <circle cx="17.8" cy="17.6" r="2.6" />
      <path d="M9 6.4h4.6a3.2 3.2 0 0 1 0 6.4H8.6a3.2 3.2 0 0 0 0 6.4h6.6" />
    </>
  ),
  finish: (
    <>
      <path d="M6.6 20.4V4.4" />
      <path d="M6.6 5.2h10.8l-1.9 3.4 1.9 3.4H6.6" />
    </>
  ),

  // ── Place / navigation ────────────────────────────────────
  pin: (
    <>
      <path d="M12 21.2c0 0 6.2-5.7 6.2-10a6.2 6.2 0 1 0-12.4 0c0 4.3 6.2 10 6.2 10Z" />
      <circle cx="12" cy="11.1" r="2.3" />
    </>
  ),
  recenter: (
    <>
      <circle cx="12" cy="12" r="7.6" />
      <path d="M12 2.8v2.8M12 18.4v2.8M2.8 12h2.8M18.4 12h2.8" />
      <circle cx="12" cy="12" r="2.1" fill="currentColor" stroke="none" />
    </>
  ),
  navigate: (
    <>
      <path d="M20.4 3.6 3.8 10.8l7.1 2.3 2.3 7.1Z" />
    </>
  ),
  map: (
    <>
      <path d="M3.6 6.6l5.4-2.2 6 2.2 5.4-2.2v13.2l-5.4 2.2-6-2.2-5.4 2.2Z" />
      <path d="M9 4.4v13.2M15 6.6v13.2" />
    </>
  ),
  city: (
    <>
      <path d="M4.4 19.8V6.6a1 1 0 0 1 1-1h4.8a1 1 0 0 1 1 1v13.2" />
      <path d="M11.2 19.8v-8.6h6.4a1 1 0 0 1 1 1v7.6" />
      <path d="M3.2 19.8h17.6" />
      <path d="M7 9.2h2.2M7 12.6h2.2M14.2 14.4h1.6" />
    </>
  ),
  share: (
    <>
      <path d="M12 15.2V4.6" />
      <path d="M8.5 8.1 12 4.6l3.5 3.5" />
      <path d="M5.6 13.6v4.6a2 2 0 0 0 2 2h8.8a2 2 0 0 0 2-2v-4.6" />
    </>
  ),

  // ── People ────────────────────────────────────────────────
  user: (
    <>
      <circle cx="12" cy="8.6" r="3.3" />
      <path d="M5.8 19.6v-.6a4.2 4.2 0 0 1 4.2-4.2h4a4.2 4.2 0 0 1 4.2 4.2v.6" />
    </>
  ),
  riders: (
    <>
      <circle cx="9.4" cy="8.4" r="3.1" />
      <path d="M4 19.6v-.6a4.2 4.2 0 0 1 4.2-4.2h2.4a4.2 4.2 0 0 1 4.2 4.2v.6" />
      <path d="M15.7 5.9a3.1 3.1 0 0 1 0 5.4" />
      <path d="M17.6 15a4.2 4.2 0 0 1 2.6 3.9v.7" />
    </>
  ),

  userPlus: (
    <>
      <circle cx="9.8" cy="8.8" r="3.3" />
      <path d="M3.8 19.6v-.6a4.2 4.2 0 0 1 4.2-4.2h3.6a4.2 4.2 0 0 1 4.2 4.2v.6" />
      <path d="M18.4 5.2v5.6M15.6 8h5.6" />
    </>
  ),
  userMinus: (
    <>
      <circle cx="9.8" cy="8.8" r="3.3" />
      <path d="M3.8 19.6v-.6a4.2 4.2 0 0 1 4.2-4.2h3.6a4.2 4.2 0 0 1 4.2 4.2v.6" />
      <path d="M15.6 8h5.6" />
    </>
  ),
  userOff: (
    <>
      <circle cx="9.8" cy="8.8" r="3.3" />
      <path d="M3.8 19.6v-.6a4.2 4.2 0 0 1 4.2-4.2h3.6a4.2 4.2 0 0 1 4.2 4.2v.6" />
      <path d="M4.4 4.4 19.6 19.6" />
    </>
  ),
  leave: (
    <>
      <circle cx="9.6" cy="8.6" r="3.2" />
      <path d="M4.2 19.6v-.6a4.2 4.2 0 0 1 4.2-4.2h1.8" />
      <path d="M14.6 12.4h5.8" />
      <path d="M17.8 9.6l2.6 2.8-2.6 2.8" />
    </>
  ),
  logout: (
    <>
      <path d="M14.6 4.6h2.6a2 2 0 0 1 2 2v10.8a2 2 0 0 1-2 2h-2.6" />
      <path d="M4.4 12h9" />
      <path d="M9.8 8.6 13.4 12l-3.6 3.4" />
    </>
  ),

  // ── Admin / system ────────────────────────────────────────
  shield: (
    <>
      <path d="M12 3.8 19 6.3v5c0 4.3-2.9 7.5-7 9-4.1-1.5-7-4.7-7-9v-5Z" />
      <path d="M9.2 12.1l2 2 3.6-3.9" />
    </>
  ),
  gauge: (
    <>
      <path d="M4.4 17.6a8.4 8.4 0 1 1 15.2 0" />
      <path d="M12 17.6 15.8 12" />
      <circle cx="12" cy="17.6" r="1.2" />
    </>
  ),
  chart: (
    <>
      <path d="M4.2 19.8h15.6" />
      <path d="M7.6 19.8v-6.2M12 19.8v-10M16.4 19.8v-4" />
    </>
  ),
  list: (
    <>
      <path d="M9.2 6.4h11M9.2 12h11M9.2 17.6h11" />
      <path d="M4.6 6.4h.9M4.6 12h.9M4.6 17.6h.9" />
    </>
  ),
  settings: (
    <>
      <path d="M4.2 8.4h8.2M18.4 8.4h1.4" />
      <circle cx="15.4" cy="8.4" r="2.2" />
      <path d="M4.2 15.6h2.4M12.4 15.6h7.4" />
      <circle cx="9.2" cy="15.6" r="2.2" />
    </>
  ),
  server: (
    <>
      <rect x="3.8" y="4.6" width="16.4" height="6" rx="2" />
      <rect x="3.8" y="13.4" width="16.4" height="6" rx="2" />
      <path d="M7.4 7.6h.9M7.4 16.4h.9" />
    </>
  ),
  access: (
    <>
      <circle cx="12" cy="4.9" r="2.1" />
      <path d="M4.8 8.6h14.4" />
      <path d="M12 8.6v5.2" />
      <path d="M12 13.8 9.4 20.2M12 13.8l2.6 6.4" />
    </>
  ),

  // ── Time ──────────────────────────────────────────────────
  clock: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.4V12l3.2 1.9" />
    </>
  ),
  history: (
    <>
      <path d="M3.9 12a8.1 8.1 0 1 0 2.6-5.9" />
      <path d="M3.6 4.6v4h4" />
      <path d="M12 8.2V12l3 1.8" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.8" y="5.2" width="16.4" height="14.6" rx="2.4" />
      <path d="M3.8 9.8h16.4" />
      <path d="M8.2 3.6v3.2M15.8 3.6v3.2" />
      <path d="M8.4 13.6h2.2" />
    </>
  ),
  refresh: (
    <>
      <path d="M19.6 12a7.6 7.6 0 1 1-2.7-5.8" />
      <path d="M19.8 4.6v4.2h-4.2" />
    </>
  ),
  spinner: (
    <>
      <path d="M12 4.2a7.8 7.8 0 1 0 7.8 7.8" />
    </>
  ),

  // ── Actions ───────────────────────────────────────────────
  plus: (
    <>
      <path d="M12 5.6v12.8M5.6 12h12.8" />
    </>
  ),
  minus: (
    <>
      <path d="M5.6 12h12.8" />
    </>
  ),
  check: (
    <>
      <path d="M5.4 12.6 10 17.2 18.6 6.9" />
    </>
  ),
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M8.4 12.2 11 14.8l4.6-5.2" />
    </>
  ),
  close: (
    <>
      <path d="M6.4 6.4 17.6 17.6M17.6 6.4 6.4 17.6" />
    </>
  ),
  closeCircle: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" />
    </>
  ),
  play: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M10.2 9.4 15 12l-4.8 2.6Z" />
    </>
  ),
  edit: (
    <>
      <path d="M4.8 19.2h3.5L18.7 8.8a2 2 0 0 0-2.8-2.8L5.4 16.4Z" />
      <path d="M14.7 7.2 16.9 9.4" />
    </>
  ),
  trash: (
    <>
      <path d="M4.6 7.4h14.8" />
      <path d="M9.4 7.4V5.9a1 1 0 0 1 1-1h3.2a1 1 0 0 1 1 1v1.5" />
      <path d="M6.6 7.4l.8 10.5a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l.8-10.5" />
      <path d="M10.4 11v5M13.6 11v5" />
    </>
  ),
  eye: (
    <>
      <path d="M2.9 12S6.3 6.5 12 6.5 21.1 12 21.1 12 17.7 17.5 12 17.5 2.9 12 2.9 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M6.6 7.4C4.3 8.9 2.9 12 2.9 12s3.4 5.5 9.1 5.5c1.5 0 2.8-.4 3.9-1" />
      <path d="M9.4 8.5A8.6 8.6 0 0 1 12 6.5c5.7 0 9.1 5.5 9.1 5.5a15 15 0 0 1-2.9 3.4" />
      <path d="M10.2 10.3a2.5 2.5 0 0 0 3.4 3.5" />
      <path d="M4.2 4.2 19.8 19.8" />
    </>
  ),
  ban: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M6.2 17.8 17.8 6.2" />
    </>
  ),

  // ── Status ────────────────────────────────────────────────
  alertCircle: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.8v4.6" />
      <circle cx="12" cy="15.7" r=".95" fill="currentColor" stroke="none" />
    </>
  ),
  alertTriangle: (
    <>
      <path d="M10.6 4.6a1.6 1.6 0 0 1 2.8 0l6.9 12.2a1.6 1.6 0 0 1-1.4 2.4H5.1a1.6 1.6 0 0 1-1.4-2.4Z" />
      <path d="M12 9.4v4.2" />
      <circle cx="12" cy="16.2" r=".95" fill="currentColor" stroke="none" />
    </>
  ),
  idea: (
    <>
      <path d="M9.6 15.4a5.2 5.2 0 1 1 4.8 0v1.7a1.3 1.3 0 0 1-1.3 1.3h-2.2a1.3 1.3 0 0 1-1.3-1.3Z" />
      <path d="M10.4 20.8h3.2" />
    </>
  ),
  dot: (
    <>
      <circle cx="12" cy="12" r="3.4" />
    </>
  ),
  dotFilled: (
    <>
      <circle cx="12" cy="12" r="3.4" fill="currentColor" stroke="none" />
    </>
  ),
  square: (
    <>
      <rect x="4.8" y="4.8" width="14.4" height="14.4" rx="3" />
    </>
  ),
  checkbox: (
    <>
      <rect x="4.8" y="4.8" width="14.4" height="14.4" rx="4" />
      <path d="M8.6 12.2 11 14.6l4.4-5" />
    </>
  ),

  // ── Route maneuvers ───────────────────────────────────────
  // One shape language: the stem always enters from the bottom (where
  // the rider is coming from) and the arrowhead shows where to go, so
  // every turn reads at a glance — a slight turn leans, a sharp turn
  // folds back, a fork splits, a merge joins.
  maneuverStraight: (
    <>
      <path d="M12 20.4V4.8" />
      <path d="M7.2 9.6 12 4.8l4.8 4.8" />
    </>
  ),
  maneuverLeft: (
    <>
      <path d="M18.6 20.4V10a3 3 0 0 0-3-3H5.4" />
      <path d="M9.4 3 5.4 7l4 4" />
    </>
  ),
  maneuverRight: (
    <>
      <path d="M5.4 20.4V10a3 3 0 0 1 3-3h10.2" />
      <path d="M14.6 3l4 4-4 4" />
    </>
  ),
  maneuverSlightLeft: (
    <>
      <path d="M14.6 20.4v-5.2a3 3 0 0 0-.9-2.1L7 6.4" />
      <path d="M7 11.6V6.4h5.2" />
    </>
  ),
  maneuverSlightRight: (
    <>
      <path d="M9.4 20.4v-5.2a3 3 0 0 1 .9-2.1L17 6.4" />
      <path d="M11.8 6.4H17v5.2" />
    </>
  ),
  maneuverSharpLeft: (
    <>
      <path d="M15.4 20.4V9a2.2 2.2 0 0 0-3.8-1.5L6.6 13.4" />
      <path d="M6.6 8.2v5.2h5.2" />
    </>
  ),
  maneuverSharpRight: (
    <>
      <path d="M8.6 20.4V9a2.2 2.2 0 0 1 3.8-1.5l5 5.9" />
      <path d="M17.4 8.2v5.2h-5.2" />
    </>
  ),
  maneuverUTurn: (
    <>
      <path d="M7 20.4v-8.8a5 5 0 0 1 10 0v4.6" />
      <path d="M13.4 12.8 17 16.2l3.6-3.4" />
    </>
  ),
  maneuverKeepLeft: (
    <>
      <path d="M12 20.4v-6.2" />
      <path d="M12 14.2 7.4 9.6V4.6" />
      <path d="M4.6 7.4 7.4 4.6l2.8 2.8" />
      <path d="M12 14.2l4.6-4.6V7.4" />
    </>
  ),
  maneuverKeepRight: (
    <>
      <path d="M12 20.4v-6.2" />
      <path d="M12 14.2l4.6-4.6V4.6" />
      <path d="M13.8 7.4l2.8-2.8 2.8 2.8" />
      <path d="M12 14.2 7.4 9.6V7.4" />
    </>
  ),
  maneuverMerge: (
    <>
      <path d="M13.6 20.4V4.8" />
      <path d="M10 8.4l3.6-3.6 3.6 3.6" />
      <path d="M6.4 20.4v-3a3 3 0 0 1 .9-2.1l6.3-6.3" />
    </>
  ),
  maneuverRoundabout: (
    <>
      <circle cx="11" cy="11.4" r="3.6" />
      <path d="M11 20.4V15" />
      <path d="M13.6 8.8 18 4.4" />
      <path d="M13.8 4.4H18v4.2" />
    </>
  ),
  maneuverDepart: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 16.2V8" />
      <path d="M8.8 11.2 12 8l3.2 3.2" />
    </>
  ),
  maneuverArrive: (
    <>
      <path d="M6 3.8v16.4" />
      <path d="M6 4.8h11.4l-2 3.6 2 3.6H6" />
    </>
  ),

  // ── Map controls ──────────────────────────────────────────
  layers: (
    <>
      <path d="M12 3.8 20.2 8.2 12 12.6 3.8 8.2Z" />
      <path d="M3.8 12.2 12 16.6l8.2-4.4" />
      <path d="M3.8 16.2 12 20.6l8.2-4.4" />
    </>
  ),
  // "Show the whole route": a viewfinder around a path
  overview: (
    <>
      <path d="M4.4 9V6.4a2 2 0 0 1 2-2H9" />
      <path d="M15 4.4h2.6a2 2 0 0 1 2 2V9" />
      <path d="M19.6 15v2.6a2 2 0 0 1-2 2H15" />
      <path d="M9 19.6H6.4a2 2 0 0 1-2-2V15" />
      <path d="M8.6 14.8c1.4-3.8 5.4-1.8 6.8-5.6" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M14.9 9.1 13.4 13.4 9.1 14.9l1.5-4.3Z" />
    </>
  ),
  gpsOff: (
    <>
      <circle cx="12" cy="12" r="6.6" />
      <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4" />
      <path d="M4.6 4.6 19.4 19.4" />
    </>
  ),
  volume: (
    <>
      <path d="M4.2 9.8h2.9l4.3-3.4v11.2l-4.3-3.4H4.2Z" />
      <path d="M14.6 9.4a3.7 3.7 0 0 1 0 5.2" />
      <path d="M17.2 6.9a7.2 7.2 0 0 1 0 10.2" />
    </>
  ),
  volumeOff: (
    <>
      <path d="M4.2 9.8h2.9l4.3-3.4v11.2l-4.3-3.4H4.2Z" />
      <path d="M15.2 9.6l5 4.8M20.2 9.6l-5 4.8" />
    </>
  ),
  expand: (
    <>
      <path d="M14 4.6h5.4V10" />
      <path d="M19.4 4.6l-6 6" />
      <path d="M10 19.4H4.6V14" />
      <path d="M4.6 19.4l6-6" />
    </>
  ),

  // ── Window actions ─────────────────────────────────────────
  minimize: (
    <>
      <path d="M5.6 12h12.8" />
    </>
  ),

  // ── Info / identity ───────────────────────────────────────
  info: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 11v5.2" />
      <circle cx="12" cy="8" r=".95" fill="currentColor" stroke="none" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M9.6 9.5a2.4 2.4 0 1 1 3.3 2.2c-.6.3-.9.7-.9 1.5" />
      <circle cx="12" cy="16.2" r=".95" fill="currentColor" stroke="none" />
    </>
  ),
  message: (
    <>
      <path d="M5.6 18.8 4 20v-4.2A7.6 7.6 0 1 1 12 19.6H8.2Z" />
      <path d="M8.6 10.6h6.8M8.6 13.8h4.4" />
    </>
  ),
  idCard: (
    <>
      <rect x="3.6" y="5.6" width="16.8" height="12.8" rx="2.4" />
      <circle cx="8.8" cy="10.8" r="1.9" />
      <path d="M5.9 15.6a3 3 0 0 1 5.8 0" />
      <path d="M14.2 10h3.6M14.2 13.4h2.4" />
    </>
  ),
  // "Do it again" — ride the same route once more
  repeat: (
    <>
      <path d="M4.6 11a5.4 5.4 0 0 1 5.4-5.4h8.4" />
      <path d="M15.8 3l2.8 2.6-2.8 2.6" />
      <path d="M19.4 13a5.4 5.4 0 0 1-5.4 5.4H5.6" />
      <path d="M8.2 21l-2.8-2.6 2.8-2.6" />
    </>
  ),

  // ── Navigation ────────────────────────────────────────────
  home: (
    <>
      <path d="M4 10.7 12 4.4l8 6.3" />
      <path d="M6.4 9.6V19a1 1 0 0 0 1 1h9.2a1 1 0 0 0 1-1V9.6" />
      <path d="M10 20v-4.4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V20" />
    </>
  ),
  chevronUp: (
    <>
      <path d="M6.6 14.4 12 9l5.4 5.4" />
    </>
  ),
  chevronDown: (
    <>
      <path d="M6.6 9.6 12 15l5.4-5.4" />
    </>
  ),
  chevronLeft: (
    <>
      <path d="M14.4 6.6 9 12l5.4 5.4" />
    </>
  ),
  chevronRight: (
    <>
      <path d="M9.6 6.6 15 12l-5.4 5.4" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M4.8 12h14.4" />
      <path d="M13.6 6.6 19 12l-5.4 5.4" />
    </>
  ),
  arrowLeft: (
    <>
      <path d="M19.2 12H4.8" />
      <path d="M10.4 6.6 5 12l5.4 5.4" />
    </>
  ),
  arrowUp: (
    <>
      <path d="M12 19.2V4.8" />
      <path d="M6.6 10.4 12 5l5.4 5.4" />
    </>
  ),

  // ── Contact / security ────────────────────────────────────
  bell: (
    <>
      <path d="M17.6 16.6H6.4l1.2-2.3V10a4.4 4.4 0 0 1 8.8 0v4.3Z" />
      <path d="M10.2 19.4a1.9 1.9 0 0 0 3.6 0" />
    </>
  ),
  bellOff: (
    <>
      <path d="M16.4 10.8V10a4.4 4.4 0 0 0-7.1-3.5" />
      <path d="M7.6 10.2v4.1l-1.2 2.3h10.2" />
      <path d="M10.2 19.4a1.9 1.9 0 0 0 3.6 0" />
      <path d="M4.4 4.4 19.6 19.6" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.4" width="14" height="9.4" rx="2.4" />
      <path d="M8.4 10.4V8a3.6 3.6 0 0 1 7.2 0v2.4" />
      <circle cx="12" cy="15" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  mail: (
    <>
      <rect x="3.6" y="5.4" width="16.8" height="13.2" rx="2.4" />
      <path d="M4.6 7.4 12 12.6l7.4-5.2" />
    </>
  ),
  phone: (
    <>
      <path d="M6.2 3.8h3l1.6 4-2 1.4a10.4 10.4 0 0 0 5.8 5.8l1.4-2 4 1.6v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.2 6a2 2 0 0 1 2-2.2Z" />
    </>
  ),
  mobile: (
    <>
      <rect x="6.6" y="2.8" width="10.8" height="18.4" rx="2.6" />
      <path d="M10.6 18.6h2.8" />
    </>
  ),

  // ── Theme glyphs (used by the theme picker) ───────────────
  theme: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 3.8v16.4" />
      <path d="M12 3.8a8.2 8.2 0 0 1 0 16.4Z" fill="currentColor" stroke="none" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="3.8" />
      <path d="M12 2.8v2.2M12 19v2.2M2.8 12h2.2M19 12h2.2" />
      <path d="M5.5 5.5 7.1 7.1M16.9 16.9l1.6 1.6M18.5 5.5l-1.6 1.6M7.1 16.9l-1.6 1.6" />
    </>
  ),
  moon: (
    <>
      <path d="M20.2 13.6A8.2 8.2 0 0 1 10.4 3.8a8.4 8.4 0 1 0 9.8 9.8Z" />
    </>
  ),
  sunCloud: (
    <>
      <circle cx="9.4" cy="8.4" r="3.1" />
      <path d="M9.4 3.2v1.5M4.6 8.4H3.1M5.7 4.7 6.8 5.8M13.1 4.7 12 5.8M14.2 8.4h1.5" />
      <path d="M8.6 20.6h7.7a2.9 2.9 0 0 0 .3-5.8 4 4 0 0 0-7.6.9 3 3 0 0 0-.4 4.9Z" />
    </>
  ),
  moonStars: (
    <>
      <path d="M18.4 12.8A6.6 6.6 0 0 1 10.6 5a6.8 6.8 0 1 0 7.8 7.8Z" />
      <path d="M17.6 3.4l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z" />
      <path d="M8.6 5.2l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5Z" />
    </>
  ),

  // ── Organizations / fleets ────────────────────────────────
  // Vehicles are drawn head-on or in profile with the same two-wheel,
  // one-beam grammar as the motorbike, signal dots for the lights.
  bus: (
    <>
      <rect x="4.2" y="3.8" width="15.6" height="12.8" rx="2.6" />
      <path d="M4.2 10.8h15.6" />
      <path d="M12 3.8v7" />
      <path d="M7.2 16.6v1.9a.9.9 0 0 0 .9.9h.8a.9.9 0 0 0 .9-.9v-1.9" />
      <path d="M14.2 16.6v1.9a.9.9 0 0 0 .9.9h.8a.9.9 0 0 0 .9-.9v-1.9" />
      <path d="M7.5 13.7h.01M16.5 13.7h.01" />
    </>
  ),
  van: (
    <>
      <path d="M5.2 16.6H4.6a1.4 1.4 0 0 1-1.4-1.4V7.4A1.4 1.4 0 0 1 4.600 6h8.600v10.600" />
      <path d="M13.2 9h3.9l3.700 4v2.200a1.400 1.400 0 0 1-1.400 1.400h-.2" />
      <path d="M9.6 16.600h5.200" />
      <circle cx="7.4" cy="16.800" r="2.200" />
      <circle cx="17" cy="16.800" r="2.200" />
    </>
  ),
  ambulance: (
    <>
      <path d="M5.2 16.6H4.6a1.4 1.4 0 0 1-1.4-1.4V7.4A1.4 1.4 0 0 1 4.600 6h8.600v10.600" />
      <path d="M13.2 9h3.9l3.700 4v2.200a1.400 1.400 0 0 1-1.400 1.400h-.2" />
      <path d="M9.6 16.600h5.200" />
      <circle cx="7.4" cy="16.800" r="2.200" />
      <circle cx="17" cy="16.800" r="2.200" />
      <path d="M8.2 8.400v3.600M6.400 10.200H10" />
    </>
  ),
  car: (
    <>
      <path d="M4.400 13.200 6.100 8.500a2 2 0 0 1 1.900-1.300h8a2 2 0 0 1 1.900 1.300l1.700 4.700" />
      <rect x="3.2" y="13.200" width="17.600" height="4.600" rx="1.600" />
      <path d="M6.400 17.800v1.500M17.600 17.800v1.500" />
      <path d="M7 15.500h.01M17 15.500h.01" />
    </>
  ),
  building: (
    <>
      <path d="M5.200 20.400V5.400A1.400 1.400 0 0 1 6.600 4h7A1.400 1.400 0 0 1 15 5.400v15" />
      <path d="M15 10h2.600a1.400 1.400 0 0 1 1.400 1.400v9" />
      <path d="M3.600 20.400h16.800" />
      <path d="M8.600 8h3M8.600 11.400h3M8.600 14.800h3" />
    </>
  ),
  steering: (
    <>
      <circle cx="12" cy="12" r="8.400" />
      <circle cx="12" cy="12" r="2.200" />
      <path d="M3.900 10.600h6.300M13.800 10.600h6.300M12 14.200v6.200" />
    </>
  ),
  megaphone: (
    <>
      <path d="M4 10.200v3.600a1 1 0 0 0 1 1h2.400l7.600 4.200V5L7.400 9.200H5a1 1 0 0 0-1 1Z" />
      <path d="M18 9.400a3.600 3.600 0 0 1 0 5.200" />
      <path d="M8.200 14.800l1 4.400" />
    </>
  ),
  bookmark: (
    <path d="M7 4h10a1 1 0 0 1 1 1v15.200l-6-4.200-6 4.200V5a1 1 0 0 1 1-1Z" />
  ),
  key: (
    <>
      <circle cx="8" cy="15.600" r="3.800" />
      <path d="M10.800 12.800 19.600 4.200" />
      <path d="M16.400 7.400l2.400 2.400M14 9.800l1.800 1.800" />
    </>
  ),
  copy: (
    <>
      <rect x="8.600" y="8.600" width="11" height="11.400" rx="2" />
      <path d="M15.400 5.600V5a1.600 1.600 0 0 0-1.600-1.600H6A1.600 1.600 0 0 0 4.400 5v8.600A1.600 1.600 0 0 0 6 15.200h.600" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11" />
      <path d="M7.600 11 12 15.400 16.400 11" />
      <path d="M4.600 19.600h14.800" />
    </>
  ),
  wrench: (
    <path d="M14.600 6.400a4.400 4.400 0 0 0-5.700 5.500L4 16.800a2 2 0 0 0 2.800 2.800l4.900-4.900a4.400 4.400 0 0 0 5.500-5.700l-2.600 2.600-2.200-.6-.6-2.200Z" />
  ),
  sos: (
    <>
      <circle cx="12" cy="12" r="8.400" />
      <circle cx="12" cy="12" r="3.400" />
      <path d="M6.100 6.100l3.500 3.500M14.400 14.400l3.500 3.500M17.900 6.100l-3.500 3.500M9.600 14.400l-3.500 3.500" />
    </>
  ),
  crown: (
    <>
      <path d="M4.200 8.400 7.600 12 12 6l4.400 6 3.400-3.600-1.600 9.200H5.800Z" />
      <path d="M6.200 20.200h11.600" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.400" />
      <path d="M3.600 12h16.800" />
      <path d="M12 3.600c2.400 2.300 3.600 5.100 3.600 8.400s-1.200 6.100-3.600 8.400c-2.400-2.300-3.600-5.100-3.600-8.400s1.200-6.100 3.600-8.400Z" />
    </>
  ),
  more: (
    <>
      <circle cx="6" cy="12" r="1.200" />
      <circle cx="12" cy="12" r="1.200" />
      <circle cx="18" cy="12" r="1.200" />
    </>
  ),
  seat: (
    <>
      <path d="M7.400 4.600v8.200a2 2 0 0 0 2 2h5.200" />
      <path d="M9.400 12.800h5.200a2 2 0 0 1 2 2v4.600" />
      <path d="M6 19.400h12" />
    </>
  ),
  signal: (
    <>
      <circle cx="12" cy="12" r="1.800" />
      <path d="M8.300 15.700a5.200 5.200 0 0 1 0-7.400M15.700 8.300a5.200 5.200 0 0 1 0 7.400" />
      <path d="M5.600 18.400a9 9 0 0 1 0-12.800M18.400 5.600a9 9 0 0 1 0 12.800" />
    </>
  ),
  activity: (
    <path d="M3.600 12h3.600l2.400-6.400 4.400 12.800 2.400-6.400h4" />
  ),
  busStop: (
    <>
      <circle cx="12" cy="8.600" r="4.800" />
      <path d="M12 13.400v7" />
      <path d="M9.400 20.400h5.200" />
    </>
  ),
  pause: (
    <path d="M9 5.600v12.800M15 5.600v12.800" />
  ),
};

/**
 * RideWise Icon — renders one icon from the family above.
 *
 * name        key in ICONS (see file header). Unknown names render nothing
 *             (and warn in dev) instead of falling back to a random glyph.
 * size        pixel box, default 18
 * strokeWidth optional override — only for optical fixes at very small sizes
 */
export default function Icon({
  name,
  size = 18,
  strokeWidth,
  className = "",
  title,
  ...rest
}) {
  const body = ICONS[name];
  if (!body) {
    if (import.meta.env.DEV) console.warn(`[Icon] unknown icon: "${name}"`);
    return null;
  }
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? SW}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : "true"}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {body}
    </svg>
  );
}
