// ============================================================
// 📌 Sidebar — Left navigation for RideWise (desktop only)
//
// LAYOUT (top to bottom):
//   Logo → Nav items → AccountMenu (profile dropdown)
//
// NAV ITEMS:
//   🏠 Home | 🔍 Find Riders | 🏍️ My Rides | 👥 Community
//   💬 Messages (with badge) | 🗺️ Map | ⚙ Settings
//
// ACTIVE STATE:
//   The current route is highlighted using location.pathname comparison.
//
// AccountMenu (bottom):
//   Shows avatar + username + email. Click to open a dropdown
//   with My Profile, My Rides, Settings, and Logout.
// ============================================================

import { useNavigate, useLocation } from "react-router-dom";
import AccountMenu from "../account/AccountMenu";

export default function Sidebar({ tc }) {
  const navigate  = useNavigate();
  const location  = useLocation();

  // ── Navigation menu items ────────────────────────────────────
  // badge: optional red notification count
  const menuItems = [
    { icon: "fa-home",       label: "Home",         path: "/home"        },
    { icon: "fa-search",     label: "Find Riders",  path: "/find-riders" },
    { icon: "fa-motorcycle", label: "My Rides",     path: "/my-rides"    },
    { icon: "fa-users",      label: "Community",    path: "/community"   },
    { icon: "fa-comments",   label: "Messages",     path: "/messages",  badge: 3 },
    { icon: "fa-map",        label: "Map",          path: "/map"         },
  ];

  return (
    <aside className={`hidden lg:flex fixed left-0 top-0 h-screen w-64 flex-col p-4 border-r ${tc.divider} bg-black/40 backdrop-blur-xl z-40`}>

      {/* ── Logo ──────────────────────────────────────────────── */}
      <div
        onClick={() => navigate("/home")}
        className="flex items-center gap-3 px-4 py-4 cursor-pointer hover:scale-105 transition-transform"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tc.button} text-sm`}>
          <i className="fa fa-motorcycle" />
        </div>
        <span className="text-xl font-black">
          Ride<span className="opacity-60">Wise</span>
        </span>
      </div>

      {/* ── Main nav items ────────────────────────────────────── */}
      <nav className="flex-1 mt-6 space-y-1">
        {menuItems.map((item) => {
          // Highlight when the path matches exactly
          const isActive = location.pathname === item.path;

          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all hover:scale-[1.02] ${
                isActive
                  ? `${tc.button}` // active = filled button style
                  : `hover:bg-white/10 ${tc.text}`
              }`}
            >
              <i className={`fa ${item.icon} text-lg w-6 text-center`} />
              <span className="font-semibold flex-1 text-left">{item.label}</span>
              {/* Notification badge */}
              {item.badge && (
                <span className="px-2 py-0.5 bg-red-500 rounded-full text-xs font-bold text-white animate-pulse">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* ── Settings quick link (bottom of nav, before AccountMenu) ── */}
        <button
          onClick={() => navigate("/settings")}
          className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all hover:scale-[1.02] ${
            location.pathname === "/settings"
              ? `${tc.button}`
              : `hover:bg-white/10 ${tc.text}`
          }`}
        >
          <i className="fa fa-cog text-lg w-6 text-center" />
          <span className="font-semibold flex-1 text-left">Settings</span>
        </button>
      </nav>

      {/* ── Account menu (profile + dropdown) at very bottom ─── */}
      {/* AccountMenu reads user data from useAuth() internally */}
      <AccountMenu tc={tc} />
    </aside>
  );
}
