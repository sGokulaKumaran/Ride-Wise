// ============================================================
// Login — the entry page (log in or sign up)
// Route: /
//
//   "Login"   → verifies email + password → /home
//   "Sign Up" → creates the account → /onboarding
//
// ALSO HERE
//   · theme switcher (the choice carries into the app after login)
//   · voice control: say "dark", "light", "warm", "midnight", "login", "signup"
//   · a password strength meter while signing up
//   · a notice when the rider was sent here because their session ended
//
// All auth logic lives in AuthContext; this file is the form.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { themes, useTheme } from "../hooks/useTheme";
import Icon from "../components/ui/Icon";
import Button, { IconButton } from "../components/ui/Button";

// What RideWise actually does — shown beside the form on wide screens.
const HIGHLIGHTS = [
  {
    icon: "navigate",
    title: "Turn-by-turn navigation",
    text: "Spoken directions and a live map that follows you along the route.",
  },
  {
    icon: "riders",
    title: "Group rides",
    text: "Invite your riders and see everyone's position on one shared map.",
  },
  {
    icon: "history",
    title: "Every ride remembered",
    text: "Distance, time and route for each ride, ready whenever you look back.",
  },
];

// 0–4: length, upper case, digit, symbol
function passwordScore(password) {
  let score = 0;
  if (password.length > 5) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}
