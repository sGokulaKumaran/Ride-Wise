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
//   - All settings are persisted per-user in localStorage under
//     "ridewise-settings-<userId>" so switching accounts loads
//     the correct settings for that account.
//
// BACKEND-READY:
//   When backend is ready, save each setting with:
//   await axios.put('/api/user/settings', { theme, notifications, ... })
//   You can add a debounced auto-save or an explicit "Save" button.
// ============================================================
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme, themes } from "./hooks/useTheme";
import { useAuth } from "../context/AuthContext";
import Icon from "./components/ui/Icon";
import { Chip } from "./components/ui/Button";
import Sidebar from "./components/layout/Sidebar";
import TopBar from "./components/layout/TopBar";
import MobileNav from "./components/layout/MobileNav";
import { applyA11ySettings } from "../utils/a11y";

// ── Per-user settings localStorage key ──────────────────────
function settingsKey(userId) {
  return userId ? `ridewise-settings-${userId}` : "ridewise-settings";
}

// ── Load saved settings for this user (or return defaults) ──
function loadSettings(userId) {
  try {
    const raw = localStorage.getItem(settingsKey(userId));
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return {
    textSize:        "medium",
    reduceMotion:    false,
    highContrast:    false,
    notifyRides:     true,
    notifyMessages:  true,
    notifyCommunity: false,
    profilePublic:   true,
    showOnlineStatus: true,
  };
}

// ── Small reusable toggle component ─────────────────────────
// Renders a label + description on the left, a switch on the right.
// "checked" controls the visual state; "onChange" fires when clicked.
// ON uses the functional accent (an active state is one of the few
// places colour is allowed); OFF stays a neutral hairline track.
function Toggle({ checked, onChange, label, sub, tc }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      {/* Left side: text */}
      <div>
        <p className="font-semibold text-sm">{label}</p>
        {sub && <p className={`text-xs mt-0.5 ${tc.sub}`}>{sub}</p>}
      </div>
      {/* Right side: switch */}
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full border transition-colors shrink-0 ${
          checked ? tc.btnAccent : `${tc.isLight ? "bg-black/15" : "bg-white/15"} border-transparent`
        }`}
      >
        <span
          className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white ${
            checked ? "translate-x-5" : "translate-x-0"
          } transition-transform`}
        />
      </button>
    </div>
  );
}

