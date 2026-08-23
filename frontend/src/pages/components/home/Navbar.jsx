// ============================================================
// 🧭 Navbar — Top navigation with search, voice, cart, theme
// Features: Search dropdown, voice command, theme switch, cart badge
// Props: theme, setTheme, tc, voiceMode, startVoice, onNavigate
// ============================================================

import { useState, useRef, useEffect } from "react";
import ThemeDropdown from "../shared/ThemeDropdown";

export default function Navbar({ theme, setTheme, tc, voiceMode, startVoice, onNavigate, cartCount = 2 }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);

  // Close search dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Categories for navigation
  const navItems = [
    { label: "Home", target: "top" },
    { label: "Trending", target: "trending" },
    { label: "Bikes", target: "bikes" },
    { label: "Rides", target: "rides" },
    { label: "Videos", target: "trending" },
    { label: "Live", target: "live" },
    { label: "Shop", target: "shop" },
  ];

  return (
    <header className={`fixed top-0 left-0 w-full z-50 backdrop-blur-xl border-b ${tc.divider} bg-black/30`}>
      {/* Main Row */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex items-center gap-3">
        
        {/* Logo */}
        <button 
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex items-center gap-2 hover:scale-105 transition-transform shrink-0"
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tc.button}`}>
            <i className="fa fa-motorcycle text-sm"></i>
          </div>
          <span className="hidden sm:inline text-lg font-black">
            Ride<span className="opacity-60">Wise</span>
          </span>
        </button>

        {/* Search Bar */}
        <div ref={searchRef} className="flex-1 relative max-w-xl">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors focus-within:border-current ${tc.card}`}>
            <i className={`fa fa-search text-sm ${tc.sub}`}></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search bikes, videos, riders..."
              className={`flex-1 bg-transparent outline-none text-sm ${tc.text}`}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className={`text-xs ${tc.sub}`}>
                <i className="fa fa-times"></i>
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {searchOpen && searchQuery && (
            <div className={`absolute top-full mt-2 w-full rounded-xl border backdrop-blur-2xl shadow-2xl z-50 overflow-hidden ${tc.card}`}>
              {[
                { type: "Bike", icon: "fa-motorcycle" },
                { type: "Video", icon: "fa-video-camera" },
                { type: "Rider", icon: "fa-user" },
                { type: "Ride", icon: "fa-road" },
              ].map((item, i) => (
                <button
                  key={i}
                  onClick={() => setSearchOpen(false)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-all hover:bg-white/10`}
                >
                  <i className={`fa ${item.icon} ${tc.sub}`}></i>
                  <span>Search "{searchQuery}" in <strong>{item.type}s</strong></span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 shrink-0">
          
          {/* Voice Command */}
          <button
            onClick={startVoice}
            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 ${
              voiceMode ? "bg-red-500 text-white animate-pulse" : tc.record
            }`}
            title="Voice: try 'dark', 'trending', 'live'"
          >
            <i className={`fa ${voiceMode ? "fa-microphone-slash" : "fa-microphone"} text-sm`}></i>
            {voiceMode && <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30"></span>}
          </button>

          {/* Cart */}
          <button className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 ${tc.record}`}>
            <i className="fa fa-shopping-cart text-sm"></i>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white">
                {cartCount}
              </span>
            )}
          </button>

          {/* Notifications */}
          <button className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 ${tc.record}`}>
            <i className="fa fa-bell text-sm"></i>
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
          </button>

          {/* Theme Switcher */}
          <ThemeDropdown theme={theme} setTheme={setTheme} tc={tc} />

          {/* Profile */}
          <button className={`w-10 h-10 rounded-full flex items-center justify-center font-bold hover:scale-110 transition-transform ${tc.button}`}>
            R
          </button>
        </div>
      </div>

      {/* Category Navigation */}
      <nav className="max-w-7xl mx-auto px-4 md:px-8 pb-3 flex gap-1 overflow-x-auto scrollbar-hide">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => {
              if (item.target === "top") window.scrollTo({ top: 0, behavior: "smooth" });
              else {
                const el = document.getElementById(item.target);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            }}
            className={`px-4 py-1.5 rounded-full text-xs md:text-sm font-semibold whitespace-nowrap transition-all hover:bg-white/10 ${tc.sub}`}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
