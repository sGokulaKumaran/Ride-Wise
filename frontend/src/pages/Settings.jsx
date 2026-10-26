// ============================================================
// Settings — how RideWise looks and behaves for this rider
// Route: /settings (protected — requires login + onboarding)
//
// Every control on this page does something:
//
//   Appearance     theme (applies at once, remembered per account)
//   Rides & map    spoken directions on/off and how fast they are spoken,
//                  keeping the screen awake, and the map style
//   Accessibility  text size, reduced motion, high contrast (applied
//                  app-wide by utils/a11y.js)
//   Privacy        "Public profile" — saved on the server; when off, riders
//                  who are not already connected with you cannot find you
//                  in search or "near me"
//   Account & security  email, password, sign out other devices
//                  (components/account/SecuritySettings)
//   Your data      download everything the account holds, as JSON
//   Delete account (components/account/DeleteAccount)
//
// WHERE THINGS ARE STORED
//   theme, accessibility, voice, screen, map style → this device (localStorage)
//   public profile, email, password                → the rider's account (server)
// ============================================================
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useTheme, themes } from "./hooks/useTheme";
import {
  KEEP_AWAKE_KEY,
  VOICE_RATES,
  loadVoiceRate,
  previewVoice,
  saveVoiceRate,
  usePersistentFlag,
  voiceSupported,
} from "./hooks/useRideAssist";
import { useAuth } from "../context/AuthContext";
import Icon from "./components/ui/Icon";
import Button, { Chip } from "./components/ui/Button";
import SecuritySettings from "./components/account/SecuritySettings";
import DeleteAccount from "./components/account/DeleteAccount";
import { exportMyData } from "../services/accountApi";
import Sidebar from "./components/layout/Sidebar";
import TopBar from "./components/layout/TopBar";
import MobileNav from "./components/layout/MobileNav";
import { applyA11ySettings } from "../utils/a11y";
import {
  MAP_STYLES,
  MAP_STYLE_AUTO,
  loadMapStyleChoice,
  saveMapStyleChoice,
} from "./components/ride/mapStyles";

const A11Y_DEFAULTS = { textSize: "medium", reduceMotion: false, highContrast: false };

const wakeLockSupported = typeof navigator !== "undefined" && "wakeLock" in navigator;

function settingsKey(userId) {
  return userId ? `ridewise-settings-${userId}` : "ridewise-settings";
}

// Saved accessibility choices for this rider (or the defaults)
function loadSettings(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey(userId)) || "null");
    if (saved && typeof saved === "object") {
      return {
        textSize: saved.textSize || A11Y_DEFAULTS.textSize,
        reduceMotion: Boolean(saved.reduceMotion),
        highContrast: Boolean(saved.highContrast),
      };
    }
  } catch {
    // unreadable → defaults
  }
  return { ...A11Y_DEFAULTS };
}

