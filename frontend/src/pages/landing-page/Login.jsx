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
//   - Mouse glow + ambient particles + 3D card tilt on desktop
//   - Ripple click effect on submit button
//   - Password strength meter (signup only)
//   - Inline error messages from AuthContext
//   - "What happens next" steps panel (signup only)
//
// BACKEND-READY:
//   Auth logic lives in AuthContext.jsx — replace localStorage calls there
//   with API calls when your backend is ready. This file doesn't change.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, signup, isAuthenticated, isFullyOnboarded } = useAuth();

  // ── Refs for DOM interaction ─────────────────────────────────
  const containerRef = useRef(null);   // for mouse glow offset
  const cardRef      = useRef(null);   // for 3D tilt calculation
  const dropdownRef  = useRef(null);   // for closing theme dropdown on outside click
  const trailRef     = useRef([]);     // cursor trail positions (not in state — no re-render needed)

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
  const [mousePos,   setMousePos]   = useState({ x: 0, y: 0 });
  const [ripples,    setRipples]    = useState([]);
  const [tilt,       setTilt]       = useState({ x: 0, y: 0 });
  const [themeOpen,  setThemeOpen]  = useState(false);
  const [voiceMode,  setVoiceMode]  = useState(false);
  const [focused,    setFocused]    = useState(null);   // which input is focused

  // ── Form state ───────────────────────────────────────────────
  const [email,             setEmail]             = useState("");
  const [password,          setPassword]          = useState("");
  const [showPassword,      setShowPassword]      = useState(false);
  const [passwordStrength,  setPasswordStrength]  = useState(0);
  const [loading,           setLoading]           = useState(false);
  const [error,             setError]             = useState("");

  // ── Theme definitions ─────────────────────────────────────────
  // Each theme has all Tailwind class strings needed for that visual style
  const themes = {
    dark: {
      bg: "bg-black", text: "text-white", sub: "text-gray-400",
      card: "bg-white/5 border-white/10 text-white",
      input: "bg-white/5 border-white/15 text-white placeholder-gray-500",
      button: "bg-white text-black",
      glow: "rgba(255,255,255,0.15)", particle: "bg-white",
      accent: "from-white to-gray-400",
      record: "bg-white/10 border border-white/20",
      label: "Dark", icon: "🌙",
    },
    light: {
      bg: "bg-gray-50", text: "text-black", sub: "text-gray-500",
      card: "bg-white border-gray-200 shadow-xl text-black",
      input: "bg-gray-50 border-gray-300 text-black placeholder-gray-400",
      button: "bg-black text-white",
      glow: "rgba(0,0,0,0.08)", particle: "bg-black",
      accent: "from-black to-gray-500",
      record: "bg-black/10 border border-gray-300",
      label: "Light", icon: "☀️",
    },
    warm: {
      bg: "bg-gradient-to-br from-orange-50 via-rose-50 to-amber-50",
      text: "text-orange-950", sub: "text-orange-700",
      card: "bg-white/60 backdrop-blur-xl border-orange-200 shadow-xl text-orange-950",
      input: "bg-white/70 border-orange-200 text-orange-950 placeholder-orange-300",
      button: "bg-gradient-to-r from-orange-500 to-rose-500 text-white",
      glow: "rgba(251,146,60,0.2)", particle: "bg-orange-500",
      accent: "from-orange-500 to-rose-500",
      record: "bg-orange-100 border border-orange-300",
      label: "Warm", icon: "🌅",
    },
    midnight: {
      bg: "bg-gradient-to-br from-indigo-950 via-purple-950 to-black",
      text: "text-white", sub: "text-purple-300",
      card: "bg-white/5 border-purple-500/20 text-white",
      input: "bg-white/5 border-purple-400/20 text-white placeholder-purple-400",
      button: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
      glow: "rgba(168,85,247,0.25)", particle: "bg-purple-400",
      accent: "from-purple-400 to-pink-400",
      record: "bg-purple-500/20 border border-purple-400/40",
      label: "Midnight", icon: "🌌",
    },
  };
  const tc = themes[theme]; // shorthand for the currently active theme object

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

  // ── Mouse tracking: glow position + 3D card tilt + cursor trail
  useEffect(() => {
    const handleMove = (e) => {
      // Glow follows cursor inside the container
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
      // 3D tilt on the form card
      if (cardRef.current) {
        const r  = cardRef.current.getBoundingClientRect();
        const cx = r.left + r.width  / 2;
        const cy = r.top  + r.height / 2;
        setTilt({
          x: -((e.clientY - cy) / r.height) * 10, // rotate on X axis
          y:  ((e.clientX - cx) / r.width)  * 10, // rotate on Y axis
        });
      }
      // Cursor trail (stored in ref to avoid re-renders)
      trailRef.current.push({ x: e.clientX, y: e.clientY, id: Date.now() });
      if (trailRef.current.length > 12) trailRef.current.shift();
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  // Clear cursor trail every 100ms (avoids stale dots)
  useEffect(() => {
    const t = setInterval(() => { trailRef.current = []; }, 100);
    return () => clearInterval(t);
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

  // ── Ripple click effect on the submit button ─────────────────
  const createRipple = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const id   = Date.now();
    const x    = e.clientX - rect.left - size / 2;
    const y    = e.clientY - rect.top  - size / 2;
    setRipples((prev) => [...prev, { id, x, y, size }]);
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 800);
  }, []);

  // ── Voice control ─────────────────────────────────────────────
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
    setVoiceMode(true);

    // Auto-stop after 6 seconds
    setTimeout(() => {
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
        await login(email, password);
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
    <div
      ref={containerRef}
      className={`relative min-h-screen w-full overflow-hidden transition-all duration-1000 ${tc.bg}`}
    >

      {/* ── Cursor trail ──────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-40">
        {trailRef.current.map((p, i) => (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: p.x - 4, top: p.y - 4, width: 8, height: 8,
              background: `rgba(255,255,255,${(i / 12) * 0.5})`,
              filter: "blur(2px)", opacity: i / 12,
            }}
          />
        ))}
      </div>

      {/* ── Mouse glow radial gradient ────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `radial-gradient(circle 600px at ${mousePos.x}px ${mousePos.y}px, ${tc.glow}, transparent 40%)`,
        }}
      />

      {/* ── Ambient floating particles ────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className={`absolute rounded-full ${tc.particle} opacity-20`}
            style={{
              width:  Math.random() * 4 + 1,
              height: Math.random() * 4 + 1,
              top:  `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animation: `pulse ${Math.random() * 3 + 2}s infinite`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      {/* ── Top bar: logo + voice + theme switcher ────────────── */}
      <div className="fixed top-5 left-5 right-5 z-50 flex justify-between items-center">

        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tc.button}`}>
            <i className="fa fa-motorcycle text-sm" />
          </div>
          <span className={`text-lg font-black ${tc.text}`}>
            Ride<span className="opacity-60">Wise</span>
          </span>
        </div>

        {/* Right: Voice + Theme */}
        <div className="flex items-center gap-2">
          {/* Voice button */}
          <button
            onClick={startVoice}
            title='Voice: say "dark", "light", "login", "signup"'
            className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110 ${
              voiceMode
                ? "bg-red-500 text-white animate-pulse"
                : `${tc.record} ${tc.text}`
            }`}
          >
            <i className={`fa ${voiceMode ? "fa-microphone-slash" : "fa-microphone"} text-sm`} />
            {voiceMode && (
              <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30" />
            )}
          </button>

          {/* Theme dropdown */}
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setThemeOpen(!themeOpen)}
              className={`flex items-center gap-2 px-3 py-2 rounded-full border backdrop-blur-md transition-all hover:scale-105 ${tc.card}`}
            >
              <span>{tc.icon}</span>
              <span className={`text-sm font-semibold ${tc.text}`}>{tc.label}</span>
              <i className={`fa fa-chevron-down text-xs ${tc.sub} transition-transform ${themeOpen ? "rotate-180" : ""}`} />
            </button>

            {themeOpen && (
              <div className={`absolute right-0 mt-2 w-40 rounded-xl border backdrop-blur-xl shadow-2xl z-50 overflow-hidden ${tc.card}`}>
                {Object.entries(themes).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => { setTheme(key); setThemeOpen(false); }}
                    className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm transition-all hover:bg-white/10 ${
                      theme === key ? "font-bold" : ""
                    }`}
                  >
                    <span>{val.icon}</span>
                    <span>{val.label}</span>
                    {theme === key && (
                      <i className="fa fa-check ml-auto text-green-400 text-xs" />
                    )}
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
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-xs tracking-widest font-bold ${tc.card}`}>
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              5,000+ Active Riders
            </div>

            {/* Headline */}
            <h1 className={`text-6xl font-black leading-tight ${tc.text}`}>
              Your Next<br />
              <span className={`bg-gradient-to-r ${tc.accent} bg-clip-text text-transparent`}>
                Ride Starts Here
              </span>
            </h1>

            <p className={`text-lg leading-relaxed max-w-sm ${tc.sub}`}>
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
            <div className={`p-5 rounded-2xl border backdrop-blur-md ${tc.card}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center font-bold text-white text-sm">
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
              💡 Voice control: say "dark", "light", "warm", "midnight", "login" or "signup"
            </p>
          </div>

          {/* ── Right column: auth form card ──────────────────── */}
          <div
            ref={cardRef}
            className="relative transition-transform duration-200 ease-out"
            style={{
              transform: `perspective(1500px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
              transformStyle: "preserve-3d",
            }}
          >
            {/* Card outer glow */}
            <div
              className="absolute -inset-3 rounded-3xl blur-3xl opacity-30"
              style={{
                background: `radial-gradient(circle, ${
                  theme === "light" ? "rgba(0,0,0,0.15)" : "rgba(255,120,40,0.4)"
                }, transparent 60%)`,
              }}
            />

            <div
              className={`relative p-8 md:p-10 rounded-3xl border backdrop-blur-2xl transition-all duration-500 ${tc.card}`}
              style={{ transform: "translateZ(30px)" }}
            >
              {/* ── Login / Sign Up tab switcher ─────────────── */}
              <div className={`flex p-1 rounded-full mb-8 ${theme === "light" ? "bg-black/5" : "bg-white/5"}`}>
                {["Login", "Sign Up"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => { setIsLogin(tab === "Login"); setError(""); }}
                    className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${
                      (isLogin && tab === "Login") || (!isLogin && tab === "Sign Up")
                        ? `${tc.button} scale-105 shadow-lg`
                        : `${tc.sub} hover:scale-105`
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* ── Heading ──────────────────────────────────── */}
              <div className="mb-6">
                <h2 className={`text-3xl font-black ${tc.text}`}>
                  {isLogin ? "Welcome back 👋" : "Join the ride 🏍️"}
                </h2>
                <p className={`text-sm mt-1 ${tc.sub}`}>
                  {isLogin
                    ? "Sign in to continue your journey"
                    : "Create your account — takes 30 seconds"}
                </p>
              </div>

              {/* ── Inline error message ─────────────────────── */}
              {error && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
                  <i className="fa fa-exclamation-circle shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* ── Form ────────────────────────────────────── */}
              <form onSubmit={handleSubmit} className="space-y-5">

                {/* Email field */}
                <div>
                  <label className={`text-xs font-bold tracking-wider mb-2 block ${tc.sub}`}>
                    EMAIL
                  </label>
                  <div className="relative">
                    <i className={`fa fa-envelope absolute left-4 top-1/2 -translate-y-1/2 ${tc.sub}`} />
                    <input
                      type="email"
                      id="login-email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocused("email")}
                      onBlur={() => setFocused(null)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className={`w-full pl-12 pr-4 py-3.5 rounded-xl border-2 outline-none transition-all duration-300 ${
                        focused === "email" ? "scale-[1.02]" : ""
                      } ${tc.input}`}
                    />
                  </div>
                </div>

                {/* Password field */}
                <div>
                  <label className={`text-xs font-bold tracking-wider mb-2 block ${tc.sub}`}>
                    PASSWORD
                  </label>
                  <div className="relative">
                    <i className={`fa fa-lock absolute left-4 top-1/2 -translate-y-1/2 ${tc.sub}`} />
                    <input
                      type={showPassword ? "text" : "password"}
                      id="login-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocused("password")}
                      onBlur={() => setFocused(null)}
                      placeholder="••••••••"
                      autoComplete={isLogin ? "current-password" : "new-password"}
                      className={`w-full pl-12 pr-12 py-3.5 rounded-xl border-2 outline-none transition-all duration-300 ${
                        focused === "password" ? "scale-[1.02]" : ""
                      } ${tc.input}`}
                    />
                    {/* Show / hide password toggle */}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute right-4 top-1/2 -translate-y-1/2 hover:scale-125 transition-transform ${tc.sub}`}
                    >
                      <i className={`fa ${showPassword ? "fa-eye-slash" : "fa-eye"}`} />
                    </button>
                  </div>

                  {/* Password strength bar (sign up only, only when password entered) */}
                  {!isLogin && password && (
                    <div className="mt-2 h-1.5 rounded-full overflow-hidden bg-gray-300/20">
                      <div
                        className={`h-full transition-all duration-500 ${strengthColor}`}
                        style={{ width: `${passwordStrength}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Remember me + Forgot password (login only) */}
                {isLogin && (
                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 accent-orange-500" />
                      <span className={tc.sub}>Remember me</span>
                    </label>
                    <button type="button" className={`${tc.sub} hover:underline text-xs`}>
                      Forgot password?
                    </button>
                  </div>
                )}

                {/* Submit button with ripple effect */}
                <button
                  type="submit"
                  id="auth-submit-btn"
                  disabled={loading}
                  onClick={createRipple}
                  className={`relative w-full py-3.5 rounded-xl font-bold overflow-hidden transition-all hover:scale-[1.02] hover:-translate-y-0.5 active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2 ${tc.button}`}
                >
                  {loading ? (
                    <>
                      <i className="fa fa-spinner fa-spin" />
                      {isLogin ? "Signing in…" : "Creating account…"}
                    </>
                  ) : (
                    <>
                      {isLogin ? "Sign In" : "Create Account"}
                      <i className="fa fa-arrow-right" />
                    </>
                  )}
                  {/* Ripple spans */}
                  {ripples.map((r) => (
                    <span
                      key={r.id}
                      className="absolute rounded-full pointer-events-none"
                      style={{
                        left: r.x, top: r.y, width: r.size, height: r.size,
                        background: "radial-gradient(circle, rgba(255,255,255,0.4), transparent 70%)",
                        transform: "scale(0)",
                        animation: "ripple 0.8s ease-out",
                      }}
                    />
                  ))}
                </button>

                {/* Tab switch link */}
                <p className={`text-center text-sm ${tc.sub}`}>
                  {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                  <button
                    type="button"
                    onClick={() => { setIsLogin(!isLogin); setError(""); }}
                    className={`font-bold ${tc.text} hover:underline`}
                  >
                    {isLogin ? "Sign Up" : "Log in"}
                  </button>
                </p>
              </form>

              {/* ── "What happens next" steps (sign up only) ──── */}
              {!isLogin && (
                <div className={`mt-6 p-4 rounded-xl border ${
                  theme === "light"
                    ? "bg-black/5 border-black/10"
                    : "bg-white/5 border-white/10"
                }`}>
                  <p className={`text-xs font-bold mb-3 tracking-wider ${tc.sub}`}>
                    WHAT HAPPENS NEXT
                  </p>
                  <div className="space-y-2">
                    {[
                      "Create your account (you are here)",
                      "Tell us about yourself — 30 seconds",
                      "Start connecting with riders 🏍️",
                    ].map((step, i) => (
                      <div key={i} className={`flex items-center gap-2.5 text-xs ${tc.sub}`}>
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                          i === 0
                            ? "bg-orange-500/30 text-orange-400"
                            : "bg-white/10 text-gray-400"
                        }`}>
                          {i + 1}
                        </span>
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <p className={`text-center text-xs mt-4 ${tc.sub}`}>
              By continuing, you agree to our{" "}
              <span className="underline cursor-pointer hover:opacity-70">Terms</span> and{" "}
              <span className="underline cursor-pointer hover:opacity-70">Privacy Policy</span>
            </p>
          </div>
        </div>
      </div>

      {/* Ripple animation keyframe */}
      <style>{`@keyframes ripple { to { transform: scale(4); opacity: 0; } }`}</style>
    </div>
  );
}