const STRENGTH = [
  { label: "Too short", tone: "danger" },
  { label: "Weak", tone: "danger" },
  { label: "Fair", tone: "warn" },
  { label: "Good", tone: "ok" },
  { label: "Strong", tone: "ok" },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, signup, isAuthenticated, isFullyOnboarded } = useAuth();

  // The shared theme system, without a user: the pick is stored under the
  // same key the app falls back to, so it carries over after login.
  const { theme, setTheme, tc } = useTheme();

  const dropdownRef = useRef(null);
  const [isLogin, setIsLogin] = useState(true);
  const [themeOpen, setThemeOpen] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);

  // ── Form ──
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(() => {
    // Sent here because the session ended (expired, or the account was suspended)
    try {
      return sessionStorage.getItem("ridewise-session-expired")
        ? "Your session has ended. Please sign in again."
        : "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    try { sessionStorage.removeItem("ridewise-session-expired"); } catch { /* ignore */ }
  }, []);

  // Already logged in → straight to the right page
  useEffect(() => {
    if (isAuthenticated) {
      navigate(isFullyOnboarded ? "/home" : "/onboarding", { replace: true });
    }
  }, [isAuthenticated, isFullyOnboarded, navigate]);

  // Close the theme menu when clicking outside it
  useEffect(() => {
    const handler = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setThemeOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Voice control (one phrase, up to 6 seconds) ──
  const voiceRef = useRef({ recognition: null, timer: 0 });
  useEffect(() => () => {
    const voice = voiceRef.current;
    try { voice.recognition?.stop(); } catch { /* already stopped */ }
    clearTimeout(voice.timer);
  }, []);

  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setNotice("Voice control isn't supported in this browser. Try Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const heard = event.results[0][0].transcript.toLowerCase().trim();
      const spokenTheme = ["midnight", "dark", "light", "warm"].find((name) => heard.includes(name));
      if (spokenTheme) setTheme(spokenTheme);
      if (heard.includes("sign up") || heard.includes("signup")) setIsLogin(false);
      else if (heard.includes("login") || heard.includes("log in") || heard.includes("sign in")) setIsLogin(true);
    };
    recognition.onend = () => setVoiceMode(false);
    recognition.onerror = () => setVoiceMode(false);

    try {
      recognition.start();
    } catch {
      return; // already listening
    }
    voiceRef.current.recognition = recognition;
    setVoiceMode(true);

    clearTimeout(voiceRef.current.timer);
    voiceRef.current.timer = setTimeout(() => {
      try { recognition.stop(); } catch { /* already stopped */ }
      setVoiceMode(false);
    }, 6000);
  };

  // ── Submit ──
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setError("");
    setNotice("");

    if (!email || !password) { setError("Please fill in both fields."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }

    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password, rememberMe);
        navigate("/home");
      } else {
        await signup(email, password);
        navigate("/onboarding");
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (toLogin) => {
    setIsLogin(toLogin);
    setError("");
    setNotice("");
  };

  const score = passwordScore(password);
  const strength = STRENGTH[score];

  return (
    <div className={`relative min-h-screen w-full overflow-hidden ${tc.bg} ${tc.text}`}>

      {/* ── Top bar: logo · voice · theme ── */}
      <div className="fixed left-5 right-5 top-5 z-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${tc.button}`}>
            <Icon name="ride" size={18} />
          </div>
          <span className="text-lg font-bold tracking-tight">
            Ride<span className="opacity-50">Wise</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <IconButton
            variant={voiceMode ? "soft" : "secondary"}
            size="sm"
            icon={voiceMode ? "micOff" : "mic"}
            label='Voice control: say "dark", "light", "login" or "signup"'
            tc={tc}
            onClick={startVoice}
          />

          <div ref={dropdownRef} className="relative">
            <Button
              variant="secondary"
              size="sm"
              iconRight
              icon={themeOpen ? "chevronUp" : "chevronDown"}
              tc={tc}
              title="Change theme"
              aria-expanded={themeOpen}
              onClick={() => setThemeOpen(!themeOpen)}
            >
              <Icon name={tc.icon} size={15} />
              {tc.label}
            </Button>

            {themeOpen && (
              <div className={`absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border shadow-lg ${tc.card}`}>
                {Object.entries(themes).map(([key, option]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setTheme(key); setThemeOpen(false); }}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                      theme === key ? `${tc.navActive} font-semibold` : tc.navIdle
                    }`}
                  >
                    <Icon name={option.icon} size={16} />
                    <span>{option.label}</span>
                    {theme === key && <Icon name="check" size={14} className="ml-auto" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Two columns on wide screens ── */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-24">
        <div className="grid w-full max-w-5xl grid-cols-1 items-center gap-12 lg:grid-cols-2">

          {/* Left: what RideWise is */}
          <div className="hidden space-y-8 lg:block">
            <div>
              <h1 className="text-5xl font-bold leading-tight tracking-tight">
                Ride further,<br />together.
              </h1>
              <p className={`mt-4 max-w-sm text-base leading-relaxed ${tc.sub}`}>
                Plan a route, follow it turn by turn, and keep your whole group on one map.
              </p>
            </div>

            <ul className="space-y-5">
              {HIGHLIGHTS.map((item) => (
                <li key={item.title} className="flex items-start gap-4">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${tc.card}`}>
                    <Icon name={item.icon} size={20} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{item.title}</span>
                    <span className={`block text-sm ${tc.sub}`}>{item.text}</span>
                  </span>
                </li>
              ))}
            </ul>

            <p className={`flex items-center gap-2 text-xs ${tc.sub}`}>
              <Icon name="mic" size={14} />
              Voice control: say &ldquo;dark&rdquo;, &ldquo;light&rdquo;, &ldquo;login&rdquo; or &ldquo;signup&rdquo;
            </p>
          </div>

          {/* Right: the form */}
          <div className={`rounded-xl border p-7 md:p-9 ${tc.card}`}>
            {/* Login / Sign Up */}
            <div role="tablist" className={`mb-8 flex rounded-full p-1 ${tc.surface2}`}>
              {[
                { label: "Login", login: true },
                { label: "Sign Up", login: false },
              ].map((tab) => {
                const active = isLogin === tab.login;
                return (
                  <button
                    key={tab.label}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => switchMode(tab.login)}
                    className={`flex-1 rounded-full border py-2 text-sm font-semibold transition-colors ${
                      active ? tc.button : `border-transparent ${tc.navIdle}`
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight">
                {isLogin ? "Welcome back" : "Create your account"}
              </h2>
              <p className={`mt-1 text-sm ${tc.sub}`}>
                {isLogin ? "Sign in to pick up where you left off." : "It takes about a minute."}
              </p>
            </div>

            {notice && (
              <div role="status" className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${tc.record} ${tc.text}`}>
                <Icon name="info" size={16} className="mt-0.5" />
                <span>{notice}</span>
              </div>
            )}
            {error && (
              <div role="alert" className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${tc.dangerSoft}`}>
                <Icon name="alertCircle" size={16} className="mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="login-email" className={`mb-2 block text-xs font-medium ${tc.sub}`}>
                  Email
                </label>
                <div className="relative">
                  <Icon name="mail" size={16} className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${tc.sub}`} />
                  <input
                    type="email"
                    id="login-email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className={`w-full rounded-lg border py-3 pl-10 pr-4 text-sm ${tc.input}`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className={`mb-2 block text-xs font-medium ${tc.sub}`}>
                  Password
                </label>
                <div className="relative">
                  <Icon name="lock" size={16} className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${tc.sub}`} />
                  <input
                    type={showPassword ? "text" : "password"}
                    id="login-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={isLogin ? "Your password" : "At least 6 characters"}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    className={`w-full rounded-lg border py-3 pl-10 pr-11 text-sm ${tc.input}`}
                  />
                  <IconButton
                    variant="ghost"
                    size="sm"
                    icon={showPassword ? "eyeOff" : "eye"}
                    label={showPassword ? "Hide password" : "Show password"}
                    tc={tc}
                    type="button"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2"
                    onClick={() => setShowPassword(!showPassword)}
                  />
                </div>

                {/* Strength (sign up only) */}
                {!isLogin && password && (
                  <div className="mt-2 flex items-center gap-3">
                    <div className={`flex h-1 flex-1 gap-1`} aria-hidden="true">
                      {[1, 2, 3, 4].map((level) => (
                        <span
                          key={level}
                          className={`h-full flex-1 rounded-full ${level <= score ? `bg-current ${tc[strength.tone]}` : tc.hairline}`}
                        />
                      ))}
                    </div>
                    <span className={`text-xs font-medium ${tc[strength.tone]}`}>{strength.label}</span>
                  </div>
                )}
              </div>

              {isLogin && (
                <div className="flex items-center justify-between text-sm">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                      className="h-4 w-4 accent-[#FF7A1A]"
                    />
                    <span className={tc.sub}>Remember me</span>
                  </label>
                  <button
                    type="button"
                    className={`text-xs hover:underline ${tc.sub}`}
                    onClick={() => {
                      setError("");
                      setNotice("Password reset by email isn't available yet. Ask your RideWise admin to help you regain access.");
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <Button
                type="submit"
                id="auth-submit-btn"
                variant="primary"
                size="lg"
                full
                tc={tc}
                loading={loading}
                icon="arrowRight"
                iconRight
              >
                {loading
                  ? isLogin ? "Signing in…" : "Creating account…"
                  : isLogin ? "Sign in" : "Create account"}
              </Button>

              <p className={`text-center text-sm ${tc.sub}`}>
                {isLogin ? "New to RideWise?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => switchMode(!isLogin)}
                  className={`font-semibold hover:underline ${tc.text}`}
                >
                  {isLogin ? "Sign up" : "Log in"}
                </button>
              </p>
            </form>

            {/* What happens next (sign up only) */}
            {!isLogin && (
              <div className={`mt-6 rounded-lg border p-4 ${tc.record}`}>
                <p className={`mb-3 text-xs font-semibold ${tc.sub}`}>What happens next</p>
                <ol className="space-y-2">
                  {[
                    "Create your account",
                    "Pick a username — about 30 seconds",
                    "Start your first ride",
                  ].map((text, index) => (
                    <li key={text} className={`flex items-center gap-2.5 text-xs ${index === 0 ? tc.text : tc.sub}`}>
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${
                        index === 0 ? tc.button : `${tc.surface2} ${tc.divider}`
                      }`}>
                        {index + 1}
                      </span>
                      {text}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
