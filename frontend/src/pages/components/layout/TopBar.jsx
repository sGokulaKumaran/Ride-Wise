// ============================================================
// 🔝 TopBar — Fixed top navigation bar for authenticated pages
//
// LEFT:   Mobile-only logo (sidebar handles desktop)
// CENTER: Search bar with dropdown (desktop only)
// RIGHT:  Mobile search | Voice mic | Notifications | Theme | Avatar
//
// CHANGES FROM OLD VERSION:
//   - Profile button now shows the real avatarLetter from AuthContext
//   - Clicking the profile button navigates to /account instead of /profile
//   - Cart button removed (not needed for rider dashboard focus)
//   - All other functionality (search, voice, notifications, theme) preserved
// ============================================================

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import ThemeDropdown from "../shared/ThemeDropdown";

// Search category suggestions shown in the dropdown
const SEARCH_CATEGORIES = [
  { type: "Bikes",   icon: "fa-motorcycle"    },
  { type: "Riders",  icon: "fa-user"          },
  { type: "Routes",  icon: "fa-route"         },
  { type: "Events",  icon: "fa-calendar"      },
];

export default function TopBar({
  theme,
  setTheme,
  tc,
  voiceMode,    // true while voice recognition is active
  startVoice,   // function to start voice recognition
  notificationCount = 5,
}) {
  const navigate = useNavigate();
  const { avatarLetter } = useAuth(); // get real avatar letter from auth context

  // ── State ────────────────────────────────────────────────────
  const [searchQuery,       setSearchQuery]       = useState("");
  const [searchOpen,        setSearchOpen]        = useState(false);
  const [mobileSearchOpen,  setMobileSearchOpen]  = useState(false);

  const searchRef = useRef(null);

  // ── Close search dropdown when clicking outside ───────────────
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
    <header
      className={`fixed top-0 left-0 lg:left-64 right-0 z-30 backdrop-blur-xl border-b ${tc.divider} bg-black/40 h-16`}
    >
      <div className="flex items-center justify-between h-full px-4 md:px-6 gap-4">

        {/* ── Mobile: Logo (desktop uses Sidebar logo) ─────── */}
        <div className="lg:hidden flex items-center gap-2 shrink-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${tc.button} text-sm cursor-pointer`}
            onClick={() => navigate("/home")}
          >
            <i className="fa fa-motorcycle" />
          </div>
          <span className="text-lg font-black cursor-pointer" onClick={() => navigate("/home")}>
            Ride<span className="opacity-60">Wise</span>
          </span>
        </div>

        {/* ── Desktop: Search bar ───────────────────────────── */}
        <div ref={searchRef} className="flex-1 max-w-2xl relative hidden md:block">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all focus-within:ring-2 focus-within:ring-orange-500/30 ${tc.card}`}
          >
            <i className={`fa fa-search text-sm ${tc.sub}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search bikes, riders, routes…"
              className={`flex-1 bg-transparent outline-none text-sm ${tc.text}`}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
                className={`text-xs ${tc.sub} hover:opacity-70`}
              >
                <i className="fa fa-times" />
              </button>
            )}
          </div>

          {/* Search dropdown — shows category suggestions */}
          {searchOpen && searchQuery && (
            <div
              className={`absolute top-full mt-2 w-full rounded-xl border backdrop-blur-2xl shadow-2xl z-50 overflow-hidden ${tc.card}`}
            >
              {SEARCH_CATEGORIES.map((item, i) => (
                <button
                  key={i}
                  onClick={() => { navigate("/search"); setSearchOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:bg-white/10"
                >
                  <i className={`fa ${item.icon} w-4 text-center ${tc.sub}`} />
                  <span className="text-sm">
                    <span className={tc.sub}>Search</span>{" "}
                    &ldquo;{searchQuery}&rdquo;{" "}
                    <span className={tc.sub}>in</span>{" "}
                    <strong>{item.type}</strong>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: action icons ───────────────────────────── */}
        <div className="flex items-center gap-1.5 shrink-0">

          {/* Mobile search button */}
          <button
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            className={`md:hidden w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 ${tc.record} text-white`}
          >
            <i className="fa fa-search text-sm" />
          </button>

          {/* Voice button — glows red while listening */}
          {startVoice && (
            <button
              onClick={startVoice}
              title='Voice commands: "dark", "light", "start", "find"'
              className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 text-white ${
                voiceMode ? "bg-red-500 animate-pulse" : tc.record
              }`}
            >
              <i className={`fa ${voiceMode ? "fa-microphone-slash" : "fa-microphone"} text-sm`} />
              {voiceMode && (
                <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30" />
              )}
            </button>
          )}

          {/* Notification bell */}
          <button
            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 text-white ${tc.record}`}
          >
            <i className="fa fa-bell text-sm" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white">
                {notificationCount}
              </span>
            )}
          </button>

          {/* Theme switcher dropdown */}
          <ThemeDropdown theme={theme} setTheme={setTheme} tc={tc} />

          {/* Profile avatar — navigates to /account */}
          {/* avatarLetter comes from AuthContext (first letter of username or email) */}
          <button
            id="topbar-profile-btn"
            onClick={() => navigate("/account")}
            title="My profile"
            className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center font-bold text-white hover:scale-110 transition-transform ring-2 ring-orange-500/30 text-sm"
          >
            {avatarLetter}
          </button>
        </div>
      </div>

      {/* ── Mobile search slide-down ──────────────────────────── */}
      {mobileSearchOpen && (
        <div
          className={`md:hidden absolute top-full left-0 right-0 p-4 border-b ${tc.divider} bg-black/95 backdrop-blur-xl`}
        >
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${tc.card}`}>
            <i className={`fa fa-search text-sm ${tc.sub}`} />
            <input
              type="text"
              placeholder="Search bikes, riders, routes…"
              className={`flex-1 bg-transparent outline-none text-sm ${tc.text}`}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") { navigate("/search"); setMobileSearchOpen(false); }
              }}
            />
          </div>
        </div>
      )}
    </header>
  );
}
