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
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from "../../../services/notificationApi";

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
  userId,
  notificationCount = 5,
}) {
  const navigate = useNavigate();
  const { avatarLetter } = useAuth(); // get real avatar letter from auth context

  // ── State ────────────────────────────────────────────────────
  const [searchQuery,       setSearchQuery]       = useState("");
  const [searchOpen,        setSearchOpen]        = useState(false);
  const [mobileSearchOpen,  setMobileSearchOpen]  = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  const searchRef = useRef(null);

  useEffect(() => {
    if (!userId) return;
    const fetchCount = () => getUnreadCount(userId).then(setUnreadCount).catch(() => {});
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  const openNotifications = () => {
    setShowNotifDropdown(v => !v);
    if (!showNotifDropdown && userId) {
      getNotifications(userId).then(list => {
        setNotifications(list || []);
      }).catch(() => {});
    }
  };

  useEffect(() => {
    if (!showNotifDropdown) return;
    const close = (e) => {
      if (!e.target.closest('[data-notif-dropdown]')) setShowNotifDropdown(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showNotifDropdown]);

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
          <div style={{ position: "relative" }} data-notif-dropdown="true">
            <button
              onClick={openNotifications}
              title="Notifications"
              style={{
                width: "38px", height: "38px", borderRadius: "12px",
                background: showNotifDropdown ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.06)",
                border: showNotifDropdown ? "1px solid rgba(249,115,22,0.3)" : "1px solid rgba(255,255,255,0.08)",
                color: showNotifDropdown ? "#f97316" : "rgba(255,255,255,0.7)",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative", fontSize: "15px",
                transition: "all 0.2s",
              }}
            >
              <i className="fa fa-bell" />
              {unreadCount > 0 && (
                <span style={{
                  position: "absolute", top: "-3px", right: "-3px",
                  width: "18px", height: "18px", borderRadius: "50%",
                  background: "linear-gradient(135deg, #ef4444, #dc2626)",
                  color: "white", fontSize: "10px", fontWeight: 900,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "2px solid rgba(15,15,26,0.95)",
                  boxShadow: "0 2px 8px rgba(239,68,68,0.4)",
                }}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* Notification dropdown */}
            {showNotifDropdown && (
              <div style={{
                position: "absolute", top: "46px", right: 0,
                width: "320px", maxHeight: "400px",
                background: "rgba(15,15,26,0.97)",
                backdropFilter: "blur(24px)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "16px",
                boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
                zIndex: 9999,
                overflow: "hidden",
                display: "flex", flexDirection: "column",
              }}>
                {/* Header */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 16px",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <span style={{ fontWeight: 900, fontSize: "14px" }}>Notifications</span>
                  {notifications.length > 0 && (
                    <button
                      onClick={() => {
                        markAllAsRead(userId);
                        setUnreadCount(0);
                        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                      }}
                      style={{
                        background: "none", border: "none",
                        color: "#8b5cf6", fontSize: "11px", fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {/* Notification list */}
                <div style={{ overflowY: "auto", flex: 1, maxHeight: "340px" }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: "32px 16px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>
                      <i className="fa fa-bell-slash" style={{ fontSize: "24px", marginBottom: "8px", display: "block" }} />
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => {
                          if (!n.isRead) {
                            markAsRead(n.id);
                            setUnreadCount(prev => Math.max(0, prev - 1));
                            setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x));
                          }
                          if (n.rideId) {
                            setShowNotifDropdown(false);
                            // Dispatch event for Home.jsx to handle opening the ride
                            window.dispatchEvent(new CustomEvent("rw-open-ride", { detail: { rideId: n.rideId } }));
                          }
                        }}
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          cursor: n.rideId ? "pointer" : "default",
                          background: n.isRead ? "transparent" : "rgba(139,92,246,0.06)",
                          transition: "background 0.2s",
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                        onMouseLeave={e => e.currentTarget.style.background = n.isRead ? "transparent" : "rgba(139,92,246,0.06)"}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                          <div style={{
                            width: "32px", height: "32px", borderRadius: "10px", flexShrink: 0,
                            background: n.type === "group_ride_invite"
                              ? "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(99,102,241,0.15))"
                              : "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "13px",
                          }}>
                            {n.type === "group_ride_invite" ? "👥" : "🔔"}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 700, fontSize: "13px", margin: "0 0 3px",
                              color: n.isRead ? "rgba(255,255,255,0.6)" : "white" }}>
                              {n.title}
                            </p>
                            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", margin: 0,
                              lineHeight: "1.4" }}>
                              {n.message}
                            </p>
                          </div>
                          {!n.isRead && (
                            <span style={{
                              width: "8px", height: "8px", borderRadius: "50%",
                              background: "#8b5cf6", flexShrink: 0, marginTop: "4px",
                            }} />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

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
