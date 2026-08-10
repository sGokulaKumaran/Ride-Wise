import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

function Login() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const cardRef = useRef(null);
  const dropdownRef = useRef(null);
  const trailRef = useRef([]);
  const audioContextRef = useRef(null);

  // ================= SINGLE STATE DECLARATIONS =================
  const [theme, setTheme] = useState("dark");
  const [isLogin, setIsLogin] = useState(true);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [ripples, setRipples] = useState([]);
  const [formData, setFormData] = useState({ email: "", password: "", name: "" });
  const [focused, setFocused] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [voiceMode, setVoiceMode] = useState(false);
  const [biometricScanning, setBiometricScanning] = useState(false);
  const [rippleColor, setRippleColor] = useState("#ffffff");
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [open, setOpen] = useState(false);  // 👈 Dropdown state moved here

  // Theme data
  const themeData = {
    dark:     { label: "Dark",     icon: "🌙" },
    light:    { label: "Light",    icon: "☀️" },
    warm:     { label: "Warm",     icon: "🌅" },
    midnight: { label: "Midnight", icon: "🌌" },
  };

  // ================= MOOD DETECTION (only on first load) =================
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) setTheme("warm");
    else if (hour >= 12 && hour < 18) setTheme("light");
    else if (hour >= 18 && hour < 22) setTheme("dark");
    else setTheme("midnight");
  }, []);

  // ================= CLICK OUTSIDE DROPDOWN =================
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ================= MOUSE TRACKING (rest of code same) =================
  useEffect(() => {
    const handleMove = (e) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
      if (cardRef.current) {
        const r = cardRef.current.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const rotateY = ((e.clientX - cx) / r.width) * 12;
        const rotateX = -((e.clientY - cy) / r.height) * 12;
        setTilt({ x: rotateX, y: rotateY });
      }
      trailRef.current.push({ x: e.clientX, y: e.clientY, id: Date.now() });
      if (trailRef.current.length > 12) trailRef.current.shift();
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      trailRef.current = [];
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // ================= RIPPLE =================
  const createRipple = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const id = Date.now();
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    setRippleColor(theme === "light" ? "#000" : "#fff");
    setRipples((prev) => [...prev, { id, x, y, size }]);
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 800);
  };

  // ================= VOICE =================
  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Voice not supported");
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript.toLowerCase().trim();
      if (text.includes("login") || text.includes("sign in") || text.includes("log in")) setIsLogin(true);
      if (text.includes("signup") || text.includes("sign up") || text.includes("register")) setIsLogin(false);
      if (text.includes("dark") || text.includes("night") || text.includes("black")) setTheme("dark");
      if (text.includes("light") || text.includes("day") || text.includes("bright") || text.includes("white")) setTheme("light");
      if (text.includes("warm") || text.includes("orange") || text.includes("sunset") || text.includes("sunrise")) setTheme("warm");
      if (text.includes("midnight") || text.includes("purple") || text.includes("galaxy") || text.includes("space")) setTheme("midnight");
      if (text.includes("home") || text.includes("back") || text.includes("landing")) navigate("/");
    };
    recognition.start();
    setVoiceMode(true);
    setTimeout(() => setVoiceMode(false), 5000);
  };

  // ================= BIOMETRIC =================
  const startBiometric = () => {
    setBiometricScanning(true);
    setTimeout(() => {
      setBiometricScanning(false);
      setLoading(true);
      setTimeout(() => navigate("/"), 1500);
    }, 3000);
  };

  // ================= PASSWORD STRENGTH =================
  useEffect(() => {
    let s = 0;
    if (formData.password.length > 5) s += 25;
    if (/[A-Z]/.test(formData.password)) s += 25;
    if (/[0-9]/.test(formData.password)) s += 25;
    if (/[^A-Za-z0-9]/.test(formData.password)) s += 25;
    setPasswordStrength(s);
  }, [formData.password]);

  // ================= SUBMIT =================
  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => navigate("/"), 1500);
  };

  const handleChange = (field) => (e) =>
    setFormData((p) => ({ ...p, [field]: e.target.value }));

  // ================= THEME STYLES =================
  const themes = {
    dark: {
      bg: "bg-black",
      text: "text-white",
      sub: "text-gray-400",
      card: "bg-white/5 border-white/10 text-white",
      input: "bg-white/5 border-white/15 text-white placeholder-gray-500",
      button: "bg-white text-black",
      record: "bg-red-500 border border-white/30",
      glow: "rgba(255,255,255,0.15)",
      particle: "bg-white",
      accent: "from-white to-gray-400",
    },
    light: {
      bg: "bg-gray-50",
      text: "text-black",
      sub: "text-gray-500",
      card: "bg-white border-gray-200 shadow-xl text-black",
      input: "bg-gray-50 border-gray-300 text-black placeholder-gray-400",
      button: "bg-black text-white",
      record: "bg-red-500 border border-black/30",
      glow: "rgba(0,0,0,0.08)",
      particle: "bg-black",
      accent: "from-black to-gray-500",
    },
    warm: {
      bg: "bg-gradient-to-br from-orange-50 via-rose-50 to-amber-50",
      text: "text-orange-950",
      sub: "text-orange-700",
      card: "bg-white/60 backdrop-blur-xl border-orange-200 shadow-xl text-orange-950",
      input: "bg-white/70 border-orange-200 text-orange-950 placeholder-orange-300",
      button: "bg-gradient-to-r from-orange-500 to-rose-500 text-white",
      record: "bg-red-500 border border-orange-300",
      glow: "rgba(251,146,60,0.2)",
      particle: "bg-orange-500",
      accent: "from-orange-500 to-rose-500",
    },
    midnight: {
      bg: "bg-gradient-to-br from-indigo-950 via-purple-950 to-black",
      text: "text-white",
      sub: "text-purple-300",
      card: "bg-white/5 border-purple-500/20 text-white",
      input: "bg-white/5 border-purple-400/20 text-white placeholder-purple-400",
      button: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
      record: "bg-red-500 border border-purple-400/40",
      glow: "rgba(168,85,247,0.25)",
      particle: "bg-purple-400",
      accent: "from-purple-400 to-pink-400",
    },
  };
  const tc = themes[theme];

  const strengthColor =
    passwordStrength <= 25 ? "bg-red-500"
    : passwordStrength <= 50 ? "bg-orange-500"
    : passwordStrength <= 75 ? "bg-yellow-500"
    : "bg-green-500";

  return (
    <div ref={containerRef} className={`relative min-h-screen w-full overflow-hidden transition-all duration-1000 ${tc.bg}`}>
      
      {/* ================= CURSOR TRAIL ================= */}
      <div className="fixed inset-0 pointer-events-none z-40">
        {trailRef.current.map((p, i) => (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: p.x - 4,
              top: p.y - 4,
              width: 8,
              height: 8,
              background: `rgba(255,255,255,${(i / 12) * 0.5})`,
              filter: "blur(2px)",
              opacity: i / 12,
            }}
          />
        ))}
      </div>

      {/* ================= MOUSE GLOW ================= */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `radial-gradient(circle 600px at ${mousePos.x}px ${mousePos.y}px, ${tc.glow}, transparent 40%)`,
        }}
      />

      {/* ================= AMBIENT PARTICLES ================= */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {[...Array(25)].map((_, i) => (
          <div
            key={i}
            className={`absolute rounded-full ${tc.particle}`}
            style={{
              width: Math.random() * 3 + 1,
              height: Math.random() * 3 + 1,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.4 + 0.2,
              animation: `pulse ${Math.random() * 3 + 2}s infinite`,
              animationDelay: `${Math.random() * 3}s`,
              transform: `translate(${(mousePos.x - window.innerWidth/2) * 0.02}px, ${(mousePos.y - window.innerHeight/2) * 0.02}px)`,
              transition: "transform 0.6s ease-out",
            }}
          />
        ))}
      </div>

      {/* ================= TOP BAR ================= */}
      <div className="fixed top-6 left-6 right-6 z-50 flex justify-between items-center">
        
        <button
          onClick={() => navigate("/")}
          className={`px-4 py-2 rounded-full backdrop-blur-md border flex items-center gap-2 transition-all hover:scale-110 ${tc.card}`}
        >
          <i className="fa fa-arrow-left text-sm"></i>
          <span className="text-sm font-semibold hidden sm:inline">Back</span>
        </button>

        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tc.button} hover:rotate-12 transition-transform`}>
            <i className="fa fa-motorcycle text-sm"></i>
          </div>
          <span className={`text-lg font-black ${tc.text}`}>
            Ride<span className="opacity-60">Wise</span>
          </span>
        </div>

        {/* RIGHT SIDE: Voice + Theme */}
        <div className="flex items-center gap-2">
          
          {/* Voice Button */}
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold tracking-widest hidden md:inline transition-all ${
              voiceMode ? "text-red-500 animate-pulse" : tc.sub
            }`}>
              {voiceMode ? "LISTENING..." : "VOICE"}
            </span>

            <button
              onClick={startVoice}
              className={`group relative w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 ${
                voiceMode 
                  ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50" 
                  : `${tc.record} ${tc.text}`
              }`}
              title="Voice Control - Try: dark, light, signup, home"
            >
              <i className={`fa ${voiceMode ? "fa-microphone-slash" : "fa-microphone"} text-sm`}></i>

              {voiceMode && (
                <>
                  <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30"></span>
                  <span className="absolute inset-0 rounded-full bg-red-500 animate-pulse opacity-50"></span>
                </>
              )}
            </button>
          </div>

          {/* Theme Dropdown */}
          <div ref={dropdownRef} className="relative w-44">
            <button
              onClick={() => setOpen(!open)}
              className={`flex items-center justify-between w-full px-4 py-2 rounded-full border backdrop-blur-md transition-all hover:scale-105 ${tc.card}`}
            >
              <span className="flex items-center gap-2">
                <span>{themeData[theme].icon}</span>
                <span className="font-semibold">{themeData[theme].label}</span>
              </span>
              <span className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}>
                ⌄
              </span>
            </button>

            {open && (
              <div className={`absolute right-0 mt-2 w-full rounded-xl border backdrop-blur-xl shadow-2xl z-50 overflow-hidden ${tc.card}`}>
                {Object.entries(themeData).map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setTheme(key);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:bg-white/10 ${
                      theme === key ? "bg-white/10 font-bold" : ""
                    }`}
                  >
                    <span className="text-lg">{value.icon}</span>
                    <span>{value.label}</span>
                    {theme === key && (
                      <span className="ml-auto text-green-400">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================= MAIN CONTENT ================= */}
      <div className="relative min-h-screen flex items-center justify-center px-4 py-24 z-10">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* LEFT */}
          <div className="hidden lg:block space-y-6">
            <div className={`inline-block px-4 py-1.5 rounded-full border backdrop-blur-md text-xs tracking-widest font-bold ${tc.card}`}>
              WELCOME BACK RIDER
            </div>

            <h1 className={`text-6xl font-black leading-tight ${tc.text}`}>
              Your Journey
              <br />
              <span className={`bg-gradient-to-r ${tc.accent} bg-clip-text text-transparent`}>
                Starts Here
              </span>
            </h1>

            <p className={`text-lg leading-relaxed ${tc.sub}`}>
              Share rides, build an audience, and turn your passion into income. Join 5,000+ riders on RideWise.
            </p>

            <div className="flex gap-6 pt-4">
              {[
                { n: 10000, l: "Posts" },
                { n: 5000, l: "Riders" },
                { n: 200000, l: "Earned" },
              ].map((s, i) => (
                <div key={i} className="hover:-translate-y-1 transition-transform">
                  <div className={`text-3xl font-black ${tc.text}`}>
                    {s.n >= 1000 ? (s.n / 1000).toFixed(0) + "K+" : s.n + "+"}
                  </div>
                  <div className={`text-xs tracking-widest ${tc.sub}`}>{s.l}</div>
                </div>
              ))}
            </div>

            <div className={`p-4 rounded-2xl border backdrop-blur-md ${tc.card}`}>
              <p className={`text-sm italic ${tc.sub}`}>
                "Started posting my rides 3 months ago. Now earning ₹15K/month from my passion!"
              </p>
              <p className={`mt-2 text-xs font-bold ${tc.text}`}>— @rider_arjun</p>
            </div>

            <p className={`text-xs ${tc.sub}`}>
              💡 Try voice control: say "dark", "light", "signup", or "home"
            </p>
          </div>

          {/* RIGHT - Form Card */}
          <div
            ref={cardRef}
            className="relative transition-transform duration-200 ease-out"
            style={{
              transform: `perspective(1500px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
              transformStyle: "preserve-3d",
            }}
          >
            <div
              className="absolute -inset-2 rounded-3xl blur-3xl opacity-40"
              style={{
                background: `radial-gradient(circle at ${mousePos.x/3}px ${mousePos.y/3}px, ${theme === "light" ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.3)"}, transparent 60%)`,
              }}
            />

            <div
              className={`relative p-8 md:p-10 rounded-3xl border backdrop-blur-2xl transition-all duration-500 ${tc.card}`}
              style={{ transform: "translateZ(30px)" }}
            >
              {/* Toggle */}
              <div className={`flex p-1 rounded-full mb-8 ${theme === "light" ? "bg-black/5" : "bg-white/5"}`}>
                {["Login", "Sign Up"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setIsLogin(tab === "Login")}
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

              <div className="mb-6">
                <h2 className={`text-3xl font-black ${tc.text}`}>
                  {isLogin ? "Welcome Back" : "Create Account"}
                </h2>
                <p className={`text-sm mt-1 ${tc.sub}`}>
                  {isLogin ? "Continue your journey" : "Start your ride today"}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {!isLogin && (
                  <Input
                    icon="fa-user"
                    label="FULL NAME"
                    type="text"
                    value={formData.name}
                    onChange={handleChange("name")}
                    onFocus={() => setFocused("name")}
                    onBlur={() => setFocused(null)}
                    placeholder="Enter your name"
                    focused={focused === "name"}
                    tc={tc}
                  />
                )}

                <Input
                  icon="fa-envelope"
                  label="EMAIL"
                  type="email"
                  value={formData.email}
                  onChange={handleChange("email")}
                  onFocus={() => setFocused("email")}
                  onBlur={() => setFocused(null)}
                  placeholder="you@example.com"
                  focused={focused === "email"}
                  tc={tc}
                />

                <div>
                  <label className={`text-xs font-bold tracking-wider mb-2 block ${tc.sub}`}>PASSWORD</label>
                  <div className="relative">
                    <i className={`fa fa-lock absolute left-4 top-1/2 -translate-y-1/2 ${tc.sub}`}></i>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={handleChange("password")}
                      onFocus={() => setFocused("password")}
                      onBlur={() => setFocused(null)}
                      placeholder="••••••••"
                      className={`w-full pl-12 pr-12 py-3.5 rounded-xl border-2 outline-none transition-all duration-300 ${
                        focused === "password" ? "scale-[1.02]" : ""
                      } ${tc.input}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute right-4 top-1/2 -translate-y-1/2 hover:scale-125 transition-transform ${tc.sub}`}
                    >
                      <i className={`fa ${showPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
                    </button>
                  </div>

                  {!isLogin && formData.password && (
                    <div className="mt-2 h-1.5 rounded-full overflow-hidden bg-gray-300/20">
                      <div
                        className={`h-full transition-all duration-500 ${strengthColor}`}
                        style={{ width: `${passwordStrength}%` }}
                      ></div>
                    </div>
                  )}
                </div>

                {isLogin && (
                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4" />
                      <span className={tc.sub}>Remember me</span>
                    </label>
                    <a href="#" className={`${tc.sub} hover:underline`}>Forgot?</a>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  onClick={createRipple}
                  className={`relative w-full py-3.5 rounded-xl font-bold overflow-hidden transition-all hover:scale-[1.02] hover:-translate-y-0.5 disabled:opacity-70 flex items-center justify-center gap-2 ${tc.button}`}
                >
                  {loading ? (
                    <><i className="fa fa-spinner fa-spin"></i> Authenticating...</>
                  ) : (
                    <>
                      {isLogin ? "Login" : "Create Account"}
                      <i className="fa fa-arrow-right"></i>
                    </>
                  )}
                  {ripples.map((r) => (
                    <span
                      key={r.id}
                      className="absolute rounded-full pointer-events-none"
                      style={{
                        left: r.x,
                        top: r.y,
                        width: r.size,
                        height: r.size,
                        background: `radial-gradient(circle, ${rippleColor}40, transparent 70%)`,
                        transform: "scale(0)",
                        animation: "ripple 0.8s ease-out",
                      }}
                    />
                  ))}
                </button>

                {isLogin && (
                  <>
                    <div className="flex items-center gap-4 my-4">
                      <div className={`flex-1 h-px ${theme === "light" ? "bg-black/10" : "bg-white/10"}`}></div>
                      <span className={`text-xs tracking-widest ${tc.sub}`}>OR</span>
                      <div className={`flex-1 h-px ${theme === "light" ? "bg-black/10" : "bg-white/10"}`}></div>
                    </div>

                    <button
                      type="button"
                      onClick={startBiometric}
                      disabled={biometricScanning}
                      className={`relative w-full py-3.5 rounded-xl border-2 transition-all hover:scale-[1.02] ${tc.card} ${biometricScanning ? "animate-pulse" : ""}`}
                    >
                      <i className={`fa fa-fingerprint text-lg ${biometricScanning ? "text-green-500" : ""}`}></i>
                      <span className="ml-2 font-semibold">
                        {biometricScanning ? "Scanning..." : "Use Biometric"}
                      </span>
                      {biometricScanning && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-32 h-32 border-4 border-green-500 rounded-full animate-ping opacity-50"></div>
                        </div>
                      )}
                    </button>
                  </>
                )}

                <p className={`text-center text-sm mt-6 ${tc.sub}`}>
                  {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                  <button
                    type="button"
                    onClick={() => setIsLogin(!isLogin)}
                    className={`font-bold ${tc.text} hover:underline`}
                  >
                    {isLogin ? "Sign Up" : "Login"}
                  </button>
                </p>
              </form>
            </div>

            <p className={`text-center text-xs mt-6 ${tc.sub}`}>
              By continuing, you agree to our <span className="underline cursor-pointer">Terms</span> and <span className="underline cursor-pointer">Privacy</span>
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ripple {
          to { transform: scale(4); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

const Input = ({ icon, label, focused, tc, ...props }) => (
  <div>
    <label className={`text-xs font-bold tracking-wider mb-2 block ${tc.sub}`}>{label}</label>
    <div className="relative">
      <i className={`fa ${icon} absolute left-4 top-1/2 -translate-y-1/2 ${tc.sub}`}></i>
      <input
        {...props}
        className={`w-full pl-12 pr-4 py-3.5 rounded-xl border-2 outline-none transition-all duration-300 ${
          focused ? "scale-[1.02]" : ""
        } ${tc.input}`}
      />
    </div>
  </div>
);

export default Login;
