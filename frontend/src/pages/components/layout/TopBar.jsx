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
import { peekCache, writeCache } from "../../../services/pageCache";

// "just now" · "12 min ago" · "3 h ago" · "2 d ago" · "14 Sep"
function timeAgo(iso, now) {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const minutes = Math.max(0, Math.round((now - then) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(then).toLocaleDateString([], { day: "numeric", month: "short" });
}

// One glyph per kind of notification
const NOTIFICATION_ICON = {
  group_ride_invite: "riders",
  group_ride_ended: "finish",
  group_ride_member_left: "leave",
  // Organizations and their vehicles
  org_invite: "building",
  org_member: "riders",
  org_notice: "building",
  org_announcement: "megaphone",
  vehicle_alert: "bus",
  vehicle_sos: "sos",
  vehicle_session_ended: "finish",
  feedback_received: "message",
  feedback_reply: "message",
};

// Kinds that deserve the accent tile (they ask for attention / an answer).
const NOTIFICATION_ACCENT = new Set(["group_ride_invite", "org_invite", "vehicle_alert", "feedback_received", "feedback_reply"]);

// Only paths inside the app are followed (a notification's link comes from
// the server, but it is still data — never navigate anywhere else with it).
const safeLink = (link) => (typeof link === "string" && /^\/(?!\/)/.test(link) ? link : null);

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
  // Kept in the session cache: every page has its own TopBar, and the badge
  // used to flash back to 0 on each navigation until the count arrived.
  const [unreadCount, setUnreadCount] = useState(() => peekCache(`unread-${userId}`) ?? 0);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  // Unread count: now, every 30 s, and whenever the tab becomes visible
  // again (a hidden tab does not need to poll).
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    const fetchCount = () => {
      if (document.hidden) return;
      getUnreadCount().then((count) => {
        if (cancelled) return;
        setUnreadCount(count);
        writeCache(`unread-${userId}`, count);
      });
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    document.addEventListener("visibilitychange", fetchCount);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", fetchCount);
    };
  }, [userId]);

  const openNotifications = () => {
    setShowNotifDropdown(v => !v);
    if (!showNotifDropdown && userId) {
      getNotifications().then((list) => {
        const now = Date.now();
        setNotifications((list || []).map((n) => ({ ...n, when: timeAgo(n.createdAt, now) })));
      });
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
      <div className="flex items-center justify-between h-full px-4 md:px-6 gap-2 sm:gap-4">

        {/* ── Mobile: Logo (desktop uses Sidebar logo) ───────
            The bar has to fit a 320 px phone: the wordmark is dropped on
            the narrowest screens, and the profile button (further down)
            only appears from 640 px — phones have the Account tab. */}
        <button
          type="button"
          onClick={() => navigate("/home")}
          aria-label="RideWise home"
          className="lg:hidden flex items-center gap-2 shrink-0"
        >
          <span className={`w-9 h-9 rounded-lg border flex items-center justify-center ${tc.button}`}>
            <Icon name="ride" size={18} />
          </span>
          <span className="hidden min-[400px]:inline text-lg font-black">
            Ride<span className="opacity-60">Wise</span>
          </span>
        </button>

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
              label={voiceMode
                ? "Listening…"
                : 'Voice commands: say "start", "history", "riders", "dark" or "light"'}
              variant={voiceMode ? "soft" : "secondary"}
              tc={tc}
              onClick={startVoice}
            />
          )}

          {/* Notification bell */}
          <div className="relative" data-notif-dropdown="true">
            <button
              onClick={openNotifications}
              title="Notifications"
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
              aria-expanded={showNotifDropdown}
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
                        markAllAsRead();
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
                          const link = safeLink(n.link);
                          if (link) {
                            // Organization / vehicle notifications say where they lead
                            // (an invitation, a vehicle's tracking screen, the fleet map).
                            setShowNotifDropdown(false);
                            navigate(link);
                          } else if (n.rideId) {
                            setShowNotifDropdown(false);
                            // Navigate to Home with the ride id in the URL so it
                            // works from ANY page (Account/Riders/Settings too).
                            // Home handles the openRide param once, then clears it.
                            navigate(`/home?openRide=${n.rideId}`, { state: { openRideId: n.rideId } });
                          }
                        }}
                        className={`px-4 py-3 border-b transition-colors ${tc.divider} ${tc.cardHover} ${
                          n.rideId || safeLink(n.link) ? "cursor-pointer" : "cursor-default"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                            n.type === "vehicle_sos" ? tc.dangerSoft
                              : NOTIFICATION_ACCENT.has(n.type) ? tc.accentSoft : `${tc.surface2} ${tc.divider}`
                          }`}>
                            <Icon name={NOTIFICATION_ICON[n.type] || "bell"} size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-bold text-[13px] mb-1 ${n.isRead ? tc.sub : tc.text}`}>
                              {n.title}
                            </p>
                            <p className={`text-[11px] leading-snug ${tc.sub}`}>
                              {n.message}
                            </p>
                            {n.when && (
                              <p className={`mt-1 text-[10px] ${tc.sub} opacity-80`}>{n.when}</p>
                            )}
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
            aria-label="My profile"
            className={`hidden sm:flex w-10 h-10 rounded-full border items-center justify-center font-bold text-sm transition-colors ${tc.button}`}
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
