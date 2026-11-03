// ============================================================
// TopBar — Fixed top navigation bar for authenticated pages
//
// LEFT:   Mobile-only logo (sidebar handles desktop)
// CENTER: Universal Search bar with icon-driven live dropdown
// RIGHT:  Mobile search | Voice mic | Notifications | Theme | Avatar
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import ThemeDropdown from "../shared/ThemeDropdown";
import Icon from "../ui/Icon";
import { IconButton } from "../ui/Button";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "../../../services/notificationApi";
import { searchRiders } from "../../../services/ridersApi";
import { searchOrganizations } from "../../../services/orgApi";
import { getUserRides } from "../../../services/rideApi";
import { shortPlaceName, formatDistance, rideRiddenMeters } from "../../../services/routingApi";
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

const NOTIFICATION_ACCENT = new Set([
  "group_ride_invite",
  "org_invite",
  "vehicle_alert",
  "feedback_received",
  "feedback_reply",
]);

const safeLink = (link) =>
  typeof link === "string" && /^\/(?!\/)/.test(link) ? link : null;

const SEARCH_SCOPES = [
  { id: "all",     icon: "search",   label: "All",    placeholder: "Search rides, riders, orgs…" },
  { id: "rides",   icon: "route",    label: "Rides",  placeholder: "Search my rides…" },
  { id: "riders",  icon: "riders",   label: "Riders", placeholder: "Search riders…" },
  { id: "orgs",    icon: "building", label: "Orgs",   placeholder: "Search organizations…" },
  { id: "actions", icon: "compass",  label: "Go",     placeholder: "Jump to page or theme…" },
];