// ── A labelled on/off switch ─────────────────────────────────
// ON uses the functional accent (an active state is one of the few places
// colour is allowed); OFF stays a neutral track.
function Toggle({ checked, onChange, label, sub, tc, disabled = false }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        {sub && <p className={`mt-0.5 text-xs ${tc.sub}`}>{sub}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
          checked ? tc.btnAccent : `${tc.isLight ? "bg-black/15" : "bg-white/15"} border-transparent`
        }`}
      >
        <span
          className={`absolute left-[3px] top-[3px] h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function SectionHeader({ icon, title, tc }) {
  return (
    <div className="mb-1 flex items-center gap-2.5">
      <Icon name={icon} size={16} className={tc.sub} />
      <h2 className="text-base font-bold">{title}</h2>
    </div>
  );
}

// Re-created when the account changes, so one rider's choices are never
// shown to (or saved over) another's.
export default function Settings() {
  const { user } = useAuth();
  return <SettingsScreen key={user?.id ?? "signed-out"} />;
}

function SettingsScreen() {
  const { user, updateProfile } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const { theme, setTheme, tc } = useTheme(userId);

  // ── Accessibility (this device) ──
  const [settings, setSettings] = useState(() => loadSettings(userId));
  useEffect(() => {
    try {
      // Merge, so keys written by older versions of this page survive.
      const existing = JSON.parse(localStorage.getItem(settingsKey(userId)) || "{}") || {};
      localStorage.setItem(settingsKey(userId), JSON.stringify({ ...existing, ...settings }));
    } catch {
      // storage unavailable — the choice still applies for this visit
    }
    applyA11ySettings(settings);
  }, [settings, userId]);
  const update = (key) => (value) => setSettings((previous) => ({ ...previous, [key]: value }));

  // ── Rides & map (this device) ──
  const [voiceOn, setVoiceOn] = usePersistentFlag("ridewise-voice-guidance", true);
  const [voiceRate, setVoiceRate] = useState(loadVoiceRate);
  const chooseVoiceRate = (id) => {
    setVoiceRate(id);
    saveVoiceRate(id);
    previewVoice();
  };
  const [keepAwake, setKeepAwake] = usePersistentFlag(KEEP_AWAKE_KEY, true);
  const [mapStyle, setMapStyle] = useState(loadMapStyleChoice);
  const chooseMapStyle = (choice) => {
    setMapStyle(choice);
    saveMapStyleChoice(choice);
  };

  // ── Privacy (the account) ──
  const profilePublic = user?.profilePublic !== false;
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const setProfilePublic = async (value) => {
    setSavingPrivacy(true);
    try {
      await updateProfile({ profilePublic: value });
      toast.success(value
        ? "Other riders can find you again."
        : "You're hidden from search and from riders nearby.");
    } catch (err) {
      toast.error(err.message || "Couldn't save that. Please try again.");
    } finally {
      setSavingPrivacy(false);
    }
  };

  // ── Your data (the account) ──
  const [exporting, setExporting] = useState(false);
  const downloadMyData = async () => {
    setExporting(true);
    try {
      const data = await exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ridewise-data-${user?.username || "account"}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Your data was downloaded.");
    } catch (err) {
      toast.error(err.message || "Couldn't prepare your data. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  // Labels, glyphs and swatches come straight from the theme system
  const themeOptions = Object.entries(themes).map(([key, option]) => ({
    key, label: option.label, preview: option.preview,
  }));

  return (
    <div className={`relative min-h-screen w-full overflow-x-hidden ${tc.bg} ${tc.text}`}>
      <Sidebar tc={tc} />
      <TopBar theme={theme} setTheme={setTheme} tc={tc} userId={userId} />
      <MobileNav tc={tc} />

      <main className="px-4 pb-28 pt-24 lg:ml-64 lg:pb-12">
        <div className="mx-auto max-w-2xl">
          {/* Back to Account (phones reach Settings from the Account tab) */}
          <button
            type="button"
            onClick={() => navigate("/account")}
            className={`mb-4 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline lg:hidden ${tc.sub}`}
          >
            <Icon name="arrowLeft" size={16} />
            Back to Account
          </button>

          <header className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className={`mt-1 text-sm ${tc.sub}`}>Make RideWise look and behave the way you like.</p>
          </header>

          {/* ── APPEARANCE ── */}
          <section className={`mb-4 rounded-xl border p-5 ${tc.card}`}>
            <SectionHeader icon="theme" title="Appearance" tc={tc} />
            <p className={`mb-4 text-xs ${tc.sub}`}>
              Until you pick one, RideWise follows the time of day.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {themeOptions.map((option) => {
                const active = theme === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setTheme(option.key)}
                    aria-pressed={active}
                    className={`flex items-center gap-3 rounded-lg border p-2.5 text-left text-sm font-semibold transition-colors ${
                      active ? tc.accentSoft : `${tc.card} ${tc.cardHover}`
                    }`}
                  >
                    {/* swatch: page, surface, ink, accent of that theme */}
                    <span
                      className={`flex h-9 w-11 shrink-0 flex-col justify-end gap-[3px] rounded-lg border p-1.5 ${option.preview.page} ${tc.divider}`}
                    >
                      <span className={`h-1 w-3 rounded-full ${option.preview.surface}`} />
                      <span className={`h-1 w-6 rounded-full ${option.preview.ink}`} />
                      <span className={`h-1 w-2 rounded-full ${option.preview.accent}`} />
                    </span>
                    <span className="flex-1">{option.label}</span>
                    {active ? <Icon name="check" size={16} /> : null}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── RIDES & MAP ── */}
          <section className={`mb-4 rounded-xl border p-5 ${tc.card}`}>
            <SectionHeader icon="map" title="Rides & map" tc={tc} />

            <Toggle
              checked={voiceOn && voiceSupported}
              onChange={setVoiceOn}
              disabled={!voiceSupported}
              label="Spoken directions"
              sub={voiceSupported
                ? "Reads each turn aloud while you ride. You can also mute it on the map."
                : "This browser can't speak directions."}
              tc={tc}
            />

            {voiceSupported && (
              <div className={`pb-3 ${voiceOn ? "" : "opacity-50"}`}>
                <p className="text-sm font-semibold">Voice speed</p>
                <p className={`mb-2.5 mt-0.5 text-xs ${tc.sub}`}>Pick one to hear a sample.</p>
                <div className="flex gap-2">
                  {VOICE_RATES.map((option) => (
                    <Chip
                      key={option.id}
                      selected={voiceRate === option.id}
                      onClick={() => chooseVoiceRate(option.id)}
                      disabled={!voiceOn}
                      tc={tc}
                      className="flex-1 justify-center"
                    >
                      {option.label}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            <div className={`border-t ${tc.divider}`} />
            <Toggle
              checked={keepAwake && wakeLockSupported}
              onChange={setKeepAwake}
              disabled={!wakeLockSupported}
              label="Keep the screen on while riding"
              sub={wakeLockSupported
                ? "Stops the phone locking mid-ride, so GPS keeps working. Turn off to save battery."
                : "This browser can't keep the screen on."}
              tc={tc}
            />

            <div className={`border-t ${tc.divider}`} />
            <div className="py-3">
              <p className="text-sm font-semibold">Map style</p>
              <p className={`mb-2.5 mt-0.5 text-xs ${tc.sub}`}>
                Automatic matches the map to your theme — dark map for dark themes.
              </p>
              <div className="flex flex-wrap gap-2">
                {[{ id: MAP_STYLE_AUTO, label: "Automatic" }, ...MAP_STYLES].map((style) => (
                  <Chip
                    key={style.id}
                    selected={mapStyle === style.id}
                    onClick={() => chooseMapStyle(style.id)}
                    tc={tc}
                  >
                    {style.label}
                  </Chip>
                ))}
              </div>
            </div>
          </section>

          {/* ── ACCESSIBILITY ── */}
          <section className={`mb-4 rounded-xl border p-5 ${tc.card}`}>
            <SectionHeader icon="access" title="Accessibility" tc={tc} />

            <div className="py-3">
              <p className="mb-2 text-sm font-semibold">Text size</p>
              <div className="flex gap-2">
                {["small", "medium", "large"].map((size) => (
                  <Chip
                    key={size}
                    selected={settings.textSize === size}
                    onClick={() => update("textSize")(size)}
                    tc={tc}
                    className="flex-1 justify-center capitalize"
                  >
                    {size}
                  </Chip>
                ))}
              </div>
            </div>

            <div className={`border-t ${tc.divider}`} />
            <Toggle
              checked={settings.reduceMotion}
              onChange={update("reduceMotion")}
              label="Reduce motion"
              sub="Turns off animations and transitions, including on the map"
              tc={tc}
            />
            <div className={`border-t ${tc.divider}`} />
            <Toggle
              checked={settings.highContrast}
              onChange={update("highContrast")}
              label="High contrast"
              sub="Stronger text and borders"
              tc={tc}
            />
          </section>

          {/* ── PRIVACY ── */}
          <section className={`mb-4 rounded-xl border p-5 ${tc.card}`}>
            <SectionHeader icon="lock" title="Privacy" tc={tc} />
            <Toggle
              checked={profilePublic}
              onChange={setProfilePublic}
              disabled={savingPrivacy}
              label="Public profile"
              sub="When off, riders you're not connected with can't find you in search or near them."
              tc={tc}
            />
            <p className={`border-t pt-3 text-xs ${tc.divider} ${tc.sub}`}>
              Other riders never see your exact location or phone number. In a group ride your live
              position is shared only with that ride&apos;s riders, and only while you ride.
            </p>
          </section>

          {/* ── ACCOUNT & SECURITY ── */}
          <section className={`mb-4 rounded-xl border p-5 ${tc.card}`}>
            <SectionHeader icon="shield" title="Account & security" tc={tc} />
            <SecuritySettings tc={tc} />
          </section>

          {/* ── YOUR DATA ── */}
          <section className={`mb-4 rounded-xl border p-5 ${tc.card}`}>
            <SectionHeader icon="download" title="Your data" tc={tc} />
            <div className="flex flex-wrap items-center justify-between gap-3 py-2">
              <p className={`max-w-md text-xs ${tc.sub}`}>
                A copy of your profile, rides, connections, organizations and the trips you drove, as a JSON file.
              </p>
              <Button variant="secondary" size="sm" icon="download" tc={tc} loading={exporting} onClick={downloadMyData}>
                Download my data
              </Button>
            </div>
          </section>

          {/* ── DELETE ACCOUNT ── */}
          <section className={`mb-4 rounded-xl border p-5 ${tc.card}`}>
            <SectionHeader icon="trash" title="Delete account" tc={tc} />
            <DeleteAccount tc={tc} />
          </section>

          <p className={`py-4 text-center text-xs ${tc.sub}`}>RideWise v1.0</p>
        </div>
      </main>
    </div>
  );
}
