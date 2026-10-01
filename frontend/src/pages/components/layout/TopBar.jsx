// ============================================================
// TopBar — Fixed top navigation bar for authenticated pages
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

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import ThemeDropdown from "../shared/ThemeDropdown";
import Icon from "../ui/Icon";
import { IconButton } from "../ui/Button";
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from "../../../services/notificationApi";

export default function TopBar({
  theme,
  setTheme,
  tc,
  voiceMode,    // true while voice recognition is active
  startVoice,   // function to start voice recognition
  userId,
}) {
  const navigate = useNavigate();
  const { avatarLetter } = useAuth(); // get real avatar letter from auth context

  // ── Notification dropdown styling comes from the theme tokens ───
  // (tc.card / tc.sub / tc.divider / tc.cardHover / tc.navActive) —
  // one flat monochrome surface shared by all four themes.

  // ── State ────────────────────────────────────────────────────
  const [searchQuery,       setSearchQuery]       = useState("");
  const [mobileSearchOpen,  setMobileSearchOpen]  = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

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

  return (
    <header
      className={`fixed top-0 left-0 lg:left-64 right-0 z-30 border-b ${tc.divider} ${tc.bar} h-16`}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex items-center justify-between h-full px-4 md:px-6 gap-4">

        {/* ── Mobile: Logo (desktop uses Sidebar logo) ─────── */}
        <div className="lg:hidden flex items-center gap-2 shrink-0">
          <div
            className={`w-9 h-9 rounded-lg border flex items-center justify-center ${tc.button} cursor-pointer`}
            onClick={() => navigate("/home")}
          >
            <Icon name="ride" size={18} />
          </div>
          <span className="text-lg font-black cursor-pointer" onClick={() => navigate("/home")}>
            Ride<span className="opacity-60">Wise</span>
          </span>
        </div>

        {/* ── Desktop: Search bar ───────────────────────────── */}
        <div className="flex-1 max-w-2xl relative hidden md:block">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors ${tc.card}`}
          >
            <Icon name="search" size={16} className={tc.sub} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchQuery.trim()) {
                  navigate(`/riders?q=${encodeURIComponent(searchQuery.trim())}`);
                }
              }}
              placeholder="Search riders… (press Enter)"
              className={`flex-1 bg-transparent text-sm ${tc.text}`}
            />
            {searchQuery && (
              <IconButton
                icon="close"
                label="Clear search"
                size="sm"
                variant="ghost"
                tc={tc}
                onClick={() => setSearchQuery("")}
              />
            )}
          </div>
        </div>

        {/* ── Right: action icons ───────────────────────────── */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">

          {/* Mobile search button */}
          <IconButton
            icon="search"
            label="Search riders"
            variant="secondary"
            tc={tc}
            className="md:hidden"
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
          />

          {/* Voice button — swaps to micOff while listening */}
          {startVoice && (
            <IconButton
              icon={voiceMode ? "micOff" : "mic"}
              label="Voice search"
              variant={voiceMode ? "soft" : "secondary"}
              tc={tc}
              title='Voice commands: "dark", "light", "start", "find"'
              onClick={startVoice}
            />
          )}

          {/* Notification bell */}
          <div className="relative" data-notif-dropdown="true">
            <button
              onClick={openNotifications}
              title="Notifications"
              className={`relative w-10 h-10 rounded-full border flex items-center justify-center transition-colors ${
                showNotifDropdown ? `${tc.navActive} ${tc.divider}` : tc.record
              }`}
            >
              <Icon name="bell" size={16} />
              {unreadCount > 0 && (
                <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center ${tc.chipSelected}`}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* Notification dropdown — responsive positioning:
                • Mobile (<640px): fixed full-width sheet below the header
                • Desktop: absolute dropdown anchored to the bell button */}
            {showNotifDropdown && (
              <>
                {/* Mobile backdrop overlay (tap to close) */}
                <div
                  className="sm:hidden fixed inset-0 z-40"
                  onClick={() => setShowNotifDropdown(false)}
                />
                <div
                  data-notif-dropdown="true"
                  className={[
                    // Shared styles
                    "rounded-xl border overflow-hidden z-50 flex flex-col shadow-2xl",
                    tc.card,
                    // Mobile: fixed, full-width below the header
                    "fixed left-3 right-3 top-[68px]",
                    "max-h-[calc(100vh-84px)]",
                    // Desktop: absolute, anchored to bell button, narrower
                    "sm:fixed sm:left-auto sm:right-4 sm:top-[68px] sm:w-80 sm:max-h-[400px]",
                    // Large desktop: back to absolute positioning relative to bell
                    "lg:absolute lg:left-auto lg:right-0 lg:top-[46px]",
                  ].join(" ")}
                >
                {/* Header */}
                <div className={`flex items-center justify-between px-4 py-3.5 border-b ${tc.divider}`}>
                  <span className="font-black text-sm">Notifications</span>
                  {notifications.length > 0 && (
                    <button
                      onClick={() => {
                        markAllAsRead(userId);
                        setUnreadCount(0);
                        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                      }}
                      className={`text-[11px] font-bold transition-opacity hover:opacity-70 ${tc.sub}`}
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {/* Notification list */}
                <div className="overflow-y-auto flex-1 max-h-[340px]">
                  {notifications.length === 0 ? (
                    <div className={`px-4 py-8 text-center text-[13px] ${tc.sub}`}>
                      <Icon name="bellOff" size={24} className="block mx-auto mb-2" />
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
                            // Navigate to Home with the ride id in the URL so it
                            // works from ANY page (Account/Riders/Settings too).
                            // Home handles the openRide param once, then clears it.
                            navigate(`/home?openRide=${n.rideId}`, { state: { openRideId: n.rideId } });
                          }
                        }}
                        className={`px-4 py-3 border-b transition-colors ${tc.divider} ${tc.cardHover} ${
                          n.rideId ? "cursor-pointer" : "cursor-default"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                            n.type === "group_ride_invite" ? tc.accentSoft : `${tc.surface2} ${tc.divider}`
                          }`}>
                            <Icon name={n.type === "group_ride_invite" ? "riders" : "bell"} size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-bold text-[13px] mb-1 ${n.isRead ? tc.sub : tc.text}`}>
                              {n.title}
                            </p>
                            <p className={`text-[11px] leading-snug ${tc.sub}`}>
                              {n.message}
                            </p>
                          </div>
                          {!n.isRead && (
                            <span className={`w-2 h-2 rounded-full bg-current shrink-0 mt-1 ${tc.accent}`} />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                </div>
              </>
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
            className={`w-10 h-10 rounded-full border flex items-center justify-center font-bold text-sm transition-colors ${tc.button}`}
          >
            {avatarLetter}
          </button>
        </div>
      </div>

      {/* ── Mobile search slide-down ──────────────────────────── */}
      {mobileSearchOpen && (
        <div
          className={`md:hidden absolute top-full left-0 right-0 p-4 border-b ${tc.divider} ${tc.bar}`}
        >
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${tc.card}`}>
            <Icon name="search" size={16} className={tc.sub} />
            <input
              type="text"
              placeholder="Search riders… (press Enter)"
              className={`flex-1 bg-transparent text-sm ${tc.text}`}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.target.value.trim()) {
                  navigate(`/riders?q=${encodeURIComponent(e.target.value.trim())}`);
                  setMobileSearchOpen(false);
                }
              }}
            />
          </div>
        </div>
      )}
    </header>
  );
}
