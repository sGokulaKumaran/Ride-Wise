// ============================================================
// 🔝 TopBar — YouTube-style top navigation
// Has: Logo, search bar (large), voice, notifications, profile
// ============================================================

import { useState, useRef, useEffect } from "react";
import ThemeDropdown from "../shared/ThemeDropdown";

export default function TopBar({ theme, setTheme, tc, voiceMode, startVoice, cartCount = 2, notificationCount = 5 }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
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

  return (
    <header className={`fixed top-0 left-0 lg:left-64 right-0 z-30 backdrop-blur-xl border-b ${tc.divider} bg-black/40 h-16`}>
      <div className="flex items-center justify-between h-full px-4 md:px-6 gap-4">

        {/* Mobile-only: Logo */}
        <div className="lg:hidden flex items-center gap-2">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tc.button} text-sm`}>
            <i className="fa fa-motorcycle"></i>
          </div>
          <span className="text-lg font-black">
            Ride<span className="opacity-60">Wise</span>
          </span>
        </div>

        {/* Desktop: Centered Search Bar (large, like YouTube) */}
        <div ref={searchRef} className="flex-1 max-w-2xl relative hidden md:block">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors focus-within:ring-2 focus-within:ring-white/20 ${tc.card}`}>
            <i className={`fa fa-search text-sm ${tc.sub}`}></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search bikes, riders, videos, gear..."
              className={`flex-1 bg-transparent outline-none text-sm ${tc.text}`}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className={`text-xs ${tc.sub}`}>
                <i className="fa fa-times"></i>
              </button>
            )}
            <div className={`border-l ${tc.divider} pl-3`}>
              <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10">
                <i className={`fa fa-microphone text-sm ${tc.sub}`}></i>
              </button>
            </div>
          </div>

          {/* Search Results Dropdown */}
          {searchOpen && searchQuery && (
            <div className={`absolute top-full mt-2 w-full rounded-xl border backdrop-blur-2xl shadow-2xl z-50 overflow-hidden ${tc.card}`}>
              {[
                { type: "Bikes",    icon: "fa-motorcycle" },
                { type: "Videos",   icon: "fa-video-camera" },
                { type: "Riders",   icon: "fa-user" },
                { type: "Routes",   icon: "fa-road" },
                { type: "Products", icon: "fa-shopping-bag" },
              ].map((item, i) => (
                <button
                  key={i}
                  onClick={() => setSearchOpen(false)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:bg-white/10`}
                >
                  <i className={`fa ${item.icon} ${tc.sub}`}></i>
                  <span className="text-sm">
                    <span className={tc.sub}>Search</span> &ldquo;{searchQuery}&rdquo; <span className={tc.sub}>in</span> <strong>{item.type}</strong>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2">

          {/* Mobile Search Icon */}
          <button
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            className={`md:hidden w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 ${tc.record} text-white`}
          >
            <i className="fa fa-search text-sm"></i>
          </button>

          {/* Voice Command */}
          <button
            onClick={startVoice}
            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 text-white ${
              voiceMode ? "bg-red-500 animate-pulse" : tc.record
            }`}
            title="Voice: 'dark', 'trending', 'bikes'"
          >
            <i className={`fa ${voiceMode ? "fa-microphone-slash" : "fa-microphone"} text-sm`}></i>
            {voiceMode && <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30"></span>}
          </button>

          {/* Cart */}
          <button className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 text-white ${tc.record}`}>
            <i className="fa fa-shopping-cart text-sm"></i>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white">
                {cartCount}
              </span>
            )}
          </button>

          {/* Notifications */}
          <button className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 text-white ${tc.record}`}>
            <i className="fa fa-bell text-sm"></i>
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white">
                {notificationCount}
              </span>
            )}
          </button>

          {/* Theme Switcher */}
          <ThemeDropdown theme={theme} setTheme={setTheme} tc={tc} />

          {/* Profile Picture */}
          <button className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center font-bold text-white hover:scale-110 transition-transform">
            R
          </button>
        </div>
      </div>

      {/* Mobile Search Bar (slides down when search icon clicked) */}
      {mobileSearchOpen && (
        <div className={`md:hidden absolute top-full left-0 right-0 p-4 border-b ${tc.divider} bg-black/95 backdrop-blur-xl`}>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${tc.card}`}>
            <i className={`fa fa-search text-sm ${tc.sub}`}></i>
            <input
              type="text"
              placeholder="Search..."
              className={`flex-1 bg-transparent outline-none text-sm ${tc.text}`}
            />
          </div>
        </div>
      )}
    </header>
  );
}
