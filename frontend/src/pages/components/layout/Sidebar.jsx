// ============================================================
// Sidebar — Minimal left navigation for RideWise
//
// INTENTIONALLY SIMPLE:
//   This sidebar only shows what's actually built and useful right now.
//   Future features (Riders feed, Map, etc.) will be added here later.
//
// CURRENT ITEMS:
//   Logo → navigates to /home
//   Home → /home (active route highlighted)
//   Riders → /riders (placeholder)
//
// BOTTOM:
//   AccountMenu → shows avatar + name + email.
//   Click it to open a dropdown with: My Profile | Settings | Log out.
//   (Settings is only accessible via this dropdown — NOT a standalone nav item)
// ============================================================

import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import AccountMenu from "../account/AccountMenu";
import Icon from "../ui/Icon";

export default function Sidebar({ tc }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { isAdmin } = useAuth();

  const isHome = location.pathname === "/home";

  return (
    <aside
      className={`hidden lg:flex fixed left-0 top-0 h-screen w-64 flex-col p-4 border-r ${tc.divider} ${tc.bar} z-40`}
    >
      {/* ── Logo ──────────────────────────────────────────────── */}
      <div
        onClick={() => navigate("/home")}
        className="flex items-center gap-3 px-4 py-4 cursor-pointer group"
      >
        <div
          className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-colors ${tc.button}`}
        >
          <Icon name="ride" size={20} />
        </div>
        <span className="text-xl font-black tracking-tight">
          Ride<span className="opacity-50">Wise</span>
        </span>
      </div>

      {/* ── Navigation ────────────────────────────────────────── */}
      <nav className="flex-1 mt-8 space-y-2">

        {/* Home — active nav item */}
        <button
          onClick={() => navigate("/home")}
          className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-semibold transition-colors ${
            isHome
              ? tc.navActive     // active = monochrome ink surface
              : tc.navIdle       // inactive = ghost
          }`}
        >
          <Icon name="home" size={20} />
          <span className="flex-1 text-left">Home</span>
        </button>

        {/* Riders — placeholder (feature coming soon, no action) */}
        {/* Rendered as a div (not button) so it's not focusable/clickable */}
        {/* Riders — active nav link */}
<button
  onClick={() => navigate("/riders")}
  className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-semibold transition-colors ${
    location.pathname === "/riders"
      ? tc.navActive
      : tc.navIdle
  }`}
>
  <Icon name="riders" size={20} />
  <span className="flex-1 text-left">Riders</span>
</button>

        {/* Admin — only visible for admin users */}
        {isAdmin && (
          <button
            onClick={() => navigate("/admin")}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-semibold transition-colors ${
              location.pathname.startsWith("/admin")
                ? tc.navActive
                : tc.navIdle
            }`}
          >
            <Icon name="shield" size={20} />
            <span className="flex-1 text-left">Admin</span>
          </button>
        )}

      </nav>

      {/* ── Account menu (profile + dropdown) at very bottom ─── */}
      {/* Contains: My Profile, Settings, Log out */}
      <AccountMenu tc={tc} />
    </aside>
  );
}