export default function TopBar({
  theme,
  setTheme,
  tc,
  voiceMode,
  startVoice,
  userId,
}) {
  const navigate = useNavigate();
  const { avatarLetter, isAdmin } = useAuth();

  // ── Search state ─────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [scope, setScope] = useState("all");

  const [riderHits, setRiderHits] = useState([]);
  const [orgHits, setOrgHits] = useState([]);
  const [userRides, setUserRides] = useState(() => peekCache(`home-rides-${userId}`) || []);
  const [searchingRemote, setSearchingRemote] = useState(false);
  const searchDebounceRef = useRef(null);

  // ── Notification state ───────────────────────────────────────
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(() => peekCache(`unread-${userId}`) ?? 0);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  // Unread count polling
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

  // Ensure user's rides are available for instant search when search opens
  const ensureRidesLoaded = () => {
    if (!userId) return;
    const cached = peekCache(`home-rides-${userId}`);
    if (cached) {
      setUserRides(cached);
      return;
    }
    getUserRides(userId)
      .then((list) => {
        if (Array.isArray(list)) {
          setUserRides(list);
          writeCache(`home-rides-${userId}`, list);
        }
      })
      .catch(() => {});
  };

  // Debounced remote search for riders and public organizations
  useEffect(() => {
    clearTimeout(searchDebounceRef.current);
    const q = searchQuery.trim();
    if (!q || scope === "rides" || scope === "actions") {
      return undefined;
    }

    let cancelled = false;
    searchDebounceRef.current = setTimeout(async () => {
      setSearchingRemote(true);
      try {
        const wantRiders = scope === "all" || scope === "riders";
        const wantOrgs = (scope === "all" || scope === "orgs") && q.length >= 2;

        const [rList, oList] = await Promise.all([
          wantRiders ? searchRiders(q).catch(() => []) : Promise.resolve([]),
          wantOrgs ? searchOrganizations(q).catch(() => []) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setRiderHits(Array.isArray(rList) ? rList.slice(0, 5) : []);
        setOrgHits(Array.isArray(oList) ? oList.slice(0, 5) : []);
      } finally {
        if (!cancelled) setSearchingRemote(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, scope]);

  // Close search dropdown on outside click or Escape
  useEffect(() => {
    if (!searchOpen && !mobileSearchOpen) return undefined;
    const onDocClick = (e) => {
      if (!e.target.closest("[data-universal-search]")) {
        setSearchOpen(false);
        setMobileSearchOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setSearchOpen(false);
        setMobileSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [searchOpen, mobileSearchOpen]);

  const closeSearch = () => {
    setSearchOpen(false);
    setMobileSearchOpen(false);
  };

  // Quick navigation & action items (icon + concise title + keywords)
  const quickItems = useMemo(() => {
    const base = [
      {
        id: "new-ride",
        icon: "ride",
        label: "New ride",
        sub: "Solo or group",
        keywords: "start new ride solo group map route plan",
        run: () => {
          navigate("/home?startRide=1");
          window.dispatchEvent(new CustomEvent("ridewise:home-overlay", { detail: "startRide" }));
        },
      },
      {
        id: "history",
        icon: "history",
        label: "History",
        sub: "Past rides",
        keywords: "history past completed rides log",
        run: () => {
          navigate("/home?openHistory=1");
          window.dispatchEvent(new CustomEvent("ridewise:home-overlay", { detail: "openHistory" }));
        },
      },
      {
        id: "riders",
        icon: "riders",
        label: "Riders",
        sub: "Find & connect",
        keywords: "riders friends people community nearby",
        run: () => navigate("/riders"),
      },
      {
        id: "orgs",
        icon: "building",
        label: "Organizations",
        sub: "Fleets & buses",
        keywords: "organizations orgs fleet bus college company",
        run: () => navigate("/organizations?tab=find"),
      },
      {
        id: "settings",
        icon: "settings",
        label: "Settings",
        sub: "Preferences",
        keywords: "settings preferences voice map privacy password",
        run: () => navigate("/settings"),
      },
      {
        id: "profile",
        icon: "user",
        label: "Profile",
        sub: "Account",
        keywords: "profile account me email phone",
        run: () => navigate("/account"),
      },
      {
        id: "help",
        icon: "help",
        label: "Help",
        sub: "Feedback & FAQ",
        keywords: "help feedback bug support faq",
        run: () => navigate("/settings#help-feedback"),
      },
    ];

    if (isAdmin) {
      base.push({
        id: "admin",
        icon: "shield",
        label: "Admin",
        sub: "Control panel",
        keywords: "admin dashboard users rides organizations",
        run: () => navigate("/admin"),
      });
    }

    if (setTheme) {
      base.push(
        {
          id: "theme-dark",
          icon: "moon",
          label: "Dark theme",
          sub: theme === "dark" ? "Active" : "Switch",
          keywords: "dark theme mode appearance",
          run: () => setTheme("dark"),
        },
        {
          id: "theme-light",
          icon: "sun",
          label: "Light theme",
          sub: theme === "light" ? "Active" : "Switch",
          keywords: "light theme mode appearance",
          run: () => setTheme("light"),
        },
        {
          id: "theme-warm",
          icon: "sunCloud",
          label: "Warm theme",
          sub: theme === "warm" ? "Active" : "Switch",
          keywords: "warm theme mode appearance",
          run: () => setTheme("warm"),
        },
        {
          id: "theme-midnight",
          icon: "moonStars",
          label: "Midnight theme",
          sub: theme === "midnight" ? "Active" : "Switch",
          keywords: "midnight theme mode appearance",
          run: () => setTheme("midnight"),
        },
      );
    }

    return base;
  }, [navigate, isAdmin, setTheme, theme]);

  const trimmedQuery = searchQuery.trim();
  const lowerQuery = trimmedQuery.toLowerCase();

  // Filtered quick actions
  const matchedActions = useMemo(() => {
    if (!lowerQuery) return quickItems.slice(0, isAdmin ? 8 : 6);
    if (scope !== "all" && scope !== "actions") return [];
    return quickItems
      .filter(
        (item) =>
          item.label.toLowerCase().includes(lowerQuery) ||
          item.keywords.includes(lowerQuery)
      )
      .slice(0, 4);
  }, [lowerQuery, quickItems, scope, isAdmin]);

  // Filtered user rides
  const matchedRides = useMemo(() => {
    if (scope !== "all" && scope !== "rides") return [];
    if (!lowerQuery) return userRides.slice(0, 3);
    return userRides
      .filter((r) => {
        const from = (r.fromName || "").toLowerCase();
        const to = (r.destinationName || "").toLowerCase();
        const status = (r.status || "").toLowerCase();
        return from.includes(lowerQuery) || to.includes(lowerQuery) || status === lowerQuery;
      })
      .slice(0, 4);
  }, [userRides, lowerQuery, scope]);

  const visibleRiders =
    trimmedQuery && (scope === "all" || scope === "riders") ? riderHits : [];
  const visibleOrgs =
    trimmedQuery && (scope === "all" || scope === "orgs") ? orgHits : [];

  const activeScopeMeta =
    SEARCH_SCOPES.find((s) => s.id === scope) || SEARCH_SCOPES[0];

  const handleEnterSubmit = () => {
    if (!trimmedQuery) return;
    if (scope === "orgs") {
      navigate(`/organizations?q=${encodeURIComponent(trimmedQuery)}`);
      closeSearch();
      return;
    }
    if (scope === "rides" && matchedRides.length > 0) {
      navigate(`/home?openRide=${matchedRides[0].id}`);
      closeSearch();
      return;
    }
    if (scope === "actions" && matchedActions.length > 0) {
      matchedActions[0].run();
      closeSearch();
      return;
    }
    if (matchedActions.length > 0 && visibleRiders.length === 0 && visibleOrgs.length === 0 && matchedRides.length === 0) {
      matchedActions[0].run();
      closeSearch();
      return;
    }
    navigate(`/riders?q=${encodeURIComponent(trimmedQuery)}`);
    closeSearch();
  };

  // Notifications dropdown
  const openNotifications = () => {
    setShowNotifDropdown((v) => !v);
    if (!showNotifDropdown && userId) {
      getNotifications().then((list) => {
        const now = Date.now();
        setNotifications(
          (list || []).map((n) => ({ ...n, when: timeAgo(n.createdAt, now) }))
        );
      });
    }
  };

  useEffect(() => {
    if (!showNotifDropdown) return undefined;
    const close = (e) => {
      if (!e.target.closest("[data-notif-dropdown]")) setShowNotifDropdown(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [showNotifDropdown]);

  // Shared dropdown content rendered on both desktop and mobile
  const renderSearchPanel = () => (
    <div
      className={`rounded-2xl border overflow-hidden shadow-2xl ${tc.card}`}
    >
      {/* ── Category Scope Bar (Icons + 1-word labels) ── */}
      <div className={`flex items-center gap-1 px-3 py-2 border-b overflow-x-auto ${tc.divider}`}>
        {SEARCH_SCOPES.map((item) => {
          const selected = scope === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setScope(item.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors shrink-0 ${
                selected ? tc.chipSelected : `${tc.surface2} ${tc.sub} ${tc.cardHover}`
              }`}
            >
              <Icon name={item.icon} size={13} />
              <span>{item.label}</span>
            </button>
          );
        })}
        {searchingRemote && (
          <Icon name="spinner" size={14} className={`ml-auto shrink-0 rw-spin ${tc.sub}`} />
        )}
      </div>

      {/* ── Results Body ── */}
      <div className="max-h-[380px] overflow-y-auto divide-y divide-transparent p-2 space-y-3">
        {/* 1. Quick Shortcuts Grid (when input is empty) or List (when typing) */}
        {matchedActions.length > 0 && (
          <div>
            <div className={`flex items-center gap-1.5 px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider ${tc.sub}`}>
              <Icon name="compass" size={12} />
              <span>{trimmedQuery ? "Shortcuts" : "Quick access"}</span>
            </div>
            <div className={trimmedQuery ? "space-y-1" : "grid grid-cols-2 sm:grid-cols-3 gap-1.5"}>
              {matchedActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => {
                    action.run();
                    closeSearch();
                  }}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors w-full ${tc.cardHover}`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tc.surface2}`}>
                    <Icon name={action.icon} size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold truncate">{action.label}</span>
                    <span className={`block text-[10px] truncate ${tc.sub}`}>{action.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 2. My Rides */}
        {matchedRides.length > 0 && (
          <div>
            <div className={`flex items-center gap-1.5 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider ${tc.sub}`}>
              <Icon name="route" size={12} />
              <span>{trimmedQuery ? "My rides" : "Recent rides"}</span>
            </div>
            <div className="space-y-0.5">
              {matchedRides.map((ride) => {
                const dist = formatDistance(rideRiddenMeters(ride));
                const active = ride.status === "active";
                return (
                  <button
                    key={ride.id}
                    type="button"
                    onClick={() => {
                      navigate(`/home?openRide=${ride.id}`);
                      closeSearch();
                    }}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors w-full ${tc.cardHover}`}
                  >
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${active ? tc.accentSoft : tc.surface2}`}>
                      <Icon name={ride.rideType === "group" ? "riders" : "route"} size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-xs font-semibold truncate">
                        <span className="truncate">{shortPlaceName(ride.fromName)}</span>
                        <Icon name="arrowRight" size={11} className={`shrink-0 ${tc.sub}`} />
                        <span className="truncate">{shortPlaceName(ride.destinationName)}</span>
                      </span>
                      <span className={`block text-[10px] ${tc.sub}`}>
                        {active ? "Live" : ride.status} · {dist}
                      </span>
                    </span>
                    <Icon name="chevronRight" size={14} className={tc.sub} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Matching Riders */}
        {visibleRiders.length > 0 && (
          <div>
            <div className={`flex items-center gap-1.5 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider ${tc.sub}`}>
              <Icon name="riders" size={12} />
              <span>Riders</span>
            </div>
            <div className="space-y-0.5">
              {visibleRiders.map((rider) => (
                <button
                  key={rider.id}
                  type="button"
                  onClick={() => {
                    navigate(`/riders?q=${encodeURIComponent(rider.username || trimmedQuery)}`);
                    closeSearch();
                  }}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors w-full ${tc.cardHover}`}
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${tc.button}`}>
                    {(rider.username?.[0] || rider.email?.[0] || "?").toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold truncate">
                      @{rider.username || "rider"}
                    </span>
                    <span className={`block text-[10px] truncate ${tc.sub}`}>
                      {rider.address || rider.email || ""}
                    </span>
                  </span>
                  <Icon name="chevronRight" size={14} className={tc.sub} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 4. Matching Organizations */}
        {visibleOrgs.length > 0 && (
          <div>
            <div className={`flex items-center gap-1.5 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider ${tc.sub}`}>
              <Icon name="building" size={12} />
              <span>Organizations</span>
            </div>
            <div className="space-y-0.5">
              {visibleOrgs.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => {
                    navigate(`/organizations/${org.id}`);
                    closeSearch();
                  }}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors w-full ${tc.cardHover}`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tc.surface2}`}>
                    <Icon name="building" size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 text-xs font-semibold truncate">
                      <span className="truncate">{org.name}</span>
                      {org.verified && <Icon name="checkCircle" size={12} className={tc.ok} />}
                    </span>
                    <span className={`block text-[10px] truncate ${tc.sub}`}>
                      {org.orgCode} · {org.activeTrips || 0} live
                    </span>
                  </span>
                  <Icon name="chevronRight" size={14} className={tc.sub} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state when typing */}
        {trimmedQuery &&
          !searchingRemote &&
          matchedActions.length === 0 &&
          matchedRides.length === 0 &&
          visibleRiders.length === 0 &&
          visibleOrgs.length === 0 && (
            <div className={`py-6 text-center text-xs ${tc.sub}`}>
              <Icon name="search" size={20} className="mx-auto mb-1.5 opacity-60" />
              No matches for &ldquo;{trimmedQuery}&rdquo;
            </div>
          )}
      </div>

      {/* ── Footer Quick Search Links when typing ── */}
      {trimmedQuery && (
        <div className={`flex items-center justify-between gap-2 px-3 py-2 border-t text-xs ${tc.surface2} ${tc.divider}`}>
          <button
            type="button"
            onClick={() => {
              navigate(`/riders?q=${encodeURIComponent(trimmedQuery)}`);
              closeSearch();
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-colors ${tc.cardHover}`}
          >
            <Icon name="riders" size={14} />
            <span>Riders</span>
            <Icon name="arrowRight" size={12} className={tc.sub} />
          </button>
          <button
            type="button"
            onClick={() => {
              navigate(`/organizations?q=${encodeURIComponent(trimmedQuery)}`);
              closeSearch();
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-colors ${tc.cardHover}`}
          >
            <Icon name="building" size={14} />
            <span>Organizations</span>
            <Icon name="arrowRight" size={12} className={tc.sub} />
          </button>
          <button
            type="button"
            onClick={() => {
              navigate("/home?startRide=1");
              window.dispatchEvent(new CustomEvent("ridewise:home-overlay", { detail: "startRide" }));
              closeSearch();
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-colors ${tc.cardHover}`}
          >
            <Icon name="ride" size={14} />
            <span>Plan ride</span>
            <Icon name="arrowRight" size={12} className={tc.sub} />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <header
      className={`fixed top-0 left-0 lg:left-64 right-0 z-30 border-b ${tc.divider} ${tc.bar} h-16`}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex items-center justify-between h-full px-4 md:px-6 gap-2 sm:gap-4">
        {/* ── Mobile: Logo ── */}
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

        {/* ── Desktop: Universal Search bar ── */}
        <div
          data-universal-search="true"
          className="flex-1 max-w-2xl relative hidden md:block"
        >
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors ${tc.card}`}
          >
            <Icon name={activeScopeMeta.icon} size={16} className={tc.sub} />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => {
                setSearchOpen(true);
                ensureRidesLoaded();
              }}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!searchOpen) setSearchOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleEnterSubmit();
                }
              }}
              placeholder={activeScopeMeta.placeholder}
              aria-label="Search rides, riders, organizations, or pages"
              className={`flex-1 bg-transparent text-sm outline-none ${tc.text}`}
            />
            {searchQuery && (
              <IconButton
                icon="close"
                label="Clear search"
                size="sm"
                variant="ghost"
                tc={tc}
                onClick={() => {
                  setSearchQuery("");
                  setRiderHits([]);
                  setOrgHits([]);
                }}
              />
            )}
          </div>

          {searchOpen && (
            <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50">
              {renderSearchPanel()}
            </div>
          )}
        </div>

        {/* ── Right: action icons ── */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Mobile search button */}
          <IconButton
            icon="search"
            label="Search"
            variant="secondary"
            tc={tc}
            className="md:hidden"
            onClick={() => {
              const next = !mobileSearchOpen;
              setMobileSearchOpen(next);
              if (next) ensureRidesLoaded();
            }}
          />

          {/* Voice button */}
          {startVoice && (
            <IconButton
              icon={voiceMode ? "micOff" : "mic"}
              label={
                voiceMode
                  ? "Listening…"
                  : 'Voice commands: say "start", "history", "riders", "dark" or "light"'
              }
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
              aria-label={
                unreadCount > 0
                  ? `Notifications, ${unreadCount} unread`
                  : "Notifications"
              }
              aria-expanded={showNotifDropdown}
              className={`relative w-10 h-10 rounded-full border flex items-center justify-center transition-colors ${
                showNotifDropdown ? `${tc.navActive} ${tc.divider}` : tc.record
              }`}
            >
              <Icon name="bell" size={16} />
              {unreadCount > 0 && (
                <span
                  className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center ${tc.chipSelected}`}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {showNotifDropdown && (
              <>
                <div
                  className="sm:hidden fixed inset-0 z-40"
                  onClick={() => setShowNotifDropdown(false)}
                />
                <div
                  data-notif-dropdown="true"
                  className={[
                    "rounded-xl border overflow-hidden z-50 flex flex-col shadow-2xl",
                    tc.card,
                    "fixed left-3 right-3 top-[68px]",
                    "max-h-[calc(100vh-84px)]",
                    "sm:fixed sm:left-auto sm:right-4 sm:top-[68px] sm:w-80 sm:max-h-[400px]",
                    "lg:absolute lg:left-auto lg:right-0 lg:top-[46px]",
                  ].join(" ")}
                >
                  <div
                    className={`flex items-center justify-between px-4 py-3.5 border-b ${tc.divider}`}
                  >
                    <span className="font-black text-sm">Notifications</span>
                    {notifications.length > 0 && (
                      <button
                        onClick={() => {
                          markAllAsRead();
                          setUnreadCount(0);
                          setNotifications((prev) =>
                            prev.map((n) => ({ ...n, isRead: true }))
                          );
                        }}
                        className={`text-[11px] font-bold transition-opacity hover:opacity-70 ${tc.sub}`}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="overflow-y-auto flex-1 max-h-[340px]">
                    {notifications.length === 0 ? (
                      <div className={`px-4 py-8 text-center text-[13px] ${tc.sub}`}>
                        <Icon name="bellOff" size={24} className="block mx-auto mb-2" />
                        No notifications yet
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (!n.isRead) {
                              markAsRead(n.id);
                              setUnreadCount((prev) => Math.max(0, prev - 1));
                              setNotifications((prev) =>
                                prev.map((x) =>
                                  x.id === n.id ? { ...x, isRead: true } : x
                                )
                              );
                            }
                            const link = safeLink(n.link);
                            if (link) {
                              setShowNotifDropdown(false);
                              navigate(link);
                            } else if (n.rideId) {
                              setShowNotifDropdown(false);
                              navigate(`/home?openRide=${n.rideId}`, {
                                state: { openRideId: n.rideId },
                              });
                            }
                          }}
                          className={`px-4 py-3 border-b transition-colors ${tc.divider} ${tc.cardHover} ${
                            n.rideId || safeLink(n.link)
                              ? "cursor-pointer"
                              : "cursor-default"
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                                n.type === "vehicle_sos"
                                  ? tc.dangerSoft
                                  : NOTIFICATION_ACCENT.has(n.type)
                                  ? tc.accentSoft
                                  : `${tc.surface2} ${tc.divider}`
                              }`}
                            >
                              <Icon
                                name={NOTIFICATION_ICON[n.type] || "bell"}
                                size={14}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p
                                className={`font-bold text-[13px] mb-1 ${
                                  n.isRead ? tc.sub : tc.text
                                }`}
                              >
                                {n.title}
                              </p>
                              <p className={`text-[11px] leading-snug ${tc.sub}`}>
                                {n.message}
                              </p>
                              {n.when && (
                                <p className={`mt-1 text-[10px] ${tc.sub} opacity-80`}>
                                  {n.when}
                                </p>
                              )}
                            </div>
                            {!n.isRead && (
                              <span
                                className={`w-2 h-2 rounded-full bg-current shrink-0 mt-1 ${tc.accent}`}
                              />
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

          {/* Profile avatar */}
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

      {/* ── Mobile universal search slide-down ── */}
      {mobileSearchOpen && (
        <div
          data-universal-search="true"
          className={`md:hidden absolute top-full left-0 right-0 p-3 border-b space-y-2 shadow-xl ${tc.divider} ${tc.bar}`}
        >
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${tc.card}`}>
            <Icon name={activeScopeMeta.icon} size={16} className={tc.sub} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeScopeMeta.placeholder}
              className={`flex-1 bg-transparent text-sm outline-none ${tc.text}`}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleEnterSubmit();
                }
              }}
            />
            {searchQuery && (
              <IconButton
                icon="close"
                label="Clear search"
                size="sm"
                variant="ghost"
                tc={tc}
                onClick={() => {
                  setSearchQuery("");
                  setRiderHits([]);
                  setOrgHits([]);
                }}
              />
            )}
          </div>
          {renderSearchPanel()}
        </div>
      )}
    </header>
  );
}
