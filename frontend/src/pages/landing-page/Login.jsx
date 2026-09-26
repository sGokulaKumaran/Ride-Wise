// ============================================================
// 🚀 Login — Entry point auth page for RideWise
// Route: / (this single page replaces the old Landing.jsx + Login.jsx)
//
// TABS:
//   "Login"   → verifies email + password → navigates to /home
//   "Sign Up" → creates account → navigates to /onboarding (details page)
//
// FEATURES:
//   - Time-based auto-theme on first load (morning=warm, day=light, etc.)
//   - Manual theme switcher (Dark / Light / Warm / Midnight)
//   - Voice control (say "dark", "light", "login", "signup")
//   - Password strength meter (signup only)
//   - Inline error messages from AuthContext
//   - "What happens next" steps panel (signup only)
//
// BACKEND-READY:
//   Auth logic lives in AuthContext.jsx — replace localStorage calls there
//   with API calls when your backend is ready. This file doesn't change.
// ============================================================

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { themes } from "../hooks/useTheme";
import Icon from "../components/ui/Icon";
import Button, { IconButton } from "../components/ui/Button";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, signup, isAuthenticated, isFullyOnboarded } = useAuth();

  // ── Refs for DOM interaction ─────────────────────────────────
  const dropdownRef  = useRef(null);   // for closing theme dropdown on outside click

  // ── UI state ─────────────────────────────────────────────────
  // Theme: restore the last choice. Uses the same "ridewise-theme" key
  // the in-app useTheme hook falls back to, so the theme picked here
  // carries into the app after login.
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem("ridewise-theme");
      if (saved && ["dark", "light", "warm", "midnight"].includes(saved)) return saved;
    } catch { /* storage unavailable */ }
    return "dark";
  });
  // setTheme also persists — dropdown picks and voice commands both save
  const setTheme = useCallback((t) => {
    setThemeState(t);
    try { localStorage.setItem("ridewise-theme", t); } catch { /* ignore */ }
  }, []);
  const [isLogin,    setIsLogin]    = useState(true);   // true = Login tab, false = Sign Up tab
  const [themeOpen,  setThemeOpen]  = useState(false);
  const [voiceMode,  setVoiceMode]  = useState(false);

  // ── Form state ───────────────────────────────────────────────
  const [email,             setEmail]             = useState("");
  const [password,          setPassword]          = useState("");
  const [showPassword,      setShowPassword]      = useState(false);
  const [passwordStrength,  setPasswordStrength]  = useState(0);
  const [rememberMe,        setRememberMe]        = useState(false);
  const [loading,           setLoading]           = useState(false);
  const [error,             setError]             = useState("");

  // ── Theme classes ─────────────────────────────────────────────
  // The shared theme system from useTheme.js is the single source of
  // truth — the login page used to keep its own duplicate theme map.
  const tc = themes[theme];

  // ── Auto-theme by time of day on first load ──────────────────
  useEffect(() => {
    // Only auto-detect when the user has never picked a theme —
    // a saved choice always wins.
    try {
      if (localStorage.getItem("ridewise-theme")) return;
    } catch { /* storage unavailable — fall through to auto-detect */ }
    const hour = new Date().getHours();
    if (hour >= 6  && hour < 12) setTheme("warm");
    else if (hour >= 12 && hour < 18) setTheme("light");
    else if (hour >= 18 && hour < 22) setTheme("dark");
    else setTheme("midnight");
  }, [setTheme]);

  // ── If already authenticated, skip to the correct page ───────
  // Prevents logged-in users from landing back on the login page
  useEffect(() => {
    if (isAuthenticated) {
      navigate(isFullyOnboarded ? "/home" : "/onboarding", { replace: true });
    }
  }, [isAuthenticated, isFullyOnboarded, navigate]);

  // ── Close theme dropdown when clicking outside it ────────────
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setThemeOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Password strength (0-100) for signup ─────────────────────
  useEffect(() => {
    let s = 0;
    if (password.length > 5)           s += 25; // min length
    if (/[A-Z]/.test(password))        s += 25; // uppercase
    if (/[0-9]/.test(password))        s += 25; // number
    if (/[^A-Za-z0-9]/.test(password)) s += 25; // special char
    setPasswordStrength(s);
  }, [password]);

  // ── Voice control (existing behaviour: 6s auto-stop) ──
  // Cleanup added: recognition + timer are stopped on unmount so the mic
  // can't keep running (and setState can't fire) after leaving the page.
  const voiceRef = useRef({ rec: null, timer: 0 });
  useEffect(() => () => {
    try { voiceRef.current.rec?.stop(); } catch { /* already stopped */ }
    clearTimeout(voiceRef.current.timer);
  }, []);
  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice not supported. Try Chrome or Edge."); return; }

    const recognition = new SR();
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript.toLowerCase().trim();
      if (text.includes("dark"))     setTheme("dark");
      if (text.includes("light"))    setTheme("light");
      if (text.includes("warm"))     setTheme("warm");
      if (text.includes("midnight")) setTheme("midnight");
      if (text.includes("login") || text.includes("sign in"))   setIsLogin(true);
      if (text.includes("signup") || text.includes("sign up"))  setIsLogin(false);
    };
    recognition.onend  = () => setVoiceMode(false);
    recognition.onerror = () => setVoiceMode(false);
    recognition.start();
    voiceRef.current.rec = recognition; // tracked so unmount can stop the mic
    setVoiceMode(true);


    // Auto-stop after 6 seconds (timer tracked so unmount can cancel it)
    clearTimeout(voiceRef.current.timer);
    voiceRef.current.timer = setTimeout(() => {
      try { recognition.stop(); } catch (_) {}
      setVoiceMode(false);
    }, 6000);
  };

  // ── Form submit ───────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Basic client-side validation
    if (!email || !password) { setError("Please fill in all fields."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }

    setLoading(true);
    try {
      if (isLogin) {
        // Login → if successful, navigate to home
        await login(email, password, rememberMe);
        navigate("/home");
      } else {
        // Sign Up → navigate to onboarding (details page) — NOT /home yet
        await signup(email, password);
        navigate("/onboarding");
      }
    } catch (err) {
      // Show the error returned by AuthContext (will map to API errors later)
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Password strength bar color
  const strengthColor =
    passwordStrength <= 25 ? "bg-red-500"    :
    passwordStrength <= 50 ? "bg-orange-500" :
    passwordStrength <= 75 ? "bg-yellow-500" : "bg-green-500";

  return (
    <div className={`relative min-h-screen w-full overflow-hidden ${tc.bg} ${tc.text}`}>

      {/* ── Top bar: logo + voice + theme switcher ────────────── */}
      <div className="fixed top-5 left-5 right-5 z-50 flex justify-between items-center">

        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tc.button}`}>
            <Icon name="ride" size={18} />
          </div>
          <span className={`text-lg font-bold tracking-tight ${tc.text}`}>
            Ride<span className="opacity-50">Wise</span>
          </span>
        </div>

        {/* Right: Voice + Theme */}
        <div className="flex items-center gap-2">
          {/* Voice button — red while the mic is listening (functional state) */}
          <IconButton
            variant={voiceMode ? "danger" : "secondary"}
            size="sm"
            icon={voiceMode ? "micOff" : "mic"}
            label='Voice control: say "dark", "light", "login", "signup"'
            tc={tc}
            onClick={startVoice}
          />

          {/* Theme dropdown */}
          <div ref={dropdownRef} className="relative">
            <Button
              variant="secondary"
              size="sm"
              iconRight
              icon={themeOpen ? "chevronUp" : "chevronDown"}
              tc={tc}
              title="Change theme"
              onClick={() => setThemeOpen(!themeOpen)}
            >
              <Icon name={tc.icon} size={15} />
              {tc.label}
            </Button>

            {themeOpen && (
              <div className={`absolute right-0 mt-2 w-44 rounded-xl border overflow-hidden z-50 ${tc.card}`}>
                {Object.entries(themes).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => { setTheme(key); setThemeOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                      theme === key ? `${tc.navActive} font-semibold` : tc.navIdle
                    }`}
                  >
                    <Icon name={val.icon} size={16} />
                    <span>{val.label}</span>
                    {theme === key && <Icon name="check" size={14} className="ml-auto" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Main content: 2-column layout on desktop ─────────── */}
      <div className="relative min-h-screen flex items-center justify-center px-4 py-24 z-10">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          {/* ── Left column: marketing copy (desktop only) ──────── */}
          <div className="hidden lg:block space-y-7">

            {/* Live badge */}
            <div className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs tracking-widest font-semibold ${tc.card}`}>
              <span className={`w-2 h-2 rounded-full bg-current ${tc.ok}`} />
              5,000+ ACTIVE RIDERS
            </div>

            {/* Headline */}
            <h1 className={`text-5xl font-bold leading-tight tracking-tight ${tc.text}`}>
              Your Next<br />
              Ride Starts Here
            </h1>

            <p className={`text-base leading-relaxed max-w-sm ${tc.sub}`}>
              Connect with riders nearby, plan epic routes, and share your journey with a passionate community.
            </p>

            {/* Stats */}
            <div className="flex gap-8">
              {[
                { n: "10K+",  l: "Rides Shared" },
                { n: "5K+",   l: "Riders"        },
                { n: "₹2L+",  l: "Community Earned" },
              ].map((s) => (
                <div key={s.l} className="hover:-translate-y-1 transition-transform">
                  <div className={`text-3xl font-black ${tc.text}`}>{s.n}</div>
                  <div className={`text-xs tracking-widest ${tc.sub}`}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Testimonial */}
            <div className={`p-5 rounded-xl border ${tc.card}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${tc.button}`}>
                  A
                </div>
                <div>
                  <p className={`font-bold text-sm ${tc.text}`}>Arjun Kumar</p>
                  <p className={`text-xs ${tc.sub}`}>@rider_arjun · 142 rides</p>
                </div>
              </div>
              <p className={`text-sm italic ${tc.sub}`}>
                "Started sharing my rides 3 months ago. Now I've connected with 200+ riders across Tamil Nadu!"
              </p>
            </div>

            <p className={`text-xs ${tc.sub}`}>
              Voice control: say "dark", "light", "warm", "midnight", "login" or "signup"
            </p>
          </div>

          {/* Right column: auth form card */}
          <div className="relative">
            <div className={`relative p-7 md:p-9 rounded-xl border ${tc.card}`}>
              {/* ── Login / Sign Up tab switcher ─────────────── */}
              <div className={`flex p-1 rounded-full mb-8 ${tc.surface2}`}>
                {["Login", "Sign Up"].map((tab) => {
                  const active = (isLogin && tab === "Login") || (!isLogin && tab === "Sign Up");
                  return (
                    <button
                      key={tab}
                      onClick={() => { setIsLogin(tab === "Login"); setError(""); }}
                      className={`flex-1 py-2 rounded-full text-sm font-semibold transition-colors ${
                        active ? tc.button : tc.navIdle
                      }`}
                    >
                      {tab}
                    </button>
                  );
                })}
              </div>

              {/* ── Heading ──────────────────────────────────── */}
              <div className="mb-6">
                <h2 className={`text-2xl font-bold tracking-tight ${tc.text}`}>
                  {isLogin ? "Welcome back" : "Join the ride"}
                </h2>
                <p className={`text-sm mt-1 ${tc.sub}`}>
                  {isLogin
                    ? "Sign in to continue your journey"
                    : "Create your account — takes 30 seconds"}
                </p>
              </div>

              {/* ── Inline error message ─────────────────────── */}
              {error && (
                <div className={`mb-4 px-4 py-3 rounded-lg border text-sm flex items-center gap-2 ${tc.dangerSoft}`}>
                  <Icon name="alertCircle" size={16} />
                  <span>{error}</span>
                </div>
              )}

              {/* ── Form ────────────────────────────────────── */}
              <form onSubmit={handleSubmit} className="space-y-5">

                {/* Email field */}
                <div>
                  <label className={`text-xs font-medium tracking-wide mb-2 block ${tc.sub}`}>
                    EMAIL
                  </label>
                  <div className="relative">
                    <Icon name="mail" size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${tc.sub}`} />
                    <input
                      type="email"
                      id="login-email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className={`w-full pl-10 pr-4 py-3 rounded-lg border text-sm ${tc.input}`}
                    />
                  </div>
                </div>

                {/* Password field */}
                <div>
                  <label className={`text-xs font-medium tracking-wide mb-2 block ${tc.sub}`}>
                    PASSWORD
                  </label>
                  <div className="relative">
                    <Icon name="lock" size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${tc.sub}`} />
                    <input
                      type={showPassword ? "text" : "password"}
                      id="login-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete={isLogin ? "current-password" : "new-password"}
                      className={`w-full pl-10 pr-11 py-3 rounded-lg border text-sm ${tc.input}`}
                    />
                    {/* Show / hide password toggle */}
                    <IconButton
                      variant="ghost"
                      size="sm"
                      icon={showPassword ? "eyeOff" : "eye"}
                      label={showPassword ? "Hide password" : "Show password"}
                      tc={tc}
                      type="button"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 border-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    />
                  </div>

                  {/* Password strength bar (sign up only, only when password entered) */}
                  {!isLogin && password && (
                    <div className={`mt-2 h-1 rounded-full overflow-hidden ${tc.surface2}`}>
                      <div
                        className={`h-full transition-all duration-500 bg-current ${strengthColor}`}
                        style={{ width: `${passwordStrength}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Remember me + Forgot password (login only) */}
                {isLogin && (
                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 accent-[#FF7A1A]"
                      />
                      <span className={tc.sub}>Remember me</span>
                    </label>
                    <button type="button" className={`${tc.sub} hover:underline text-xs`}>
                      Forgot password?
                    </button>
                  </div>
                )}

                {/* Submit button */}
                <Button
                  type="submit"
                  id="auth-submit-btn"
                  variant="primary"
                  size="lg"
                  full
                  tc={tc}
                >
                  {loading ? (
                    <>
                      <Icon name="spinner" size={18} className="rw-spin" />
                      {isLogin ? "Signing in…" : "Creating account…"}
                    </>
                  ) : (
                    <>
                      {isLogin ? "Sign In" : "Create Account"}
                      <Icon name="arrowRight" size={18} />
                    </>
                  )}
                </Button>

                {/* Tab switch link */}
                <p className={`text-center text-sm ${tc.sub}`}>
                  {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                  <button
                    type="button"
                    onClick={() => { setIsLogin(!isLogin); setError(""); }}
                    className={`font-semibold ${tc.text} hover:underline`}
                  >
                    {isLogin ? "Sign Up" : "Log in"}
                  </button>
                </p>
              </form>

              {/* ── "What happens next" steps (sign up only) ──── */}
              {!isLogin && (
                <div className={`mt-6 p-4 rounded-lg border ${tc.surface2} ${tc.divider}`}>
                  <p className={`text-xs font-semibold mb-3 tracking-wide ${tc.sub}`}>
                    WHAT HAPPENS NEXT
                  </p>
                  <div className="space-y-2">
                    {[
                      "Create your account (you are here)",
                      "Tell us about yourself — 30 seconds",
                      "Start connecting with riders",
                    ].map((step, i) => (
                      <div key={i} className={`flex items-center gap-2.5 text-xs ${tc.sub}`}>
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center font-semibold text-[10px] shrink-0 ${
                          i === 0 ? `${tc.button}` : `${tc.surface2} ${tc.text}`
                        }`}>
                          {i + 1}
                        </span>
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            <p className={`text-center text-xs mt-4 ${tc.sub}`}>
              By continuing, you agree to our{" "}
              <span className="underline cursor-pointer hover:opacity-70">Terms</span> and{" "}
              <span className="underline cursor-pointer hover:opacity-70">Privacy Policy</span>
            </p>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