// ── Small reusable section header ────────────────────────────
// Monochrome glyph + title, used to start each settings section.
function SectionHeader({ icon, title, tc }) {
  return (
    <div className="flex items-center gap-2.5 mb-1">
      <Icon name={icon} size={16} className={tc.sub} />
      <h2 className="font-bold text-base">{title}</h2>
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const userId   = user?.id;
  const navigate = useNavigate();

  // Pull current theme + setter — scoped to this user
  const { theme, setTheme, tc } = useTheme(userId);

  // ── Load initial settings from per-user localStorage ─────────
  const [settings, setSettings] = useState(() => loadSettings(userId));

  // Re-load settings whenever the logged-in user changes
  // (covers the case where two sessions exist in the same tab)
  useEffect(() => {
    setSettings(loadSettings(userId));
  }, [userId]);

  // Persist settings to localStorage whenever any value changes,
  // and apply accessibility choices (text size / motion / contrast)
  // to the whole app immediately
  useEffect(() => {
    try {
      localStorage.setItem(settingsKey(userId), JSON.stringify(settings));
    } catch (_) {}
    applyA11ySettings(settings);
  }, [settings, userId]);

  // ── Convenience updater ──────────────────────────────────────
  const update = (key) => (value) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  // Theme options come straight from the theme system, so labels, glyphs and
  // preview swatches can never drift out of sync with useTheme.js
  const themeOptions = Object.entries(themes).map(([key, t]) => ({
    key, label: t.label, icon: t.icon, preview: t.preview,
  }));

  return (
    <div className={`relative min-h-screen w-full overflow-x-hidden ${tc.bg} ${tc.text}`}>
      <Sidebar tc={tc} />
      <TopBar theme={theme} setTheme={setTheme} tc={tc} userId={user?.id} />
      <MobileNav tc={tc} />

      <main className="lg:ml-64 pt-20 px-4 pb-28 lg:pb-8">
        <div className="max-w-2xl mx-auto">
          {/* ── Back to Account (mobile only) ────────────────── */}
          {/* On a phone Settings is opened from the Account tab, so give an
              explicit way back that does not depend on the bottom bar.
              Desktop opens Settings from the sidebar dropdown and needs
              no back link. */}
          <button
            type="button"
            onClick={() => navigate("/account")}
            className={`lg:hidden mb-4 inline-flex items-center gap-1.5 text-sm font-semibold transition-colors ${tc.sub} hover:underline`}
          >
            <Icon name="arrowLeft" size={16} />
            Back to Account
          </button>

          {/* ── Page header ──────────────────────────────────── */}
          <div className="mb-7">
            <h1 className="text-2xl font-bold mb-1 flex items-center gap-2.5">
              <Icon name="settings" size={22} />
              Settings
            </h1>
            <p className={`text-sm ${tc.sub}`}>Customize your RideWise experience</p>
          </div>

          {/* ══════════════════════════════════════════════════
              APPEARANCE
          ══════════════════════════════════════════════════ */}
          <div className={`rounded-xl border p-5 mb-4 ${tc.card}`}>
            <SectionHeader icon="theme" title="Appearance" tc={tc} />
            <p className={`text-xs ${tc.sub} mb-4`}>
              Choose a theme or let RideWise auto-select based on time of day.
            </p>
            {/* Theme grid — each option previews its own palette */}
            <div className="grid grid-cols-2 gap-2.5">
              {themeOptions.map((t) => {
                const active = theme === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTheme(t.key)}
                    aria-pressed={active}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border text-sm font-semibold text-left transition-colors ${
                      active ? tc.accentSoft : `${tc.card} ${tc.cardHover}`
                    }`}
                  >
                    {/* swatch: page, surface, ink, accent of that theme */}
                    <span
                      className={`w-11 h-9 rounded-lg border flex flex-col justify-end gap-[3px] p-1.5 shrink-0 ${t.preview.page} ${tc.divider}`}
                    >
                      <span className={`h-1 w-3 rounded-full ${t.preview.surface}`} />
                      <span className={`h-1 w-6 rounded-full ${t.preview.ink}`} />
                      <span className={`h-1 w-2 rounded-full ${t.preview.accent}`} />
                    </span>
                    <span className="flex-1">{t.label}</span>
                    {active ? <Icon name="check" size={16} /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              ACCESSIBILITY
          ══════════════════════════════════════════════════ */}
          <div className={`rounded-xl border p-5 mb-4 ${tc.card}`}>
            <SectionHeader icon="access" title="Accessibility" tc={tc} />

            {/* Text Size */}
            <div className="py-3">
              <p className="font-semibold text-sm mb-2">Text Size</p>
              <div className="flex gap-2">
                {["small", "medium", "large"].map((size) => (
                  <Chip
                    key={size}
                    selected={settings.textSize === size}
                    onClick={() => update("textSize")(size)}
                    tc={tc}
                    className="flex-1 justify-center capitalize"
                  >
                    {size.charAt(0).toUpperCase() + size.slice(1)}
                  </Chip>
                ))}
              </div>
            </div>

            <div className={`border-t ${tc.divider}`} />
            <Toggle
              checked={settings.reduceMotion}
              onChange={update("reduceMotion")}
              label="Reduce Motion"
              sub="Disables animations and transitions"
              tc={tc}
            />
            <div className={`border-t ${tc.divider}`} />
            <Toggle
              checked={settings.highContrast}
              onChange={update("highContrast")}
              label="High Contrast"
              sub="Increases text and border contrast"
              tc={tc}
            />
          </div>

          {/* ══════════════════════════════════════════════════
              NOTIFICATIONS
          ══════════════════════════════════════════════════ */}
          <div className={`rounded-xl border p-5 mb-4 ${tc.card}`}>
            <SectionHeader icon="bell" title="Notifications" tc={tc} />
            <p className={`text-xs ${tc.sub} mb-2`}>
              Choose which updates you want to receive.
            </p>
            <Toggle
              checked={settings.notifyRides}
              onChange={update("notifyRides")}
              label="Ride Alerts"
              sub="When riders near you start a public ride"
              tc={tc}
            />
            <div className={`border-t ${tc.divider}`} />
            <Toggle
              checked={settings.notifyMessages}
              onChange={update("notifyMessages")}
              label="Messages"
              sub="New messages from other riders"
              tc={tc}
            />
            <div className={`border-t ${tc.divider}`} />
            <Toggle
              checked={settings.notifyCommunity}
              onChange={update("notifyCommunity")}
              label="Community Updates"
              sub="New posts and events in the community"
              tc={tc}
            />
          </div>

          {/* ══════════════════════════════════════════════════
              PRIVACY
          ══════════════════════════════════════════════════ */}
          <div className={`rounded-xl border p-5 mb-4 ${tc.card}`}>
            <SectionHeader icon="lock" title="Privacy" tc={tc} />
            <p className={`text-xs ${tc.sub} mb-2`}>
              Control who can see your profile and activity.
            </p>
            <Toggle
              checked={settings.profilePublic}
              onChange={update("profilePublic")}
              label="Public Profile"
              sub="Other riders can discover your profile"
              tc={tc}
            />
            <div className={`border-t ${tc.divider}`} />
            <Toggle
              checked={settings.showOnlineStatus}
              onChange={update("showOnlineStatus")}
              label="Show Online Status"
              sub="Let others see when you're active"
              tc={tc}
            />
          </div>

          {/* ── App version footer ────────────────────────────── */}
          <div className={`text-center text-xs ${tc.sub} py-4`}>
            RideWise v1.0 · Connected to the Spring Boot backend
          </div>
        </div>
      </main>
    </div>
  );
}