// ============================================================
// Settings — how RideWise looks and behaves for this rider
// Route: /settings (protected — requires login + onboarding)
// ============================================================
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import HelpAndFeedback from "./components/account/HelpAndFeedback";
import AdminEmailSettings from "./components/account/AdminEmailSettings";
import DeleteAccount from "./components/account/DeleteAccount";
import { exportMyData } from "../services/accountApi";
import { clearFinishedRides } from "../services/rideApi";
import { forgetCache } from "../services/pageCache";
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

const AUTO_DELETE_OPTIONS = [
  { days: 0,  label: "Never" },
  { days: 1,  label: "1 day" },
  { days: 7,  label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

const THEME_ICONS = {
  dark: "moon",
  light: "sun",
  warm: "sunCloud",
  midnight: "moonStars",
};

const wakeLockSupported = typeof navigator !== "undefined" && "wakeLock" in navigator;

function settingsKey(userId) {
  return userId ? `ridewise-settings-${userId}` : "ridewise-settings";
}

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

function Toggle({ icon, checked, onChange, label, sub, tc, disabled = false }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tc.surface2}`}>
            <Icon name={icon} size={16} />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold">{label}</p>
          {sub && <p className={`mt-0.5 text-xs ${tc.sub}`}>{sub}</p>}
        </div>
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

function OptionBlock({ icon, label, sub, right, tc, disabled = false, children }) {
  return (
    <div className={`py-3 ${disabled ? "opacity-50" : ""}`}>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {icon && (
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tc.surface2}`}>
              <Icon name={icon} size={16} />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold">{label}</p>
            {sub && <p className={`mt-0.5 text-xs ${tc.sub}`}>{sub}</p>}
          </div>
        </div>
        {right}
      </div>
      {children}
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

export default function Settings() {
  const { user } = useAuth();
  return <SettingsScreen key={user?.id ?? "signed-out"} />;
}

function SettingsScreen() {
  const { user, updateProfile } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (location.hash === "#help-feedback") {
      const el = document.getElementById("help-feedback");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash]);
  const { theme, setTheme, tc } = useTheme(userId);

  // ── Accessibility (this device) ──
  const [settings, setSettings] = useState(() => loadSettings(userId));
  useEffect(() => {
    try {
      const existing = JSON.parse(localStorage.getItem(settingsKey(userId)) || "{}") || {};
      localStorage.setItem(settingsKey(userId), JSON.stringify({ ...existing, ...settings }));
    } catch {
      // storage unavailable
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

  // ── Auto-delete ride data (the account) ──
  const autoDeleteDays = Number(user?.autoDeleteRidesDays) > 0 ? Number(user.autoDeleteRidesDays) : 0;
  const [savingAutoDelete, setSavingAutoDelete] = useState(false);
  const chooseAutoDeleteDays = async (days) => {
    if (days === autoDeleteDays || savingAutoDelete) return;
    setSavingAutoDelete(true);
    try {
      await updateProfile({ autoDeleteRidesDays: days });
      forgetCache(`home-rides-${userId}`);
      forgetCache(`account-stats-${userId}`);
      toast.success(
        days === 0
          ? "Auto-delete turned off."
          : `Finished rides older than ${days}d will auto-delete.`,
      );
    } catch (err) {
      toast.error(err.message || "Couldn't save setting.");
    } finally {
      setSavingAutoDelete(false);
    }
  };

  const [confirmClearRides, setConfirmClearRides] = useState(false);
  const [clearingRides, setClearingRides] = useState(false);
  const handleClearFinishedRides = async () => {
    if (!userId || clearingRides) return;
    if (!confirmClearRides) {
      setConfirmClearRides(true);
      return;
    }
    setClearingRides(true);
    try {
      const res = await clearFinishedRides(userId);
      forgetCache(`home-rides-${userId}`);
      forgetCache(`account-stats-${userId}`);
      toast.success(res?.message || "Completed rides cleared.");
    } catch (err) {
      toast.error(err.message || "Couldn't clear rides.");
    } finally {
      setClearingRides(false);
      setConfirmClearRides(false);
    }
  };

  // ── Privacy (the account) ──
  const profilePublic = user?.profilePublic !== false;
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const setProfilePublic = async (value) => {
    setSavingPrivacy(true);
    try {
      await updateProfile({ profilePublic: value });
      toast.success(value ? "Profile is now public." : "Profile hidden from search.");
    } catch (err) {
      toast.error(err.message || "Couldn't save privacy setting.");
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
      toast.success("Data downloaded.");
    } catch (err) {
      toast.error(err.message || "Couldn't export data.");
    } finally {
      setExporting(false);
    }
  };

  const themeOptions = Object.entries(themes).map(([key, option]) => ({
    key,
    label: option.label,
    preview: option.preview,
    icon: THEME_ICONS[key] || "theme",
  }));

  return (
    <div className={`relative min-h-screen w-full overflow-x-hidden ${tc.bg} ${tc.text}`}>
      <Sidebar tc={tc} />
      <TopBar theme={theme} setTheme={setTheme} tc={tc} userId={userId} />
      <MobileNav tc={tc} />

      <main className="px-4 pb-28 pt-24 lg:ml-64 lg:pb-12">
        <div className="mx-auto max-w-2xl">
          <button
            type="button"
            onClick={() => navigate("/account")}
            className={`mb-4 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline lg:hidden ${tc.sub}`}
          >
            <Icon name="arrowLeft" size={16} />
            Account
          </button>

          <header className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className={`mt-1 text-sm ${tc.sub}`}>Preferences, privacy &amp; account controls</p>
          </header>

          {/* ── APPEARANCE ── */}
          <section className={`mb-4 rounded-xl border p-5 ${tc.card}`}>
            <SectionHeader icon="theme" title="Appearance" tc={tc} />
            <p className={`mb-4 text-xs ${tc.sub}`}>
              Follows time of day until chosen.
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
                    <span
                      className={`flex h-9 w-11 shrink-0 flex-col justify-end gap-[3px] rounded-lg border p-1.5 ${option.preview.page} ${tc.divider}`}
                    >
                      <span className={`h-1 w-3 rounded-full ${option.preview.surface}`} />
                      <span className={`h-1 w-6 rounded-full ${option.preview.ink}`} />
                      <span className={`h-1 w-2 rounded-full ${option.preview.accent}`} />
                    </span>
                    <span className="flex flex-1 items-center gap-1.5">
                      <Icon name={option.icon} size={15} className={tc.sub} />
                      <span>{option.label}</span>
                    </span>
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
              icon="volume"
              checked={voiceOn && voiceSupported}
              onChange={setVoiceOn}
              disabled={!voiceSupported}
              label="Spoken directions"
              sub={voiceSupported ? "Read turns aloud on the map" : "Not supported in this browser"}
              tc={tc}
            />

            {voiceSupported && (
              <>
                <div className={`border-t ${tc.divider}`} />
                <OptionBlock
                  icon="gauge"
                  label="Voice speed"
                  sub="Tap to preview"
                  disabled={!voiceOn}
                  tc={tc}
                >
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
                </OptionBlock>
              </>
            )}

            <div className={`border-t ${tc.divider}`} />
            <Toggle
              icon="mobile"
              checked={keepAwake && wakeLockSupported}
              onChange={setKeepAwake}
              disabled={!wakeLockSupported}
              label="Keep screen on"
              sub={wakeLockSupported ? "Prevent screen lock during rides" : "Not supported in this browser"}
              tc={tc}
            />

            <div className={`border-t ${tc.divider}`} />
            <OptionBlock
              icon="layers"
              label="Map style"
              sub="Auto matches your active theme"
              tc={tc}
            >
              <div className="flex flex-wrap gap-2">
                {[{ id: MAP_STYLE_AUTO, label: "Auto" }, ...MAP_STYLES].map((style) => (
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
            </OptionBlock>

            <div className={`border-t ${tc.divider}`} />
            <OptionBlock
              icon="clock"
              label="Auto-delete rides"
              sub="Remove finished rides after set time"
              right={savingAutoDelete ? <Icon name="spinner" size={14} className={`rw-spin ${tc.sub}`} /> : null}
              tc={tc}
            >
              <div className="flex flex-wrap gap-2">
                {AUTO_DELETE_OPTIONS.map((option) => (
                  <Chip
                    key={option.days}
                    selected={autoDeleteDays === option.days}
                    onClick={() => chooseAutoDeleteDays(option.days)}
                    disabled={savingAutoDelete}
                    tc={tc}
                  >
                    {option.label}
                  </Chip>
                ))}
              </div>
            </OptionBlock>
          </section>

          {/* ── ACCESSIBILITY ── */}
          <section className={`mb-4 rounded-xl border p-5 ${tc.card}`}>
            <SectionHeader icon="access" title="Accessibility" tc={tc} />

            <OptionBlock
              icon="list"
              label="Text size"
              sub="Adjust app font scale"
              tc={tc}
            >
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
            </OptionBlock>

            <div className={`border-t ${tc.divider}`} />
            <Toggle
              icon="pause"
              checked={settings.reduceMotion}
              onChange={update("reduceMotion")}
              label="Reduce motion"
              sub="Turn off animations & transitions"
              tc={tc}
            />
            <div className={`border-t ${tc.divider}`} />
            <Toggle
              icon="eye"
              checked={settings.highContrast}
              onChange={update("highContrast")}
              label="High contrast"
              sub="Sharper text & borders"
              tc={tc}
            />
          </section>

          {/* ── PRIVACY ── */}
          <section className={`mb-4 rounded-xl border p-5 ${tc.card}`}>
            <SectionHeader icon="lock" title="Privacy" tc={tc} />
            <Toggle
              icon="globe"
              checked={profilePublic}
              onChange={setProfilePublic}
              disabled={savingPrivacy}
              label="Public profile"
              sub="Visible in rider search & nearby"
              tc={tc}
            />
            <div className={`flex items-center gap-2 border-t pt-3 text-xs ${tc.divider} ${tc.sub}`}>
              <Icon name="shield" size={14} className="shrink-0" />
              <span>Phone &amp; exact GPS stay private. Live location shares only during group rides.</span>
            </div>
          </section>

          {/* ── HELP & FEEDBACK ── */}
          <section id="help-feedback" className={`mb-4 scroll-mt-24 rounded-xl border p-5 ${tc.card}`}>
            <SectionHeader icon="help" title="Help & feedback" tc={tc} />
            <p className={`mb-3 text-xs ${tc.sub}`}>
              Report bugs, share ideas, or view quick guides.
            </p>
            <HelpAndFeedback tc={tc} />
          </section>

          {/* ── ADMIN: FEEDBACK & GMAIL ALERTS ── */}
          {user?.role === "ADMIN" && (
            <section id="admin-email-alerts" className={`mb-4 scroll-mt-24 rounded-xl border p-5 ${tc.card}`}>
              <AdminEmailSettings tc={tc} />
            </section>
          )}

          {/* ── ACCOUNT & SECURITY ── */}
          <section className={`mb-4 rounded-xl border p-5 ${tc.card}`}>
            <SectionHeader icon="shield" title="Account & security" tc={tc} />
            <SecuritySettings tc={tc} />
          </section>

          {/* ── YOUR DATA ── */}
          <section className={`mb-4 rounded-xl border p-5 ${tc.card}`}>
            <SectionHeader icon="download" title="Your data" tc={tc} />
            <div className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tc.surface2}`}>
                  <Icon name="download" size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Export data</p>
                  <p className={`mt-0.5 text-xs ${tc.sub}`}>
                    Download profile, rides &amp; orgs as JSON
                  </p>
                </div>
              </div>
              <Button variant="secondary" size="sm" icon="download" tc={tc} loading={exporting} onClick={downloadMyData}>
                Export JSON
              </Button>
            </div>

            <div className={`border-t ${tc.divider}`} />
            <div className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tc.surface2}`}>
                  <Icon name="history" size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Clear ride history</p>
                  <p className={`mt-0.5 text-xs ${tc.sub}`}>
                    Delete all completed &amp; cancelled rides
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {confirmClearRides && (
                  <Button
                    variant="ghost"
                    size="sm"
                    tc={tc}
                    disabled={clearingRides}
                    onClick={() => setConfirmClearRides(false)}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  variant={confirmClearRides ? "danger" : "secondary"}
                  size="sm"
                  icon="trash"
                  tc={tc}
                  loading={clearingRides}
                  onClick={handleClearFinishedRides}
                >
                  {confirmClearRides ? "Tap to confirm" : "Clear history"}
                </Button>
              </div>
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
