// ============================================================
// ⚙️ Settings — App settings page
// Route: /settings (protected — requires login + onboarding)
//
// SECTIONS:
//   1. Appearance     → Theme switcher (live preview)
//   2. Accessibility  → Text Size, Reduce Motion, High Contrast
//   3. Notifications  → Ride alerts, Messages, Community updates
//   4. Privacy        → Profile visibility, Show online status
//
// BEHAVIOR:
//   - Theme toggle applies immediately (uses useTheme hook)
//   - All other toggles are local state for now (no backend persistence yet)
//   - Each toggle shows a clear on/off visual
//
// BACKEND-READY:
//   When backend is ready, save each setting with:
//   await axios.put('/api/user/settings', { theme, notifications, ... })
//   You can add a debounced auto-save or an explicit "Save" button.
// ============================================================
import { useState } from "react";
import { useTheme } from "./hooks/useTheme";
import Sidebar from "./components/layout/Sidebar";
import TopBar from "./components/layout/TopBar";
import MobileNav from "./components/layout/MobileNav";

// ── Small reusable toggle component ─────────────────────────
// Renders a label + description on the left, a switch on the right.
// "checked" controls the visual state; "onChange" fires when clicked.
function Toggle({ checked, onChange, label, sub, tc }) {
  return (
    <div className="flex items-center justify-between py-3">
      {/* Left side: text */}
      <div>
        <p className="font-semibold text-sm">{label}</p>
        {sub && <p className={`text-xs mt-0.5 ${tc.sub}`}>{sub}</p>}
      </div>
      {/* Right side: switch */}
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${
          checked ? "bg-orange-500" : "bg-gray-500/30"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

// ── Small reusable section header ────────────────────────────
// Icon box + title, used to start each settings section.
function SectionHeader({ icon, title, tc }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
        <i className={`fa ${icon} text-orange-400 text-sm`} />
      </div>
      <h2 className="font-black text-base">{title}</h2>
    </div>
  );
}

export default function Settings() {
  // Pull current theme + setter from the global theme hook
  const { theme, setTheme, tc, allThemes } = useTheme();

  // ── Accessibility settings (local state for now) ─────────────
  const [textSize,      setTextSize]      = useState("medium");  // small | medium | large
  const [reduceMotion,  setReduceMotion]  = useState(false);
  const [highContrast,  setHighContrast]  = useState(false);

  // ── Notification settings ────────────────────────────────────
  const [notifyRides,     setNotifyRides]     = useState(true);
  const [notifyMessages,  setNotifyMessages]  = useState(true);
  const [notifyCommunity, setNotifyCommunity] = useState(false);

  // ── Privacy settings ─────────────────────────────────────────
  const [profilePublic,    setProfilePublic]    = useState(true);
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);

  // Theme options (pulled from useTheme's allThemes)
  const themeOptions = [
    { key: "dark",     icon: "🌙", label: "Dark" },
    { key: "light",    icon: "☀️", label: "Light" },
    { key: "warm",     icon: "🌅", label: "Warm" },
    { key: "midnight", icon: "🌌", label: "Midnight" },
  ];

  return (
    <div className={`relative min-h-screen w-full overflow-x-hidden ${tc.bg} ${tc.text}`}>
      <Sidebar tc={tc} />
      <TopBar theme={theme} setTheme={setTheme} tc={tc} />
      <MobileNav tc={tc} />

      <main className="lg:ml-64 pt-20 px-4 pb-28 lg:pb-8">
        <div className="max-w-2xl mx-auto">
          {/* ── Page header ──────────────────────────────────── */}
          <div className="mb-7">
            <h1 className="text-3xl font-black mb-1">⚙️ Settings</h1>
            <p className={`text-sm ${tc.sub}`}>Customize your RideWise experience</p>
          </div>

          {/* ══════════════════════════════════════════════════
              APPEARANCE
          ══════════════════════════════════════════════════ */}
          <div className={`rounded-2xl border p-5 mb-4 ${tc.card}`}>
            <SectionHeader icon="fa-palette" title="Appearance" tc={tc} />
            <p className={`text-xs ${tc.sub} mb-4`}>
              Choose a theme or let RideWise auto-select based on time of day.
            </p>
            {/* Theme grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {themeOptions.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTheme(t.key)}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all hover:scale-[1.02] font-semibold text-sm ${
                    theme === t.key
                      ? "border-orange-500 bg-orange-500/10"
                      : `${tc.card} hover:border-orange-500/40`
                  }`}
                >
                  <span className="text-lg">{t.icon}</span>
                  <span className="flex-1 text-left">{t.label}</span>
                  {theme === t.key && (
                    <i className="fa fa-check-circle text-orange-400 text-xs" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              ACCESSIBILITY
          ══════════════════════════════════════════════════ */}
          <div className={`rounded-2xl border p-5 mb-4 ${tc.card}`}>
            <SectionHeader icon="fa-universal-access" title="Accessibility" tc={tc} />

            {/* Text Size */}
            <div className="py-3">
              <p className="font-semibold text-sm mb-2">Text Size</p>
              <div className="flex gap-2">
                {["small", "medium", "large"].map((size) => (
                  <button
                    key={size}
                    onClick={() => setTextSize(size)}
                    className={`flex-1 py-2 rounded-xl border text-xs font-bold capitalize transition-all hover:scale-[1.02] ${
                      textSize === size
                        ? "border-orange-500 bg-orange-500/10 text-orange-400"
                        : `${tc.card} hover:border-orange-500/40`
                    }`}
                  >
                    {size.charAt(0).toUpperCase() + size.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className={`border-t ${tc.divider}`} />
            <Toggle
              checked={reduceMotion}
              onChange={setReduceMotion}
              label="Reduce Motion"
              sub="Disables animations and transitions"
              tc={tc}
            />
            <div className={`border-t ${tc.divider}`} />
            <Toggle
              checked={highContrast}
              onChange={setHighContrast}
              label="High Contrast"
              sub="Increases text and border contrast"
              tc={tc}
            />
          </div>

          {/* ══════════════════════════════════════════════════
              NOTIFICATIONS
          ══════════════════════════════════════════════════ */}
          <div className={`rounded-2xl border p-5 mb-4 ${tc.card}`}>
            <SectionHeader icon="fa-bell" title="Notifications" tc={tc} />
            <p className={`text-xs ${tc.sub} mb-2`}>
              Choose which updates you want to receive.
            </p>
            <Toggle
              checked={notifyRides}
              onChange={setNotifyRides}
              label="Ride Alerts"
              sub="When riders near you start a public ride"
              tc={tc}
            />
            <div className={`border-t ${tc.divider}`} />
            <Toggle
              checked={notifyMessages}
              onChange={setNotifyMessages}
              label="Messages"
              sub="New messages from other riders"
              tc={tc}
            />
            <div className={`border-t ${tc.divider}`} />
            <Toggle
              checked={notifyCommunity}
              onChange={setNotifyCommunity}
              label="Community Updates"
              sub="New posts and events in the community"
              tc={tc}
            />
          </div>

          {/* ══════════════════════════════════════════════════
              PRIVACY
          ══════════════════════════════════════════════════ */}
          <div className={`rounded-2xl border p-5 mb-4 ${tc.card}`}>
            <SectionHeader icon="fa-lock" title="Privacy" tc={tc} />
            <p className={`text-xs ${tc.sub} mb-2`}>
              Control who can see your profile and activity.
            </p>
            <Toggle
              checked={profilePublic}
              onChange={setProfilePublic}
              label="Public Profile"
              sub="Other riders can discover your profile"
              tc={tc}
            />
            <div className={`border-t ${tc.divider}`} />
            <Toggle
              checked={showOnlineStatus}
              onChange={setShowOnlineStatus}
              label="Show Online Status"
              sub="Let others see when you're active"
              tc={tc}
            />
          </div>

          {/* ── App version footer ────────────────────────────── */}
          <div className={`text-center text-xs ${tc.sub} py-4`}>
            RideWise v0.1.0 · Frontend-only prototype
          </div>
        </div>
      </main>
    </div>
  );
}