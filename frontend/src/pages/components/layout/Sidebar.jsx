// ============================================================
// 📌 Sidebar — Minimal left navigation for RideWise
//
// INTENTIONALLY SIMPLE:
//   This sidebar only shows what's actually built and useful right now.
//   Future features (Riders feed, Map, etc.) will be added here later.
//
// CURRENT ITEMS:
//   🏍️ Logo → navigates to /home
//   🏠 Home → /home (active route highlighted)
//   👥 Riders → placeholder, no action (shows "SOON" badge)
//
// BOTTOM:
//   AccountMenu → shows avatar + name + email.
//   Click it to open a dropdown with: My Profile | Settings | Log out.
//   (Settings is only accessible via this dropdown — NOT a standalone nav item)
// ============================================================

import { useNavigate, useLocation } from "react-router-dom";
import AccountMenu from "../account/AccountMenu";

export default function Sidebar({ tc }) {
  const navigate  = useNavigate();
  const location  = useLocation();

  const isHome = location.pathname === "/home";

  return (
    <aside
      className={`hidden lg:flex fixed left-0 top-0 h-screen w-64 flex-col p-4 border-r ${tc.divider} bg-black/40 backdrop-blur-xl z-40`}
    >
      {/* ── Logo ──────────────────────────────────────────────── */}
      <div
        onClick={() => navigate("/home")}
        className="flex items-center gap-3 px-4 py-4 cursor-pointer group"
      >
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 ${tc.button} text-sm`}
        >
          <i className="fa fa-motorcycle" />
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
          className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-[1.02] ${
            isHome
              ? `${tc.button} shadow-lg`          // active = filled
              : `hover:bg-white/10 ${tc.text}`    // inactive = ghost
          }`}
        >
          <i className={`fa fa-home text-lg w-5 text-center`} />
          <span className="flex-1 text-left">Home</span>
        </button>

        {/* Riders — placeholder (feature coming soon, no action) */}
        {/* Rendered as a div (not button) so it's not focusable/clickable */}
        {/* Riders — active nav link */}
<button
  onClick={() => navigate("/riders")}
  className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-[1.02] ${
    location.pathname === "/riders"
      ? `${tc.button} shadow-lg`
      : `hover:bg-white/10 ${tc.text}`
  }`}
>
  <i className="fa fa-users text-lg w-5 text-center" />
  <span className="flex-1 text-left">Riders</span>
</button>

      </nav>

      {/* ── Account menu (profile + dropdown) at very bottom ─── */}
      {/* Contains: My Profile, Settings, Log out */}
      <AccountMenu tc={tc} />
    </aside>
  );
}
