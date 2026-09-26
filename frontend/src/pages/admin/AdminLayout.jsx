// ============================================================
// AdminLayout — Wrapper layout for all admin pages
//
// Provides a simple tab navigation (Dashboard, Users, Rides)
// and a "Back to RideWise" link. Uses the existing theme system.
// ============================================================
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../hooks/useTheme";
import Icon from "../components/ui/Icon";
import Button from "../components/ui/Button";
import MobileNav from "../components/layout/MobileNav";

export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, avatarLetter } = useAuth();
  // Pass user?.id so the admin panel uses the same saved theme as the app
  const { tc } = useTheme(user?.id);

  const tabs = [
    { path: "/admin",       label: "Dashboard", icon: "gauge" },
    { path: "/admin/users", label: "Users",     icon: "riders" },
    { path: "/admin/rides", label: "Rides",     icon: "road" },
  ];

  const isActive = (path) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(path);
  };

  return (
    <div className={`min-h-screen ${tc.bg} ${tc.text}`}>
      {/* ── Top Header ──────────────────────────────────────── */}
      <header className={`sticky top-0 z-50 border-b ${tc.divider} ${tc.bar}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo + Admin badge */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/admin")}
                className="flex items-center gap-2"
              >
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${tc.button}`}>
                  <Icon name="shield" size={18} />
                </span>
                <span className="text-lg font-bold tracking-tight">
                  Ride<span className={tc.sub}>Wise</span>
                </span>
              </button>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold tracking-wider ${tc.surface2} ${tc.sub} ${tc.divider}`}>
                ADMIN
              </span>
            </div>

            {/* Right: Back to app + user info */}
            <div className="flex items-center gap-4">
              <Button
                variant="secondary"
                size="sm"
                icon="arrowLeft"
                onClick={() => navigate("/home")}
                tc={tc}
              >
                <span className="hidden sm:inline">Back to RideWise</span>
                <span className="sm:hidden">Back</span>
              </Button>
              <div className="flex items-center gap-2">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${tc.button}`}>
                  {avatarLetter}
                </span>
                <span className="hidden sm:block text-sm font-medium truncate max-w-[120px]">
                  {user?.username || user?.email}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Tab Navigation ──────────────────────────────────── */}
      <nav className={`border-b ${tc.divider} ${tc.bar}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* overflow-x-auto + scrollbar-hide: the three tabs are ~330px wide in
              total, which overflows a 320–360px phone and used to scroll the
              WHOLE page sideways. Now only this strip scrolls — with no visible
              scrollbar — and it never overflows on tablet/desktop. */}
          <div className="flex gap-1 -mb-px overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const active = isActive(tab.path);
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className={`relative flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active ? `${tc.navActive} ${tc.text}` : tc.navIdle
                  }`}
                >
                  <Icon name={tab.icon} size={20} />
                  {tab.label}
                  {active && (
                    <span className={`absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-current ${tc.accent}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* ── Page Content ──────────────────────────────────────── */}
      {/* pb-28 on mobile keeps the last row of a table above the bottom
          navigation bar (which is 64px tall + the elevated ride button). */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 lg:pb-6">
        {children}
      </main>

      {/* ── Bottom navigation (mobile) ───────────────────────── */}
      {/* Same bar as every other page, so an admin can jump to Home,
          Riders, Account or start a ride without leaving the panel. */}
      <MobileNav tc={tc} />
    </div>
  );
}
